export type NavModuleId =
  | 'dashboard'
  | 'learning'
  | 'sql'
  | 'excel'
  | 'python'
  | 'statistics'
  | 'powerbi'
  | 'cleaning'
  | 'visualization'
  | 'ba'
  | 'product'
  | 'marketing'
  | 'operations'
  | 'financial'
  | 'research'
  | 'automation'
  | 'reporting'
  | 'projects'
  | 'interview'
  | 'portfolio'
  | 'files'
  | 'notes'
  | 'settings';

export type CareerTrackId =
  | 'data-analyst'
  | 'business-analyst'
  | 'bi-analyst'
  | 'product-analyst'
  | 'marketing-analyst'
  | 'operations-analyst'
  | 'reporting-mis-analyst'
  | 'research-analyst'
  | 'financial-analyst'
  | 'process-analyst'
  | 'customer-insights-analyst'
  | 'ai-automation-analyst'
  | 'sales-analyst'
  | 'strategy-analyst';

export type AiMode =
  | 'learn'
  | 'practice'
  | 'analyst'
  | 'interview'
  | 'report';

export type AiLanguage = 'english' | 'telugu' | 'bilingual';

export interface DatasetColumn {
  name: string;
  type: 'number' | 'string' | 'date' | 'boolean';
  nullCount?: number;
  uniqueCount?: number;
}

export interface DatasetMeta {
  id: string;
  project_id: string | null;
  name: string;
  table_name: string;
  source_type: string;
  columns: DatasetColumn[];
  row_count: number;
  version: number;
  description: string;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  career_track: CareerTrackId;
  dataset_id: string | null;
  status: 'active' | 'in_progress' | 'completed';
  progress: number;
  checklist_json?: string;
  created_at: string;
  updated_at: string;
}

export interface SqlScript {
  id: string;
  project_id: string | null;
  title: string;
  dialect: 'sqlite' | 'oracle' | 'postgresql' | 'mysql';
  sql_text: string;
  created_at: string;
  updated_at: string;
}

export interface SqlHistoryItem {
  id: number;
  dialect: string;
  sql_text: string;
  status: 'success' | 'error';
  rows_returned: number;
  exec_ms: number;
  error_msg: string | null;
  executed_at: string;
}

export interface TaskItem {
  id: string;
  project_id: string | null;
  title: string;
  module: NavModuleId;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
  due_date: string | null;
  created_at: string;
}

export interface NoteItem {
  id: string;
  project_id: string | null;
  title: string;
  category: string;
  content: string;
  updated_at: string;
}

export interface LearningProgressRecord {
  topic_id: string;
  level: string;
  status: 'not_started' | 'in_progress' | 'completed';
  score: number;
  time_spent_min: number;
  last_accessed: string;
}

export interface BaDocument {
  id: string;
  project_id: string | null;
  doc_type: string;
  title: string;
  content: Record<string, any>;
  updated_at: string;
}

export interface PortfolioItem {
  id: string;
  project_id: string | null;
  title: string;
  role_focus: string;
  problem: string;
  dataset_desc: string;
  tools: string;
  methodology: string;
  findings: string;
  recommendations: string;
  created_at: string;
}

export interface NotebookCell {
  id: string;
  type: 'code' | 'markdown';
  source: string;
  stdout?: string;
  stderr?: string;
  images?: string[];
  tableHtml?: string;
  execMs?: number;
}

export interface NotebookRecord {
  id: string;
  project_id: string | null;
  title: string;
  cells: NotebookCell[];
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export interface AiContextPayload {
  module: NavModuleId;
  careerTrack: CareerTrackId;
  datasetName?: string;
  datasetColumns?: string[];
  sampleSummary?: string;
  activeCode?: string;
  activeProject?: string;
  recentOutput?: string;
}
