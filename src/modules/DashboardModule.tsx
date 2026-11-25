import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Database,
  FolderKanban,
  Plus,
  Trash2,
  Play,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { CAREER_TRACKS } from '../data/careerTracks';
import { LEARNING_CURRICULUM } from '../data/curriculum';
import { NavModuleId } from '../types/os';

export const DashboardModule: React.FC = () => {
  const {
    activeCareerTrack,
    setActiveCareerTrack,
    setActiveModule,
    openDatasetInModule,
    datasets,
    projects,
    tasks,
    learningProgress,
    scripts,
    refreshWorkspace,
    askGeminiWithPrompt,
  } = useWorkspace();

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskModule, setNewTaskModule] = useState<NavModuleId>('sql');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [savingTask, setSavingTask] = useState(false);

  const track = CAREER_TRACKS.find((c) => c.id === activeCareerTrack) || CAREER_TRACKS[0];
  const completedLessons = LEARNING_CURRICULUM.filter(lesson => learningProgress.some(record => record.topic_id === lesson.id && record.status === 'completed')).length;
  const totalLessons = LEARNING_CURRICULUM.length;
  const learningPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const recommendedDatasets = datasets.filter((d) => track.recommendedDatasetIds.includes(d.id));

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || savingTask) return;
    setSavingTask(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          module: newTaskModule,
          priority: newTaskPriority,
        }),
      });
      setNewTaskTitle('');
      await refreshWorkspace();
    } finally {
      setSavingTask(false);
    }
  };

  const toggleTask = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'todo' : 'done';
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    await refreshWorkspace();
  };

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    await refreshWorkspace();
  };

  const quickTools: { id: NavModuleId; title: string; subtitle: string }[] = [
    { id: 'sql', title: 'SQL Studio', subtitle: 'SQLite / Oracle / PG / MySQL' },
    { id: 'excel', title: 'Excel Studio', subtitle: 'Formulas, Pivots & XLSX' },
    { id: 'python', title: 'Python Studio', subtitle: 'Sandboxed Pandas & Plots' },
    { id: 'statistics', title: 'Statistics Lab', subtitle: 'Tests, Distributions & OLS' },
    { id: 'cleaning', title: 'Data Cleaning Lab', subtitle: 'Audit, Clean & Register' },
    { id: 'powerbi', title: 'Power BI Workspace', subtitle: 'Star Schema & DAX' },
  ];

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Header & Metrics Row */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Personal Analytics Workstation · Persistent SQLite Storage · 14 Career Tracks
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mt-1">
            {track.title} Workspace
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            {track.summary}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveModule(track.starterExercise.module)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Launch Recommended Lab</span>
          </button>
          <button
            onClick={() =>
              askGeminiWithPrompt(
                `Create a practical 7-day job-readiness study & execution plan for a ${track.title} using my available datasets in Venky Analytics OS.`,
                'learn'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Career Study Plan</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip (Real Persistent Counts) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
          <div className="text-xs text-slate-500 dark:text-slate-400">Shared Datasets</div>
          <div className="text-2xl font-display font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {datasets.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {datasets.reduce((a, d) => a + d.row_count, 0).toLocaleString()} total rows indexed
          </div>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
          <div className="text-xs text-slate-500 dark:text-slate-400">Active Projects</div>
          <div className="text-2xl font-display font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {projects.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">{scripts.length} saved SQL scripts</div>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
          <div className="text-xs text-slate-500 dark:text-slate-400">Curriculum Mastery</div>
          <div className="text-2xl font-display font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {learningPct}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {completedLessons} of {totalLessons} core tracks completed
          </div>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722]">
          <div className="text-xs text-slate-500 dark:text-slate-400">Open Analyst Tasks</div>
          <div className="text-2xl font-display font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {tasks.filter((t) => t.status !== 'done').length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {tasks.filter((t) => t.status === 'done').length} completed
          </div>
        </div>
      </div>

      {/* 14 Target Analyst Career Workspaces Selector */}
      <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
              Target Analyst Career Workspaces (14 Roles)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select a role to align recommended tools, datasets, practical exercises, and deliverables.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {CAREER_TRACKS.map((c) => {
            const active = c.id === activeCareerTrack;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCareerTrack(c.id)}
                className={`px-3 py-2 rounded-md text-left text-xs font-medium border transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                }`}
              >
                <div className="truncate">{c.shortTitle}</div>
              </button>
            );
          })}
        </div>

        {/* Active Career Track Detail Strip */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Core Skills Matrix</div>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400">
              {track.coreSkills.map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Professional Deliverables</div>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400">
              {track.keyDeliverables.map((d) => (
                <li key={d}>· {d}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">Practical Role Exercise</div>
            <div className="text-slate-700 dark:text-slate-300 font-medium">{track.starterExercise.title}</div>
            <p className="text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{track.starterExercise.brief}</p>
            <button
              onClick={() => setActiveModule(track.starterExercise.module)}
              className="mt-2.5 inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              <span>Open in {track.starterExercise.module.toUpperCase()} Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Quick Launch + Datasets + Tasks Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Quick Tools & Datasets & Projects */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Launch */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Quick Access Analytics Engines
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {quickTools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveModule(t.id)}
                  className="p-3 rounded-md border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 text-left transition-colors bg-slate-50/50 dark:bg-[#0B111A]/60"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{t.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Recommended & Recent Datasets */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
                Recommended Datasets for {track.shortTitle}
              </h2>
              <button
                onClick={() => setActiveModule('files')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                All {datasets.length} datasets
              </button>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {(recommendedDatasets.length > 0 ? recommendedDatasets : datasets.slice(0, 4)).map((ds) => (
                <div key={ds.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{ds.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
                      {ds.table_name} · {ds.row_count} rows · {ds.columns.length} cols
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openDatasetInModule(ds.id, 'sql')}
                      className="px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      SQL
                    </button>
                    <button
                      onClick={() => openDatasetInModule(ds.id, 'excel')}
                      className="px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Excel
                    </button>
                    <button
                      onClick={() => openDatasetInModule(ds.id, 'statistics')}
                      className="px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Stats
                    </button>
                    <button
                      onClick={() => openDatasetInModule(ds.id, 'visualization')}
                      className="px-2.5 py-1 rounded text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Charts
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Projects */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
                Recent Analytical Projects
              </h2>
              <button
                onClick={() => setActiveModule('projects')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open Projects Hub
              </button>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {projects.slice(0, 4).map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <FolderKanban className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {p.career_track} · {p.status} · {p.progress}% complete
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveModule('projects')}
                    className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 shrink-0"
                  >
                    Inspect
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 cols: Persistent Task Manager & Learning Progress */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
            <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Analyst Task Queue
            </h2>

            <form onSubmit={handleAddTask} className="space-y-2 mb-4">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add analysis task (e.g., Audit Q4 variance)..."
                className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newTaskModule}
                  onChange={(e) => setNewTaskModule(e.target.value as NavModuleId)}
                  className="flex-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="sql">SQL Studio</option>
                  <option value="excel">Excel Studio</option>
                  <option value="python">Python Studio</option>
                  <option value="statistics">Statistics Lab</option>
                  <option value="cleaning">Data Cleaning</option>
                  <option value="powerbi">Power BI</option>
                  <option value="ba">Business Analysis</option>
                  <option value="reporting">Reporting</option>
                </select>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] text-xs text-slate-800 dark:text-slate-200"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button
                  type="submit"
                  disabled={savingTask || !newTaskTitle.trim()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </form>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-80 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">No tasks queued yet.</div>
              ) : (
                tasks.map((t) => (
                  <div key={t.id} className="py-2.5 flex items-start justify-between gap-2.5">
                    <button
                      onClick={() => toggleTask(t.id, t.status)}
                      className="mt-0.5 text-slate-400 hover:text-blue-500 shrink-0"
                      aria-label="Toggle task status"
                    >
                      {t.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs ${
                          t.status === 'done'
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {t.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        <button
                          onClick={() => setActiveModule(t.module)}
                          className="hover:text-blue-500 underline-offset-2 hover:underline"
                        >
                          {t.module}
                        </button>
                        {' · '}
                        <span
                          className={
                            t.priority === 'high'
                              ? 'text-red-500'
                              : t.priority === 'medium'
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }
                        >
                          {t.priority} priority
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTask(t.id)}
                      className="p-1 text-slate-400 hover:text-red-500 shrink-0"
                      aria-label="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Learning Progress & Skill Readiness */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100">
                Skill Assessment & Learning Progress
              </h2>
              <button
                onClick={() => setActiveModule('learning')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            </div>

            <div className="space-y-3">
              {LEARNING_CURRICULUM.slice(0, 5).map((lesson) => {
                const rec = learningProgress.find((p) => p.topic_id === lesson.id);
                const done = rec?.status === 'completed';
                return (
                  <div key={lesson.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300 truncate pr-2">{lesson.track}: {lesson.title}</span>
                      <span className="font-mono text-[11px] tabular-nums text-slate-500 shrink-0">
                        {done ? `Completed (${rec?.score || 100}%)` : lesson.level}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-blue-600/35'}`}
                        style={{ width: done ? '100%' : rec?.status === 'in_progress' ? '45%' : '8%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
