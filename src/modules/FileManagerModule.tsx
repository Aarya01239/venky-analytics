import React, { useState } from 'react';
import { Upload, Download, Trash2, Database, Eye, Check } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { SyntheticDatasetGenerator } from './SyntheticDatasetGenerator';
import { exportRowsToCsv, exportRowsToXlsx, exportJsonFile } from '../utils/exporters';

export const FileManagerModule: React.FC = () => {
  const {
    datasets,
    projects,
    refreshWorkspace,
    openDatasetInModule,
    pushNotification,
  } = useWorkspace();

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ name: string; rows: Record<string, any>[] } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/datasets/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      await refreshWorkspace();
      pushNotification(
        'Dataset Uploaded',
        `"${data.name}" (${data.row_count} rows) is now registered as SQL table "${data.table_name}" across all modules.`,
        'success'
      );
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const fetchRowsForAction = async (id: string) => {
    const res = await fetch(`/api/datasets/${encodeURIComponent(id)}/rows?limit=2000`);
    const data = await res.json();
    return data.rows || [];
  };

  const handlePreview = async (id: string, name: string) => {
    const rows = await fetchRowsForAction(id);
    setPreviewData({ name, rows });
  };

  const handleRenameSave = async (id: string) => {
    if (!renameText.trim()) return;
    await fetch(`/api/datasets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameText.trim() }),
    });
    setRenamingId(null);
    await refreshWorkspace();
  };

  const handleAssignProject = async (id: string, projectId: string) => {
    await fetch(`/api/datasets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId || null }),
    });
    await refreshWorkspace();
  };

  const handleDelete = async (id: string, name: string) => {
    await fetch(`/api/datasets/${id}`, { method: 'DELETE' });
    if (previewData?.name === name) setPreviewData(null);
    await refreshWorkspace();
    pushNotification('Dataset Deleted', `Removed "${name}" from workspace.`, 'info');
  };

  const previewCols = previewData?.rows?.[0] ? Object.keys(previewData.rows[0]) : [];

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Central Dataset &amp; File Manager
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Upload CSV, XLSX, XLS, or JSON once (max 10 MB) — automatically indexed into SQLite and instantly reusable across SQL, Excel, Python, Statistics, Cleaning, and Charts.
          </p>
        </div>

        <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shrink-0">
          <Upload className="w-3.5 h-3.5" />
          <span>{uploading ? 'Uploading & Indexing...' : 'Upload Dataset (CSV / XLSX / JSON)'}</span>
          <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>

      {uploadError && (
        <div className="p-3 rounded-md border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
          {uploadError}
        </div>
      )}

      <SyntheticDatasetGenerator />

      {/* Dataset Catalog Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Dataset Name</th>
              <th className="px-3 py-2.5 font-mono">SQL Table</th>
              <th className="px-3 py-2.5 text-right">Rows</th>
              <th className="px-3 py-2.5 text-right">Ver</th>
              <th className="px-3 py-2.5">Project Folder</th>
              <th className="px-3 py-2.5">Open In Module</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {datasets.map((ds) => (
              <tr key={ds.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                  {renamingId === ds.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        className="px-2 py-1 rounded border border-blue-500 bg-transparent text-xs"
                      />
                      <button onClick={() => handleRenameSave(ds.id)} className="p-1 text-emerald-500">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setRenamingId(ds.id);
                        setRenameText(ds.name);
                      }}
                      title="Click to rename"
                      className="flex items-center gap-2 text-left hover:text-blue-500"
                    >
                      <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{ds.name}</span>
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{ds.table_name}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{ds.row_count.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">v{ds.version}</td>
                <td className="px-3 py-2.5">
                  <select
                    value={ds.project_id || ''}
                    onChange={(e) => handleAssignProject(ds.id, e.target.value)}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-transparent text-[11px]"
                  >
                    <option value="">Unassigned</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    {(['sql', 'excel', 'python', 'cleaning', 'statistics', 'visualization'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => openDatasetInModule(ds.id, m)}
                        className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[10px] uppercase"
                      >
                        {m === 'statistics' ? 'Stats' : m === 'visualization' ? 'Viz' : m}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => handlePreview(ds.id, ds.name)}
                      title="Preview rows"
                      className="p-1 text-slate-500 hover:text-blue-500"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => exportRowsToCsv(await fetchRowsForAction(ds.id), `${ds.table_name}.csv`)}
                      title="Download CSV"
                      className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => exportRowsToXlsx(await fetchRowsForAction(ds.id), `${ds.table_name}.xlsx`)}
                      title="Download XLSX"
                      className="text-[10px] font-mono text-slate-500 hover:text-blue-500"
                    >
                      XLSX
                    </button>
                    <button
                      onClick={async () => exportJsonFile(await fetchRowsForAction(ds.id), `${ds.table_name}.json`)}
                      title="Download JSON"
                      className="text-[10px] font-mono text-slate-500 hover:text-blue-500"
                    >
                      JSON
                    </button>
                    {!ds.is_sample && (
                      <button
                        onClick={() => handleDelete(ds.id, ds.name)}
                        title="Delete dataset"
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Live Preview Drawer */}
      {previewData && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="font-semibold">Preview: {previewData.name} (first 30 rows)</span>
            <button onClick={() => setPreviewData(null)} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              Close
            </button>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {previewCols.map((c) => <th key={c} className="px-3 py-2 font-mono">{c}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewData.rows.slice(0, 30).map((r, i) => (
                  <tr key={i}>
                    {previewCols.map((c) => <td key={c} className="px-3 py-1.5 whitespace-nowrap font-mono text-[11px]">{String(r[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
