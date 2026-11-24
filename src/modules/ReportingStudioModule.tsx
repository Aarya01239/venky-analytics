import React, { useMemo, useState } from 'react';
import { Download, Sparkles, Loader2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  exportRowsToCsv,
  exportRowsToXlsx,
  exportStructuredDocx,
  exportStructuredPdf,
} from '../utils/exporters';

const REPORT_TYPES = [
  'Daily MIS Report',
  'Weekly Performance Report',
  'Monthly Business Review (MBR)',
  'Sales Performance Report',
  'Marketing Campaign Report',
  'Operations SLA & Quality Report',
  'Executive KPI Summary',
  'Statistical Diagnostics Report',
];

export const ReportingStudioModule: React.FC = () => {
  const { datasets, activeDatasetId, setActiveDatasetId, activeDatasetRows, aiLanguage, pushNotification } = useWorkspace();

  const [reportType, setReportType] = useState(REPORT_TYPES[2]);
  const [reportTitle, setReportTitle] = useState('Monthly Business Performance & KPI Pack');
  const [executiveSummary, setExecutiveSummary] = useState(
    'This report consolidates verified metrics computed directly from the active workspace dataset. Review the summary KPIs and dimension breakdown below.'
  );
  const [recommendations, setRecommendations] = useState(
    '1. Audit top variance drivers identified in the breakdown table.\n2. Standardize weekly data quality validation before executive distribution.\n3. Track cohort and regional margin trends over the next 4-week cycle.'
  );
  const [drafting, setDrafting] = useState(false);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const columns = useMemo(() => (activeDatasetRows[0] ? Object.keys(activeDatasetRows[0]) : []), [activeDatasetRows]);
  const numCols = useMemo(() => columns.filter((c) => typeof activeDatasetRows[0]?.[c] === 'number'), [columns, activeDatasetRows]);
  const catCols = useMemo(() => columns.filter((c) => !numCols.includes(c)), [columns, numCols]);

  const groupCol = catCols[1] || catCols[0] || '';
  const summaryTable = useMemo(() => {
    if (!groupCol || !activeDatasetRows.length) return [];
    const targetNums = numCols.slice(0, 3);
    const map: Record<string, { count: number; sums: Record<string, number> }> = {};
    for (const r of activeDatasetRows) {
      const k = String(r[groupCol] ?? 'Other');
      if (!map[k]) {
        map[k] = { count: 0, sums: {} };
        for (const nc of targetNums) map[k].sums[nc] = 0;
      }
      map[k].count++;
      for (const nc of targetNums) map[k].sums[nc] += Number(r[nc]) || 0;
    }
    return Object.entries(map)
      .map(([group, val]) => {
        const row: Record<string, any> = { [groupCol]: group, records: val.count };
        for (const nc of targetNums) row[`sum_${nc}`] = Math.round(val.sums[nc] * 100) / 100;
        return row;
      })
      .sort((a, b) => b.records - a.records)
      .slice(0, 15);
  }, [activeDatasetRows, groupCol, numCols]);

  const draftWithGemini = async () => {
    if (!activeDs || drafting) return;
    setDrafting(true);
    try {
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'report',
          language: aiLanguage,
          prompt: `Draft a crisp Executive Summary and 3 concrete Business Recommendations for a "${reportType}" based ONLY on this verified summary table from "${activeDs.name}":\n${JSON.stringify(
            summaryTable.slice(0, 10)
          )}\nSeparate the output clearly into Executive Summary and Recommendations.`,
          context: { module: 'reporting', datasetName: activeDs.name },
        }),
      });
      const data = await res.json();
      if (res.ok && data.text) {
        const parts = data.text.split(/recommendations/i);
        setExecutiveSummary(parts[0].trim());
        if (parts[1]) setRecommendations(parts[1].replace(/^[:\s-]+/, '').trim());
        pushNotification('Executive Draft Ready', 'Commentary drafted from verified summary table.', 'success');
      } else {
        pushNotification('Gemini API Error', data.error || `Request failed (HTTP ${res.status}).`, 'error');
      }
    } catch (err: any) {
      pushNotification('Network Error', err?.message || 'Unable to reach Gemini AI endpoint.', 'error');
    } finally {
      setDrafting(false);
    }
  };

  const tableCols = summaryTable[0] ? Object.keys(summaryTable[0]) : [];

  return (
    <div className="p-6 max-w-[1380px] mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Reporting Studio (MIS &amp; Executive Packs)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Assemble verified dataset summary tables, executive commentary, and export production-ready PDF, DOCX, XLSX, and CSV reports.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() =>
              exportStructuredPdf({
                title: reportTitle,
                subtitle: `${reportType} · Source: ${activeDs?.name || 'Dataset'} · ${new Date().toLocaleDateString()}`,
                sections: [
                  { heading: 'Executive Summary', body: executiveSummary },
                  { heading: 'Business Recommendations', body: recommendations },
                ],
                table: {
                  title: `Verified Summary by ${groupCol}`,
                  columns: tableCols,
                  rows: summaryTable.map((r) => tableCols.map((c) => r[c])),
                },
                filename: `${reportTitle.replace(/[^a-z0-9]+/gi, '_')}.pdf`,
              })
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            onClick={() =>
              exportStructuredDocx({
                title: reportTitle,
                subtitle: `${reportType} · Source: ${activeDs?.name}`,
                sections: [
                  { heading: 'Executive Summary', body: executiveSummary },
                  { heading: 'Verified Breakdown Table', body: summaryTable.map((r) => JSON.stringify(r)).join('\n') },
                  { heading: 'Recommendations', body: recommendations },
                ],
                filename: `${reportTitle.replace(/[^a-z0-9]+/gi, '_')}.docx`,
              })
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOCX</span>
          </button>
          <button
            onClick={() => exportRowsToXlsx(summaryTable, `${reportTitle.replace(/[^a-z0-9]+/gi, '_')}.xlsx`, 'MIS_Summary')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>XLSX</span>
          </button>
          <button
            onClick={() => exportRowsToCsv(summaryTable, `${reportTitle.replace(/[^a-z0-9]+/gi, '_')}.csv`)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Report Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
        <div className="lg:col-span-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 mb-1">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
              >
                {REPORT_TYPES.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Source Dataset</label>
              <select
                value={activeDatasetId}
                onChange={(e) => setActiveDatasetId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
              >
                {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Report Title</label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] font-medium"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Executive Commentary</span>
            <button
              onClick={draftWithGemini}
              disabled={drafting}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            >
              {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              <span>Draft from Verified Table</span>
            </button>
          </div>

          <textarea
            rows={5}
            value={executiveSummary}
            onChange={(e) => setExecutiveSummary(e.target.value)}
            className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
          />

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Recommendations</label>
            <textarea
              rows={4}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
            />
          </div>
        </div>

        {/* Live Report Preview */}
        <div className="lg:col-span-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-6 space-y-5">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="text-[11px] text-slate-500">{reportType} · {new Date().toLocaleDateString()}</div>
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 mt-0.5">{reportTitle}</h2>
            <div className="text-[11px] text-slate-500 mt-1">
              Dataset: {activeDs?.name} ({activeDatasetRows.length} rows)
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Executive Summary</h3>
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{executiveSummary}</p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Verified Aggregated Table (by {groupCol})</h3>
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {tableCols.map((c) => (
                      <th key={c} className="px-3 py-2 font-mono font-semibold">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {summaryTable.map((row, i) => (
                    <tr key={i}>
                      {tableCols.map((c) => (
                        <td key={c} className={`px-3 py-1.5 ${typeof row[c] === 'number' ? 'font-mono tabular-nums text-right' : ''}`}>
                          {typeof row[c] === 'number' ? row[c].toLocaleString() : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Actionable Recommendations</h3>
            <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{recommendations}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
