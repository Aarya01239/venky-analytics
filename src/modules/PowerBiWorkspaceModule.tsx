import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Sparkles, Play, Info, Download } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportTextFile } from '../utils/exporters';

function evaluateDaxOnRows(expr: string, rows: Record<string, any>[]): { value: string; explanation: string } {
  if (!rows.length) return { value: '0', explanation: 'No dataset rows loaded.' };
  const clean = expr.trim().replace(/^[^=]+=\s*/, '');

  const evalSimpleAgg = (fn: string, col: string, subset: Record<string, any>[]): number => {
    const cleanCol = col.replace(/^.*\[([^\]]+)\]$/, '$1').trim();
    if (fn === 'COUNT') return subset.filter((r) => r[cleanCol] !== null && r[cleanCol] !== undefined).length;
    if (fn === 'DISTINCTCOUNT') return new Set(subset.map((r) => r[cleanCol])).size;
    const nums = subset.map((r) => Number(r[cleanCol])).filter((v) => Number.isFinite(v));
    if (!nums.length) return 0;
    if (fn === 'SUM') return nums.reduce((a, b) => a + b, 0);
    if (fn === 'AVERAGE') return nums.reduce((a, b) => a + b, 0) / nums.length;
    if (fn === 'MAX') return Math.max(...nums);
    if (fn === 'MIN') return Math.min(...nums);
    return 0;
  };

  // DIVIDE(agg1, agg2, alt)
  const divMatch = clean.match(/^DIVIDE\s*\(\s*(SUM|AVERAGE|COUNT|DISTINCTCOUNT)\(([^)]+)\)\s*,\s*(SUM|AVERAGE|COUNT|DISTINCTCOUNT)\(([^)]+)\)\s*(?:,\s*([^)]+))?\)$/i);
  if (divMatch) {
    const num = evalSimpleAgg(divMatch[1].toUpperCase(), divMatch[2], rows);
    const den = evalSimpleAgg(divMatch[3].toUpperCase(), divMatch[4], rows);
    const res = den === 0 ? Number(divMatch[5] || 0) : num / den;
    return {
      value: `${(res * 100).toFixed(2)}% (raw: ${res.toFixed(4)})`,
      explanation: `Evaluated safe ratio DIVIDE(${num.toFixed(2)}, ${den.toFixed(2)}) across ${rows.length} rows.`,
    };
  }

  // CALCULATE(AGG(col), tbl[filterCol] = "val")
  const calcMatch = clean.match(/^CALCULATE\s*\(\s*(SUM|AVERAGE|COUNT|DISTINCTCOUNT)\(([^)]+)\)\s*,\s*([^=<>]+)\s*=\s*["']([^"']+)["']\s*\)$/i);
  if (calcMatch) {
    const filterCol = calcMatch[3].replace(/^.*\[([^\]]+)\]$/, '$1').trim();
    const filterVal = calcMatch[4];
    const filtered = rows.filter((r) => String(r[filterCol] ?? '').toLowerCase() === filterVal.toLowerCase());
    const val = evalSimpleAgg(calcMatch[1].toUpperCase(), calcMatch[2], filtered);
    return {
      value: val.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      explanation: `Applied filter context [${filterCol}] = "${filterVal}" (${filtered.length} matching rows).`,
    };
  }

  // Simple AGG(col)
  const aggMatch = clean.match(/^(SUM|AVERAGE|COUNT|DISTINCTCOUNT|MAX|MIN)\s*\(\s*([^)]+)\s*\)$/i);
  if (aggMatch) {
    const val = evalSimpleAgg(aggMatch[1].toUpperCase(), aggMatch[2], rows);
    return {
      value: val.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      explanation: `Evaluated ${aggMatch[1].toUpperCase()} across ${rows.length} rows in current filter context.`,
    };
  }

  return {
    value: 'Syntax Ready for Power BI Desktop',
    explanation:
      'Browser DAX evaluator natively computes SUM, AVERAGE, COUNT, DISTINCTCOUNT, MAX, MIN, DIVIDE(agg, agg), and CALCULATE(agg, col="val"). Complex Time-Intelligence expressions (e.g., SAMEPERIODLASTYEAR) can be validated with Gemini AI and pasted directly into Microsoft Power BI Desktop.',
  };
}

export const PowerBiWorkspaceModule: React.FC = () => {
  const { datasets, activeDatasetId, setActiveDatasetId, activeDatasetRows, askGeminiWithPrompt } = useWorkspace();
  const [subTab, setSubTab] = useState<'dashboard' | 'dax' | 'model' | 'pbix'>('dashboard');

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const tbl = activeDs?.table_name || 'retail_sales';

  const [daxCode, setDaxCode] = useState(`Gross Margin % = DIVIDE(SUM(retail_sales[profit]), SUM(retail_sales[revenue]), 0)`);
  const [daxOut, setDaxOut] = useState<{ value: string; explanation: string } | null>(null);
  const [slicerVal, setSlicerVal] = useState<string>('ALL');

  const columns = useMemo(() => (activeDatasetRows[0] ? Object.keys(activeDatasetRows[0]) : []), [activeDatasetRows]);
  const numCols = useMemo(() => columns.filter((c) => typeof activeDatasetRows[0]?.[c] === 'number'), [columns, activeDatasetRows]);
  const catCols = useMemo(() => columns.filter((c) => !numCols.includes(c)), [columns, numCols]);

  const slicerCol = catCols[1] || catCols[0] || '';
  const dimCol = catCols[2] || catCols[1] || catCols[0] || '';
  const primaryMetric = numCols.includes('revenue') ? 'revenue' : numCols[numCols.length - 1] || '';
  const secondaryMetric = numCols.includes('profit') ? 'profit' : numCols[0] || '';

  const slicerOptions = useMemo(
    () => (slicerCol ? Array.from(new Set(activeDatasetRows.map((r) => String(r[slicerCol] ?? '')))).slice(0, 12) : []),
    [activeDatasetRows, slicerCol]
  );

  const slicedRows = useMemo(() => {
    if (!slicerCol || slicerVal === 'ALL') return activeDatasetRows;
    return activeDatasetRows.filter((r) => String(r[slicerCol] ?? '') === slicerVal);
  }, [activeDatasetRows, slicerCol, slicerVal]);

  const chartData = useMemo(() => {
    if (!dimCol || !primaryMetric) return [];
    const map: Record<string, { primary: number; secondary: number }> = {};
    for (const r of slicedRows) {
      const k = String(r[dimCol] ?? 'Other');
      if (!map[k]) map[k] = { primary: 0, secondary: 0 };
      map[k].primary += Number(r[primaryMetric]) || 0;
      if (secondaryMetric) map[k].secondary += Number(r[secondaryMetric]) || 0;
    }
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        primary: Math.round(v.primary * 100) / 100,
        secondary: Math.round(v.secondary * 100) / 100,
      }))
      .sort((a, b) => b.primary - a.primary)
      .slice(0, 10);
  }, [slicedRows, dimCol, primaryMetric, secondaryMetric]);

  const totalPrimary = useMemo(() => slicedRows.reduce((a, r) => a + (Number(r[primaryMetric]) || 0), 0), [slicedRows, primaryMetric]);
  const totalSecondary = useMemo(() => slicedRows.reduce((a, r) => a + (Number(r[secondaryMetric]) || 0), 0), [slicedRows, secondaryMetric]);

  const daxTemplates = [
    { name: 'Total Metric', code: `Total ${primaryMetric} = SUM(${tbl}[${primaryMetric}])` },
    { name: 'Safe Ratio (DIVIDE)', code: `Ratio % = DIVIDE(SUM(${tbl}[${secondaryMetric}]), SUM(${tbl}[${primaryMetric}]), 0)` },
    {
      name: 'CALCULATE Filter',
      code: `Filtered ${primaryMetric} = CALCULATE(SUM(${tbl}[${primaryMetric}]), ${tbl}[${slicerCol}] = "${slicerOptions[0] || 'North'}")`,
    },
    { name: 'Distinct Keys', code: `Unique Records = DISTINCTCOUNT(${tbl}[${columns[0] || 'order_id'}])` },
  ];

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Power BI Compatible Workspace
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Browser-based BI dashboard builder, Star Schema modeling, live DAX measure evaluation, and Microsoft Power BI Desktop (.pbix) integration workflow.
          </p>
        </div>

        <select
          value={activeDatasetId}
          onChange={(e) => {
            setActiveDatasetId(e.target.value);
            setSlicerVal('ALL');
          }}
          className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] text-xs"
        >
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Transparency Notice */}
      <div className="rounded-md border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-500 shrink-0" />
        <span>
          <strong>Compatibility Notice:</strong> Venky Analytics OS provides a browser-native BI &amp; DAX learning/prototyping studio. It does not replace Microsoft Power BI Desktop (.pbix proprietary binary format); use the Power BI Desktop Integration tab to export your DAX measures, Power Query M script, and cleaned CSV directly into Power BI Desktop.
        </span>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0F1722] border border-slate-200 dark:border-slate-800 w-fit text-xs">
        {[
          { id: 'dashboard', label: 'Interactive BI Canvas' },
          { id: 'dax', label: 'DAX Formula Lab' },
          { id: 'model', label: 'Star Schema Modeler' },
          { id: 'pbix', label: 'Power BI Desktop (.pbix) Workflow' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              subTab === t.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. Interactive BI Canvas with Live Slicer */}
      {subTab === 'dashboard' && (
        <div className="space-y-5">
          {slicerCol && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-500 font-medium">Slicer ({slicerCol}):</span>
              <button
                onClick={() => setSlicerVal('ALL')}
                className={`px-2.5 py-1 rounded border ${slicerVal === 'ALL' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
              >
                All
              </button>
              {slicerOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSlicerVal(opt)}
                  className={`px-2.5 py-1 rounded border ${slicerVal === opt ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-slate-700'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
              <div className="text-xs text-slate-500">Total {primaryMetric}</div>
              <div className="text-2xl font-mono font-bold tabular-nums mt-1">
                {totalPrimary.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
              <div className="text-xs text-slate-500">Total {secondaryMetric}</div>
              <div className="text-2xl font-mono font-bold tabular-nums mt-1">
                {totalSecondary.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
              <div className="text-xs text-slate-500">Active Slice Row Count</div>
              <div className="text-2xl font-mono font-bold tabular-nums mt-1">{slicedRows.length.toLocaleString()}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
            <h2 className="text-sm font-display font-semibold mb-4">
              {primaryMetric} &amp; {secondaryMetric} by {dimCol}
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="primary" fill="#2563EB" name={primaryMetric} radius={[3, 3, 0, 0]} />
                  {secondaryMetric !== primaryMetric && (
                    <Bar dataKey="secondary" fill="#10B981" name={secondaryMetric} radius={[3, 3, 0, 0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 2. DAX Formula Lab */}
      {subTab === 'dax' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-display font-semibold">DAX Measure Editor</h2>
              <div className="flex items-center gap-1.5 flex-wrap">
                {daxTemplates.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setDaxCode(t.code)}
                    className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-[11px]"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={5}
              value={daxCode}
              onChange={(e) => setDaxCode(e.target.value)}
              className="w-full p-3.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] font-mono text-xs focus:outline-none focus:border-blue-500"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDaxOut(evaluateDaxOnRows(daxCode, slicedRows))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Evaluate Measure on Live Dataset</span>
              </button>
              <button
                onClick={() =>
                  askGeminiWithPrompt(
                    `Review this DAX measure for Power BI best practices (filter context, performance, edge cases) and suggest a Time-Intelligence version:\n${daxCode}`,
                    'analyst'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-blue-500/40 text-blue-600 dark:text-blue-400"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Optimize DAX with Gemini</span>
              </button>
            </div>

            {daxOut && (
              <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A] space-y-1">
                <div className="text-slate-500">Evaluated Measure Output</div>
                <div className="text-2xl font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {daxOut.value}
                </div>
                <div className="text-slate-600 dark:text-slate-400">{daxOut.explanation}</div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-3">
            <h2 className="text-sm font-display font-semibold">Available Table Columns ({tbl})</h2>
            <div className="space-y-1 font-mono text-[11px] max-h-72 overflow-y-auto">
              {columns.map((c) => (
                <div key={c} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800/70">
                  <span>{tbl}[{c}]</span>
                  <span className="text-slate-400">{numCols.includes(c) ? 'Numeric' : 'Text'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Star Schema Modeler */}
      {subTab === 'model' && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-6 space-y-5">
          <div>
            <h2 className="text-sm font-display font-semibold">Recommended Star Schema Architecture ({tbl})</h2>
            <p className="text-xs text-slate-500 mt-1">
              Split wide flat extracts into one central numeric Fact table surrounded by single-direction 1-to-Many (1:*) Dimension tables.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-xs font-mono">
            <div className="space-y-3">
              <div className="p-3.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]">
                <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1.5">Dim_Date (1)</div>
                <div>· date_key (PK)</div>
                <div>· year, quarter, month_name</div>
                <div>· fiscal_period, is_weekend</div>
              </div>
              <div className="p-3.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]">
                <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1.5">Dim_{catCols[1] || 'Region'} (1)</div>
                <div>· {catCols[1] || 'region'}_key (PK)</div>
                <div>· attribute_name</div>
              </div>
            </div>

            <div className="p-4 rounded-md border-2 border-blue-600 bg-blue-600/5">
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Fact_{tbl} (*)</div>
              <div className="text-slate-500 mb-2 text-[11px]">Foreign Keys (Many Side)</div>
              {catCols.slice(0, 3).map((c) => <div key={c}>→ {c}_key (FK)</div>)}
              <div className="text-slate-500 mt-3 mb-1 text-[11px]">Additive Numeric Measures</div>
              {numCols.slice(0, 5).map((c) => <div key={c}>Σ {c}</div>)}
            </div>

            <div className="p-3.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]">
              <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1.5">Dim_{catCols[2] || 'Category'} (1)</div>
              <div>· {catCols[2] || 'category'}_key (PK)</div>
              <div>· hierarchy_parent</div>
              <div>· segment_tier</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Power BI Desktop Workflow */}
      {subTab === 'pbix' && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4 text-xs">
          <h2 className="text-sm font-display font-semibold">Step-by-Step Export to Microsoft Power BI Desktop (.pbix)</h2>
          <ol className="list-decimal pl-5 space-y-2 text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>Clean and validate your dataset in <strong>Data Cleaning Lab</strong>, then export the clean CSV/XLSX.</li>
            <li>In Microsoft Power BI Desktop, click <strong>Get Data → Text/CSV</strong> and load the exported dataset.</li>
            <li>Open <strong>Model View</strong> and create the Star Schema relationships shown in the Star Schema Modeler tab.</li>
            <li>Click <strong>New Measure</strong> and paste your verified DAX measures from the DAX Formula Lab.</li>
          </ol>
          <button
            onClick={() =>
              exportTextFile(
                `// Venky Analytics OS - Power BI DAX Measure Pack (${tbl})\n${daxCode}\n`,
                `${tbl}_dax_measures.dax`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .dax Measure Script</span>
          </button>
        </div>
      )}
    </div>
  );
};
