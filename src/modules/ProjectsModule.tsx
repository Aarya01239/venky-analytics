import React, { useEffect, useState } from 'react';
import { FolderKanban, Plus, Play, Award, Trash2, CheckCircle2, Sparkles } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { REAL_WORLD_PROJECTS, RealWorldProjectBlueprint } from '../data/curriculum';
import { CAREER_TRACKS } from '../data/careerTracks';
import { CareerTrackId } from '../types/os';

export const ProjectsModule: React.FC = () => {
  const {
    projects,
    datasets,
    settings,
    updateSetting,
    refreshWorkspace,
    openDatasetInModule,
    setActiveModule,
    pushNotification,
    askGeminiWithPrompt,
  } = useWorkspace();

  const [selectedBlueprint, setSelectedBlueprint] = useState<RealWorldProjectBlueprint>(REAL_WORLD_PROJECTS[0]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrack, setNewTrack] = useState<CareerTrackId>('data-analyst');
  const [newDatasetId, setNewDatasetId] = useState(datasets[0]?.id || 'ds_retail_sales');
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (settings.project_checklists) {
      try {
        const parsed = JSON.parse(settings.project_checklists);
        if (parsed && typeof parsed === 'object') setCheckedSteps(parsed);
      } catch {
        // ignore invalid json
      }
    }
  }, [settings.project_checklists]);

  const toggleStep = (checkKey: string) => {
    const next = { ...checkedSteps, [checkKey]: !checkedSteps[checkKey] };
    setCheckedSteps(next);
    updateSetting('project_checklists', JSON.stringify(next));
  };

  const createCustomProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDesc.trim(),
        career_track: newTrack,
        dataset_id: newDatasetId,
      }),
    });
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
    await refreshWorkspace();
    pushNotification('Custom Project Created', `"${newName}" registered in workspace.`, 'success');
  };

  const promoteToPortfolio = async (bp: RealWorldProjectBlueprint) => {
    await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: bp.title.replace(/^\d+\.\s*/, ''),
        role_focus: bp.careerTrack,
        problem: bp.businessProblem,
        dataset_desc: `Table: ${bp.tableName} (${bp.domain} domain)`,
        tools: 'SQL Studio, Excel Studio, Python (Pandas/Matplotlib), Statistics Lab, Data Visualization',
        methodology: Object.entries(bp.tasks)
          .map(([k, v]) => `- ${k.toUpperCase()}: ${v}`)
          .join('\n'),
        findings: bp.objectives.map((o) => `- ${o}`).join('\n'),
        recommendations: bp.evaluationCriteria.map((c) => `- ${c}`).join('\n'),
      }),
    });
    await refreshWorkspace();
    pushNotification('Added to Portfolio', `"${bp.title}" promoted to Portfolio Builder.`, 'success');
    setActiveModule('portfolio');
  };

  const deleteCustomProject = async (id: string) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    await refreshWorkspace();
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Real-World End-to-End Projects
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            12 structured enterprise case studies wired directly to live sample datasets plus custom projects on your own uploaded files.
          </p>
        </div>

        <button
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Custom Project</span>
        </button>
      </div>

      {/* Create Custom Project Form */}
      {showCreate && (
        <form
          onSubmit={createCustomProject}
          className="rounded-lg border border-blue-500/40 bg-white dark:bg-[#0F1722] p-5 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs"
        >
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project Title (e.g., Q4 Regional Margin Audit)"
            className="px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
          />
          <select
            value={newTrack}
            onChange={(e) => setNewTrack(e.target.value as CareerTrackId)}
            className="px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
          >
            {CAREER_TRACKS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select
            value={newDatasetId}
            onChange={(e) => setNewDatasetId(e.target.value)}
            className="px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
          >
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Business objective..."
              className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
            />
            <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white font-medium">
              Create
            </button>
          </div>
        </form>
      )}

      {/* User's Saved Custom Projects Strip */}
      {projects.length > 0 && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-4">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
            My Saved Workspace Projects ({projects.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {projects.map((p) => (
              <div key={p.id} className="p-3 rounded border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B111A] text-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                  <button onClick={() => deleteCustomProject(p.id)} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 line-clamp-2">{p.description || 'Custom analyst project'}</div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-mono text-slate-500">{p.career_track}</span>
                  {p.dataset_id && (
                    <button
                      onClick={() => openDatasetInModule(p.dataset_id!, 'sql')}
                      className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                    >
                      Open Dataset →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 12 End-to-End Blueprint Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-3 space-y-1 max-h-[680px] overflow-y-auto">
          {REAL_WORLD_PROJECTS.map((bp) => {
            const active = bp.id === selectedBlueprint.id;
            return (
              <button
                key={bp.id}
                onClick={() => setSelectedBlueprint(bp)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-xs transition-colors ${
                  active
                    ? 'bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-600/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent'
                }`}
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <FolderKanban className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{bp.title}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  {bp.domain} · {bp.tableName}
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-6 space-y-5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="text-[11px] text-slate-500 font-mono">
                {selectedBlueprint.domain} · Table: {selectedBlueprint.tableName} · Role: {selectedBlueprint.careerTrack}
              </div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {selectedBlueprint.title}
              </h2>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => promoteToPortfolio(selectedBlueprint)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Promote to Portfolio</span>
              </button>
              <button
                onClick={() =>
                  askGeminiWithPrompt(
                    `Act as a Senior Analytics Manager reviewing my project "${selectedBlueprint.title}" on table "${selectedBlueprint.tableName}". Guide me through the SQL, Python, and Statistical approach step by step.`,
                    'practice'
                  )
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-blue-500/40 text-blue-600 dark:text-blue-400"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Mentor</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-slate-900 dark:text-slate-100">Business Problem Statement</div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{selectedBlueprint.businessProblem}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Project Objectives</div>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                {selectedBlueprint.objectives.map((o) => <li key={o}>· {o}</li>)}
              </ul>
            </div>
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Key Analytical Questions</div>
              <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                {selectedBlueprint.questions.map((q) => <li key={q}>· {q}</li>)}
              </ul>
            </div>
          </div>

          {/* 6-Tool Execution Checklist with Direct Launch Buttons */}
          <div className="space-y-2.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100">End-to-End Execution Workflow</div>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
              {(
                [
                  { key: 'cleaning', label: 'Data Cleaning Lab', mod: 'cleaning' },
                  { key: 'sql', label: 'SQL Studio', mod: 'sql' },
                  { key: 'excel', label: 'Excel Studio', mod: 'excel' },
                  { key: 'python', label: 'Python Studio', mod: 'python' },
                  { key: 'statistics', label: 'Statistics Lab', mod: 'statistics' },
                  { key: 'visualization', label: 'Visualization Studio', mod: 'visualization' },
                ] as const
              ).map((item) => {
                const checkKey = `${selectedBlueprint.id}_${item.key}`;
                const checked = Boolean(checkedSteps[checkKey]);
                return (
                  <div key={item.key} className="p-3 flex items-start justify-between gap-3">
                    <label className="flex items-start gap-2.5 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStep(checkKey)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className={`font-semibold ${checked ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                          {item.label}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                          {selectedBlueprint.tasks[item.key]}
                        </div>
                      </div>
                    </label>
                    <button
                      onClick={() => openDatasetInModule(selectedBlueprint.datasetId, item.mod)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-[11px] font-medium shrink-0"
                    >
                      <Play className="w-3 h-3 text-blue-500" />
                      <span>Launch</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Evaluation Rubric</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 dark:text-slate-400">
              {selectedBlueprint.evaluationCriteria.map((c) => <span key={c}>· {c}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
