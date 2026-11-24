import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  Database,
  Table2,
  TerminalSquare,
  Sigma,
  BarChart3,
  Eraser,
  LineChart,
  Briefcase,
  Layers,
  Megaphone,
  Cog,
  Landmark,
  SearchCheck,
  Workflow,
  FileSpreadsheet,
  FolderKanban,
  Award,
  BookMarked,
  HardDrive,
  StickyNote,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { NavModuleId } from '../../types/os';
import { useWorkspace } from '../../context/WorkspaceContext';

export interface NavItemSpec {
  id: NavModuleId;
  label: string;
  group: string;
  icon: React.FC<{ className?: string }>;
}

export const NAV_ITEMS: NavItemSpec[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview', icon: LayoutDashboard },
  { id: 'learning', label: 'My Learning', group: 'Overview', icon: GraduationCap },

  { id: 'sql', label: 'SQL Studio', group: 'Core Analytics Labs', icon: Database },
  { id: 'excel', label: 'Excel Studio', group: 'Core Analytics Labs', icon: Table2 },
  { id: 'python', label: 'Python Studio', group: 'Core Analytics Labs', icon: TerminalSquare },
  { id: 'statistics', label: 'Statistics Lab', group: 'Core Analytics Labs', icon: Sigma },
  { id: 'cleaning', label: 'Data Cleaning Lab', group: 'Core Analytics Labs', icon: Eraser },

  { id: 'powerbi', label: 'Power BI Workspace', group: 'BI & Reporting', icon: BarChart3 },
  { id: 'visualization', label: 'Data Visualization', group: 'BI & Reporting', icon: LineChart },
  { id: 'reporting', label: 'Reporting Studio', group: 'BI & Reporting', icon: FileSpreadsheet },

  { id: 'ba', label: 'Business Analysis', group: 'Domain Workspaces', icon: Briefcase },
  { id: 'product', label: 'Product Analytics', group: 'Domain Workspaces', icon: Layers },
  { id: 'marketing', label: 'Marketing Analytics', group: 'Domain Workspaces', icon: Megaphone },
  { id: 'operations', label: 'Operations Analytics', group: 'Domain Workspaces', icon: Cog },
  { id: 'financial', label: 'Financial Analytics', group: 'Domain Workspaces', icon: Landmark },
  { id: 'research', label: 'Research & Market', group: 'Domain Workspaces', icon: SearchCheck },
  { id: 'automation', label: 'AI & Automation', group: 'Domain Workspaces', icon: Workflow },

  { id: 'projects', label: 'Real-World Projects', group: 'Career & Assets', icon: FolderKanban },
  { id: 'interview', label: 'Interview Prep', group: 'Career & Assets', icon: Award },
  { id: 'portfolio', label: 'Portfolio Builder', group: 'Career & Assets', icon: BookMarked },
  { id: 'files', label: 'File Manager', group: 'Career & Assets', icon: HardDrive },
  { id: 'notes', label: 'Notes & Resources', group: 'Career & Assets', icon: StickyNote },
  { id: 'settings', label: 'Settings', group: 'Career & Assets', icon: Settings },
];

const GROUPS = [
  'Overview',
  'Core Analytics Labs',
  'BI & Reporting',
  'Domain Workspaces',
  'Career & Assets',
];

export const Sidebar: React.FC = () => {
  const { activeModule, setActiveModule, sidebarCollapsed, setSidebarCollapsed } = useWorkspace();

  return (
    <aside
      className={`${
        sidebarCollapsed ? 'w-16' : 'w-64'
      } shrink-0 h-screen flex flex-col border-r border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#0F1722] transition-[width] duration-200 select-none`}
    >
      {/* Brand Row */}
      <div className="h-14 px-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/90 shrink-0">
        {!sidebarCollapsed && (
          <button
            onClick={() => setActiveModule('dashboard')}
            className="text-left font-display font-bold text-[15px] tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Venky Analytics OS
          </button>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          return (
            <div key={group}>
              {!sidebarCollapsed && (
                <div className="px-2.5 mb-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-500 tracking-wide">
                  {group}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveModule(item.id)}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-blue-600/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};
