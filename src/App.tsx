import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { Sidebar } from './components/Layout/Sidebar';
import { TopBar } from './components/Layout/TopBar';
import { GeminiPanel } from './components/Layout/GeminiPanel';
import { GlobalSearchModal } from './components/Layout/GlobalSearchModal';

import { DashboardModule } from './modules/DashboardModule';
const LearningModule = React.lazy(() => import('./modules/LearningModule').then(m => ({ default: m.LearningModule })));
const SqlStudioModule = React.lazy(() => import('./modules/SqlStudioModule').then(m => ({ default: m.SqlStudioModule })));
const ExcelStudioModule = React.lazy(() => import('./modules/ExcelStudioModule').then(m => ({ default: m.ExcelStudioModule })));
const PythonStudioModule = React.lazy(() => import('./modules/PythonStudioModule').then(m => ({ default: m.PythonStudioModule })));
const StatisticsLabModule = React.lazy(() => import('./modules/StatisticsLabModule').then(m => ({ default: m.StatisticsLabModule })));
const PowerBiWorkspaceModule = React.lazy(() => import('./modules/PowerBiWorkspaceModule').then(m => ({ default: m.PowerBiWorkspaceModule })));
const DataCleaningModule = React.lazy(() => import('./modules/DataCleaningModule').then(m => ({ default: m.DataCleaningModule })));
const VisualizationStudioModule = React.lazy(() => import('./modules/VisualizationStudioModule').then(m => ({ default: m.VisualizationStudioModule })));
const BusinessAnalysisModule = React.lazy(() => import('./modules/BusinessAnalysisModule').then(m => ({ default: m.BusinessAnalysisModule })));
const DomainAnalyticsModule = React.lazy(() => import('./modules/DomainAnalyticsModule').then(m => ({ default: m.DomainAnalyticsModule })));
const AiAutomationModule = React.lazy(() => import('./modules/AiAutomationModule').then(m => ({ default: m.AiAutomationModule })));
const ReportingStudioModule = React.lazy(() => import('./modules/ReportingStudioModule').then(m => ({ default: m.ReportingStudioModule })));
const ProjectsModule = React.lazy(() => import('./modules/ProjectsModule').then(m => ({ default: m.ProjectsModule })));
const InterviewPrepModule = React.lazy(() => import('./modules/InterviewPrepModule').then(m => ({ default: m.InterviewPrepModule })));
const PortfolioBuilderModule = React.lazy(() => import('./modules/PortfolioBuilderModule').then(m => ({ default: m.PortfolioBuilderModule })));
const FileManagerModule = React.lazy(() => import('./modules/FileManagerModule').then(m => ({ default: m.FileManagerModule })));
const NotesResourcesModule = React.lazy(() => import('./modules/NotesSettingsModule').then(m => ({ default: m.NotesResourcesModule })));
const SettingsModule = React.lazy(() => import('./modules/NotesSettingsModule').then(m => ({ default: m.SettingsModule })));

const CommunicationStudioModule = React.lazy(() => import('./modules/CommunicationStudioModule').then(m => ({ default: m.CommunicationStudioModule })));
const SkillsPracticeModule = React.lazy(() => import('./modules/SkillsPracticeModule').then(m => ({ default: m.SkillsPracticeModule })));

const WorkstationShell: React.FC = () => {
  const { loading, error, activeModule, refreshWorkspace } = useWorkspace();

  const [practice, setPractice] = React.useState<'keyboard' | 'voice' | null>(null);
  React.useEffect(() => { setPractice(null); }, [activeModule]);
  const renderModule = () => {
    if (practice === 'voice') return <CommunicationStudioModule />;
    if (practice === 'keyboard') return <SkillsPracticeModule />;
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule />;
      case 'learning':
        return <LearningModule />;
      case 'sql':
        return <SqlStudioModule />;
      case 'excel':
        return <ExcelStudioModule />;
      case 'python':
        return <PythonStudioModule />;
      case 'statistics':
        return <StatisticsLabModule />;
      case 'powerbi':
        return <PowerBiWorkspaceModule />;
      case 'cleaning':
        return <DataCleaningModule />;
      case 'visualization':
        return <VisualizationStudioModule />;
      case 'ba':
        return <BusinessAnalysisModule />;
      case 'product':
        return <DomainAnalyticsModule domain="product" />;
      case 'marketing':
        return <DomainAnalyticsModule domain="marketing" />;
      case 'operations':
        return <DomainAnalyticsModule domain="operations" />;
      case 'financial':
        return <DomainAnalyticsModule domain="financial" />;
      case 'research':
        return <DomainAnalyticsModule domain="research" />;
      case 'automation':
        return <AiAutomationModule />;
      case 'reporting':
        return <ReportingStudioModule />;
      case 'projects':
        return <ProjectsModule />;
      case 'interview':
        return <InterviewPrepModule />;
      case 'portfolio':
        return <PortfolioBuilderModule />;
      case 'files':
        return <FileManagerModule />;
      case 'notes':
        return <NotesResourcesModule />;
      case 'settings':
        return <SettingsModule />;
      default:
        return <DashboardModule />;
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0B111A] text-slate-600 dark:text-slate-300 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <div className="text-sm font-display font-medium">Booting Venky Analytics OS...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0B111A] p-6 text-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <h1 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
          Workspace Initialization Error
        </h1>
        <p className="text-xs text-slate-500 max-w-md">{error}</p>
        <button
          onClick={refreshWorkspace}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-slate-50 dark:bg-[#0B111A] text-slate-900 dark:text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <nav aria-label="Practice studios" className="flex flex-wrap gap-4 px-3 py-2 border-b border-slate-300 dark:border-slate-700">
          <button className="text-sm text-blue-600 dark:text-blue-400" aria-pressed={practice === 'keyboard'} onClick={() => setPractice(value => value === 'keyboard' ? null : 'keyboard')}>Keyboard Skills Lab</button>
          <button className="text-sm text-blue-600 dark:text-blue-400" aria-pressed={practice === 'voice'} onClick={() => setPractice(value => value === 'voice' ? null : 'voice')}>Communication Studio</button>
        </nav>
        <main className="flex-1 overflow-y-auto">
          <React.Suspense fallback={<p className="p-6">Loading studio…</p>}>{renderModule()}</React.Suspense>
        </main>
      </div>
      <GeminiPanel />
      <GlobalSearchModal />
    </div>
  );
};

export default function App() {
  return (
    <WorkspaceProvider>
      <WorkstationShell />
    </WorkspaceProvider>
  );
}
