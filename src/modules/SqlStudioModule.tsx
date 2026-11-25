import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Save,
  Plus,
  X,
  Download,
  RefreshCw,
  Table2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FileCode2,
  Share2,
  Wand2,
  Trophy,
  Info,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { SQL_CHALLENGES, SqlChallenge, sqlChallengeTopicId } from '../data/curriculum';
import { exportRowsToCsv, exportRowsToXlsx } from '../utils/exporters';

interface SchemaTable {
  name: string;
  type: string;
  rowCount: number;
  columns: { name: string; type: string; notnull: boolean; pk: boolean }[];
}

interface SqlTab {
  id: string;
  title: string;
  dialect: 'sqlite' | 'oracle' | 'postgresql' | 'mysql';
  sql: string;
}

interface ExecResultSet {
  columns: string[];
  rows: Record<string, any>[];
  totalRows: number;
  truncated: boolean;
}

export const SqlStudioModule: React.FC = () => {
  const {
    scripts,
    sqlHistory,
    refreshWorkspace,
    pushNotification,
    updateAiContext,
    askGeminiWithPrompt,
    datasets,
    activeDatasetId,
    learningProgress,
    recordLearningProgress,
  } = useWorkspace();

  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>('retail_sales');
  const [leftTab, setLeftTab] = useState<'schema' | 'scripts' | 'challenges' | 'history'>('schema');

  const [tabs, setTabs] = useState<SqlTab[]>([
    {
      id: 'ws_1',
      title: 'Worksheet 1',
      dialect: 'sqlite',
      sql: `-- Venky Analytics OS SQL Studio (Genuine Persistent SQLite Engine)\n-- Try CTEs, Window Functions, JOINs, CREATE TABLE, VIEWS, or EXPLAIN PLAN\nSELECT\n  region,\n  category,\n  COUNT(*) AS orders,\n  ROUND(SUM(revenue), 2) AS total_revenue,\n  ROUND(SUM(profit), 2) AS total_profit,\n  ROUND(SUM(profit) * 100.0 / NULLIF(SUM(revenue), 0), 2) AS margin_pct\nFROM retail_sales\nGROUP BY region, category\nORDER BY total_revenue DESC\nLIMIT 20;`,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('ws_1');
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ExecResultSet[]>([]);
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [execError, setExecError] = useState<string | null>(null);
  const [execMeta, setExecMeta] = useState<{ execMs: number; rowsModified: number; notes: string[] } | null>(null);

  const [activeChallenge, setActiveChallenge] = useState<SqlChallenge | null>(null);
  const [evalResult, setEvalResult] = useState<{ passed: boolean; feedback: string } | null>(null);
  const verifiedTopics = new Set(learningProgress.filter(record => record.status === 'completed').map(record => record.topic_id));
  const verifiedCount = SQL_CHALLENGES.filter(challenge => verifiedTopics.has(sqlChallengeTopicId(challenge.id))).length;
  const [showOracleNote, setShowOracleNote] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  const loadSchema = async () => {
    try {
      const res = await fetch('/api/sql/schema');
      if (res.ok) {
        const data = await res.json();
        setSchema(data.tables || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSchema();
  }, [datasets.length]);

  useEffect(() => {
    updateAiContext({
      activeCode: activeTab.sql,
      recentOutput: execError
        ? `SQL Error: ${execError}`
        : results[0]
        ? `Returned ${results[0].totalRows} rows with columns: ${results[0].columns.join(', ')}`
        : undefined,
    });
  }, [activeTab.sql, execError, results, updateAiContext]);

  const updateActiveTab = (partial: Partial<SqlTab>) => {
    setTabs((prev) => prev.map((t) => (t.id === activeTab.id ? { ...t, ...partial } : t)));
  };

  const executeSql = async (explain = false, selectionOnly = false) => {
    let sqlToRun = activeTab.sql;
    if (selectionOnly && editorRef.current) {
      const start = editorRef.current.selectionStart;
      const end = editorRef.current.selectionEnd;
      if (end > start) {
        sqlToRun = activeTab.sql.slice(start, end);
      }
    }
    if (!sqlToRun.trim() || running) return;
    setRunning(true);
    setExecError(null);
    setEvalResult(null);
    try {
      const res = await fetch('/api/sql/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: sqlToRun,
          dialect: activeTab.dialect,
          explain,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setExecError(data.error || 'Query execution failed.');
        setResults([]);
        setExecMeta({ execMs: data.execMs || 0, rowsModified: 0, notes: data.translationNotes || [] });
      } else {
        setResults(data.results || []);
        setActiveResultIdx(0);
        setExecMeta({
          execMs: data.execMs,
          rowsModified: data.rowsModified || 0,
          notes: data.translationNotes || [],
        });
        if (/\b(create|alter|drop|insert|update|delete)\b/i.test(activeTab.sql)) {
          await loadSchema();
        }
      }
      await refreshWorkspace();
    } catch (err: any) {
      setExecError(err?.message || 'Network error executing SQL.');
    } finally {
      setRunning(false);
    }
  };

  const evaluateChallenge = async () => {
    if (!activeChallenge || running) return;
    setRunning(true);
    try {
      const res = await fetch('/api/sql/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userSql: activeTab.sql,
          challengeId: activeChallenge.id,
          dialect: activeTab.dialect,
        }),
      });
      const data = await res.json();
      setEvalResult({ passed: Boolean(data.passed), feedback: data.feedback });
      if (data.passed) {
        if (data.progress) recordLearningProgress(data.progress);
        pushNotification('Challenge Passed', `Verified solution for "${activeChallenge.title}"`, 'success');
      }
    } catch {
      setEvalResult({ passed: false, feedback: 'Could not reach the SQL grader. Try again.' });
    } finally {
      setRunning(false);
    }
  };

  const formatSql = () => {
    const keywords = [
      'SELECT',
      'FROM',
      'WHERE',
      'GROUP BY',
      'HAVING',
      'ORDER BY',
      'LIMIT',
      'LEFT JOIN',
      'INNER JOIN',
      'RIGHT JOIN',
      'UNION ALL',
      'UNION',
      'WITH',
    ];
    let formatted = activeTab.sql.replace(/\s+/g, ' ').trim();
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      formatted = formatted.replace(regex, `\n${kw}`);
    }
    updateActiveTab({ sql: formatted.trim() });
  };

  const saveScript = async () => {
    const title = activeTab.title || `SQL Script ${scripts.length + 1}`;
    await fetch('/api/sql/scripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        dialect: activeTab.dialect,
        sql_text: activeTab.sql,
      }),
    });
    await refreshWorkspace();
    pushNotification('Script Saved', `"${title}" saved to persistent SQL library.`, 'success');
  };

  const shareScript = () => {
    navigator.clipboard.writeText(activeTab.sql);
    pushNotification('Script Copied', 'SQL script copied to clipboard for sharing.', 'info');
  };

  const addWorksheet = () => {
    const id = `ws_${Date.now()}`;
    const ds = datasets.find((d) => d.id === activeDatasetId);
    const tableName = ds?.table_name || 'retail_sales';
    setTabs((prev) => [
      ...prev,
      {
        id,
        title: `Worksheet ${prev.length + 1}`,
        dialect: 'sqlite',
        sql: `SELECT * FROM ${tableName} LIMIT 50;`,
      },
    ]);
    setActiveTabId(id);
  };

  const closeWorksheet = (id: string) => {
    if (tabs.length <= 1) return;
    const filtered = tabs.filter((t) => t.id !== id);
    setTabs(filtered);
    if (activeTabId === id) setActiveTabId(filtered[0].id);
  };

  const currentResult = results[activeResultIdx];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row lg:overflow-hidden">
      {/* Left Explorer Panel */}
      <div className="w-full lg:w-72 shrink-0 max-h-60 lg:max-h-none border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] flex flex-col">
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-1 pt-1 gap-0.5 text-xs">
          {[
            { id: 'schema', label: 'Schema' },
            { id: 'scripts', label: 'Saved' },
            { id: 'challenges', label: 'Challenges' },
            { id: 'history', label: 'History' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setLeftTab(t.id as any)}
              className={`flex-1 py-2 text-center font-medium border-b-2 transition-colors ${
                leftTab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 text-xs">
          {leftTab === 'schema' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                <span>Tables & Views ({schema.length})</span>
                <button onClick={loadSchema} title="Refresh schema" className="hover:text-blue-500">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {schema.map((tbl) => (
                <div key={tbl.name} className="rounded border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setExpandedTable(expandedTable === tbl.name ? null : tbl.name)}
                    className="w-full px-2.5 py-2 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <span className="flex items-center gap-1.5 font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                      <Table2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{tbl.name}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 tabular-nums shrink-0 ml-1">
                      {tbl.rowCount}
                    </span>
                  </button>
                  {expandedTable === tbl.name && (
                    <div className="px-2.5 pb-2 pt-1 bg-slate-50 dark:bg-[#0B111A] border-t border-slate-200 dark:border-slate-800 space-y-1">
                      <button
                        onClick={() =>
                          updateActiveTab({ sql: `SELECT * FROM ${tbl.name} LIMIT 100;` })
                        }
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline mb-1 block"
                      >
                        Insert SELECT * query
                      </button>
                      {tbl.columns.map((c) => (
                        <div key={c.name} className="flex items-center justify-between font-mono text-[11px]">
                          <span className="text-slate-700 dark:text-slate-300 truncate">{c.name}</span>
                          <span className="text-slate-400 text-[10px]">{c.type}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {leftTab === 'scripts' && (
            <div className="space-y-2">
              {scripts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    updateActiveTab({ title: s.title, dialect: s.dialect as any, sql: s.sql_text });
                    setActiveChallenge(null);
                  }}
                  className="w-full text-left p-2.5 rounded border border-slate-200 dark:border-slate-800 hover:border-blue-500/60 space-y-1"
                >
                  <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileCode2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">{s.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">{s.dialect}</div>
                </button>
              ))}
            </div>
          )}

          {leftTab === 'challenges' && (
            <div className="space-y-2.5">
              <div className="text-[11px] text-slate-500">
                {verifiedCount} of {SQL_CHALLENGES.length} SQL challenges verified
              </div>
              {SQL_CHALLENGES.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveChallenge(ch);
                    setEvalResult(null);
                    updateActiveTab({ title: ch.title, dialect: 'sqlite', sql: ch.starterSql });
                  }}
                  className={`w-full text-left p-2.5 rounded border transition-colors ${
                    activeChallenge?.id === ch.id
                      ? 'border-blue-600 bg-blue-600/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-blue-500/50'
                  }`}
                >
                  <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{ch.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {ch.level} · {ch.topic}{verifiedTopics.has(sqlChallengeTopicId(ch.id)) ? ' · Verified' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}

          {leftTab === 'history' && (
            <div className="space-y-2">
              {sqlHistory.length === 0 ? (
                <div className="text-slate-500 py-4 text-center">No queries executed yet.</div>
              ) : (
                sqlHistory.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => updateActiveTab({ sql: h.sql_text })}
                    className="w-full text-left p-2 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className={h.status === 'success' ? 'text-emerald-500 font-medium' : 'text-red-500 font-medium'}>
                        {h.status} · {h.rows_returned} rows · {h.exec_ms}ms
                      </span>
                      <Clock className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">
                      {h.sql_text}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main SQL Workbench */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-[#0B111A]">
        {/* Worksheet Tabs */}
        <div className="flex items-center gap-1 px-3 pt-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] overflow-x-auto shrink-0">
          {tabs.map((t) => (
            <div
              key={t.id}
              onClick={() => setActiveTabId(t.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md text-xs font-medium cursor-pointer border border-b-0 whitespace-nowrap ${
                t.id === activeTab.id
                  ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B111A] text-slate-900 dark:text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>{t.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWorksheet(t.id);
                  }}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addWorksheet}
            title="New worksheet"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* SQL Action Toolbar */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1722] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => executeSql(false, false)}
              disabled={running}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{running ? 'Running...' : 'Run Script'}</span>
            </button>
            <button
              onClick={() => executeSql(false, true)}
              disabled={running}
              title="Execute highlighted SQL statement (or full script if none selected)"
              className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Run Selection
            </button>
            <button
              onClick={() => executeSql(true, false)}
              disabled={running}
              className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Explain Plan
            </button>
            <button
              onClick={formatSql}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Format</span>
            </button>
            <button
              onClick={saveScript}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              onClick={shareScript}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="SQL dialect compatibility"
              value={activeTab.dialect}
              onChange={(e) => updateActiveTab({ dialect: e.target.value as any })}
              className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B111A] text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="sqlite">SQLite Engine (Native)</option>
              <option value="oracle">Oracle SQL Compat Layer</option>
              <option value="postgresql">PostgreSQL Compat Layer</option>
              <option value="mysql">MySQL Compat Layer</option>
            </select>
            <button
              onClick={() => setShowOracleNote((v) => !v)}
              title="Database engine compatibility details"
              className="p-1.5 rounded-md text-slate-500 hover:text-blue-500"
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                askGeminiWithPrompt(
                  execError
                    ? `Debug this SQL error and fix the query:\nError: ${execError}\nSQL:\n${activeTab.sql}`
                    : `Review this SQL query for correctness, edge cases, and optimization:\n${activeTab.sql}`,
                  'analyst'
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-blue-500/40 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{execError ? 'Debug with AI' : 'AI Review'}</span>
            </button>
          </div>
        </div>

        {/* Engine Transparency Banner */}
        {showOracleNote && (
          <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-start justify-between gap-4">
            <div>
              <strong>SQL Execution Engine Transparency:</strong> Queries execute genuinely on a persistent SQLite 3 relational engine with full CTE, Window Function, JOIN, View, Index, and EXPLAIN QUERY PLAN support. Supported compatibility translations: Oracle (<code>NVL</code>, <code>DECODE</code>, <code>MINUS</code>, <code>SYSDATE</code>, <code>FROM DUAL</code>, <code>FETCH FIRST N ROWS ONLY</code>), PostgreSQL (<code>ILIKE</code>, <code>::type</code> casts including function calls, <code>DATE_TRUNC</code>), and MySQL (<code>NOW()</code>, <code>IF()</code>, <code>CONCAT()</code>). Unsupported dialect-specific features (Oracle <code>ROWNUM</code>, <code>CONNECT BY</code>, PL/SQL <code>BEGIN..END</code>, Stored Procedures, PostgreSQL <code>GENERATE_SERIES</code>/<code>JSONB</code>, MySQL <code>DATE_FORMAT</code>) require an external Oracle XE (<code>gvenzl/oracle-free</code>) or Postgres/MySQL database (see Settings → Architecture Guide).
            </div>
            <button onClick={() => setShowOracleNote(false)} className="shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Challenge Banner */}
        {activeChallenge && (
          <div className="px-4 py-3 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900/60 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="font-semibold text-blue-900 dark:text-blue-200">
                SQL Challenge: {activeChallenge.title} ({activeChallenge.level})
              </div>
              <div className="text-slate-700 dark:text-slate-300">{activeChallenge.prompt}</div>
              {activeChallenge.hint && <details key={activeChallenge.id}>
                <summary className="cursor-pointer font-medium">Show hint</summary>
                <p className="mt-1">{activeChallenge.hint}</p>
              </details>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={evaluateChallenge}
                disabled={running}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                Verify Solution
              </button>
              <button
                onClick={() => updateActiveTab({ sql: activeChallenge.solutionSql })}
                className="px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Load Solution
              </button>
              <button onClick={() => setActiveChallenge(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {evalResult && (
          <div
            className={`px-4 py-2 text-xs border-b flex items-center gap-2 ${
              evalResult.passed
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
            }`}
          >
            {evalResult.passed ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{evalResult.feedback}</span>
          </div>
        )}

        {/* SQL Code Editor */}
        <div className="h-64 lg:h-[44%] border-b border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
          <textarea
            ref={editorRef}
            value={activeTab.sql}
            onChange={(e) => updateActiveTab({ sql: e.target.value })}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                executeSql(false, true);
              }
            }}
            spellCheck={false}
            className="flex-1 w-full p-4 font-mono text-[13px] leading-relaxed bg-white dark:bg-[#0B111A] text-slate-900 dark:text-slate-100 focus:outline-none resize-none"
            placeholder="Write SQL query here... Press Ctrl+Enter to execute."
          />
          <div className="px-4 py-1.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F1722] flex items-center justify-between text-[11px] text-slate-500">
            <span>Ctrl+Enter to Run · Persistent tables: retail_sales, banking_customers, marketing_campaigns, hr_attrition, and more</span>
            <input
              type="text"
              value={activeTab.title}
              onChange={(e) => updateActiveTab({ title: e.target.value })}
              className="bg-transparent text-right text-slate-700 dark:text-slate-300 focus:outline-none w-44"
              aria-label="Worksheet title"
            />
          </div>
        </div>

        {/* Results Grid Panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0F1722]">
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 text-xs shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-800 dark:text-slate-200">Query Output</span>
              {execMeta && !execError && (
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {currentResult ? `${currentResult.totalRows} rows` : `${execMeta.rowsModified} rows affected`} · {execMeta.execMs}ms
                </span>
              )}
              {results.length > 1 && (
                <div className="flex items-center gap-1">
                  {results.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveResultIdx(idx)}
                      className={`px-2 py-0.5 rounded text-[11px] ${
                        idx === activeResultIdx ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Set {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {currentResult && currentResult.rows.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportRowsToCsv(currentResult.rows, `${activeTab.title}_result.csv`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3 h-3" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => exportRowsToXlsx(currentResult.rows, `${activeTab.title}_result.xlsx`)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3 h-3" />
                  <span>XLSX</span>
                </button>
              </div>
            )}
          </div>

          {execMeta?.notes && execMeta.notes.length > 0 && (
            <div className="px-4 py-1.5 bg-slate-50 dark:bg-[#0B111A] border-b border-slate-200 dark:border-slate-800 text-[11px] text-blue-600 dark:text-blue-400">
              {execMeta.notes.join(' ')}
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {execError ? (
              <div className="p-4 text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap">
                SQL Execution Error: {execError}
              </div>
            ) : currentResult && currentResult.columns.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2 font-mono text-[11px] text-slate-400 w-10">#</th>
                    {currentResult.columns.map((col) => (
                      <th key={col} className="px-3 py-2 font-mono font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {currentResult.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-1.5 font-mono text-[11px] text-slate-400 tabular-nums">{rIdx + 1}</td>
                      {currentResult.columns.map((col) => {
                        const val = row[col];
                        const isNum = typeof val === 'number';
                        return (
                          <td
                            key={col}
                            className={`px-3 py-1.5 whitespace-nowrap ${
                              isNum ? 'font-mono tabular-nums text-right text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {val === null || val === undefined ? (
                              <span className="text-slate-400 italic">NULL</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : execMeta ? (
              <div className="p-4 text-xs text-emerald-600 dark:text-emerald-400">
                Statement executed successfully ({execMeta.execMs}ms). Rows affected: {execMeta.rowsModified}.
              </div>
            ) : (
              <div className="p-6 text-xs text-slate-500 text-center">
                Execute a query (Run Script or Ctrl+Enter) to view live relational database results.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
