import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  getDb,
  getDbStorageInfo,
  persistDb,
  queryAll,
  registerTableFromRows,
  sanitizeIdentifier,
  seedInitialWorkspace,
  translateDialectSql,
  validateUserSqlSafety,
  withReadOnlySnapshot,
} from './server/db.ts';
import { runGeminiAssistant } from './server/gemini.ts';
import { SQL_CHALLENGES, sqlChallengeTopicId } from './src/data/curriculum.ts';
import type { Database } from 'sql.js';

const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.use(express.json({ limit: '15mb' }));

// File upload validation (max 10 MB, strict tabular extensions)
const ALLOWED_EXTS = new Set(['.csv', '.xlsx', '.xls', '.json']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      cb(new Error(`Unsupported file type "${ext}". Allowed tabular formats: CSV, XLSX, XLS, JSON.`));
      return;
    }
    cb(null, true);
  },
});

// Health Check
app.get('/api/health', async (_req, res) => {
  try {
    await getDb();
    res.json({
      ok: true,
      engine: 'sqlite-wasm',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      storage: getDbStorageInfo(),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Database error' });
  }
});

// Full Workspace Bootstrap
app.get('/api/bootstrap', async (_req, res) => {
  try {
    const db = await getDb();
    const projects = queryAll(db, 'SELECT * FROM _vos_projects ORDER BY updated_at DESC');
    const datasets = queryAll(db, 'SELECT * FROM _vos_datasets ORDER BY is_sample ASC, updated_at DESC').map((d) => ({
      ...d,
      columns: JSON.parse(d.columns_json || '[]'),
      is_sample: Boolean(d.is_sample),
    }));
    const scripts = queryAll(db, 'SELECT * FROM _vos_sql_scripts ORDER BY updated_at DESC');
    const history = queryAll(db, 'SELECT * FROM _vos_sql_history ORDER BY id DESC LIMIT 40');
    const tasks = queryAll(db, 'SELECT * FROM _vos_tasks ORDER BY created_at DESC');
    const notes = queryAll(db, 'SELECT * FROM _vos_notes ORDER BY updated_at DESC');
    const learning = queryAll(db, 'SELECT * FROM _vos_learning_progress');
    const baDocs = queryAll(db, 'SELECT * FROM _vos_ba_docs ORDER BY updated_at DESC').map((b) => ({
      ...b,
      content: JSON.parse(b.content_json || '{}'),
    }));
    const portfolio = queryAll(db, 'SELECT * FROM _vos_portfolio ORDER BY created_at DESC');
    const notebooks = queryAll(db, 'SELECT * FROM _vos_notebooks ORDER BY updated_at DESC').map((n) => ({
      ...n,
      cells: JSON.parse(n.cells_json || '[]'),
    }));
    const settingsRows = queryAll(db, 'SELECT key, value FROM _vos_settings');
    const settings: Record<string, string> = {};
    for (const s of settingsRows) settings[s.key] = s.value;

    res.json({
      projects,
      datasets,
      scripts,
      history,
      tasks,
      notes,
      learning,
      baDocs,
      portfolio,
      notebooks,
      settings,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to bootstrap workspace' });
  }
});

// ========================
// PROJECTS CRUD
// ========================
app.post('/api/projects', async (req, res) => {
  try {
    const db = await getDb();
    const { name, description, career_track, dataset_id } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'Project name is required.' });
      return;
    }
    const id = `proj_${Date.now()}`;
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO _vos_projects (id, name, description, career_track, dataset_id, status, progress, checklist_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', 0, '[]', ?, ?)`,
      [id, String(name).trim(), description || '', career_track || 'data-analyst', dataset_id || null, now, now]
    );
    persistDb(db);
    const created = queryAll(db, 'SELECT * FROM _vos_projects WHERE id = ?', [id])[0];
    res.json(created);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { name, description, career_track, dataset_id, status, progress, checklist_json } = req.body;
    const now = new Date().toISOString();
    db.run(
      `UPDATE _vos_projects SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        career_track = COALESCE(?, career_track),
        dataset_id = COALESCE(?, dataset_id),
        status = COALESCE(?, status),
        progress = COALESCE(?, progress),
        checklist_json = COALESCE(?, checklist_json),
        updated_at = ?
       WHERE id = ?`,
      [
        name ?? null,
        description ?? null,
        career_track ?? null,
        dataset_id ?? null,
        status ?? null,
        progress ?? null,
        checklist_json ?? null,
        now,
        id,
      ]
    );
    persistDb(db);
    const updated = queryAll(db, 'SELECT * FROM _vos_projects WHERE id = ?', [id])[0];
    if (!updated) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM _vos_projects WHERE id = ?', [req.params.id]);
    persistDb(db);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ========================
// DATASETS & FILE MANAGER
// ========================
app.get('/api/datasets/:id/rows', async (req, res) => {
  try {
    const db = await getDb();
    const limit = Math.max(1, Math.min(Math.floor(Number(req.query.limit) || 1000), 5000));
    const ds = queryAll(db, 'SELECT * FROM _vos_datasets WHERE id = ? OR table_name = ?', [
      req.params.id,
      req.params.id,
    ])[0];
    if (!ds) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    const rows = queryAll(db, `SELECT * FROM "${ds.table_name}" LIMIT ${limit}`);
    res.json({
      dataset: { ...ds, columns: JSON.parse(ds.columns_json || '[]'), is_sample: Boolean(ds.is_sample) },
      rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/datasets/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }
    const ext = path.extname(req.file.originalname).toLowerCase();
    const baseName = path.basename(req.file.originalname, ext);
    let rows: Record<string, any>[] = [];

    if (ext === '.csv') {
      const text = req.file.buffer.toString('utf-8');
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });
      rows = parsed.data;
    } else if (ext === '.xlsx' || ext === '.xls') {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = req.body.sheetName || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(ws, { defval: null });
    } else if (ext === '.json') {
      const parsed = JSON.parse(req.file.buffer.toString('utf-8'));
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } else {
      res.status(400).json({ error: 'SQL/TXT files should be imported via Notes or SQL Studio.' });
      return;
    }

    if (!rows || rows.length === 0) {
      res.status(400).json({ error: 'Uploaded file contains no tabular rows.' });
      return;
    }

    const db = await getDb();
    const desiredName = req.body.name || baseName;
    let tableName = sanitizeIdentifier(desiredName);
    const existing = queryAll(db, 'SELECT id FROM _vos_datasets WHERE table_name = ?', [tableName]);
    if (existing.length > 0) {
      tableName = `${tableName}_${Date.now().toString().slice(-4)}`;
    }

    const { columns, rowCount } = registerTableFromRows(db, tableName, rows);
    const id = `ds_${Date.now()}`;
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO _vos_datasets
      (id, project_id, name, table_name, source_type, columns_json, row_count, version, description, is_sample, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id,
        req.body.project_id || null,
        desiredName,
        tableName,
        ext.replace('.', ''),
        JSON.stringify(columns),
        rowCount,
        1,
        req.body.description || `Uploaded from ${req.file.originalname}`,
        now,
        now,
      ]
    );
    persistDb(db);
    const created = queryAll(db, 'SELECT * FROM _vos_datasets WHERE id = ?', [id])[0];
    res.json({ ...created, columns, is_sample: false });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Failed to parse uploaded file.' });
  }
});

// Save cleaned/derived dataset from JSON rows into SQLite so every module can reuse it
app.post('/api/datasets/from-rows', async (req, res) => {
  try {
    const { name, description, project_id, rows, parent_version } = req.body;
    if (!name || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'Dataset name and non-empty rows array are required.' });
      return;
    }
    const db = await getDb();
    let tableName = sanitizeIdentifier(name);
    const existing = queryAll(db, 'SELECT id FROM _vos_datasets WHERE table_name = ?', [tableName]);
    if (existing.length > 0) {
      tableName = `${tableName}_v${(parent_version || 1) + 1}_${Date.now().toString().slice(-3)}`;
    }

    const { columns, rowCount } = registerTableFromRows(db, tableName, rows);
    const id = `ds_${Date.now()}`;
    const now = new Date().toISOString();
    const version = (parent_version || 0) + 1;

    db.run(
      `INSERT INTO _vos_datasets
      (id, project_id, name, table_name, source_type, columns_json, row_count, version, description, is_sample, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'cleaned', ?, ?, ?, ?, 0, ?, ?)`,
      [
        id,
        project_id || null,
        name,
        tableName,
        JSON.stringify(columns),
        rowCount,
        version,
        description || 'Prepared in Data Cleaning Lab',
        now,
        now,
      ]
    );
    persistDb(db);
    const created = queryAll(db, 'SELECT * FROM _vos_datasets WHERE id = ?', [id])[0];
    res.json({ ...created, columns, is_sample: false });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.put('/api/datasets/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { name, description, project_id } = req.body;
    const now = new Date().toISOString();
    const hasProjectId = Object.prototype.hasOwnProperty.call(req.body, 'project_id');
    db.run(
      `UPDATE _vos_datasets SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        project_id = CASE WHEN ? = 1 THEN ? ELSE project_id END,
        updated_at = ?
       WHERE id = ?`,
      [name ?? null, description ?? null, hasProjectId ? 1 : 0, project_id ?? null, now, req.params.id]
    );
    persistDb(db);
    const updated = queryAll(db, 'SELECT * FROM _vos_datasets WHERE id = ?', [req.params.id])[0];
    if (!updated) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    res.json({ ...updated, columns: JSON.parse(updated.columns_json || '[]'), is_sample: Boolean(updated.is_sample) });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/datasets/:id', async (req, res) => {
  try {
    const db = await getDb();
    const ds = queryAll(db, 'SELECT * FROM _vos_datasets WHERE id = ?', [req.params.id])[0];
    if (!ds) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    db.run(`DROP TABLE IF EXISTS "${ds.table_name}"`);
    db.run('DELETE FROM _vos_datasets WHERE id = ?', [req.params.id]);
    persistDb(db);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ========================
// SQL STUDIO (GENUINE EXECUTION)
// ========================
app.get('/api/sql/schema', async (_req, res) => {
  try {
    const db = await getDb();
    const objects = queryAll(
      db,
      `SELECT name, type, sql FROM sqlite_master
       WHERE type IN ('table', 'view', 'index')
       AND name NOT LIKE '_vos_%'
       AND name NOT LIKE 'sqlite_%'
       ORDER BY type DESC, name ASC`
    );
    const tables = objects
      .filter((o) => o.type === 'table' || o.type === 'view')
      .map((o) => {
        const cols = queryAll(db, `PRAGMA table_info("${o.name}")`);
        let rowCount = 0;
        try {
          const cnt = queryAll(db, `SELECT COUNT(*) as c FROM "${o.name}"`)[0];
          rowCount = Number(cnt?.c || 0);
        } catch {
          rowCount = 0;
        }
        return {
          name: o.name,
          type: o.type,
          rowCount,
          columns: cols.map((c) => ({
            name: c.name,
            type: c.type || 'TEXT',
            notnull: Boolean(c.notnull),
            pk: Boolean(c.pk),
          })),
        };
      });
    const indexes = objects.filter((o) => o.type === 'index');
    res.json({ tables, indexes });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/sql/execute', async (req, res) => {
  const start = performance.now();
  const { sql, dialect = 'sqlite', explain = false } = req.body;
  if (!sql || !String(sql).trim()) {
    res.status(400).json({ error: 'SQL statement is empty.' });
    return;
  }

  const safetyErr = validateUserSqlSafety(sql);
  if (safetyErr) {
    res.status(403).json({ error: safetyErr });
    return;
  }

  const db = await getDb();
  const { sql: translated, notes } = translateDialectSql(sql, dialect);
  const execSql = explain ? `EXPLAIN QUERY PLAN ${translated.replace(/;+\s*$/, '')}` : translated;
  const now = new Date().toISOString();

  try {
    const resultSets = db.exec(execSql);
    const execMs = Math.round((performance.now() - start) * 100) / 100;
    const isDdlOrDml = /\b(create|alter|drop|insert|update|delete|replace)\b/i.test(execSql);
    if (isDdlOrDml && !explain) {
      persistDb(db);
    }

    const formattedResults = resultSets.map((rs) => ({
      columns: rs.columns,
      rows: rs.values.slice(0, 5000).map((vals) => {
        const obj: Record<string, any> = {};
        rs.columns.forEach((col, i) => {
          obj[col] = vals[i];
        });
        return obj;
      }),
      totalRows: rs.values.length,
      truncated: rs.values.length > 5000,
    }));

    const totalRows = formattedResults.reduce((acc, r) => acc + r.totalRows, 0);
    const rowsModified = db.getRowsModified();

    db.run(
      `INSERT INTO _vos_sql_history (dialect, sql_text, status, rows_returned, exec_ms, error_msg, executed_at)
       VALUES (?, ?, 'success', ?, ?, NULL, ?)`,
      [dialect, sql.slice(0, 4000), totalRows, execMs, now]
    );
    persistDb(db);

    res.json({
      success: true,
      execMs,
      rowsModified,
      translationNotes: notes,
      results: formattedResults,
    });
  } catch (err: any) {
    const execMs = Math.round((performance.now() - start) * 100) / 100;
    const message = err?.message || 'SQL execution failed.';
    db.run(
      `INSERT INTO _vos_sql_history (dialect, sql_text, status, rows_returned, exec_ms, error_msg, executed_at)
       VALUES (?, ?, 'error', 0, ?, ?, ?)`,
      [dialect, sql.slice(0, 4000), execMs, message, now]
    );
    persistDb(db);
    res.status(400).json({ success: false, execMs, error: message, translationNotes: notes });
  }
});

// Grade against the registered reference using a disposable snapshot.
function selectForGrading(db: Database, sql: string) {
  const statement = db.prepare(sql);
  try {
    const columns = statement.getColumnNames();
    const values = [];
    while (statement.step()) {
      if (values.length >= 5000) throw new Error('Challenge output exceeds 5,000 rows.');
      values.push(statement.get());
    }
    return { columns, values };
  } finally {
    statement.free();
  }
}

app.post('/api/sql/evaluate', async (req, res) => {
  try {
    const { userSql, challengeId, dialect = 'sqlite' } = req.body;
    const challenge = SQL_CHALLENGES.find(item => item.id === challengeId);
    if (!challenge || typeof userSql !== 'string' || userSql.length > 16_000) {
      res.status(400).json({ passed: false, feedback: 'Select a registered challenge and enter a query under 16,000 characters.' });
      return;
    }
    const { sql: cleanUser } = translateDialectSql(userSql, dialect);
    if (!/^\s*(?:select|with)\b/i.test(cleanUser)) {
      res.status(400).json({ passed: false, feedback: 'Start the challenge query with SELECT or WITH.' });
      return;
    }
    const safetyErr = validateUserSqlSafety(cleanUser);
    if (safetyErr) {
      res.status(403).json({ passed: false, feedback: safetyErr });
      return;
    }
    const [u, s] = await withReadOnlySnapshot(db => [
      selectForGrading(db, cleanUser),
      selectForGrading(db, challenge.solutionSql),
    ]);

    const normalizeRows = (vals: any[][]) =>
      vals.map((row) =>
        row.map((cell) => (typeof cell === 'number' ? Number(cell.toFixed(2)) : String(cell ?? '').trim().toLowerCase()))
      );

    const uNorm = normalizeRows(u.values);
    const sNorm = normalizeRows(s.values);

    const sameRowCount = uNorm.length === sNorm.length;
    const sameColCount = u.columns.length === s.columns.length;
    const exactMatch = sameRowCount && sameColCount && JSON.stringify(uNorm) === JSON.stringify(sNorm);

    let progress;
    if (exactMatch) {
      const db = await getDb();
      const topicId = sqlChallengeTopicId(challenge.id);
      db.run(
        `INSERT OR IGNORE INTO _vos_learning_progress
          (topic_id, level, status, score, time_spent_min, last_accessed)
        VALUES (?, ?, 'completed', 100, 0, ?)`,
        [topicId, challenge.level, new Date().toISOString()],
      );
      if (db.getRowsModified() > 0) persistDb(db);
      progress = queryAll(db, 'SELECT * FROM _vos_learning_progress WHERE topic_id = ?', [topicId])[0];
    }

    res.json({
      passed: exactMatch,
      progress,
      userRowCount: u.values.length,
      expectedRowCount: s.values.length,
      expectedColumns: s.columns,
      userColumns: u.columns,
      feedback: exactMatch
        ? 'Verified! Your SQL query output matches the expected dataset exactly.'
        : !sameColCount
        ? `Column count mismatch: expected ${s.columns.length} columns (${s.columns.join(', ')}), got ${u.columns.length}.`
        : !sameRowCount
        ? `Row count mismatch: expected ${s.values.length} rows, got ${u.values.length}. Check your WHERE, GROUP BY, or LIMIT clause.`
        : 'Row values or ordering differ from the expected result. Verify your aggregations, rounding, or ORDER BY clause.',
    });
  } catch (err: any) {
    res.status(400).json({ passed: false, feedback: `SQL Error: ${err?.message}` });
  }
});

app.post('/api/sql/scripts', async (req, res) => {
  try {
    const db = await getDb();
    const { id, project_id, title, dialect, sql_text } = req.body;
    const now = new Date().toISOString();
    const scriptId = id || `sql_${Date.now()}`;
    db.run(
      `INSERT OR REPLACE INTO _vos_sql_scripts (id, project_id, title, dialect, sql_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM _vos_sql_scripts WHERE id = ?), ?), ?)`,
      [scriptId, project_id || null, title || 'Untitled Script', dialect || 'sqlite', sql_text || '', scriptId, now, now]
    );
    persistDb(db);
    res.json(queryAll(db, 'SELECT * FROM _vos_sql_scripts WHERE id = ?', [scriptId])[0]);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/sql/scripts/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM _vos_sql_scripts WHERE id = ?', [req.params.id]);
    persistDb(db);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ========================
// TASKS, NOTES, LEARNING, BA DOCS, PORTFOLIO, NOTEBOOKS, SETTINGS
// ========================
app.post('/api/tasks', async (req, res) => {
  try {
    const db = await getDb();
    const { title, module = 'dashboard', priority = 'medium', project_id = null, due_date = null } = req.body;
    const id = `task_${Date.now()}`;
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO _vos_tasks (id, project_id, title, module, priority, status, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, 'todo', ?, ?)`,
      [id, project_id, title, module, priority, due_date, now]
    );
    persistDb(db);
    res.json(queryAll(db, 'SELECT * FROM _vos_tasks WHERE id = ?', [id])[0]);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { status, title, priority } = req.body;
    db.run(
      `UPDATE _vos_tasks SET
        status = COALESCE(?, status),
        title = COALESCE(?, title),
        priority = COALESCE(?, priority)
       WHERE id = ?`,
      [status ?? null, title ?? null, priority ?? null, req.params.id]
    );
    persistDb(db);
    const updated = queryAll(db, 'SELECT * FROM _vos_tasks WHERE id = ?', [req.params.id])[0];
    if (!updated) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM _vos_tasks WHERE id = ?', [req.params.id]);
    persistDb(db);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/notes', async (req, res) => {
  try {
    const db = await getDb();
    const { id, project_id = null, title, category = 'General', content = '' } = req.body;
    const noteId = id || `note_${Date.now()}`;
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO _vos_notes (id, project_id, title, category, content, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [noteId, project_id, title || 'Untitled Note', category, content, now]
    );
    persistDb(db);
    res.json(queryAll(db, 'SELECT * FROM _vos_notes WHERE id = ?', [noteId])[0]);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM _vos_notes WHERE id = ?', [req.params.id]);
    persistDb(db);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/learning', async (req, res) => {
  try {
    const db = await getDb();
    const { topic_id, level = 'Beginner', status = 'in_progress', score = 0, time_spent_min = 5 } = req.body;
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO _vos_learning_progress (topic_id, level, status, score, time_spent_min, last_accessed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [topic_id, level, status, score, time_spent_min, now]
    );
    persistDb(db);
    res.json(queryAll(db, 'SELECT * FROM _vos_learning_progress WHERE topic_id = ?', [topic_id])[0]);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/ba-docs', async (req, res) => {
  try {
    const db = await getDb();
    const { id, project_id = null, doc_type = 'BRD', title, content = {} } = req.body;
    const docId = id || `ba_${Date.now()}`;
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO _vos_ba_docs (id, project_id, doc_type, title, content_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [docId, project_id, doc_type, title || 'Untitled BA Document', JSON.stringify(content), now]
    );
    persistDb(db);
    const saved = queryAll(db, 'SELECT * FROM _vos_ba_docs WHERE id = ?', [docId])[0];
    res.json({ ...saved, content: JSON.parse(saved.content_json || '{}') });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/ba-docs/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM _vos_ba_docs WHERE id = ?', [req.params.id]);
    persistDb(db);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/portfolio', async (req, res) => {
  try {
    const db = await getDb();
    const { id, project_id = null, title, role_focus, problem, dataset_desc, tools, methodology, findings, recommendations } = req.body;
    const itemId = id || `port_${Date.now()}`;
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO _vos_portfolio
      (id, project_id, title, role_focus, problem, dataset_desc, tools, methodology, findings, recommendations, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM _vos_portfolio WHERE id = ?), ?))`,
      [
        itemId,
        project_id,
        title || 'Untitled Case Study',
        role_focus || 'Data Analyst',
        problem || '',
        dataset_desc || '',
        tools || '',
        methodology || '',
        findings || '',
        recommendations || '',
        itemId,
        now,
      ]
    );
    persistDb(db);
    res.json(queryAll(db, 'SELECT * FROM _vos_portfolio WHERE id = ?', [itemId])[0]);
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.delete('/api/portfolio/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM _vos_portfolio WHERE id = ?', [req.params.id]);
    persistDb(db);
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/notebooks', async (req, res) => {
  try {
    const db = await getDb();
    const { id, project_id = null, title, cells = [] } = req.body;
    const nbId = id || `nb_${Date.now()}`;
    const now = new Date().toISOString();
    db.run(
      `INSERT OR REPLACE INTO _vos_notebooks (id, project_id, title, cells_json, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [nbId, project_id, title || 'Untitled Notebook.ipynb', JSON.stringify(cells), now]
    );
    persistDb(db);
    const saved = queryAll(db, 'SELECT * FROM _vos_notebooks WHERE id = ?', [nbId])[0];
    res.json({ ...saved, cells: JSON.parse(saved.cells_json || '[]') });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const db = await getDb();
    const entries = Object.entries(req.body || {});
    for (const [k, v] of entries) {
      db.run('INSERT OR REPLACE INTO _vos_settings (key, value) VALUES (?, ?)', [k, String(v)]);
    }
    persistDb(db);
    res.json({ saved: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

app.post('/api/admin/reseed-samples', async (_req, res) => {
  try {
    const db = await getDb();
    seedInitialWorkspace(db);
    persistDb(db);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message });
  }
});

// ========================
// GEMINI AI CENTRAL ASSISTANT (SERVER-SIDE ONLY)
// ========================
app.post('/api/ai/assist', async (req, res) => {
  try {
    const { prompt, mode = 'analyst', language = 'english', context, history } = req.body;
    if (!prompt || !String(prompt).trim()) {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }
    const result = await runGeminiAssistant({
      prompt: String(prompt),
      mode,
      language,
      context,
      history,
    });
    res.json({ text: result.text, model: result.model });
  } catch (err: any) {
    console.error('Gemini API error:', err?.message || err);
    const status = Number(err?.statusCode) || 500;
    res.status(status).json({
      error:
        err?.message ||
        'Gemini AI request failed. Verify GEMINI_API_KEY in Settings > Secrets and try again.',
    });
  }
});

// Global error handler for Multer / JSON errors
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: err?.message || 'Unexpected server error' });
});

async function startServer() {
  const db = await getDb();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Venky Analytics OS running on http://0.0.0.0:${PORT} (mode: ${process.env.NODE_ENV || 'development'})`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}, flushing SQLite database and closing server...`);
    persistDb(db);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
