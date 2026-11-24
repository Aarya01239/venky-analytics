import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Send, Trash2, X, Sparkles, Loader2 } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { AiLanguage, AiMode } from '../../types/os';

interface ChatMsg {
  id: string;
  role: 'user' | 'model';
  text: string;
  error?: boolean;
}

const AI_MODES: { id: AiMode; label: string }[] = [
  { id: 'analyst', label: 'Analyst' },
  { id: 'learn', label: 'Learn' },
  { id: 'practice', label: 'Practice' },
  { id: 'interview', label: 'Interview' },
  { id: 'report', label: 'Report' },
];

const QUICK_PROMPTS: Record<string, string[]> = {
  sql: [
    'Write a window-function SQL query for the active dataset',
    'Explain how to optimize my active SQL query',
    'Create 3 SQL practice questions on this dataset',
  ],
  excel: [
    'Suggest the best SUMIFS and INDEX/MATCH formulas for this dataset',
    'Design a Pivot Table structure for executive review',
    'Explain XLOOKUP vs VLOOKUP in Telugu + English',
  ],
  python: [
    'Generate Pandas EDA and Matplotlib code for the active dataset',
    'Write outlier detection code using IQR in Python',
    'Explain my active Python code step by step',
  ],
  statistics: [
    'Which hypothesis test fits my active dataset and what are its assumptions?',
    'Explain Sample vs Population variance with a business example in Telugu',
    'Interpret the latest statistical test output',
  ],
  ba: [
    'Draft acceptance criteria and edge cases for this BRD',
    'Suggest stakeholder RACI roles and KPI governance checks',
  ],
  default: [
    'Suggest top 5 KPIs to track on the active dataset',
    'Draft an executive summary structure for this dataset',
    'Ask me a challenging interview question for my active career track',
  ],
};

export const GeminiPanel: React.FC = () => {
  const {
    aiOpen,
    setAiOpen,
    aiMode,
    setAiMode,
    aiLanguage,
    setAiLanguage,
    aiContext,
    pendingAiPrompt,
    clearPendingAiPrompt,
  } = useWorkspace();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMsg = { id: `u_${Date.now()}`, role: 'user', text: trimmed };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          mode: aiMode,
          language: aiLanguage,
          context: aiContext,
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gemini AI request failed.');
      }
      setMessages((prev) => [
        ...prev,
        { id: `m_${Date.now()}`, role: 'model', text: data.text || 'No response received.' },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'model',
          text: err?.message || 'Could not reach Gemini AI backend.',
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (aiOpen && pendingAiPrompt) {
      const p = pendingAiPrompt;
      clearPendingAiPrompt();
      sendPrompt(p);
    }
  }, [aiOpen, pendingAiPrompt]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  if (!aiOpen) return null;

  const suggestions = QUICK_PROMPTS[aiContext.module] || QUICK_PROMPTS.default;

  return (
    <aside className="fixed inset-y-0 right-0 z-40 shadow-2xl lg:static lg:shadow-none w-[410px] max-w-[92vw] shrink-0 h-screen flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
            Gemini Analytics Assistant
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMessages([])}
            title="Clear conversation"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setAiOpen(false)}
            title="Close AI panel"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode & Language Controls */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0 bg-slate-50/70 dark:bg-[#0B111A]/60">
        <div className="flex items-center gap-1 overflow-x-auto">
          {AI_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setAiMode(m.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                aiMode === m.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span className="truncate">
            Context: <strong className="text-slate-700 dark:text-slate-200">{aiContext.module}</strong>
            {aiContext.datasetName ? ` · ${aiContext.datasetName.split(' (')[0]}` : ''}
          </span>
          <select
            aria-label="Response language"
            value={aiLanguage}
            onChange={(e) => setAiLanguage(e.target.value as AiLanguage)}
            className="bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none shrink-0 ml-2"
          >
            <option value="english" className="bg-white dark:bg-slate-900">English</option>
            <option value="telugu" className="bg-white dark:bg-slate-900">Telugu (తెలుగు)</option>
            <option value="bilingual" className="bg-white dark:bg-slate-900">English + Telugu</option>
          </select>
        </div>
      </div>

      {/* Conversation Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Connected to your active workspace, dataset schema, and tool outputs. Computations are always distinguished from AI interpretations.
            </p>
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-500">Contextual prompts</div>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendPrompt(s)}
                  className="w-full text-left px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`text-[13px] leading-relaxed ${
                m.role === 'user'
                  ? 'ml-8 px-3 py-2 rounded-lg bg-blue-600 text-white'
                  : m.error
                  ? 'px-3 py-2 rounded-lg border border-red-300 dark:border-red-900/70 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                  : 'text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/80 pb-3'
              }`}
            >
              {m.role === 'user' ? (
                <div className="whitespace-pre-wrap">{m.text}</div>
              ) : (
                <div>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:p-2.5 prose-pre:rounded-md prose-code:text-blue-600 dark:prose-code:text-blue-300 prose-table:text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                  </div>
                  <div className="mt-2 flex items-center justify-end">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(m.text);
                        setCopiedId(m.id);
                        setTimeout(() => setCopiedId(null), 1500);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      {copiedId === m.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === m.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
            <span>Analyzing workspace context...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendPrompt(input);
        }}
        className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendPrompt(input);
              }
            }}
            placeholder="Ask SQL, Excel, Python, Stats, BA, or Telugu explanation..."
            className="flex-1 resize-none rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="p-2.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition-colors shrink-0"
            aria-label="Send prompt"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
};
