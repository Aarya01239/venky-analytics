import React, { useState } from 'react';
import * as ss from 'simple-statistics';
import { Play, CheckCircle2, Loader2, Sparkles, Download } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportStructuredPdf } from '../utils/exporters';

interface StepLog {
  step: string;
  status: 'idle' | 'running' | 'done' | 'error';
  detail: string;
}

export const AiAutomationModule: React.FC = () => {
  const { datasets, activeDatasetId, setActiveDatasetId, aiLanguage } = useWorkspace();

  const [includeAiBrief, setIncludeAiBrief] = useState(true);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [briefText, setBriefText] = useState('');

  const activeDs = datasets.find((d) => d.id === activeDatasetId);

  const runEndToEndPipeline = async () => {
    if (!activeDs || running) return;
    setRunning(true);
    setBriefText('');
    const initial: StepLog[] = [
      { step: '1. Ingest & Validate Schema', status: 'running', detail: `Reading table "${activeDs.table_name}"...` },
      { step: '2. Automated Data Quality Audit', status: 'idle', detail: 'Pending' },
      { step: '3. Statistical Numeric Profiling', status: 'idle', detail: 'Pending' },
      { step: '4. Grounded Gemini Executive Synthesis', status: 'idle', detail: includeAiBrief ? 'Pending' : 'Skipped by user' },
    ];
    setLogs(initial);

    try {
      // Step 1: Fetch rows
      const res = await fetch(`/api/datasets/${encodeURIComponent(activeDs.id)}/rows?limit=2000`);
      const data = await res.json();
      const rows: Record<string, any>[] = data.rows || [];
      const cols = rows[0] ? Object.keys(rows[0]) : [];
      setLogs((prev) =>
        prev.map((l, i) =>
          i === 0
            ? { ...l, status: 'done', detail: `Verified ${rows.length} rows and ${cols.length} columns.` }
            : i === 1
            ? { ...l, status: 'running', detail: 'Scanning nulls and exact duplicates...' }
            : l
        )
      );

      // Step 2: Quality Audit
      const seen = new Set<string>();
      let dupes = 0;
      let nulls = 0;
      for (const r of rows) {
        const k = JSON.stringify(r);
        if (seen.has(k)) dupes++;
        seen.add(k);
        for (const c of cols) {
          if (r[c] === null || r[c] === undefined || String(r[c]).trim() === '') nulls++;
        }
      }
      const qaDetail = `Duplicates: ${dupes} | Null/Empty Cells: ${nulls} (${(
        (nulls / Math.max(1, rows.length * cols.length)) *
        100
      ).toFixed(2)}%)`;

      setLogs((prev) =>
        prev.map((l, i) =>
          i === 1
            ? { ...l, status: 'done', detail: qaDetail }
            : i === 2
            ? { ...l, status: 'running', detail: 'Computing means, medians, SD, and IQR outliers...' }
            : l
        )
      );

      // Step 3: Stats summary
      const numSummaries: string[] = [];
      for (const c of cols) {
        const nums = rows.map((r) => Number(r[c])).filter((v) => Number.isFinite(v));
        if (nums.length >= 4 && nums.length / rows.length > 0.7) {
          const sorted = [...nums].sort((a, b) => a - b);
          const mean = ss.mean(nums);
          const median = ss.medianSorted(sorted);
          const q1 = ss.quantileSorted(sorted, 0.25);
          const q3 = ss.quantileSorted(sorted, 0.75);
          const iqr = q3 - q1;
          const outliers = nums.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;
          numSummaries.push(
            `${c}: sum=${nums.reduce((a, b) => a + b, 0).toFixed(1)}, mean=${mean.toFixed(2)}, median=${median.toFixed(2)}, outliers=${outliers}`
          );
        }
      }
      const statsDetail = numSummaries.slice(0, 6).join(' | ') || 'No numeric columns detected.';

      setLogs((prev) =>
        prev.map((l, i) =>
          i === 2
            ? { ...l, status: 'done', detail: statsDetail }
            : i === 3 && includeAiBrief
            ? { ...l, status: 'running', detail: 'Generating grounded executive brief via Gemini API...' }
            : l
        )
      );

      // Step 4: Gemini Brief
      if (includeAiBrief) {
        const aiRes = await fetch('/api/ai/assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'report',
            language: aiLanguage,
            prompt: `Generate a concise Automated Data QA & Executive Brief for dataset "${activeDs.name}".\nVERIFIED PIPELINE COMPUTATIONS:\n- Rows: ${rows.length}, Columns: ${cols.join(', ')}\n- Quality Audit: ${qaDetail}\n- Numeric Profiles:\n${numSummaries.join('\n')}\n\nHighlight: (1) Data Readiness Verdict, (2) Key Numeric Findings from the verified metrics above, (3) Recommended Next SQL/BI Actions.`,
            context: { module: 'automation', datasetName: activeDs.name },
          }),
        });
        const aiData = await aiRes.json();
        if (!aiRes.ok) throw new Error(aiData.error || 'Gemini step failed');
        setBriefText(aiData.text || '');
        setLogs((prev) =>
          prev.map((l, i) => (i === 3 ? { ...l, status: 'done', detail: 'Executive brief synthesized from verified metrics.' } : l))
        );
      }
    } catch (err: any) {
      setLogs((prev) =>
        prev.map((l) => (l.status === 'running' ? { ...l, status: 'error', detail: err?.message || 'Step failed' } : l))
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 max-w-[1360px] mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            AI &amp; Automation Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Run repeatable, multi-step automated data quality, statistical profiling, and grounded Gemini executive briefing workflows on any dataset.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeDatasetId}
            onChange={(e) => setActiveDatasetId(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] text-xs"
          >
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={includeAiBrief} onChange={(e) => setIncludeAiBrief(e.target.checked)} />
            <span>Include Gemini Brief</span>
          </label>
          <button
            onClick={runEndToEndPipeline}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>Run Automated Pipeline</span>
          </button>
        </div>
      </div>

      {/* Pipeline Run Steps */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-3">
        <h2 className="text-sm font-display font-semibold">Pipeline Execution Log</h2>
        {logs.length === 0 ? (
          <div className="text-xs text-slate-500 py-4">
            Select a dataset and click <strong>Run Automated Pipeline</strong> to execute schema validation, QA duplicate/null scan, statistical profiling, and AI synthesis.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {logs.map((l) => (
              <div key={l.step} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{l.step}</div>
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-400">{l.detail}</div>
                </div>
                <span className="shrink-0 font-mono text-[11px]">
                  {l.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {l.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                  {l.status === 'error' && <span className="text-red-500">Error</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {briefText && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display font-semibold text-sm">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>Automated Executive Synthesis</span>
            </div>
            <button
              onClick={() =>
                exportStructuredPdf({
                  title: `Automated Pipeline Report — ${activeDs?.name}`,
                  subtitle: `Generated ${new Date().toLocaleString()}`,
                  sections: [
                    ...logs.map((l) => ({ heading: l.step, body: l.detail })),
                    { heading: 'Gemini Executive Brief', body: briefText },
                  ],
                  filename: `pipeline_${activeDs?.table_name}.pdf`,
                })
              }
              className="inline-flex items-center gap-1 px-3 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PDF</span>
            </button>
          </div>
          <pre className="whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
            {briefText}
          </pre>
        </div>
      )}
    </div>
  );
};
