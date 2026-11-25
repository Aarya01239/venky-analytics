import { CreateWebWorkerMLCEngine } from '@mlc-ai/web-llm';

const model = 'SmolLM2-135M-Instruct-q0f16-MLC';

export interface BrowserTutor {
  ask(prompt: string, module: string): Promise<string>;
  close(): void;
}

export async function loadBrowserTutor(onProgress: (percent: number) => void, signal: AbortSignal): Promise<BrowserTutor> {
  signal.throwIfAborted();

  const worker = new Worker(new URL('./browserTutor.worker.ts', import.meta.url), { type: 'module' });
  const stop = () => worker.terminate();
  let onAbort: () => void = stop;
  let onWorkerError: () => void = stop;
  try {
    const engine = await Promise.race([
      CreateWebWorkerMLCEngine(worker, model, {
        initProgressCallback: report => onProgress(Math.round(report.progress * 100)),
      }),
      new Promise<never>((_, reject) => {
        onAbort = () => { stop(); reject(signal.reason); };
        signal.addEventListener('abort', onAbort, { once: true });
        onWorkerError = () => reject(new Error('Could not start the browser worker. Offline practice is still available.'));
        worker.addEventListener('error', onWorkerError, { once: true });
      }),
    ]);
    return {
      async ask(prompt, module) {
        const result = await engine.chat.completions.create({
          messages: [
            { role: 'system', content: `You are a concise English analytics study tutor. The current module is ${module}. Explain concepts with simple examples. Say when unsure.` },
            { role: 'user', content: prompt.slice(0, 3000) },
          ],
          max_tokens: 192,
        });
        const reply = result.choices[0]?.message.content?.trim();
        if (!reply) throw new Error('Browser model produced no answer.');
        return reply;
      },
      close: stop,
    };
  } catch (error) {
    stop();
    throw error;
  } finally {
    signal.removeEventListener('abort', onAbort);
    worker.removeEventListener('error', onWorkerError);
  }
}
