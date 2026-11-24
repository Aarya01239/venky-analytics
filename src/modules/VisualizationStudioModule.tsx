import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as ss from 'simple-statistics';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Download, Sparkles } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportRowsToCsv } from '../utils/exporters';

const CHART_COLORS = ['#2563EB', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export const VisualizationStudioModule: React.FC = () => {
  const { datasets, activeDatasetId, setActiveDatasetId, activeDatasetRows, askGeminiWithPrompt } = useWorkspace();

  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie' | 'histogram' | 'scatter' | 'heatmap'>('bar');
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [agg, setAgg] = useState<'sum' | 'avg' | 'count' | 'max' | 'min'>('sum');
  const [filterCol, setFilterCol] = useState('');
  const [filterVal, setFilterVal] = useState('ALL');
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => (activeDatasetRows[0] ? Object.keys(activeDatasetRows[0]) : []), [activeDatasetRows]);
  const numericCols = useMemo(
    () => columns.filter((c) => activeDatasetRows.slice(0, 25).some((r) => typeof r[c] === 'number')),
    [columns, activeDatasetRows]
  );
  const categoricalCols = useMemo(() => columns.filter((c) => !numericCols.includes(c)), [columns, numericCols]);

  useEffect(() => {
    if (columns.length) {
      setXCol(categoricalCols[1] || categoricalCols[0] || columns[0]);
      setYCol(numericCols[numericCols.length - 1] || columns[1] || columns[0]);
      setFilterCol(categoricalCols[0] || '');
      setFilterVal('ALL');
    }
  }, [activeDatasetId, columns.length]);

  const filterValues = useMemo(() => {
    if (!filterCol) return [];
    return Array.from(new Set(activeDatasetRows.map((r) => String(r[filterCol] ?? '')))).slice(0, 30);
  }, [activeDatasetRows, filterCol]);

  const filteredRows = useMemo(() => {
    if (!filterCol || filterVal === 'ALL') return activeDatasetRows;
    return activeDatasetRows.filter((r) => String(r[filterCol] ?? '') === filterVal);
  }, [activeDatasetRows, filterCol, filterVal]);

  // Aggregated Chart Data
  const aggregatedData = useMemo<Record<string, any>[]>(() => {
    if (!filteredRows.length || !xCol) return [];
    if (chartType === 'scatter') {
      return filteredRows
        .map((r) => ({ x: Number(r[xCol]), y: Number(r[yCol]) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .slice(0, 200);
    }
    if (chartType === 'histogram') {
      const vals = filteredRows.map((r) => Number(r[yCol])).filter((v) => Number.isFinite(v));
      if (!vals.length) return [];
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const bins = 10;
      const step = (max - min) / bins || 1;
      return Array.from({ length: bins }, (_, i) => {
        const lo = min + i * step;
        const hi = i === bins - 1 ? max + 0.001 : min + (i + 1) * step;
        return {
          name: `${Math.round(lo)}–${Math.round(hi)}`,
          value: vals.filter((v) => v >= lo && v < hi).length,
        };
      });
    }

    const groups: Record<string, number[]> = {};
    for (const r of filteredRows) {
      const key = String(r[xCol] ?? '(Blank)');
      if (!groups[key]) groups[key] = [];
      const n = Number(r[yCol]);
      if (Number.isFinite(n)) groups[key].push(n);
      else if (agg === 'count') groups[key].push(1);
    }
    return Object.entries(groups)
      .map(([name, vals]) => {
        let value = 0;
        if (agg === 'count') value = vals.length;
        else if (vals.length) {
          if (agg === 'sum') value = vals.reduce((a, b) => a + b, 0);
          else if (agg === 'avg') value = vals.reduce((a, b) => a + b, 0) / vals.length;
          else if (agg === 'max') value = Math.max(...vals);
          else if (agg === 'min') value = Math.min(...vals);
        }
        return { name, value: Math.round(value * 100) / 100 };
      })
      .sort((a, b) => (chartType === 'line' || chartType === 'area' ? a.name.localeCompare(b.name) : b.value - a.value))
      .slice(0, 24);
  }, [filteredRows, xCol, yCol, agg, chartType]);

  // Correlation Matrix Heatmap
  const corrMatrix = useMemo(() => {
    if (chartType !== 'heatmap') return [];
    const cols = numericCols.slice(0, 7);
    return cols.map((c1) => {
      const row: Record<string, any> = { col: c1 };
      for (const c2 of cols) {
        const pairs = filteredRows
          .map((r) => [Number(r[c1]), Number(r[c2])])
          .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
        if (pairs.length >= 3) {
          row[c2] = Math.round(ss.sampleCorrelation(pairs.map((p) => p[0]), pairs.map((p) => p[1])) * 100) / 100;
        } else {
          row[c2] = 0;
        }
      }
      return row;
    });
  }, [chartType, numericCols, filteredRows]);

  const kpiSummary = useMemo(() => {
    const vals = filteredRows.map((r) => Number(r[yCol])).filter((v) => Number.isFinite(v));
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      count: filteredRows.length,
      sum,
      avg: sum / vals.length,
      max: Math.max(...vals),
    };
  }, [filteredRows, yCol]);

  const downloadChartSvg = () => {
    const svg = chartContainerRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chartType}_${xCol}_${yCol}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Data Visualization Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Interactive charts computed directly from live dataset rows with aggregations, filters, correlation matrices, and SVG export.
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
          <button
            onClick={downloadChartSvg}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download SVG</span>
          </button>
          <button
            onClick={() => exportRowsToCsv(aggregatedData, `chart_data_${xCol}_${yCol}.csv`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Data</span>
          </button>
          <button
            onClick={() =>
              askGeminiWithPrompt(
                `Interpret this ${chartType} chart of ${agg.toUpperCase()}(${yCol}) by ${xCol}. Top computed points: ${JSON.stringify(
                  aggregatedData.slice(0, 8)
                )}. Highlight business trends and potential anomalies.`,
                'analyst'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interpret Chart</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      {kpiSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
            <div className="text-[11px] text-slate-500">Filtered Rows</div>
            <div className="text-lg font-mono font-bold tabular-nums mt-0.5">{kpiSummary.count.toLocaleString()}</div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
            <div className="text-[11px] text-slate-500">Total {yCol}</div>
            <div className="text-lg font-mono font-bold tabular-nums mt-0.5">{kpiSummary.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
            <div className="text-[11px] text-slate-500">Average {yCol}</div>
            <div className="text-lg font-mono font-bold tabular-nums mt-0.5">{kpiSummary.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
            <div className="text-[11px] text-slate-500">Peak {yCol}</div>
            <div className="text-lg font-mono font-bold tabular-nums mt-0.5">{kpiSummary.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          </div>
        </div>
      )}

      {/* Configuration & Chart Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-4 space-y-4 text-xs">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Chart Type</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'bar', label: 'Bar' },
                { id: 'line', label: 'Line' },
                { id: 'area', label: 'Area' },
                { id: 'pie', label: 'Donut / Pie' },
                { id: 'histogram', label: 'Histogram' },
                { id: 'scatter', label: 'Scatter' },
                { id: 'heatmap', label: 'Corr. Matrix' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setChartType(t.id as any)}
                  className={`px-2.5 py-1.5 rounded border text-left font-medium ${
                    chartType === t.id
                      ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {chartType !== 'heatmap' && (
            <>
              <div>
                <label className="block text-slate-500 mb-1">
                  {chartType === 'scatter' ? 'X Numeric Column' : 'X Dimension / Category'}
                </label>
                <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] font-mono">
                  {(chartType === 'scatter' ? numericCols : columns).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Y Metric Column</label>
                <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] font-mono">
                  {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {chartType !== 'scatter' && chartType !== 'histogram' && (
                <div>
                  <label className="block text-slate-500 mb-1">Aggregation</label>
                  <select value={agg} onChange={(e) => setAgg(e.target.value as any)} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]">
                    <option value="sum">SUM</option>
                    <option value="avg">AVERAGE</option>
                    <option value="count">COUNT</option>
                    <option value="max">MAX</option>
                    <option value="min">MIN</option>
                  </select>
                </div>
              )}
            </>
          )}

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="font-semibold text-slate-900 dark:text-slate-100">Interactive Filter</div>
            <select value={filterCol} onChange={(e) => { setFilterCol(e.target.value); setFilterVal('ALL'); }} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]">
              <option value="">No Filter</option>
              {categoricalCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {filterCol && (
              <select value={filterVal} onChange={(e) => setFilterVal(e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]">
                <option value="ALL">All Values</option>
                {filterValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Chart Viewport */}
        <div
          ref={chartContainerRef}
          className="lg:col-span-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 flex flex-col"
        >
          <div className="mb-4">
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
              {chartType === 'heatmap'
                ? 'Pearson Correlation Matrix'
                : chartType === 'histogram'
                ? `Distribution Histogram of ${yCol}`
                : chartType === 'scatter'
                ? `Scatter Plot: ${xCol} vs ${yCol}`
                : `${agg.toUpperCase()}(${yCol}) by ${xCol}`}
            </h2>
          </div>

          {chartType === 'heatmap' ? (
            <div className="overflow-auto">
              <table className="w-full text-xs font-mono border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-slate-500">Variable</th>
                    {numericCols.slice(0, 7).map((c) => (
                      <th key={c} className="p-2 text-center text-slate-500">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corrMatrix.map((row) => (
                    <tr key={row.col}>
                      <td className="p-2 font-semibold text-slate-700 dark:text-slate-200">{row.col}</td>
                      {numericCols.slice(0, 7).map((c) => {
                        const v = Number(row[c] ?? 0);
                        const bg =
                          v > 0.6
                            ? 'bg-blue-600/30 text-blue-700 dark:text-blue-200'
                            : v > 0.25
                            ? 'bg-blue-500/15'
                            : v < -0.5
                            ? 'bg-red-600/30 text-red-700 dark:text-red-200'
                            : v < -0.2
                            ? 'bg-red-500/15'
                            : 'bg-slate-100/50 dark:bg-slate-800/40';
                        return (
                          <td key={c} className={`p-2.5 text-center tabular-nums border border-slate-200 dark:border-slate-800 ${bg}`}>
                            {v.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' || chartType === 'histogram' ? (
                  <BarChart data={aggregatedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} name={yCol} />
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={aggregatedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2.2} dot={{ r: 3 }} name={yCol} />
                  </LineChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={aggregatedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#2563EB" fill="#2563EB" fillOpacity={0.2} name={yCol} />
                  </AreaChart>
                ) : chartType === 'pie' ? (
                  <PieChart>
                    <Pie data={aggregatedData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={135} label>
                      {aggregatedData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                ) : (
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="x" type="number" name={xCol} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="y" type="number" name={yCol} tick={{ fontSize: 11 }} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter data={aggregatedData} fill="#2563EB" name={`${xCol} vs ${yCol}`} />
                  </ScatterChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
