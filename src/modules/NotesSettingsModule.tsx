import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2, RefreshCw, Sun, Moon, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { AiLanguage, AiMode } from '../types/os';

export const NotesResourcesModule: React.FC = () => {
  const { notes, refreshWorkspace, pushNotification } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('SQL');
  const [content, setContent] = useState('');

  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (notes.length > 0 && !hasHydrated) {
      setSelectedId(notes[0].id);
      setTitle(notes[0].title);
      setCategory(notes[0].category);
      setContent(notes[0].content);
      setHasHydrated(true);
    }
  }, [notes, hasHydrated]);

  const saveNote = async () => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedId || undefined,
        title: title.trim() || 'Untitled Note',
        category,
        content,
      }),
    });
    const saved = await res.json();
    setSelectedId(saved.id);
    await refreshWorkspace();
    pushNotification('Note Saved', `"${saved.title}" stored in SQLite.`, 'success');
  };

  const deleteNote = async (id: string) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (selectedId === id) setSelectedId(null);
    await refreshWorkspace();
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">Notes &amp; Analyst Resources</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Persistent Markdown notes, SQL snippets, statistical test checklists, and interview playbooks.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedId(null);
            setTitle('New Study Note');
            setCategory('General');
            setContent('');
          }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Note</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
        <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-3 space-y-1.5">
          {notes.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                setSelectedId(n.id);
                setTitle(n.title);
                setCategory(n.category);
                setContent(n.content);
              }}
              className={`p-2.5 rounded border cursor-pointer flex items-center justify-between gap-2 ${
                selectedId === n.id ? 'border-blue-600 bg-blue-600/10' : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{n.title}</div>
                <div className="text-[11px] text-slate-500">{n.category}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(n.id);
                }}
                className="text-slate-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              className="flex-1 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] font-medium"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
            >
              {['SQL', 'Excel', 'Python', 'Statistics', 'Power BI', 'Business Analysis', 'Interview', 'General'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={saveNote}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          </div>

          <textarea
            rows={16}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write markdown notes, DAX formulas, or SQL snippets..."
            className="w-full p-3.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] font-mono text-xs leading-relaxed focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

export const SettingsModule: React.FC = () => {
  const {
    theme,
    toggleTheme,
    aiMode,
    setAiMode,
    aiLanguage,
    setAiLanguage,
    updateSetting,
    refreshWorkspace,
    pushNotification,
  } = useWorkspace();

  const [reseeding, setReseeding] = useState(false);

  const handleReseed = async () => {
    setReseeding(true);
    try {
      await fetch('/api/admin/reseed-samples', { method: 'POST' });
      await refreshWorkspace();
      pushNotification('Sample Data Restored', 'All 12 sample datasets and starter scripts were verified/restored.', 'success');
    } finally {
      setReseeding(false);
    }
  };

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-6 text-xs">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
          Workstation Settings &amp; System Architecture
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure appearance, Gemini AI defaults, database maintenance, and external infrastructure references.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
          <h2 className="text-sm font-display font-semibold">Preferences</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Color Theme</div>
              <div className="text-slate-500">Dark workstation theme by default</div>
            </div>
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">Default Gemini AI Mode</div>
              <div className="text-slate-500">Applies across contextual panels</div>
            </div>
            <select
              value={aiMode}
              onChange={(e) => {
                setAiMode(e.target.value as AiMode);
                updateSetting('defaultAiMode', e.target.value);
              }}
              className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
            >
              <option value="analyst">Professional Analyst</option>
              <option value="learn">Learn / Tutor</option>
              <option value="practice">Practice Coach</option>
              <option value="interview">Interview Mode</option>
              <option value="report">Report Generation</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium">Default AI Language</div>
              <div className="text-slate-500">English, Telugu (తెలుగు), or Bilingual</div>
            </div>
            <select
              value={aiLanguage}
              onChange={(e) => {
                setAiLanguage(e.target.value as AiLanguage);
                updateSetting('defaultAiLanguage', e.target.value);
              }}
              className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
            >
              <option value="english">English</option>
              <option value="telugu">Telugu (తెలుగు)</option>
              <option value="bilingual">English + Telugu</option>
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
          <h2 className="text-sm font-display font-semibold">Database &amp; Security Controls</h2>
          <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              Gemini API keys remain strictly server-side (`process.env.GEMINI_API_KEY`). Python executes exclusively in an isolated client-side Pyodide WebAssembly Worker with a 25-second timeout. SQL Studio blocks access to internal `_vos_*` metadata tables and unsafe pragmas.
            </span>
          </div>
          <button
            onClick={handleReseed}
            disabled={reseeding}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reseeding ? 'animate-spin' : ''}`} />
            <span>{reseeding ? 'Restoring...' : 'Restore / Verify 12 Sample Datasets'}</span>
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-2.5">
        <h2 className="text-sm font-display font-semibold">External Infrastructure &amp; Enterprise Database Integration Notes</h2>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          Venky Analytics OS ships zero-dependency with a genuine persistent SQLite 3 relational engine (`sql.js` persisted to `data/venky_os.sqlite`) plus transparent syntax compatibility translation for common Oracle, PostgreSQL, and MySQL idioms.
        </p>
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
          For full native Oracle PL/SQL stored procedures, Oracle Free 23ai (`gvenzl/oracle-free` Docker container) or a managed PostgreSQL/MySQL database server can be connected in a dedicated server deployment via `oracledb`, `pg`, or `mysql2` connection pools configured through server environment variables.
        </p>
      </div>
    </div>
  );
};
