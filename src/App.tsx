import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { Sidebar } from './components/Layout/Sidebar';
import { TopBar } from './components/Layout/TopBar';
import { GeminiPanel } from './components/Layout/GeminiPanel';
import { GlobalSearchModal } from './components/Layout/GlobalSearchModal';

import { DashboardModule } from './modules/DashboardModule';
import { LearningModule } from './modules/LearningModule';
import { SqlStudioModule } from './modules/SqlStudioModule';
import { ExcelStudioModule } from './modules/ExcelStudioModule';
import { PythonStudioModule } from './modules/PythonStudioModule';
import { StatisticsLabModule } from './modules/StatisticsLabModule';
import { PowerBiWorkspaceModule } from './modules/PowerBiWorkspaceModule';
import { DataCleaningModule } from './modules/DataCleaningModule';
import { VisualizationStudioModule } from './modules/VisualizationStudioModule';
import { BusinessAnalysisModule } from './modules/BusinessAnalysisModule';
import { DomainAnalyticsModule } from './modules/DomainAnalyticsModule';
import { AiAutomationModule } from './modules/AiAutomationModule';
import { ReportingStudioModule } from './modules/ReportingStudioModule';
import { ProjectsModule } from './modules/ProjectsModule';
import { InterviewPrepModule } from './modules/InterviewPrepModule';
import { PortfolioBuilderModule } from './modules/PortfolioBuilderModule';
import { FileManagerModule } from './modules/FileManagerModule';
import { NotesResourcesModule, SettingsModule } from './modules/NotesSettingsModule';

const SkillsPracticeModule = React.lazy(() => import('./modules/SkillsPracticeModule').then(m => ({ default: m.SkillsPracticeModule })));

const WorkstationShell: React.FC = () => {
  const { loading, error, activeModule, refreshWorkspace } = useWorkspace();

  const [skillsOpen, setSkillsOpen] = React.useState(false);
  React.useEffect(() => { setSkillsOpen(false); }, [activeModule]);
  const renderModule = () => {
    if (skillsOpen) return <React.Suspense fallback={<p className="p-6">Loading practice lab...</p>}><SkillsPracticeModule /></React.Suspense>;
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
        <div className="px-3 py-1 border-b border-slate-300 dark:border-slate-700"><button className="text-sm text-blue-500" onClick={() => setSkillsOpen(v => !v)}>{skillsOpen ? 'Return to workspace' : 'Keyboard Skills Lab'}</button></div>
        <main className="flex-1 overflow-y-auto">{renderModule()}</main>
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
