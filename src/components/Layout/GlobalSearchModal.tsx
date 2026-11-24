import React, { useMemo, useState } from 'react';
import { Search, X, Database, Code2, Briefcase, FolderKanban, ArrowRight } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { NAV_ITEMS } from './Sidebar';
import { CAREER_TRACKS } from '../../data/careerTracks';

export const GlobalSearchModal: React.FC = () => {
  const {
    searchOpen,
    setSearchOpen,
    setActiveModule,
    setActiveCareerTrack,
    datasets,
    openDatasetInModule,
    scripts,
    projects,
  } = useWorkspace();

  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchedModules = NAV_ITEMS.filter(
      (i) => !q || i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)
    ).slice(0, 6);

    const matchedCareers = CAREER_TRACKS.filter(
      (c) => !q || c.title.toLowerCase().includes(q) || c.summary.toLowerCase().includes(q)
    ).slice(0, 4);

    const matchedDatasets = datasets
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.table_name.toLowerCase().includes(q))
      .slice(0, 5);

    const matchedScripts = scripts
      .filter((s) => !q || s.title.toLowerCase().includes(q) || s.sql_text.toLowerCase().includes(q))
      .slice(0, 3);

    const matchedProjects = projects
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 3);

    return { matchedModules, matchedCareers, matchedDatasets, matchedScripts, matchedProjects };
  }, [query, datasets, scripts, projects]);

  if (!searchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[2px] flex items-start justify-center pt-20 px-4"
      onClick={() => setSearchOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111926] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to module, career workspace, dataset, SQL script, or project..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            onClick={() => setSearchOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[440px] overflow-y-auto p-3 space-y-4">
          {results.matchedModules.length > 0 && (
            <div>
              <div className="px-2 mb-1 text-[11px] font-medium text-slate-500">Modules</div>
              <div className="space-y-0.5">
                {results.matchedModules.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setActiveModule(m.id);
                        setSearchOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-medium">{m.label}</span>
                        <span className="text-slate-400">· {m.group}</span>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {results.matchedCareers.length > 0 && (
            <div>
              <div className="px-2 mb-1 text-[11px] font-medium text-slate-500">Analyst Career Tracks</div>
              <div className="space-y-0.5">
                {results.matchedCareers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveCareerTrack(c.id);
                      setActiveModule('dashboard');
                      setSearchOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-medium">{c.title}</span>
                      <span className="text-slate-400 truncate">· {c.summary}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.matchedDatasets.length > 0 && (
            <div>
              <div className="px-2 mb-1 text-[11px] font-medium text-slate-500">Datasets (Open in SQL Studio)</div>
              <div className="space-y-0.5">
                {results.matchedDatasets.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      openDatasetInModule(d.id, 'sql');
                      setSearchOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                  >
                    <span className="flex items-center gap-2.5">
                      <Database className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-medium">{d.name}</span>
                      <span className="font-mono text-slate-400">{d.table_name}</span>
                    </span>
                    <span className="font-mono text-slate-500 tabular-nums">{d.row_count} rows</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.matchedScripts.length > 0 && (
            <div>
              <div className="px-2 mb-1 text-[11px] font-medium text-slate-500">Saved SQL Scripts</div>
              {results.matchedScripts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveModule('sql');
                    setSearchOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                >
                  <Code2 className="w-3.5 h-3.5 text-blue-500" />
                  <span>{s.title}</span>
                </button>
              ))}
            </div>
          )}

          {results.matchedProjects.length > 0 && (
            <div>
              <div className="px-2 mb-1 text-[11px] font-medium text-slate-500">Projects</div>
              {results.matchedProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveModule('projects');
                    setSearchOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-violet-500" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
