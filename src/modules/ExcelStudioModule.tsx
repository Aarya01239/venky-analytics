import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { HyperFormula } from 'hyperformula';
import {
  Download,
  Upload,
  Calculator,
  Table2,
  Filter,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportRowsToCsv, exportRowsToXlsx } from '../utils/exporters';

function colLetter(index: number): string {
  let s = '';
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * HyperFormula requires TRUE() / FALSE() function syntax rather than bare TRUE / FALSE
 * boolean literals inside formulas like VLOOKUP(..., FALSE) or IFS(..., TRUE, ...).
 * Normalize standalone TRUE/FALSE tokens outside double-quoted string literals.
 */
function normalizeExcelFormula(expr: string): string {
  const prefixed = expr.startsWith('=') ? expr : `=${expr}`;
  const parts = prefixed.split(/("(?:[^"]|"")*")/g);
  return parts
    .map((part, idx) =>
      idx % 2 === 1
        ? part
        : part.replace(/\b(TRUE|FALSE)\b(?!\s*\()/gi, (_m, tok) => `${tok.toUpperCase()}()`)
    )
    .join('');
}

const FORMULA_EXAMPLES = [
  { label: 'SUM', formula: '=SUM(K2:K141)', desc: 'Sum numeric column K' },
  { label: 'AVERAGE', formula: '=AVERAGE(K2:K141)', desc: 'Mean of column K' },
  { label: 'SUMIF', formula: '=SUMIF(C2:C141, "North", K2:K141)', desc: 'Conditional sum where Col C = North' },
  { label: 'SUMIFS', formula: '=SUMIFS(K2:K141, C2:C141, "North", E2:E141, "Electronics")', desc: 'Multi-criteria conditional sum' },
  { label: 'COUNTIF', formula: '=COUNTIF(E2:E141, "Electronics")', desc: 'Count matching category rows' },
  { label: 'IF', formula: '=IF(AVERAGE(K2:K141)>1000, "High Ticket", "Standard")', desc: 'Conditional logic branch' },
  { label: 'IFS', formula: '=IFS(K2>5000, "Enterprise", K2>1000, "Mid-Market", TRUE, "SMB")', desc: 'Multi-branch conditional logic' },
  { label: 'VLOOKUP', formula: '=IFERROR(VLOOKUP("RET-1005", A2:M141, 11, FALSE), "N/A")', desc: 'Classic vertical exact lookup' },
  { label: 'INDEX/MATCH', formula: '=IFERROR(INDEX(K2:K141, MATCH("RET-1005", A2:A141, 0)), "Not Found")', desc: 'Resilient key lookup' },
  { label: 'LEFT/ROUND', formula: '=LEFT(A2, 3) & "-" & ROUND(K2, 0)', desc: 'String slicing & rounded concatenation' },
  { label: 'DATE', formula: '=YEAR(DATE(2025, 6, 15)) & "-Q2"', desc: 'Date extraction helper' },
];

export const ExcelStudioModule: React.FC = () => {
  const {
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    activeDatasetRows,
    pushNotification,
    askGeminiWithPrompt,
    updateAiContext,
  } = useWorkspace();

  const [subView, setSubView] = useState<'grid' | 'pivot' | 'quality' | 'powerquery'>('grid');
  const [sheets, setSheets] = useState<Record<string, Record<string, any>[]>>({});
  const [activeSheetName, setActiveSheetName] = useState<string>('ActiveDataset');
  const [formulaInput, setFormulaInput] = useState('=SUM(K2:K141)');
  const [formulaResult, setFormulaResult] = useState<string>('');
  const [filterText, setFilterText] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [cfCol, setCfCol] = useState<string>('');
  const [cfThreshold, setCfThreshold] = useState<string>('');

  // Pivot Table Config
  const [pivotRow, setPivotRow] = useState('');
  const [pivotCol, setPivotCol] = useState('');
  const [pivotVal, setPivotVal] = useState('');
  const [pivotAgg, setPivotAgg] = useState<'sum' | 'avg' | 'count'>('sum');

  useEffect(() => {
    if (activeDatasetRows.length > 0) {
      setSheets({ ActiveDataset: activeDatasetRows });
      setActiveSheetName('ActiveDataset');
      const cols = Object.keys(activeDatasetRows[0] || {});
      const numCols = cols.filter((c) => typeof activeDatasetRows[0][c] === 'number');
      const strCols = cols.filter((c) => typeof activeDatasetRows[0][c] === 'string');
      if (strCols[0]) setPivotRow(strCols[1] || strCols[0]);
      if (strCols[2]) setPivotCol(strCols[2]);
      if (numCols[0]) {
        const idx = cols.indexOf(numCols[numCols.length - 1]);
        const letter = colLetter(idx);
        setPivotVal(numCols[numCols.length - 1]);
        setCfCol(numCols[numCols.length - 1]);
        setFormulaInput(`=SUM(${letter}2:${letter}${activeDatasetRows.length + 1})`);
      }
    }
  }, [activeDatasetRows, activeDatasetId]);

  const currentRows = sheets[activeSheetName] || [];
  const columns = useMemo(() => (currentRows[0] ? Object.keys(currentRows[0]) : []), [currentRows]);

  // Evaluate Formula using real HyperFormula Engine
  const evaluateFormula = (expr: string) => {
    if (!currentRows.length || !columns.length) {
      setFormulaResult('No spreadsheet rows loaded.');
      return;
    }
    try {
      const sheetMatrix: any[][] = [
        columns,
        ...currentRows.map((r) =>
          columns.map((c) => {
            const v = r[c];
            if (v === null || v === undefined) return '';
            return v;
          })
        ),
        [normalizeExcelFormula(expr)],
      ];
      const hf = HyperFormula.buildFromArray(sheetMatrix, { licenseKey: 'gpl-v3' });
      const val = hf.getCellValue({ sheet: 0, row: sheetMatrix.length - 1, col: 0 });
      hf.destroy();
      if (val && typeof val === 'object' && 'value' in val) {
        setFormulaResult(`Error: ${(val as any).value} (${(val as any).message || 'Formula error'})`);
      } else if (typeof val === 'number') {
        setFormulaResult(Number(val.toFixed(4)).toLocaleString());
      } else {
        setFormulaResult(String(val ?? ''));
      }
    } catch (err: any) {
      setFormulaResult(`Evaluation Error: ${err?.message}`);
    }
  };

  useEffect(() => {
    if (currentRows.length > 0 && formulaInput) {
      evaluateFormula(formulaInput);
      updateAiContext({
        activeCode: `Excel Formula: ${formulaInput}\nEvaluated Result: ${formulaResult}`,
      });
    }
  }, [formulaInput, currentRows.length, activeSheetName]);

  const handleUploadWorkbook = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const loaded: Record<string, Record<string, any>[]> = {};
    wb.SheetNames.forEach((name) => {
      loaded[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });
    });
    setSheets(loaded);
    setActiveSheetName(wb.SheetNames[0]);
    pushNotification('Workbook Loaded', `Opened "${file.name}" with ${wb.SheetNames.length} worksheet(s).`, 'success');
  };

  const handleCellEdit = (rowIdx: number, col: string, value: string) => {
    setSheets((prev) => {
      const copy = [...(prev[activeSheetName] || [])];
      const numVal = value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value;
      copy[rowIdx] = { ...copy[rowIdx], [col]: numVal };
      return { ...prev, [activeSheetName]: copy };
    });
  };

  const processedEntries = useMemo(() => {
    let entries = currentRows.map((row, origIdx) => ({ row, origIdx }));
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      entries = entries.filter(({ row }) =>
        Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q))
      );
    }
    if (sortCol) {
      entries = [...entries].sort((a, b) => {
        const av = a.row[sortCol];
        const bv = b.row[sortCol];
        if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
        return sortAsc
          ? String(av ?? '').localeCompare(String(bv ?? ''))
          : String(bv ?? '').localeCompare(String(av ?? ''));
      });
    }
    return entries;
  }, [currentRows, filterText, sortCol, sortAsc]);

  const processedRows = useMemo(() => processedEntries.map((e) => e.row), [processedEntries]);

  // Real Pivot Table Computation
  const pivotMatrix = useMemo(() => {
    if (!pivotRow || !pivotVal || !currentRows.length) return null;
    const rowKeys = Array.from(new Set(currentRows.map((r) => String(r[pivotRow] ?? '(Blank)')))).sort();
    const colKeys = pivotCol
      ? Array.from(new Set(currentRows.map((r) => String(r[pivotCol] ?? '(Blank)')))).sort()
      : ['Total'];
    const map: Record<string, Record<string, number[]>> = {};
    for (const rk of rowKeys) {
      map[rk] = {};
      for (const ck of colKeys) map[rk][ck] = [];
    }
    for (const r of currentRows) {
      const rk = String(r[pivotRow] ?? '(Blank)');
      const ck = pivotCol ? String(r[pivotCol] ?? '(Blank)') : 'Total';
      const val = Number(r[pivotVal]);
      if (!Number.isNaN(val)) map[rk][ck].push(val);
    }
    const agg = (arr: number[]) => {
      if (!arr.length) return 0;
      if (pivotAgg === 'count') return arr.length;
      const sum = arr.reduce((a, b) => a + b, 0);
      return pivotAgg === 'avg' ? sum / arr.length : sum;
    };
    return { rowKeys, colKeys, map, agg };
  }, [currentRows, pivotRow, pivotCol, pivotVal, pivotAgg]);

  // Duplicate & Missing Audit
  const qualityReport = useMemo(() => {
    const seen = new Set<string>();
    let duplicates = 0;
    for (const r of currentRows) {
      const key = JSON.stringify(r);
      if (seen.has(key)) duplicates++;
      seen.add(key);
    }
    const missingByCol = columns.map((c) => {
      const missing = currentRows.filter((r) => r[c] === null || r[c] === undefined || String(r[c]).trim() === '').length;
      return { column: c, missing, pct: currentRows.length ? Math.round((missing / currentRows.length) * 1000) / 10 : 0 };
    });
    return { duplicates, missingByCol };
  }, [currentRows, columns]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">Excel Studio</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            HyperFormula Excel engine (SUMIFS, COUNTIFS, VLOOKUP, INDEX/MATCH, IFERROR) · Multi-sheet XLSX/CSV processing · Browser-based spreadsheet workbench (not a full desktop Microsoft Excel clone).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activeDatasetId}
            onChange={(e) => setActiveDatasetId(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] text-xs"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
            <Upload className="w-3.5 h-3.5" />
            <span>Open XLSX/CSV</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUploadWorkbook} className="hidden" />
          </label>

          <button
            onClick={() => exportRowsToXlsx(processedRows, `${activeSheetName}.xlsx`, activeSheetName)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export XLSX</span>
          </button>

          <button
            onClick={() => exportRowsToCsv(processedRows, `${activeSheetName}.csv`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0F1722] border border-slate-200 dark:border-slate-800 text-xs">
          {[
            { id: 'grid', label: 'Spreadsheet & Formula Engine' },
            { id: 'pivot', label: 'Pivot Table Analyzer' },
            { id: 'quality', label: 'Duplicates & Validation' },
            { id: 'powerquery', label: 'Power Query Exercises' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setSubView(v.id as any)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                subView === v.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Sheet Tabs */}
        <div className="flex items-center gap-1.5 text-xs">
          {Object.keys(sheets).map((name) => (
            <button
              key={name}
              onClick={() => setActiveSheetName(name)}
              className={`px-2.5 py-1 rounded border text-xs ${
                name === activeSheetName
                  ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400 font-medium'
                  : 'border-slate-200 dark:border-slate-800 text-slate-500'
              }`}
            >
              {name} ({sheets[name].length})
            </button>
          ))}
        </div>
      </div>

      {/* Formula Bar */}
      {subView === 'grid' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-500 shrink-0">
                <Calculator className="w-4 h-4 text-blue-500" />
                <span>fx</span>
              </div>
              <input
                type="text"
                value={formulaInput}
                onChange={(e) => setFormulaInput(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                placeholder="Enter Excel formula e.g. =SUMIF(C2:C141, &quot;North&quot;, K2:K141)"
              />
              <div className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums">
                Result: <strong className="text-blue-600 dark:text-blue-400">{formulaResult}</strong>
              </div>
              <button
                onClick={() =>
                  askGeminiWithPrompt(
                    `Explain this Excel formula and suggest 2 more useful business formulas for my active sheet columns (${columns.join(', ')}): ${formulaInput}`,
                    'learn'
                  )
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-blue-500/40 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Formula Helper</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span className="text-slate-500 mr-1">Practice templates:</span>
              {FORMULA_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setFormulaInput(ex.formula)}
                  title={ex.desc}
                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 font-mono text-slate-700 dark:text-slate-300"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Filter & Conditional Formatting Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter rows across any column..."
                className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] w-64 focus:outline-none"
              />
              <span className="text-slate-500 font-mono tabular-nums">
                Showing {Math.min(processedRows.length, 150)} of {processedRows.length} rows
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500">Conditional Highlight:</span>
              <select
                value={cfCol}
                onChange={(e) => setCfCol(e.target.value)}
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722]"
              >
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="number"
                value={cfThreshold}
                onChange={(e) => setCfThreshold(e.target.value)}
                placeholder="Highlight > value"
                className="px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] w-32 font-mono"
              />
            </div>
          </div>

          {/* Interactive Editable Spreadsheet Grid */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] overflow-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-2.5 py-2 font-mono text-[11px] text-slate-400 border-r border-slate-200 dark:border-slate-800 w-10">
                    Row
                  </th>
                  {columns.map((col, idx) => (
                    <th
                      key={col}
                      onClick={() => {
                        if (sortCol === col) setSortAsc(!sortAsc);
                        else {
                          setSortCol(col);
                          setSortAsc(true);
                        }
                      }}
                      className="px-3 py-2 font-mono font-semibold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          <span className="text-blue-500 mr-1">{colLetter(idx)}</span>
                          {col}
                        </span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {processedEntries.slice(0, 150).map(({ row, origIdx }) => (
                  <tr key={origIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-400 border-r border-slate-200 dark:border-slate-800 tabular-nums">
                      {origIdx + 2}
                    </td>
                    {columns.map((col) => {
                      const val = row[col];
                      const isNum = typeof val === 'number';
                      const thresholdNum = cfThreshold !== '' ? Number(cfThreshold) : null;
                      const highlighted =
                        thresholdNum !== null && col === cfCol && isNum && val > thresholdNum;
                      return (
                        <td
                          key={col}
                          className={`p-0 border-r border-slate-100 dark:border-slate-800/70 ${
                            highlighted ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold' : ''
                          }`}
                        >
                          <input
                            type="text"
                            value={val === null || val === undefined ? '' : String(val)}
                            onChange={(e) => handleCellEdit(origIdx, col, e.target.value)}
                            className={`w-full px-2.5 py-1.5 bg-transparent focus:outline-none focus:bg-blue-500/10 ${
                              isNum ? 'font-mono tabular-nums text-right' : ''
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pivot Table Analyzer */}
      {subView === 'pivot' && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Rows Dimension</label>
              <select
                value={pivotRow}
                onChange={(e) => setPivotRow(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
              >
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Columns Dimension (Optional)</label>
              <select
                value={pivotCol}
                onChange={(e) => setPivotCol(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
              >
                <option value="">None (1D Summary)</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Values Metric</label>
              <select
                value={pivotVal}
                onChange={(e) => setPivotVal(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
              >
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Aggregation</label>
              <select
                value={pivotAgg}
                onChange={(e) => setPivotAgg(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
              >
                <option value="sum">SUM</option>
                <option value="avg">AVERAGE</option>
                <option value="count">COUNT</option>
              </select>
            </div>
          </div>

          {pivotMatrix && (
            <div className="overflow-auto border border-slate-200 dark:border-slate-800 rounded-md">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{pivotRow} \ {pivotCol || pivotVal}</th>
                    {pivotMatrix.colKeys.map((ck) => (
                      <th key={ck} className="px-3 py-2 font-semibold text-right">{ck}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pivotMatrix.rowKeys.map((rk) => (
                    <tr key={rk} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{rk}</td>
                      {pivotMatrix.colKeys.map((ck) => {
                        const val = pivotMatrix.agg(pivotMatrix.map[rk][ck]);
                        return (
                          <td key={ck} className="px-3 py-2 text-right font-mono tabular-nums">
                            {val.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quality & Validation */}
      {subView === 'quality' && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
          <div className="flex items-center gap-6 text-xs">
            <div className="flex items-center gap-2">
              <Table2 className="w-4 h-4 text-blue-500" />
              <span>Total Rows: <strong className="font-mono tabular-nums">{currentRows.length}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              {qualityReport.duplicates > 0 ? (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              )}
              <span>Exact Duplicate Rows: <strong className="font-mono tabular-nums">{qualityReport.duplicates}</strong></span>
            </div>
          </div>

          <table className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 text-left">Column</th>
                <th className="px-3 py-2 text-right">Missing Count</th>
                <th className="px-3 py-2 text-right">Missing %</th>
                <th className="px-3 py-2 text-left">Validation Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {qualityReport.missingByCol.map((m) => (
                <tr key={m.column}>
                  <td className="px-3 py-2 font-mono">{m.column}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{m.missing}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{m.pct}%</td>
                  <td className="px-3 py-2">
                    <span className={m.missing === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                      {m.missing === 0 ? 'Complete' : 'Requires Imputation'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Power Query Learning Exercises */}
      {subView === 'powerquery' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          {[
            {
              title: '1. Unpivot Monthly Columns into Fact Table',
              mCode: `let\n  Source = Excel.CurrentWorkbook(){[Name="BudgetWide"]}[Content],\n  Unpivoted = Table.UnpivotOtherColumns(Source, {"Department", "CostCenter"}, "FiscalMonth", "Amount"),\n  ChangedType = Table.TransformColumnTypes(Unpivoted, {{"Amount", Currency.Type}})\nin\n  ChangedType`,
              why: 'Transforms wide spreadsheet reports into narrow relational tables ready for Pivot Tables, SQL, and Power BI.',
            },
            {
              title: '2. Clean Dirty Text Keys & Parse Locale Dates',
              mCode: `let\n  Source = Csv.Document(File.Contents("raw_dirty_sales.csv"), [Delimiter=","]),\n  Promoted = Table.PromoteHeaders(Source),\n  Trimmed = Table.TransformColumns(Promoted, {{"region", Text.Trim}, {"region", Text.Proper}}),\n  Deduplicated = Table.Distinct(Trimmed, {"tx_id"})\nin\n  Deduplicated`,
              why: 'Ensures joins never drop records due to trailing spaces ("North " vs "north") and guarantees idempotent daily refresh.',
            },
          ].map((ex) => (
            <div key={ex.title} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-4 space-y-2.5">
              <div className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">{ex.title}</div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{ex.why}</p>
              <pre className="p-3 rounded-md bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
                {ex.mCode}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
