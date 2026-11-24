import React, { useMemo, useState } from 'react';
import * as ss from 'simple-statistics';
import { Save, Download, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportRowsToCsv, exportRowsToXlsx } from '../utils/exporters';

function normalizeIsoDate(raw: any): string {
  if (raw === null || raw === undefined) return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slashYmd = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashYmd) {
    return `${slashYmd[1]}-${slashYmd[2].padStart(2, '0')}-${slashYmd[3].padStart(2, '0')}`;
  }
  const usMdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMdy) {
    return `${usMdy[3]}-${usMdy[1].padStart(2, '0')}-${usMdy[2].padStart(2, '0')}`;
  }
  return s;
}

export const DataCleaningModule: React.FC = () => {
  const {
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    activeDatasetRows,
    refreshWorkspace,
    pushNotification,
    openDatasetInModule,
  } = useWorkspace();

  const [trimStrings, setTrimStrings] = useState(true);
  const [titleCaseText, setTitleCaseText] = useState(false);
  const [deduplicate, setDeduplicate] = useState(true);
  const [imputeStrategy, setImputeStrategy] = useState<'none' | 'median' | 'mean' | 'zero'>('median');
  const [normalizeDates, setNormalizeDates] = useState(true);
  const [removeOutliers, setRemoveOutliers] = useState(false);
  const [dropNegativeNums, setDropNegativeNums] = useState(false);
  const [previewMode, setPreviewMode] = useState<'after' | 'before'>('after');
  const [newDatasetName, setNewDatasetName] = useState('');
  const [saving, setSaving] = useState(false);

  const activeDs = datasets.find((d) => d.id === activeDatasetId);
  const columns = useMemo(() => (activeDatasetRows[0] ? Object.keys(activeDatasetRows[0]) : []), [activeDatasetRows]);

  const numericCols = useMemo(() => {
    return columns.filter((col) => {
      const vals = activeDatasetRows
        .map((r) => r[col])
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
      return vals.length > 0 && vals.filter((v) => !Number.isNaN(Number(v))).length / vals.length > 0.8;
    });
  }, [activeDatasetRows, columns]);

  // Compute Before Audit
  const beforeAudit = useMemo(() => {
    let missingCells = 0;
    const seen = new Set<string>();
    let duplicates = 0;
    for (const r of activeDatasetRows) {
      const k = JSON.stringify(r);
      if (seen.has(k)) duplicates++;
      seen.add(k);
      for (const c of columns) {
        if (r[c] === null || r[c] === undefined || String(r[c]).trim() === '') missingCells++;
      }
    }
    return { rows: activeDatasetRows.length, missingCells, duplicates };
  }, [activeDatasetRows, columns]);

  // Compute Cleaned Rows Pipeline
  const cleanedRows = useMemo(() => {
    if (!activeDatasetRows.length) return [];

    // Precompute medians/means for numeric imputation
    const colFill: Record<string, number> = {};
    const colBounds: Record<string, { lo: number; hi: number }> = {};

    for (const col of numericCols) {
      const nums = activeDatasetRows
        .map((r) => Number(r[col]))
        .filter((v) => Number.isFinite(v) && (!dropNegativeNums || v >= 0))
        .sort((a, b) => a - b);
      if (nums.length >= 2) {
        colFill[col] =
          imputeStrategy === 'mean'
            ? Math.round(ss.mean(nums) * 100) / 100
            : imputeStrategy === 'median'
            ? Math.round(ss.medianSorted(nums) * 100) / 100
            : 0;
        const q1 = ss.quantileSorted(nums, 0.25);
        const q3 = ss.quantileSorted(nums, 0.75);
        const iqr = q3 - q1;
        colBounds[col] = { lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr };
      }
    }

    let out: Record<string, any>[] = activeDatasetRows.map((row) => {
      const next: Record<string, any> = {};
      for (const col of columns) {
        let val = row[col];
        if (typeof val === 'string') {
          if (trimStrings) val = val.trim();
          if (normalizeDates && /date/i.test(col)) {
            val = normalizeIsoDate(val);
          } else if (titleCaseText && !/@/.test(val) && !/^[A-Z]{2,4}-\d+/.test(val)) {
            val = val
              .toLowerCase()
              .replace(/\b\w/g, (ch: string) => ch.toUpperCase());
          }
        }
        if ((val === null || val === undefined || val === '') && numericCols.includes(col) && imputeStrategy !== 'none') {
          val = colFill[col] ?? 0;
        } else if (numericCols.includes(col) && val !== null && val !== '' && !Number.isNaN(Number(val))) {
          val = Number(val);
        }
        next[col] = val;
      }
      return next;
    });

    if (dropNegativeNums) {
      out = out.filter((r) =>
        numericCols.every((c) => typeof r[c] !== 'number' || r[c] >= 0)
      );
    }

    if (removeOutliers) {
      out = out.filter((r) =>
        numericCols.every((c) => {
          const b = colBounds[c];
          if (!b || typeof r[c] !== 'number') return true;
          return r[c] >= b.lo && r[c] <= b.hi;
        })
      );
    }

    if (deduplicate) {
      const seen = new Set<string>();
      out = out.filter((r) => {
        const k = JSON.stringify(r);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    return out;
  }, [
    activeDatasetRows,
    columns,
    numericCols,
    trimStrings,
    titleCaseText,
    deduplicate,
    imputeStrategy,
    normalizeDates,
    removeOutliers,
    dropNegativeNums,
  ]);

  const afterAudit = useMemo(() => {
    let missingCells = 0;
    for (const r of cleanedRows) {
      for (const c of columns) {
        if (r[c] === null || r[c] === undefined || String(r[c]).trim() === '') missingCells++;
      }
    }
    return { rows: cleanedRows.length, missingCells };
  }, [cleanedRows, columns]);

  const saveCleanedDataset = async () => {
    if (!cleanedRows.length || saving) return;
    setSaving(true);
    try {
      const name = newDatasetName.trim() || `${activeDs?.name.replace(' (Sample)', '') || 'Dataset'} Cleaned`;
      const res = await fetch('/api/datasets/from-rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: `Cleaned from ${activeDs?.table_name} (${beforeAudit.rows} → ${cleanedRows.length} rows, missing cells ${beforeAudit.missingCells} → ${afterAudit.missingCells}).`,
          rows: cleanedRows,
          parent_version: activeDs?.version || 1,
        }),
      });
      const created = await res.json();
      if (!res.ok) throw new Error(created.error || 'Failed to save cleaned dataset');
      await refreshWorkspace();
      setActiveDatasetId(created.id);
      setNewDatasetName('');
      pushNotification(
        'Cleaned Dataset Registered',
        `Saved as table "${created.table_name}". Immediately reusable in SQL, Python, Excel, Stats, and Charts.`,
        'success'
      );
    } catch (err: any) {
      pushNotification('Save Failed', err?.message || 'Error saving dataset', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Data Cleaning & Preparation Lab
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Try loading &quot;Raw Dirty Sales (Cleaning Practice)&quot; to fix real duplicates, nulls, messy whitespace, inconsistent dates, and extreme outliers, then register the clean table across the entire OS.
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
          <button
            onClick={() => setActiveDatasetId('ds_raw_dirty_sales')}
            className="px-3 py-1.5 rounded-md border border-amber-500/50 text-amber-600 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/10"
          >
            Load Dirty Practice Dataset
          </button>
        </div>
      </div>

      {/* Before vs After Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
          <div className="text-xs text-slate-500">Rows (Before → After)</div>
          <div className="text-xl font-mono font-bold tabular-nums mt-1">
            {beforeAudit.rows} → <span className="text-blue-600 dark:text-blue-400">{afterAudit.rows}</span>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
          <div className="text-xs text-slate-500">Missing Cells (Before → After)</div>
          <div className="text-xl font-mono font-bold tabular-nums mt-1">
            {beforeAudit.missingCells} →{' '}
            <span className={afterAudit.missingCells === 0 ? 'text-emerald-500' : 'text-amber-500'}>
              {afterAudit.missingCells}
            </span>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
          <div className="text-xs text-slate-500">Exact Duplicates Detected</div>
          <div className="text-xl font-mono font-bold tabular-nums mt-1">
            {beforeAudit.duplicates}{' '}
            <span className="text-xs font-normal text-slate-500">{deduplicate ? '(removed)' : '(kept)'}</span>
          </div>
        </div>
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
          <div className="text-xs text-slate-500">Data Quality Readiness</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
            {afterAudit.missingCells === 0 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Analysis Ready</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">Review Remaining Nulls</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Controls & Save Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-display font-semibold">Transformation Steps</h2>
            <button
              onClick={() => {
                setTrimStrings(false);
                setTitleCaseText(false);
                setDeduplicate(false);
                setImputeStrategy('none');
                setNormalizeDates(false);
                setRemoveOutliers(false);
                setDropNegativeNums(false);
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="space-y-2.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={trimStrings} onChange={(e) => setTrimStrings(e.target.checked)} />
              <span>Trim leading &amp; trailing whitespace</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={titleCaseText} onChange={(e) => setTitleCaseText(e.target.checked)} />
              <span>Standardize text casing (Title Case)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={deduplicate} onChange={(e) => setDeduplicate(e.target.checked)} />
              <span>Drop exact duplicate rows</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={normalizeDates} onChange={(e) => setNormalizeDates(e.target.checked)} />
              <span>Normalize date columns to ISO (YYYY-MM-DD)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={dropNegativeNums} onChange={(e) => setDropNegativeNums(e.target.checked)} />
              <span>Remove rows with negative numeric values</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={removeOutliers} onChange={(e) => setRemoveOutliers(e.target.checked)} />
              <span>Filter extreme numeric outliers (1.5 × IQR)</span>
            </label>

            <div className="pt-2">
              <label className="block text-slate-500 mb-1">Missing Numeric Value Imputation</label>
              <select
                value={imputeStrategy}
                onChange={(e) => setImputeStrategy(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
              >
                <option value="none">Leave Nulls Untouched</option>
                <option value="median">Fill with Column Median (Recommended)</option>
                <option value="mean">Fill with Column Mean</option>
                <option value="zero">Fill with Zero (0)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <label className="block text-slate-500">Save Cleaned Dataset into Shared SQLite Workspace</label>
            <input
              type="text"
              value={newDatasetName}
              onChange={(e) => setNewDatasetName(e.target.value)}
              placeholder={`${activeDs?.table_name || 'dataset'}_cleaned`}
              className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
            />
            <button
              onClick={saveCleanedDataset}
              disabled={saving || !cleanedRows.length}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Registering Table...' : 'Save & Reuse Across OS'}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => exportRowsToCsv(cleanedRows, `${activeDs?.table_name || 'cleaned'}_clean.csv`)}
                className="inline-flex items-center justify-center gap-1 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => exportRowsToXlsx(cleanedRows, `${activeDs?.table_name || 'cleaned'}_clean.xlsx`)}
                className="inline-flex items-center justify-center gap-1 py-1.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export XLSX</span>
              </button>
            </div>
            {activeDs && (
              <div className="pt-2 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400">
                <button onClick={() => openDatasetInModule(activeDs.id, 'sql')} className="hover:underline">Open in SQL →</button>
                <button onClick={() => openDatasetInModule(activeDs.id, 'statistics')} className="hover:underline">Open in Stats →</button>
                <button onClick={() => openDatasetInModule(activeDs.id, 'visualization')} className="hover:underline">Charts →</button>
              </div>
            )}
          </div>
        </div>

        {/* Live Before/After Preview Table */}
        <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-display font-semibold text-sm">
                {previewMode === 'after' ? 'Cleaned Output Preview (Live)' : 'Original Raw Data (Before Cleaning)'}
              </span>
              <div className="inline-flex rounded border border-slate-200 dark:border-slate-800 overflow-hidden text-[11px]">
                <button
                  onClick={() => setPreviewMode('before')}
                  className={`px-2 py-0.5 ${previewMode === 'before' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
                >
                  Before ({activeDatasetRows.length})
                </button>
                <button
                  onClick={() => setPreviewMode('after')}
                  className={`px-2 py-0.5 ${previewMode === 'after' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'}`}
                >
                  After ({cleanedRows.length})
                </button>
              </div>
            </div>
            <span className="font-mono text-slate-500 tabular-nums">
              Showing first {Math.min((previewMode === 'after' ? cleanedRows : activeDatasetRows).length, 60)} of {(previewMode === 'after' ? cleanedRows : activeDatasetRows).length} rows
            </span>
          </div>
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="px-3 py-2 font-mono font-semibold whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {(previewMode === 'after' ? cleanedRows : activeDatasetRows).slice(0, 60).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {columns.map((c) => (
                      <td key={c} className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px]">
                        {row[c] === null || row[c] === undefined || row[c] === '' ? (
                          <span className="text-amber-500 italic">NULL</span>
                        ) : (
                          String(row[c])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
