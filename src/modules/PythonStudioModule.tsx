import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Plus,
  Trash2,
  RotateCcw,
  Download,
  Save,
  Sparkles,
  Loader2,
  ShieldCheck,
  Database,
} from 'lucide-react';
import Papa from 'papaparse';
import { useWorkspace } from '../context/WorkspaceContext';
import { NotebookCell } from '../types/os';
import { exportJsonFile } from '../utils/exporters';

const WORKER_SCRIPT = `
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let pyodide = null;
let initialized = false;

async function ensurePyodide() {
  if (initialized && pyodide) return pyodide;
  self.postMessage({ type: "status", message: "Loading isolated Python 3.12 WebAssembly runtime..." });
  pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/"
  });
  pyodide.FS.mkdirTree("/workspace");
  initialized = true;
  self.postMessage({ type: "ready" });
  return pyodide;
}

self.onmessage = async (event) => {
  const { type, id, code, files } = event.data;
  try {
    const py = await ensurePyodide();
    if (type === "init") return;
    if (type === "mount" && files) {
      for (const [name, csvText] of Object.entries(files)) {
        py.FS.writeFile("/workspace/" + name, csvText, { encoding: "utf8" });
      }
      self.postMessage({ type: "mounted", count: Object.keys(files).length });
      return;
    }
    if (type === "run") {
      const start = performance.now();
      self.postMessage({ type: "status", message: "Loading packages required by this cell…" });
      const aliases = [
        ["pd", "import pandas as pd"],
        ["np", "import numpy as np"],
        ["plt", "import matplotlib.pyplot as plt"],
      ];
      const imports = aliases.filter(([alias]) => new RegExp("\\\\b" + alias + "\\\\s*\\\\.").test(code) && !py.globals.has(alias));
      const prelude = imports.map(([, statement]) => statement).join("\\n");
      await py.loadPackagesFromImports(prelude + "\\n" + code);
      if (Object.hasOwn(py.loadedPackages, "matplotlib")) {
        await py.runPythonAsync(\`
import sys
if "matplotlib.pyplot" not in sys.modules:
    import matplotlib
    matplotlib.use("Agg")
\`);
      }
      if (prelude) await py.runPythonAsync(prelude);
      py.globals.set("__user_code__", code);
      const rawJson = await py.runPythonAsync(\`
import io, sys, json, base64, traceback
_pyplot = sys.modules.get("matplotlib.pyplot")

_stdout = io.StringIO()
_stderr = io.StringIO()
_old_out, _old_err = sys.stdout, sys.stderr
sys.stdout, sys.stderr = _stdout, _stderr
_images = []
_err = ""

def _capture_show(*args, **kwargs):
    pyplot = sys.modules.get("matplotlib.pyplot")
    for num in pyplot.get_fignums():
        fig = pyplot.figure(num)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=130, bbox_inches="tight")
        buf.seek(0)
        _images.append("data:image/png;base64," + base64.b64encode(buf.read()).decode("utf-8"))
    pyplot.close("all")

if _pyplot:
    _pyplot.show = _capture_show

try:
    exec(compile(__user_code__, "<notebook_cell>", "exec"), globals())
    _pyplot = sys.modules.get("matplotlib.pyplot")
    if _pyplot and _pyplot.get_fignums():
        _capture_show()
except Exception:
    _err = traceback.format_exc()
finally:
    sys.stdout, sys.stderr = _old_out, _old_err

json.dumps({
    "stdout": _stdout.getvalue(),
    "stderr": _stderr.getvalue() + _err,
    "images": _images
})
\`);
      const parsed = JSON.parse(rawJson);
      self.postMessage({
        type: "result",
        id,
        stdout: parsed.stdout,
        stderr: parsed.stderr,
        images: parsed.images,
        execMs: Math.round(performance.now() - start)
      });
    }
  } catch (err) {
    self.postMessage({
      type: type === "init" ? "boot-error" : "result",
      id,
      stdout: "",
      stderr: String(err && err.message ? err.message : err),
      images: [],
      execMs: 0
    });
  }
};
`;

const STARTER_SNIPPETS = [
  {
    label: 'EDA Summary',
    code: `df = pd.read_csv('/workspace/retail_sales.csv')\nprint(df.info())\nprint("\\nNumeric Summary:")\nprint(df.describe().round(2))`,
  },
  {
    label: 'Correlation Matrix',
    code: `df = pd.read_csv('/workspace/retail_sales.csv')\nnum_df = df.select_dtypes(include=[np.number])\nprint(num_df.corr().round(3))`,
  },
  {
    label: 'IQR Outlier Check',
    code: `df = pd.read_csv('/workspace/raw_dirty_sales.csv')\nq1, q3 = df['unit_price'].quantile([0.25, 0.75])\niqr = q3 - q1\noutliers = df[(df['unit_price'] < q1 - 1.5*iqr) | (df['unit_price'] > q3 + 1.5*iqr)]\nprint(f"IQR: {iqr:.2f} | Outliers found: {len(outliers)}")\nprint(outliers[['tx_id', 'product_name', 'unit_price']])`,
  },
  {
    label: 'Matplotlib Chart',
    code: `df = pd.read_csv('/workspace/marketing_campaigns.csv')\nch = df.groupby('channel')[['spend', 'revenue']].sum()\nch['roas'] = (ch['revenue'] / ch['spend']).round(2)\nfig, ax = plt.subplots(figsize=(7.5, 3.6))\nax.bar(ch.index, ch['roas'], color='#2563EB')\nax.set_title('Marketing ROAS by Channel (Computed in Python)')\nax.set_ylabel('ROAS (x)')\nplt.xticks(rotation=20)\nplt.tight_layout()\nplt.show()`,
  },
];

export const PythonStudioModule: React.FC = () => {
  const {
    notebooks,
    datasets,
    activeDatasetId,
    refreshWorkspace,
    pushNotification,
    askGeminiWithPrompt,
    updateAiContext,
  } = useWorkspace();

  const [nbTitle, setNbTitle] = useState('Retail Sales Exploratory Data Analysis.ipynb');
  const [nbId, setNbId] = useState<string>('nb_retail_eda');
  const [cells, setCells] = useState<NotebookCell[]>([
    {
      id: 'c1',
      type: 'code',
      source: `import pandas as pd\nimport numpy as np\n\ndf = pd.read_csv('/workspace/retail_sales.csv')\nprint("Loaded rows:", len(df))\nprint(df.groupby('region')[['revenue', 'profit']].sum().round(2))`,
    },
  ]);

  const [kernelState, setKernelState] = useState<'idle' | 'loading' | 'ready' | 'running' | 'error'>('idle');
  const [kernelMsg, setKernelMsg] = useState('Boot the kernel or run a cell to load Python. Libraries and CSVs load as needed.');
  const [mountedTables, setMountedTables] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const [initializedNb, setInitializedNb] = useState(false);

  useEffect(() => {
    if (notebooks.length > 0 && !initializedNb) {
      setNbId(notebooks[0].id);
      setNbTitle(notebooks[0].title);
      setCells(notebooks[0].cells);
      setInitializedNb(true);
    }
  }, [notebooks, initializedNb]);

  const mountedVersions = useRef(new Map<string, string>());

  async function mountDatasets(worker: Worker, tableNames: string[], refresh = false) {
    const files: Record<string, string> = {};
    const versions = new Map<string, string>();
    for (const tableName of new Set(tableNames)) {
      const dataset = datasets.find(item => item.table_name === tableName);
      if (!dataset) continue;
      const version = [dataset.id, dataset.version, dataset.updated_at].join(':');
      if (!refresh && mountedVersions.current.get(tableName) === version) continue;
      const response = await fetch(`/api/datasets/${encodeURIComponent(dataset.id)}/rows?limit=2000`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Could not load ${tableName}.csv.`);
      const data = await response.json();
      files[`${tableName}.csv`] = Papa.unparse(data.rows ?? []);
      versions.set(tableName, version);
    }
    if (workerRef.current !== worker || !versions.size) return;
    worker.postMessage({ type: 'mount', files });
    for (const [table, version] of versions) mountedVersions.current.set(table, version);
    setMountedTables([...mountedVersions.current.keys()]);
  }

  const bootWorker = (): Promise<Worker> => {
    return new Promise((resolve, reject) => {
      if (workerRef.current && kernelState === 'ready') {
        resolve(workerRef.current);
        return;
      }
      setKernelState('loading');
      setKernelMsg('Booting sandboxed Pyodide Web Worker...');
      const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      URL.revokeObjectURL(url);
      workerRef.current = worker;

      const onMsg = async (e: MessageEvent) => {
        const data = e.data;
        if (data.type === 'status') {
          setKernelMsg(data.message);
        } else if (data.type === 'ready') {
          if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
          setKernelState('ready');
          setKernelMsg('Python 3.12 sandbox ready');
          resolve(worker);
        } else if (data.type === 'boot-error') {
          if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
          worker.terminate();
          workerRef.current = null;
          setKernelState('error');
          setKernelMsg(data.stderr);
          reject(new Error(data.stderr));
        } else if (data.type === 'result') {
          if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
          setCells((prev) =>
            prev.map((c) =>
              c.id === data.id
                ? { ...c, stdout: data.stdout, stderr: data.stderr, images: data.images, execMs: data.execMs }
                : c
            )
          );
          setKernelState('ready');
          setKernelMsg('Python 3.12 sandbox ready');
          updateAiContext({
            recentOutput: data.stderr ? `Python Error:\n${data.stderr}` : `Python stdout:\n${data.stdout}`,
          });
        }
      };

      worker.onmessage = onMsg;
      worker.onerror = (err) => {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        worker.terminate();
        workerRef.current = null;
        mountedVersions.current.clear();
        setMountedTables([]);
        setKernelState('error');
        setKernelMsg(`Sandbox worker error: ${err.message}`);
        reject(err);
      };
      timeoutRef.current = window.setTimeout(() => {
        worker.terminate();
        workerRef.current = null;
        setKernelState('error');
        const message = 'Python runtime download timed out. Check the connection and try again.';
        setKernelMsg(message);
        reject(new Error(message));
      }, 60_000);
      worker.postMessage({ type: 'init' });
    });
  };

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const restartKernel = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    workerRef.current?.terminate();
    workerRef.current = null;
    mountedVersions.current.clear();
    setMountedTables([]);
    setKernelState('idle');
    setKernelMsg('Kernel terminated. Ready to boot fresh isolated Python sandbox.');
  };

  const runCell = async (cell: NotebookCell) => {
    if (cell.type !== 'code' || kernelState === 'loading' || kernelState === 'running') return;
    updateAiContext({ activeCode: cell.source });
    try {
      const worker = await bootWorker();
      setKernelState('running');
      const tables = [...cell.source.matchAll(/\/workspace\/([a-zA-Z0-9_]+)\.csv\b/g)].map(match => match[1]);
      await mountDatasets(worker, tables);
      if (workerRef.current !== worker) return;
      // Enforce strict 25s execution timeout resource limit
      timeoutRef.current = window.setTimeout(() => {
        restartKernel();
        setCells((prev) =>
          prev.map((c) =>
            c.id === cell.id
              ? { ...c, stderr: 'Execution Timeout (25s limit): Kernel terminated to protect browser resources.' }
              : c
          )
        );
      }, 25000);
      worker.postMessage({ type: 'run', id: cell.id, code: cell.source });
    } catch (error) {
      if (!workerRef.current) return;
      setKernelState('ready');
      setKernelMsg(error instanceof Error ? error.message : 'Could not load a notebook dataset.');
    }
  };

  const addCell = (type: 'code' | 'markdown', source = '') => {
    setCells((prev) => [...prev, { id: `c_${Date.now()}`, type, source }]);
  };

  const saveNotebook = async () => {
    await fetch('/api/notebooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: nbId, title: nbTitle, cells }),
    });
    await refreshWorkspace();
    pushNotification('Notebook Saved', `"${nbTitle}" saved to persistent workspace.`, 'success');
  };

  const selectSavedNotebook = (id: string) => {
    const found = notebooks.find((n) => n.id === id);
    if (!found) return;
    setNbId(found.id);
    setNbTitle(found.title);
    setCells(found.cells);
  };

  const createNewNotebook = () => {
    const newId = `nb_${Date.now()}`;
    const ds = datasets.find((d) => d.id === activeDatasetId);
    const tbl = ds?.table_name || 'retail_sales';
    setNbId(newId);
    setNbTitle(`Analysis_${tbl}.ipynb`);
    setCells([
      {
        id: `c_${Date.now()}`,
        type: 'code',
        source: `import pandas as pd\nimport numpy as np\n\ndf = pd.read_csv('/workspace/${tbl}.csv')\nprint("Shape:", df.shape)\nprint(df.head())`,
      },
    ]);
  };

  const downloadIpynb = () => {
    const ipynb = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: { kernelspec: { display_name: 'Python 3 (Pyodide)', language: 'python', name: 'python3' } },
      cells: cells.map((c) => ({
        cell_type: c.type,
        metadata: {},
        source: c.source.split('\n').map((l, i, arr) => (i < arr.length - 1 ? `${l}\n` : l)),
        ...(c.type === 'code' ? { outputs: [], execution_count: null } : {}),
      })),
    };
    exportJsonFile(ipynb, nbTitle.endsWith('.ipynb') ? nbTitle : `${nbTitle}.ipynb`);
  };

  const activeDs = datasets.find((d) => d.id === activeDatasetId);

  return (
    <div className="p-6 max-w-[1380px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Python Analytics Studio
          </h1>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Isolated Client-Side Pyodide WebAssembly Sandbox · Zero server-side arbitrary code execution · 25s resource timeout</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { void bootWorker().catch(() => undefined); }}
            disabled={kernelState === 'loading' || kernelState === 'ready' || kernelState === 'running'}
            className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            {kernelState === 'ready' ? 'Kernel Ready' : kernelState === 'loading' ? 'Booting...' : 'Boot Python Kernel'}
          </button>
          <button
            onClick={restartKernel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart</span>
          </button>
          <button
            onClick={saveNotebook}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
          <button
            onClick={downloadIpynb}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.ipynb</span>
          </button>
        </div>
      </div>

      {/* Kernel Status & Dataset Mounting Bar */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {(kernelState === 'loading' || kernelState === 'running') && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
          )}
          <span className="text-slate-700 dark:text-slate-300">{kernelMsg}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
          <Database className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {mountedTables.length > 0
              ? `Mounted ${mountedTables.length} CSVs in /workspace/`
              : `Active CSV path: /workspace/${activeDs?.table_name || 'retail_sales'}.csv`}
          </span>
          {kernelState === 'ready' && workerRef.current && (
            <button
              disabled={!activeDs}
              onClick={async () => {
                if (!activeDs || !workerRef.current) return;
                const worker = workerRef.current;
                setKernelState('running');
                try {
                  await mountDatasets(worker, [activeDs.table_name], true);
                  if (workerRef.current === worker) setKernelMsg('Active CSV mounted');
                } catch (error) {
                  if (workerRef.current === worker) setKernelMsg(String(error));
                } finally {
                  if (workerRef.current === worker) setKernelState('ready');
                }
              }}
              className="ml-1 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300"
            >
              Mount active CSV
            </button>
          )}
        </div>
      </div>

      {/* Notebook Controls & Snippets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {notebooks.length > 0 && (
            <select
              aria-label="Select saved notebook"
              value={notebooks.some((n) => n.id === nbId) ? nbId : ''}
              onChange={(e) => e.target.value && selectSavedNotebook(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] text-xs"
            >
              <option value="">Saved Notebooks ({notebooks.length})</option>
              {notebooks.map((n) => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            value={nbTitle}
            onChange={(e) => setNbTitle(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1722] text-xs font-medium w-64"
          />
          <button
            onClick={createNewNotebook}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
          <button
            onClick={() => addCell('code', `# Active dataset\ndf = pd.read_csv('/workspace/${activeDs?.table_name || 'retail_sales'}.csv')\nprint(df.head())`)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Code Cell</span>
          </button>
          <button
            onClick={() => addCell('markdown', '### Analytical Findings\n- Write key business takeaways here.')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Markdown</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-slate-500">Insert snippet:</span>
          {STARTER_SNIPPETS.map((sn) => (
            <button
              key={sn.label}
              onClick={() => addCell('code', sn.code)}
              className="px-2 py-1 rounded border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 text-slate-700 dark:text-slate-300"
            >
              {sn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cells Stream */}
      <div className="space-y-4">
        {cells.map((cell, idx) => (
          <div
            key={cell.id}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] overflow-hidden"
          >
            <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                <span>In [{idx + 1}]</span>
                <span>·</span>
                <span>{cell.type === 'code' ? 'Python 3' : 'Markdown'}</span>
                {cell.execMs !== undefined && <span className="tabular-nums">· {cell.execMs}ms</span>}
              </div>

              <div className="flex items-center gap-1.5">
                {cell.type === 'code' && (
                  <>
                    <button
                      onClick={() => runCell(cell)}
                      disabled={kernelState === 'loading' || kernelState === 'running'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-medium"
                    >
                      <Play className="w-3 h-3" />
                      <span>Run</span>
                    </button>
                    <button
                      onClick={() =>
                        askGeminiWithPrompt(
                          cell.stderr
                            ? `Explain and fix this Python error:\n${cell.stderr}\n\nCode:\n${cell.source}`
                            : `Explain this Python Pandas/Analytics code step by step and suggest improvements:\n${cell.source}`,
                          'learn'
                        )
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px] text-blue-600 dark:text-blue-400"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{cell.stderr ? 'Fix Error' : 'Explain'}</span>
                    </button>
                  </>
                )}
                {cells.length > 1 && (
                  <button
                    onClick={() => setCells((prev) => prev.filter((c) => c.id !== cell.id))}
                    className="p-1 text-slate-400 hover:text-red-500"
                    aria-label="Delete cell"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <textarea
              value={cell.source}
              onChange={(e) =>
                setCells((prev) => prev.map((c) => (c.id === cell.id ? { ...c, source: e.target.value } : c)))
              }
              rows={Math.max(3, Math.min(18, cell.source.split('\n').length + 1))}
              spellCheck={false}
              className={`w-full p-3.5 bg-white dark:bg-[#0F1722] text-slate-900 dark:text-slate-100 focus:outline-none resize-y ${
                cell.type === 'code' ? 'font-mono text-[13px] leading-relaxed' : 'text-sm leading-relaxed'
              }`}
            />

            {(cell.stdout || cell.stderr || (cell.images && cell.images.length > 0)) && (
              <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A] p-3.5 space-y-3">
                {cell.stdout && (
                  <pre className="font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap overflow-x-auto">
                    {cell.stdout}
                  </pre>
                )}
                {cell.stderr && (
                  <pre className="font-mono text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap overflow-x-auto">
                    {cell.stderr}
                  </pre>
                )}
                {cell.images && cell.images.length > 0 && (
                  <div className="space-y-2">
                    {cell.images.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Python matplotlib output ${i + 1}`}
                        className="max-w-full rounded border border-slate-200 dark:border-slate-800 bg-white"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
