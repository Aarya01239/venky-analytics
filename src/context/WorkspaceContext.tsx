import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AiContextPayload,
  AiLanguage,
  AiMode,
  BaDocument,
  CareerTrackId,
  DatasetMeta,
  LearningProgressRecord,
  NavModuleId,
  NotebookRecord,
  NoteItem,
  NotificationItem,
  PortfolioItem,
  ProjectRecord,
  SqlHistoryItem,
  SqlScript,
  TaskItem,
} from '../types/os';

interface WorkspaceContextValue {
  loading: boolean;
  error: string | null;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activeModule: NavModuleId;
  setActiveModule: (mod: NavModuleId) => void;
  activeCareerTrack: CareerTrackId;
  setActiveCareerTrack: (track: CareerTrackId) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  aiMode: AiMode;
  setAiMode: (m: AiMode) => void;
  aiLanguage: AiLanguage;
  setAiLanguage: (l: AiLanguage) => void;
  aiContext: AiContextPayload;
  updateAiContext: (partial: Partial<AiContextPayload>) => void;
  askGeminiWithPrompt: (prompt: string, mode?: AiMode, extraCtx?: Partial<AiContextPayload>) => void;
  pendingAiPrompt: string | null;
  clearPendingAiPrompt: () => void;

  // Shared Persistent Data
  projects: ProjectRecord[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  datasets: DatasetMeta[];
  activeDatasetId: string;
  setActiveDatasetId: (id: string) => void;
  activeDatasetRows: Record<string, any>[];
  loadingRows: boolean;
  scripts: SqlScript[];
  sqlHistory: SqlHistoryItem[];
  tasks: TaskItem[];
  notes: NoteItem[];
  learningProgress: LearningProgressRecord[];
  recordLearningProgress: (record: LearningProgressRecord) => void;
  baDocs: BaDocument[];
  portfolioItems: PortfolioItem[];
  notebooks: NotebookRecord[];
  settings: Record<string, string>;
  notifications: NotificationItem[];

  // Actions
  refreshWorkspace: () => Promise<void>;
  loadDatasetRows: (datasetId: string) => Promise<Record<string, any>[]>;
  pushNotification: (title: string, message: string, type?: NotificationItem['type']) => void;
  markNotificationsRead: () => void;
  updateSetting: (key: string, value: string) => Promise<void>;
  openDatasetInModule: (datasetId: string, mod: NavModuleId) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeModule, setActiveModule] = useState<NavModuleId>('dashboard');
  const [activeCareerTrack, setActiveCareerTrackState] = useState<CareerTrackId>('data-analyst');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>('analyst');
  const [aiLanguage, setAiLanguage] = useState<AiLanguage>('english');
  const [pendingAiPrompt, setPendingAiPrompt] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetMeta[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string>('ds_retail_sales');
  const [activeDatasetRows, setActiveDatasetRows] = useState<Record<string, any>[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [scripts, setScripts] = useState<SqlScript[]>([]);
  const [sqlHistory, setSqlHistory] = useState<SqlHistoryItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [learningProgress, setLearningProgress] = useState<LearningProgressRecord[]>([]);
  const [baDocs, setBaDocs] = useState<BaDocument[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookRecord[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'welcome_1',
      title: 'Workspace Ready',
      message: '12 realistic sample datasets are loaded into your persistent SQLite workspace.',
      type: 'info',
      timestamp: new Date().toISOString(),
      read: false,
    },
  ]);

  const [aiContext, setAiContext] = useState<AiContextPayload>({
    module: 'dashboard',
    careerTrack: 'data-analyst',
  });

  const pushNotification = useCallback(
    (title: string, message: string, type: NotificationItem['type'] = 'info') => {
      setNotifications((prev) => [
        {
          id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          message,
          type,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...prev.slice(0, 25),
      ]);
    },
    []
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const applyThemeClass = useCallback((t: 'dark' | 'light') => {
    const html = document.documentElement;
    if (t === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, []);

  const updateSetting = useCallback(async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      // ignore network error on setting save
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyThemeClass(next);
      updateSetting('theme', next);
      return next;
    });
  }, [applyThemeClass, updateSetting]);

  const setActiveCareerTrack = useCallback(
    (track: CareerTrackId) => {
      setActiveCareerTrackState(track);
      updateSetting('activeCareerTrack', track);
    },
    [updateSetting]
  );

  const refreshWorkspace = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('Failed to load workspace data from server.');
      const data = await res.json();
      setProjects(data.projects || []);
      setDatasets(data.datasets || []);
      setScripts(data.scripts || []);
      setSqlHistory(data.history || []);
      setTasks(data.tasks || []);
      setNotes(data.notes || []);
      setLearningProgress(data.learning || []);
      setBaDocs(data.baDocs || []);
      setPortfolioItems(data.portfolio || []);
      setNotebooks(data.notebooks || []);
      const s = data.settings || {};
      setSettings(s);
      if (s.theme === 'light' || s.theme === 'dark') {
        setTheme(s.theme);
        applyThemeClass(s.theme);
      }
      if (s.activeCareerTrack) {
        setActiveCareerTrackState(s.activeCareerTrack as CareerTrackId);
      }
      if (s.defaultAiMode) setAiMode(s.defaultAiMode as AiMode);
      if (s.defaultAiLanguage) setAiLanguage(s.defaultAiLanguage as AiLanguage);
      if (!activeProjectId && data.projects?.length > 0) {
        setActiveProjectId(data.projects[0].id);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Workspace connection failed.');
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, applyThemeClass]);

  const loadDatasetRows = useCallback(async (datasetId: string): Promise<Record<string, any>[]> => {
    if (!datasetId) return [];
    setLoadingRows(true);
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(datasetId)}/rows?limit=2000`);
      if (!res.ok) return [];
      const data = await res.json();
      const rows = data.rows || [];
      setActiveDatasetRows(rows);
      return rows;
    } catch {
      return [];
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspace();
  }, []);

  useEffect(() => {
    if (activeDatasetId && datasets.some((d) => d.id === activeDatasetId || d.table_name === activeDatasetId)) {
      loadDatasetRows(activeDatasetId);
    }
  }, [activeDatasetId, datasets.length, loadDatasetRows]);

  // Keep AI context synchronized automatically with active workspace, dataset, and project
  useEffect(() => {
    const ds = datasets.find((d) => d.id === activeDatasetId);
    const proj = projects.find((p) => p.id === activeProjectId);
    setAiContext((prev) => ({
      ...prev,
      module: activeModule,
      careerTrack: activeCareerTrack,
      datasetName: ds ? `${ds.name} (table: ${ds.table_name}, ${ds.row_count} rows)` : undefined,
      datasetColumns: ds ? ds.columns.map((c) => `${c.name}:${c.type}`) : undefined,
      activeProject: proj ? proj.name : undefined,
    }));
  }, [activeModule, activeCareerTrack, activeDatasetId, activeProjectId, datasets, projects]);

  // Keyboard shortcuts: Ctrl/Cmd+K for global search, Ctrl/Cmd+Shift+A for Gemini AI
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setAiOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const updateAiContext = useCallback((partial: Partial<AiContextPayload>) => {
    setAiContext((prev) => ({ ...prev, ...partial }));
  }, []);

  const askGeminiWithPrompt = useCallback(
    (prompt: string, mode?: AiMode, extraCtx?: Partial<AiContextPayload>) => {
      if (mode) setAiMode(mode);
      if (extraCtx) {
        setAiContext((prev) => ({ ...prev, ...extraCtx }));
      }
      setPendingAiPrompt(prompt);
      setAiOpen(true);
    },
    []
  );

  const clearPendingAiPrompt = useCallback(() => setPendingAiPrompt(null), []);

  const openDatasetInModule = useCallback((datasetId: string, mod: NavModuleId) => {
    setActiveDatasetId(datasetId);
    setActiveModule(mod);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        loading,
        error,
        theme,
        toggleTheme,
        activeModule,
        setActiveModule,
        activeCareerTrack,
        setActiveCareerTrack,
        sidebarCollapsed,
        setSidebarCollapsed,
        searchOpen,
        setSearchOpen,
        aiOpen,
        setAiOpen,
        aiMode,
        setAiMode,
        aiLanguage,
        setAiLanguage,
        aiContext,
        updateAiContext,
        askGeminiWithPrompt,
        pendingAiPrompt,
        clearPendingAiPrompt,
        projects,
        activeProjectId,
        setActiveProjectId,
        datasets,
        activeDatasetId,
        setActiveDatasetId,
        activeDatasetRows,
        loadingRows,
        scripts,
        sqlHistory,
        tasks,
        notes,
        learningProgress,
        recordLearningProgress: record => setLearningProgress(previous => [
          ...previous.filter(item => item.topic_id !== record.topic_id), record,
        ]),
        baDocs,
        portfolioItems,
        notebooks,
        settings,
        notifications,
        refreshWorkspace,
        loadDatasetRows,
        pushNotification,
        markNotificationsRead,
        updateSetting,
        openDatasetInModule,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
