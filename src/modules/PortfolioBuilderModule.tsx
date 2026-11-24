import React, { useEffect, useState } from 'react';
import { Save, Plus, Download, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { exportStructuredDocx, exportStructuredPdf, exportTextFile } from '../utils/exporters';

export const PortfolioBuilderModule: React.FC = () => {
  const { portfolioItems, refreshWorkspace, pushNotification } = useWorkspace();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('Regional Retail Margin & Discount Optimization Study');
  const [roleFocus, setRoleFocus] = useState('Data Analyst');
  const [problem, setProblem] = useState('Regional gross margin fell despite rising order volume due to unmonitored >15% discounting.');
  const [datasetDesc, setDatasetDesc] = useState('retail_sales table (140 multi-region transactions across 4 categories and 3 customer segments).');
  const [tools, setTools] = useState('SQL (CTEs & Window Functions), Excel (SUMIFS & Pivots), Python (Pandas/Matplotlib), Statistics (Welch T-Test)');
  const [methodology, setMethodology] = useState('1. Audited data quality and verified zero negative costs.\n2. Computed regional & category margin % using SQL window rankings.\n3. Validated profit impact of >10% discounts with a two-sample T-test.');
  const [findings, setFindings] = useState('- Office Supplies yielded the highest unit margin while heavy Electronics discounts compressed regional profit.\n- Flagship and Online Direct stores showed distinct basket sizes.');
  const [recommendations, setRecommendations] = useState('1. Implement regional manager approval gate for discounts above 15%.\n2. Rebalance Q4 promotional spend toward high-margin bundles.');

  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (portfolioItems.length > 0 && !hasHydrated) {
      const first = portfolioItems[0];
      setSelectedId(first.id);
      setTitle(first.title);
      setRoleFocus(first.role_focus);
      setProblem(first.problem);
      setDatasetDesc(first.dataset_desc);
      setTools(first.tools);
      setMethodology(first.methodology);
      setFindings(first.findings);
      setRecommendations(first.recommendations);
      setHasHydrated(true);
    }
  }, [portfolioItems, hasHydrated]);

  const saveEntry = async () => {
    const res = await fetch('/api/portfolio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedId || undefined,
        title,
        role_focus: roleFocus,
        problem,
        dataset_desc: datasetDesc,
        tools,
        methodology,
        findings,
        recommendations,
      }),
    });
    const saved = await res.json();
    setSelectedId(saved.id);
    await refreshWorkspace();
    pushNotification('Portfolio Saved', `"${title}" saved to portfolio.`, 'success');
  };

  const deleteEntry = async (id: string) => {
    await fetch(`/api/portfolio/${id}`, { method: 'DELETE' });
    if (selectedId === id) setSelectedId(null);
    await refreshWorkspace();
  };

  const sections = [
    { heading: '1. Business Problem', body: problem },
    { heading: '2. Dataset Overview', body: datasetDesc },
    { heading: '3. Analytical Tools & Stack', body: tools },
    { heading: '4. Methodology', body: methodology },
    { heading: '5. Key Verified Findings', body: findings },
    { heading: '6. Strategic Recommendations', body: recommendations },
  ];

  const markdownExport = `# ${title}\n**Target Role:** ${roleFocus}\n\n${sections
    .map((s) => `## ${s.heading}\n${s.body}`)
    .join('\n\n')}`;

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Analytics Portfolio Builder
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Convert completed analytical projects into recruiter-ready PDF, DOCX, and GitHub Markdown case studies.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setSelectedId(null);
              setTitle('New Analytics Case Study');
              setProblem('');
              setDatasetDesc('');
              setMethodology('');
              setFindings('');
              setRecommendations('');
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Entry</span>
          </button>
          <button
            onClick={saveEntry}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Entry</span>
          </button>
          <button
            onClick={() =>
              exportStructuredPdf({
                title,
                subtitle: `Analytics Portfolio Case Study · ${roleFocus}`,
                sections,
                filename: `${title.replace(/[^a-z0-9]+/gi, '_')}_portfolio.pdf`,
              })
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            onClick={() =>
              exportStructuredDocx({
                title,
                subtitle: `Analytics Portfolio Case Study · ${roleFocus}`,
                sections,
                filename: `${title.replace(/[^a-z0-9]+/gi, '_')}_portfolio.docx`,
              })
            }
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOCX</span>
          </button>
          <button
            onClick={() => exportTextFile(markdownExport, `${title.replace(/[^a-z0-9]+/gi, '_')}.md`, 'text/markdown')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>README.md</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
        <div className="lg:col-span-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-4 space-y-2">
          <div className="font-semibold text-slate-900 dark:text-slate-100">Saved Portfolio Entries ({portfolioItems.length})</div>
          {portfolioItems.length === 0 ? (
            <div className="text-slate-500 py-4">Save your first case study or promote one from Real-World Projects.</div>
          ) : (
            portfolioItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setTitle(item.title);
                  setRoleFocus(item.role_focus);
                  setProblem(item.problem);
                  setDatasetDesc(item.dataset_desc);
                  setTools(item.tools);
                  setMethodology(item.methodology);
                  setFindings(item.findings);
                  setRecommendations(item.recommendations);
                }}
                className={`p-2.5 rounded border cursor-pointer flex items-center justify-between gap-2 ${
                  selectedId === item.id ? 'border-blue-600 bg-blue-600/10' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="text-[11px] text-slate-500">{item.role_focus}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteEntry(item.id);
                  }}
                  className="text-slate-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold mb-1">Project Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Target Role Focus</label>
            <input type="text" value={roleFocus} onChange={(e) => setRoleFocus(e.target.value)} className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Business Problem</label>
            <textarea rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Dataset Description</label>
            <textarea rows={3} value={datasetDesc} onChange={(e) => setDatasetDesc(e.target.value)} className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]" />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">Tools &amp; Technical Stack</label>
            <input type="text" value={tools} onChange={(e) => setTools(e.target.value)} className="w-full px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Methodology &amp; Analytical Steps</label>
            <textarea rows={4} value={methodology} onChange={(e) => setMethodology(e.target.value)} className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Key Verified Findings</label>
            <textarea rows={4} value={findings} onChange={(e) => setFindings(e.target.value)} className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]" />
          </div>
          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">Recommendations &amp; Business Impact</label>
            <textarea rows={3} value={recommendations} onChange={(e) => setRecommendations(e.target.value)} className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A]" />
          </div>
        </div>
      </div>
    </div>
  );
};
