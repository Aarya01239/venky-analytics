import React, { useEffect, useState } from 'react';
import { Save, Plus, Download, Trash2, Sparkles, GitBranch } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportStructuredDocx, exportStructuredPdf } from '../utils/exporters';

const BA_TEMPLATES: { type: string; label: string; defaultFields: Record<string, string> }[] = [
  {
    type: 'BRD',
    label: 'Business Requirements Document (BRD)',
    defaultFields: {
      executiveSummary: '',
      businessObjectives: '',
      scopeIn: '',
      scopeOut: '',
      stakeholders: '',
      functionalReqs: '',
      nonFunctionalReqs: '',
      acceptanceCriteria: '',
    },
  },
  {
    type: 'FRD',
    label: 'Functional Requirements Document (FRD)',
    defaultFields: {
      systemOverview: '',
      dataFlows: '',
      businessRules: '',
      interfaceSpecs: '',
      errorHandling: '',
      securityAndAudit: '',
    },
  },
  {
    type: 'USER_STORIES',
    label: 'User Stories, Acceptance Criteria & MoSCoW',
    defaultFields: {
      epicGoal: '',
      mustHaveStories: 'As a [role], I want [capability], so that [business value].\nAC: Given..., When..., Then...',
      shouldHaveStories: '',
      couldHaveStories: '',
      wontHaveScope: '',
    },
  },
  {
    type: 'GAP_SWOT',
    label: 'AS-IS / TO-BE Gap, Root Cause & SWOT',
    defaultFields: {
      asIsProcess: '',
      toBeProcess: '',
      identifiedGaps: '',
      fiveWhysRootCause: 'Why 1:\nWhy 2:\nWhy 3:\nWhy 4:\nWhy 5:',
      swotStrengths: '',
      swotWeaknesses: '',
      swotOpportunities: '',
      swotThreats: '',
    },
  },
  {
    type: 'RACI_RTM_UAT',
    label: 'Stakeholder RACI, Traceability (RTM) & UAT Cases',
    defaultFields: {
      raciMatrix: 'Deliverable | Responsible | Accountable | Consulted | Informed\nBRD Sign-off | BA | VP Ops | Finance | Engineering',
      rtmMapping: 'Req ID | Requirement | Design Ref | Test Case ID | Status\nFR-01 | Margin Alert | SQL View v1 | UAT-01 | Planned',
      uatTestCases: 'UAT-01: Verify discount >15% triggers exception flag.\nExpected Result: Row highlighted in Margin Audit report.',
      changeRequests: 'CR-01: Add regional currency filter (Impact: Low, Status: Pending CAB).',
    },
  },
];

const FIELD_LABELS: Record<string, string> = {
  executiveSummary: 'Executive Summary',
  businessObjectives: 'Business Objectives & ROI',
  scopeIn: 'In Scope',
  scopeOut: 'Out of Scope',
  stakeholders: 'Stakeholder Analysis',
  functionalReqs: 'Functional Requirements',
  nonFunctionalReqs: 'Non-Functional Requirements',
  acceptanceCriteria: 'Acceptance Criteria',
  systemOverview: 'System & Architecture Overview',
  dataFlows: 'Inputs, Outputs & Data Flows',
  businessRules: 'Business Logic & Validation Rules',
  interfaceSpecs: 'UI / API Interface Specifications',
  errorHandling: 'Exception & Error Handling',
  securityAndAudit: 'Security, RBAC & Audit Logging',
  epicGoal: 'Epic Business Goal',
  mustHaveStories: 'Must Have (MoSCoW)',
  shouldHaveStories: 'Should Have (MoSCoW)',
  couldHaveStories: 'Could Have (MoSCoW)',
  wontHaveScope: 'Won’t Have This Release',
  asIsProcess: 'Current State (AS-IS)',
  toBeProcess: 'Target State (TO-BE)',
  identifiedGaps: 'Gap Analysis & Remediation',
  fiveWhysRootCause: 'Root Cause Analysis (5 Whys)',
  swotStrengths: 'SWOT — Strengths',
  swotWeaknesses: 'SWOT — Weaknesses',
  swotOpportunities: 'SWOT — Opportunities',
  swotThreats: 'SWOT — Threats',
  raciMatrix: 'Stakeholder RACI Matrix',
  rtmMapping: 'Requirements Traceability Matrix (RTM)',
  uatTestCases: 'UAT Test Cases & Sign-Off Criteria',
  changeRequests: 'Change Request Log & Meeting Notes',
};

export const BusinessAnalysisModule: React.FC = () => {
  const { baDocs, refreshWorkspace, pushNotification, askGeminiWithPrompt } = useWorkspace();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [docType, setDocType] = useState('BRD');
  const [title, setTitle] = useState('New Business Requirements Document');
  const [fields, setFields] = useState<Record<string, string>>(BA_TEMPLATES[0].defaultFields);
  const [viewMode, setViewMode] = useState<'docs' | 'diagram'>('docs');

  // Visual Process / BPMN Flow Builder State
  const [diagramType, setDiagramType] = useState<'bpmn' | 'usecase' | 'sequence'>('bpmn');
  const [flowSteps, setFlowSteps] = useState<string[]>([
    'Start: Sales Order Received',
    'Validate Discount Threshold (>15%)',
    'Decision: Manager Approval Required?',
    'Update Margin Audit Ledger',
    'End: Publish Daily MIS Pack',
  ]);
  const [newStepText, setNewStepText] = useState('');

  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (baDocs.length > 0 && !hasHydrated) {
      const first = baDocs[0];
      setSelectedId(first.id);
      setDocType(first.doc_type);
      setTitle(first.title);
      setFields(first.content || BA_TEMPLATES[0].defaultFields);
      setHasHydrated(true);
    }
  }, [baDocs, hasHydrated]);

  const startNewDoc = (type: string) => {
    const tmpl = BA_TEMPLATES.find((t) => t.type === type) || BA_TEMPLATES[0];
    setSelectedId(null);
    setDocType(tmpl.type);
    setTitle(`New ${tmpl.label}`);
    setFields({ ...tmpl.defaultFields });
  };

  const saveDoc = async () => {
    const res = await fetch('/api/ba-docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedId || undefined,
        doc_type: docType,
        title,
        content: fields,
      }),
    });
    const saved = await res.json();
    setSelectedId(saved.id);
    await refreshWorkspace();
    pushNotification('BA Document Saved', `"${title}" saved to SQLite repository.`, 'success');
  };

  const deleteDoc = async (id: string) => {
    await fetch(`/api/ba-docs/${id}`, { method: 'DELETE' });
    if (selectedId === id) setSelectedId(null);
    await refreshWorkspace();
  };

  const sectionsForExport = Object.entries(fields).map(([k, v]) => ({
    heading: FIELD_LABELS[k] || k,
    body: String(v || '—'),
  }));

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Business Analysis Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            BRD, FRD, User Stories, MoSCoW, AS-IS/TO-BE Gap, Root Cause, SWOT, RACI, RTM, UAT, Visual Process Mapping, and DOCX/PDF Export.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0F1722] border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('docs')}
              className={`px-3 py-1 rounded font-medium ${viewMode === 'docs' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}
            >
              BA Artifacts &amp; Templates
            </button>
            <button
              onClick={() => setViewMode('diagram')}
              className={`px-3 py-1 rounded font-medium inline-flex items-center gap-1 ${viewMode === 'diagram' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>BPMN &amp; Process Diagrams</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'docs' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Library */}
          <div className="lg:col-span-3 space-y-4 text-xs">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-4 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Create From Template</div>
              {BA_TEMPLATES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => startNewDoc(t.type)}
                  className="w-full text-left px-2.5 py-2 rounded border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-4 space-y-2">
              <div className="font-semibold text-slate-900 dark:text-slate-100">Saved Documents ({baDocs.length})</div>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {baDocs.map((d) => (
                  <div
                    key={d.id}
                    className={`p-2 rounded border flex items-center justify-between gap-2 cursor-pointer ${
                      selectedId === d.id
                        ? 'border-blue-600 bg-blue-600/10'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                    onClick={() => {
                      setSelectedId(d.id);
                      setDocType(d.doc_type);
                      setTitle(d.title);
                      setFields(d.content || {});
                    }}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate text-slate-900 dark:text-slate-100">{d.title}</div>
                      <div className="text-[11px] text-slate-500">{d.doc_type}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDoc(d.id);
                      }}
                      className="text-slate-400 hover:text-red-500 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Editor */}
          <div className="lg:col-span-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 text-base font-display font-semibold bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none border-b border-transparent focus:border-blue-500"
              />
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={saveDoc}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
                <button
                  onClick={() =>
                    exportStructuredDocx({
                      title,
                      subtitle: `Venky Analytics OS · ${docType} · Generated ${new Date().toLocaleDateString()}`,
                      sections: sectionsForExport,
                      filename: `${title.replace(/[^a-z0-9]+/gi, '_')}.docx`,
                    })
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOCX</span>
                </button>
                <button
                  onClick={() =>
                    exportStructuredPdf({
                      title,
                      subtitle: `Venky Analytics OS · ${docType}`,
                      sections: sectionsForExport,
                      filename: `${title.replace(/[^a-z0-9]+/gi, '_')}.pdf`,
                    })
                  }
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  onClick={() =>
                    askGeminiWithPrompt(
                      `Review and strengthen this ${docType} titled "${title}". Suggest missing edge cases, measurable KPIs, and crisp acceptance criteria:\n${JSON.stringify(
                        fields,
                        null,
                        2
                      )}`,
                      'analyst'
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-blue-500/40 text-xs text-blue-600 dark:text-blue-400"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Review</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {Object.entries(fields).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    {FIELD_LABELS[key] || key}
                  </label>
                  <textarea
                    rows={4}
                    value={val}
                    onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full p-2.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Interactive Process Flow / BPMN / Use Case / Sequence Diagram Builder */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <div className="lg:col-span-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 space-y-4">
            <div className="flex items-center gap-1.5">
              {(['bpmn', 'usecase', 'sequence'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDiagramType(t)}
                  className={`px-2.5 py-1.5 rounded border uppercase text-[11px] font-medium ${
                    diagramType === t ? 'border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400' : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div className="font-semibold">Process Nodes ({flowSteps.length})</div>
              {flowSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => setFlowSteps((prev) => prev.map((s, idx) => (idx === i ? e.target.value : s)))}
                    className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
                  />
                  <button
                    onClick={() => setFlowSteps((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newStepText}
                  onChange={(e) => setNewStepText(e.target.value)}
                  placeholder="Add workflow step..."
                  className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]"
                />
                <button
                  onClick={() => {
                    if (!newStepText.trim()) return;
                    setFlowSteps((prev) => [...prev, newStepText.trim()]);
                    setNewStepText('');
                  }}
                  className="px-3 py-1.5 rounded bg-blue-600 text-white font-medium"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-6 overflow-x-auto">
            <h2 className="text-sm font-display font-semibold mb-4 uppercase tracking-wide text-slate-500">
              {diagramType === 'bpmn'
                ? 'BPMN Process Flow Diagram'
                : diagramType === 'usecase'
                ? 'Actor → Use Case Interaction Map'
                : 'System Sequence Interaction Flow'}
            </h2>
            <svg width="760" height={Math.max(260, flowSteps.length * 76)} className="mx-auto">
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#3B82F6" />
                </marker>
              </defs>
              {flowSteps.map((step, i) => {
                const y = 24 + i * 72;
                const isDecision = /decision|\?/i.test(step);
                return (
                  <g key={i}>
                    <rect
                      x={diagramType === 'sequence' ? 80 + (i % 2) * 240 : 180}
                      y={y}
                      width={380}
                      height={44}
                      rx={isDecision ? 20 : 6}
                      fill={isDecision ? 'rgba(245, 158, 11, 0.14)' : 'rgba(37, 99, 235, 0.12)'}
                      stroke={isDecision ? '#F59E0B' : '#2563EB'}
                      strokeWidth={1.5}
                    />
                    <text
                      x={diagramType === 'sequence' ? 270 + (i % 2) * 240 : 370}
                      y={y + 26}
                      textAnchor="middle"
                      fill="currentColor"
                      fontSize="12"
                      fontFamily="Public Sans, sans-serif"
                    >
                      {i + 1}. {step}
                    </text>
                    {i < flowSteps.length - 1 && (
                      <line
                        x1={370}
                        y1={y + 44}
                        x2={370}
                        y2={y + 70}
                        stroke="#3B82F6"
                        strokeWidth={1.5}
                        markerEnd="url(#arrow)"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
