import { GoogleGenAI } from '@google/genai';

let cachedClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error('GEMINI_API_KEY is not configured in server environment variables. Configure it in Settings > Secrets.'),
      { statusCode: 503 }
    );
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export interface GeminiAssistRequest {
  prompt: string;
  mode: 'learn' | 'practice' | 'analyst' | 'interview' | 'report';
  language: 'english' | 'telugu' | 'bilingual';
  context?: {
    module?: string;
    careerTrack?: string;
    datasetName?: string;
    datasetColumns?: string[];
    sampleSummary?: string;
    activeCode?: string;
    activeProject?: string;
    recentOutput?: string;
  };
  history?: { role: 'user' | 'model'; text: string }[];
}

export interface GeminiAssistResult {
  text: string;
  model: string;
}

function isTransientError(err: any): boolean {
  const msg = String(err?.message || '').toLowerCase();
  const status = Number(err?.status || err?.code || 0);
  return status === 503 || status === 429 || msg.includes('503') || msg.includes('high demand') || msg.includes('unavailable');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runGeminiAssistant(req: GeminiAssistRequest): Promise<GeminiAssistResult> {
  const ai = getAiClient();

  const modeDirectives: Record<string, string> = {
    learn:
      'Act as a Principal Data Analyst & Statistics Tutor. Teach step-by-step with crystal clarity, explicit formulas, assumptions (always distinguish sample vs population statistics when relevant), and a practical business example.',
    practice:
      'Act as an interactive Analytics Coach. Give guided hints, review the user code/formula/answer, highlight edge cases, and suggest follow-up drills.',
    analyst:
      'Act as a Principal Business Intelligence & Data Analyst. Be concise, direct, production-grade, and ROI-focused. Provide optimized SQL, Python (Pandas/NumPy/Matplotlib), Excel, or DAX code with clear business context.',
    interview:
      'Act as a Senior Hiring Manager for Analytics roles. Ask sharp follow-up questions, evaluate answers against a structured rubric (Technical Accuracy, Business Framing, Edge Cases, Communication), and give concrete improvement advice.',
    report:
      'Act as an Executive Analytics Lead drafting stakeholder-ready business summaries, MIS commentary, KPI highlights, risks, and actionable recommendations.',
  };

  const langDirectives: Record<string, string> = {
    english: 'Respond in clear, professional English.',
    telugu:
      'Respond primarily in clear, natural Telugu (తెలుగు) using standard English technical terms (like JOIN, p-value, DAX, Variance, ROI) so it is practical for working analysts.',
    bilingual:
      'Respond in clear professional English followed by a concise, practical Telugu (తెలుగు) summary explanation for key concepts and business takeaways.',
  };

  const ctx = req.context || {};
  const contextLines = [
    ctx.module ? `Active Module: ${ctx.module}` : null,
    ctx.careerTrack ? `Target Career Track: ${ctx.careerTrack}` : null,
    ctx.activeProject ? `Active Project: ${ctx.activeProject}` : null,
    ctx.datasetName ? `Active Dataset: ${ctx.datasetName}` : null,
    ctx.datasetColumns?.length ? `Dataset Columns: ${ctx.datasetColumns.join(', ')}` : null,
    ctx.sampleSummary ? `Verified Computed Summary:\n${ctx.sampleSummary}` : null,
    ctx.activeCode ? `User Active Code / Formula:\n\`\`\`\n${ctx.activeCode.slice(0, 2500)}\n\`\`\`` : null,
    ctx.recentOutput ? `Recent Engine Output:\n${ctx.recentOutput.slice(0, 1500)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const systemInstruction = [
    'You are the integrated AI Analyst Engine inside Venky Analytics OS.',
    modeDirectives[req.mode] || modeDirectives.analyst,
    langDirectives[req.language] || langDirectives.english,
    'CRITICAL INTEGRITY RULES:',
    '1. Always distinguish clearly between Verified Computed Values (from SQL, Python, Excel, or Statistics engines) and your analytical interpretations/hypotheses.',
    '2. NEVER fabricate or hallucinate numerical results, dataset rows, or fake citations. If a calculation has not been computed yet, provide the exact SQL/Python/Excel/DAX query to compute it.',
    '3. Keep outputs well-structured with clean markdown tables, code blocks, and business impact explanations.',
    contextLines ? `\n--- LIVE WORKSPACE CONTEXT ---\n${contextLines}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const priorTurns = (req.history || []).slice(-8).map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  const contents = [...priorTurns, { role: 'user', parts: [{ text: req.prompt }] }];

  // Retry gemini-4-hydrogen with exponential backoff, falling back to gemini-3.1-flash-lite on persistent 503 overload
  const attempts: { model: string; delayMs: number }[] = [
    { model: 'gemini-4-hydrogen', delayMs: 0 },
    { model: 'gemini-4-hydrogen', delayMs: 700 },
    { model: 'gemini-3.1-flash-lite', delayMs: 300 },
  ];

  let lastError: any = null;
  for (const step of attempts) {
    if (step.delayMs > 0) await sleep(step.delayMs);
    try {
      const response = await ai.models.generateContent({
        model: step.model,
        contents,
        config: { systemInstruction },
      });
      return {
        text: response.text || 'No response text was returned by Gemini.',
        model: step.model,
      };
    } catch (err: any) {
      lastError = err;
      if (!isTransientError(err)) {
        break;
      }
    }
  }

  const rawMsg = String(lastError?.message || 'Gemini AI request failed.');
  if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED') || lastError?.status === 403) {
    throw Object.assign(
      new Error('Gemini API key is invalid or unauthorized. Please check GEMINI_API_KEY in Settings > Secrets.'),
      { statusCode: 403 }
    );
  }
  if (rawMsg.includes('RESOURCE_EXHAUSTED') || lastError?.status === 429) {
    throw Object.assign(
      new Error('Gemini API quota exceeded (429). Wait briefly or configure a billing-enabled key in Settings > Secrets.'),
      { statusCode: 429 }
    );
  }
  if (isTransientError(lastError)) {
    throw Object.assign(
      new Error('Gemini API is temporarily experiencing high demand (503). Please retry in a few seconds.'),
      { statusCode: 503 }
    );
  }
  throw Object.assign(new Error(rawMsg), { statusCode: 500 });
}
