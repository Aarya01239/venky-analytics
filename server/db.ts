import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { generateSeedDatasets } from './seedData.ts';

const railwayVolume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (process.env.RAILWAY_ENVIRONMENT_ID && !railwayVolume) {
  throw new Error('Attach a Railway persistent volume before starting the workspace.');
}
const DATA_DIR = path.resolve(railwayVolume || process.env.DATA_DIR || path.join(process.cwd(), 'data'));
export const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'venky_os.sqlite');

if (railwayVolume) {
  if (!DB_PATH.startsWith(DATA_DIR + path.sep)) {
    throw new Error('The SQLite database must be stored inside the Railway persistent volume.');
  }
  fs.accessSync(DATA_DIR, fs.constants.W_OK);
}

export function getDbStorageInfo() {
  const exists = fs.existsSync(DB_PATH);
  const sizeBytes = exists ? fs.statSync(DB_PATH).size : 0;
  return {
    engine: 'sqlite-wasm-persistent',
    dbFile: path.basename(DB_PATH),
    storageDir: path.dirname(DB_PATH),
    customVolumeConfigured: Boolean(railwayVolume || process.env.SQLITE_DB_PATH || process.env.DATA_DIR),
    fileExists: exists,
    sizeBytes,
  };
}

let dbInstance: Database | null = null;
let initPromise: Promise<Database> | null = null;

export function sanitizeIdentifier(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!cleaned || /^[0-9]/.test(cleaned)) {
    return `tbl_${cleaned || 'data'}`;
  }
  if (cleaned.startsWith('_vos_')) {
    return `user_${cleaned.slice(5)}`;
  }
  return cleaned.slice(0, 60);
}

export function inferColumnType(values: any[]): 'number' | 'string' | 'date' | 'boolean' {
  const nonNull = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNull.length === 0) return 'string';
  let numCount = 0;
  let dateCount = 0;
  let boolCount = 0;
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
  for (const val of nonNull.slice(0, 80)) {
    if (typeof val === 'boolean') {
      boolCount++;
    } else if (typeof val === 'number' && !Number.isNaN(val)) {
      numCount++;
    } else {
      const s = String(val).trim();
      if (isoDateRegex.test(s)) {
        dateCount++;
      } else if (s !== '' && !Number.isNaN(Number(s)) && !/^0\d+/.test(s)) {
        numCount++;
      }
    }
  }
  const sampleSize = Math.min(nonNull.length, 80);
  if (boolCount / sampleSize > 0.85) return 'boolean';
  if (numCount / sampleSize > 0.85) return 'number';
  if (dateCount / sampleSize > 0.85) return 'date';
  return 'string';
}

export function persistDb(db: Database) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    const tmpPath = `${DB_PATH}.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, Buffer.from(data));
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    console.error('Failed to persist SQLite database:', err);
  }
}

export function registerTableFromRows(
  db: Database,
  tableName: string,
  rows: Record<string, any>[]
): { columns: { name: string; type: 'number' | 'string' | 'date' | 'boolean' }[]; rowCount: number } {
  const safeTable = sanitizeIdentifier(tableName);
  if (!rows || rows.length === 0) {
    throw new Error('Dataset has no rows to load.');
  }
  const rawCols = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r || {})))
  ).filter((c) => c.trim() !== '');

  const colMap: { raw: string; safe: string; type: 'number' | 'string' | 'date' | 'boolean' }[] = [];
  const used = new Set<string>();
  for (const raw of rawCols) {
    let safe = sanitizeIdentifier(raw);
    let idx = 2;
    while (used.has(safe)) {
      safe = `${sanitizeIdentifier(raw)}_${idx++}`;
    }
    used.add(safe);
    const vals = rows.map((r) => r[raw]);
    colMap.push({ raw, safe, type: inferColumnType(vals) });
  }

  db.run(`DROP TABLE IF EXISTS "${safeTable}";`);
  const colDefs = colMap
    .map((c) => `"${c.safe}" ${c.type === 'number' ? 'REAL' : c.type === 'boolean' ? 'INTEGER' : 'TEXT'}`)
    .join(', ');
  db.run(`CREATE TABLE "${safeTable}" (${colDefs});`);

  const placeholders = colMap.map(() => '?').join(', ');
  const insertStmt = db.prepare(
    `INSERT INTO "${safeTable}" (${colMap.map((c) => `"${c.safe}"`).join(', ')}) VALUES (${placeholders});`
  );

  db.run('BEGIN TRANSACTION;');
  try {
    for (const row of rows) {
      const vals = colMap.map((c) => {
        const v = row[c.raw];
        if (v === undefined || v === null || v === '') return null;
        if (c.type === 'number') {
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        }
        if (c.type === 'boolean') {
          return v === true || v === 1 || String(v).toLowerCase() === 'true' ? 1 : 0;
        }
        return String(v);
      });
      insertStmt.run(vals);
    }
    db.run('COMMIT;');
  } catch (e) {
    db.run('ROLLBACK;');
    throw e;
  } finally {
    insertStmt.free();
  }

  return {
    columns: colMap.map((c) => ({ name: c.safe, type: c.type })),
    rowCount: rows.length,
  };
}

function createCoreSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS _vos_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      career_track TEXT DEFAULT 'data-analyst',
      dataset_id TEXT,
      status TEXT DEFAULT 'active',
      progress INTEGER DEFAULT 0,
      checklist_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_datasets (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      table_name TEXT NOT NULL UNIQUE,
      source_type TEXT DEFAULT 'sample',
      columns_json TEXT NOT NULL,
      row_count INTEGER DEFAULT 0,
      version INTEGER DEFAULT 1,
      description TEXT DEFAULT '',
      is_sample INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_sql_scripts (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      dialect TEXT DEFAULT 'sqlite',
      sql_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_sql_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dialect TEXT DEFAULT 'sqlite',
      sql_text TEXT NOT NULL,
      status TEXT NOT NULL,
      rows_returned INTEGER DEFAULT 0,
      exec_ms REAL DEFAULT 0,
      error_msg TEXT,
      executed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      module TEXT DEFAULT 'dashboard',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'todo',
      due_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      content TEXT DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_learning_progress (
      topic_id TEXT PRIMARY KEY,
      level TEXT DEFAULT 'Beginner',
      status TEXT DEFAULT 'not_started',
      score INTEGER DEFAULT 0,
      time_spent_min INTEGER DEFAULT 0,
      last_accessed TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_ba_docs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      doc_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_portfolio (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      role_focus TEXT DEFAULT 'Data Analyst',
      problem TEXT DEFAULT '',
      dataset_desc TEXT DEFAULT '',
      tools TEXT DEFAULT '',
      methodology TEXT DEFAULT '',
      findings TEXT DEFAULT '',
      recommendations TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_notebooks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      cells_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS _vos_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function seedInitialWorkspace(db: Database) {
  const now = new Date().toISOString();
  const datasets = generateSeedDatasets();

  for (const ds of datasets) {
    const { columns, rowCount } = registerTableFromRows(db, ds.tableName, ds.rows);
    db.run(
      `INSERT OR REPLACE INTO _vos_datasets
      (id, project_id, name, table_name, source_type, columns_json, row_count, version, description, is_sample, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ds.id,
        null,
        ds.name,
        ds.tableName,
        'sample',
        JSON.stringify(columns),
        rowCount,
        1,
        ds.description,
        1,
        now,
        now,
      ]
    );
  }

  // Seed starter projects
  const starterProjects = [
    {
      id: 'proj_retail_sales',
      name: 'Retail Sales Performance & Profitability',
      description: 'End-to-end regional margin, discount impact, and seasonal revenue diagnostics.',
      career_track: 'data-analyst',
      dataset_id: 'ds_retail_sales',
      status: 'in_progress',
      progress: 35,
    },
    {
      id: 'proj_banking_churn',
      name: 'Banking Customer Churn Diagnostics',
      description: 'Identify high-risk retail banking segments by balance, product depth, and engagement.',
      career_track: 'customer-insights-analyst',
      dataset_id: 'ds_banking_customers',
      status: 'active',
      progress: 15,
    },
    {
      id: 'proj_mkt_roas',
      name: 'Multi-Channel Marketing ROAS & CAC Audit',
      description: 'Evaluate channel efficiency, lead quality, and budget reallocation scenarios.',
      career_track: 'marketing-analyst',
      dataset_id: 'ds_marketing_campaigns',
      status: 'active',
      progress: 20,
    },
  ];

  for (const p of starterProjects) {
    db.run(
      `INSERT OR IGNORE INTO _vos_projects
      (id, name, description, career_track, dataset_id, status, progress, checklist_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.description, p.career_track, p.dataset_id, p.status, p.progress, '[]', now, now]
    );
  }

  // Seed SQL starter scripts
  const starterScripts = [
    {
      id: 'sql_retail_window',
      project_id: 'proj_retail_sales',
      title: 'Regional Revenue & Running Total (Window Functions)',
      dialect: 'sqlite',
      sql_text: `-- Regional monthly revenue with Window Function running totals & ranking
WITH monthly_sales AS (
  SELECT
    region,
    substr(order_date, 1, 7) AS sales_month,
    ROUND(SUM(revenue), 2) AS total_revenue,
    ROUND(SUM(profit), 2) AS total_profit,
    COUNT(*) AS orders
  FROM retail_sales
  GROUP BY region, substr(order_date, 1, 7)
)
SELECT
  region,
  sales_month,
  orders,
  total_revenue,
  total_profit,
  ROUND(total_profit * 100.0 / NULLIF(total_revenue, 0), 2) AS margin_pct,
  ROUND(SUM(total_revenue) OVER (PARTITION BY region ORDER BY sales_month), 2) AS running_revenue,
  RANK() OVER (PARTITION BY sales_month ORDER BY total_revenue DESC) AS monthly_rank
FROM monthly_sales
ORDER BY sales_month DESC, monthly_rank ASC
LIMIT 24;`,
    },
    {
      id: 'sql_oracle_compat',
      project_id: 'proj_banking_churn',
      title: 'Oracle Compat: Churn Rate by Account Tier',
      dialect: 'oracle',
      sql_text: `-- Oracle-style syntax translated transparently on execution
SELECT
  account_type,
  COUNT(*) AS total_customers,
  SUM(churned) AS churned_customers,
  ROUND(AVG(NVL(balance, 0)), 2) AS avg_balance,
  ROUND(SUM(churned) * 100.0 / COUNT(*), 2) AS churn_rate_pct
FROM banking_customers
GROUP BY account_type
ORDER BY churn_rate_pct DESC
FETCH FIRST 10 ROWS ONLY;`,
    },
    {
      id: 'sql_mkt_roi',
      project_id: 'proj_mkt_roas',
      title: 'Marketing Channel ROAS, CAC & Conversion Funnel',
      dialect: 'postgresql',
      sql_text: `SELECT
  channel,
  COUNT(*) AS campaigns,
  ROUND(SUM(spend), 2) AS total_spend,
  SUM(leads) AS total_leads,
  SUM(conversions) AS total_conversions,
  ROUND(SUM(revenue), 2) AS total_revenue,
  ROUND(SUM(revenue) / NULLIF(SUM(spend), 0), 2) AS roas,
  ROUND(SUM(spend) / NULLIF(SUM(conversions), 0), 2) AS cac
FROM marketing_campaigns
GROUP BY channel
ORDER BY roas DESC;`,
    },
  ];

  for (const s of starterScripts) {
    db.run(
      `INSERT OR IGNORE INTO _vos_sql_scripts (id, project_id, title, dialect, sql_text, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.project_id, s.title, s.dialect, s.sql_text, now, now]
    );
  }

  // Seed starter tasks
  const starterTasks = [
    {
      id: 'task_clean_dirty',
      project_id: 'proj_retail_sales',
      title: 'Clean raw_dirty_sales duplicates, nulls, and outliers in Data Cleaning Lab',
      module: 'cleaning',
      priority: 'high',
      status: 'todo',
      due_date: '2026-11-28',
    },
    {
      id: 'task_sql_window',
      project_id: 'proj_retail_sales',
      title: 'Complete SQL Window Functions Challenge in SQL Studio',
      module: 'sql',
      priority: 'medium',
      status: 'in_progress',
      due_date: '2026-11-30',
    },
    {
      id: 'task_stats_ttest',
      project_id: 'proj_banking_churn',
      title: 'Run Two-Sample T-Test on Churned vs Retained Customer Balances',
      module: 'statistics',
      priority: 'medium',
      status: 'todo',
      due_date: '2026-12-02',
    },
  ];

  for (const t of starterTasks) {
    db.run(
      `INSERT OR IGNORE INTO _vos_tasks (id, project_id, title, module, priority, status, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.project_id, t.title, t.module, t.priority, t.status, t.due_date, now]
    );
  }

  // Seed starter notes
  db.run(
    `INSERT OR IGNORE INTO _vos_notes (id, project_id, title, category, content, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'note_sql_cheatsheet',
      null,
      'SQL Analytical Patterns Cheat Sheet',
      'SQL',
      `# Core Analyst SQL Patterns\n\n## 1. Safe Division\nAlways wrap denominators in \`NULLIF(col, 0)\` to prevent division-by-zero errors.\n\n## 2. Running Total\n\`\`\`sql\nSUM(revenue) OVER (PARTITION BY region ORDER BY order_date)\n\`\`\`\n\n## 3. Period-over-Period Growth\nUse \`LAG(revenue) OVER (ORDER BY month)\` to compute MoM or YoY deltas cleanly.`,
      now,
    ]
  );

  // Seed starter notebook
  db.run(
    `INSERT OR IGNORE INTO _vos_notebooks (id, project_id, title, cells_json, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'nb_retail_eda',
      'proj_retail_sales',
      'Retail Sales Exploratory Data Analysis.ipynb',
      JSON.stringify([
        {
          id: 'cell_1',
          type: 'markdown',
          source: '### Retail Sales EDA Notebook\nDatasets from Venky Analytics OS are automatically mounted into `/workspace/<table_name>.csv`.',
        },
        {
          id: 'cell_2',
          type: 'code',
          source: `import pandas as pd\nimport numpy as np\n\ndf = pd.read_csv('/workspace/retail_sales.csv')\nprint("Shape:", df.shape)\nprint("\\nSummary by Region:")\nsummary = df.groupby('region').agg(\n    orders=('order_id', 'count'),\n    total_revenue=('revenue', 'sum'),\n    total_profit=('profit', 'sum'),\n    avg_discount=('discount_pct', 'mean')\n).round(2)\nsummary['margin_pct'] = (summary['total_profit'] / summary['total_revenue'] * 100).round(2)\nprint(summary)`,
        },
        {
          id: 'cell_3',
          type: 'code',
          source: `import matplotlib.pyplot as plt\n\ncat_rev = df.groupby('category')['revenue'].sum().sort_values(ascending=True)\nfig, ax = plt.subplots(figsize=(7, 3.6))\nax.barh(cat_rev.index, cat_rev.values, color='#2563EB')\nax.set_title('Total Revenue by Product Category (Sample Dataset)')\nax.set_xlabel('Revenue ($)')\nax.grid(axis='x', alpha=0.25)\nplt.tight_layout()\nplt.show()`,
        },
      ]),
      now,
    ]
  );

  // Seed starter BA Doc
  db.run(
    `INSERT OR IGNORE INTO _vos_ba_docs (id, project_id, doc_type, title, content_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      'ba_brd_retail',
      'proj_retail_sales',
      'BRD',
      'Omnichannel Discount Governance & Margin Dashboard BRD',
      JSON.stringify({
        executiveSummary:
          'Establish standardized discount approval thresholds and executive margin visibility across North, South, East, and West retail channels.',
        businessObjectives:
          '1. Reduce unapproved discounting above 15% by 40% within 2 quarters.\n2. Improve gross margin visibility from monthly lag to daily refresh.\n3. Standardize KPI definitions across Finance and Retail Operations.',
        scopeIn: 'POS & Online Direct sales ledger, regional manager approval workflows, daily margin dashboard.',
        scopeOut: 'ERP inventory accounting overhaul, vendor rebate renegotiations.',
        stakeholders: 'VP Retail Operations (Sponsor), Regional Managers (End Users), Finance Controller (Governance), Data Analytics Team (Delivery).',
        functionalReqs:
          'FR-01: System shall calculate net margin % after discount per SKU.\nFR-02: System shall flag orders exceeding 15% discount for regional manager review.\nFR-03: Exportable weekly MIS PDF/XLSX report.',
        nonFunctionalReqs:
          'NFR-01: Daily data refresh before 07:00 IST.\nNFR-02: Role-based row-level security by region.',
        acceptanceCriteria:
          'Given a transaction with discount > 15%, when daily ETL executes, then an exception alert is logged and surfaced in the Margin Audit view.',
      }),
      now,
    ]
  );

  // Seed default settings
  const defaultSettings: Record<string, string> = {
    theme: 'dark',
    defaultDialect: 'sqlite',
    defaultAiMode: 'analyst',
    defaultAiLanguage: 'english',
    activeCareerTrack: 'data-analyst',
  };
  for (const [k, v] of Object.entries(defaultSettings)) {
    db.run(`INSERT OR IGNORE INTO _vos_settings (key, value) VALUES (?, ?)`, [k, v]);
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    let db: Database;
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      createCoreSchema(db);
    } else {
      db = new SQL.Database();
      createCoreSchema(db);
      seedInitialWorkspace(db);
      persistDb(db);
    }
    dbInstance = db;
    return db;
  })();

  return initPromise;
}

export async function withReadOnlySnapshot<T>(run: (snapshot: Database) => T): Promise<T> {
  const db = await getDb();
  const SQL = await initSqlJs();
  const snapshot = new SQL.Database(db.export());
  try {
    snapshot.run('PRAGMA query_only = ON');
    return run(snapshot);
  } finally {
    snapshot.close();
  }
}

export function queryAll(db: Database, sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = db.prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params);
    const rows: Record<string, any>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

// Transparent SQL dialect translator (Oracle / Postgres / MySQL idioms -> SQLite engine)
export function translateDialectSql(
  rawSql: string,
  dialect: 'sqlite' | 'oracle' | 'postgresql' | 'mysql'
): { sql: string; notes: string[] } {
  let sql = rawSql.trim();
  const notes: string[] = [];

  if (dialect === 'oracle') {
    if (/\bFROM\s+DUAL\b/i.test(sql)) {
      sql = sql.replace(/\bFROM\s+DUAL\b/gi, '');
      notes.push('Translated Oracle FROM DUAL to SQLite expression query.');
    }
    if (/\bNVL\s*\(/i.test(sql)) {
      sql = sql.replace(/\bNVL\s*\(/gi, 'IFNULL(');
      notes.push('Translated Oracle NVL() to IFNULL().');
    }
    if (/\bSYSDATE\b/gi.test(sql)) {
      sql = sql.replace(/\bSYSDATE\b/gi, "DATE('now')");
      notes.push("Translated Oracle SYSDATE to DATE('now').");
    }
    if (/\bFETCH\s+FIRST\s+(\d+)\s+ROWS?\s+ONLY\b/i.test(sql)) {
      sql = sql.replace(/\bFETCH\s+FIRST\s+(\d+)\s+ROWS?\s+ONLY\b/gi, 'LIMIT $1');
      notes.push('Translated Oracle FETCH FIRST N ROWS ONLY to LIMIT N.');
    }
    if (/\bDECODE\s*\(([^()]+)\)/i.test(sql)) {
      sql = sql.replace(/\bDECODE\s*\(([^()]+)\)/gi, (_m, inner: string) => {
        const parts = inner.split(',').map((p) => p.trim());
        if (parts.length < 3) return _m;
        const target = parts[0];
        let caseSql = `CASE ${target}`;
        let i = 1;
        while (i + 1 < parts.length) {
          caseSql += ` WHEN ${parts[i]} THEN ${parts[i + 1]}`;
          i += 2;
        }
        if (i < parts.length) {
          caseSql += ` ELSE ${parts[i]}`;
        }
        caseSql += ' END';
        return caseSql;
      });
      notes.push('Translated Oracle DECODE() to ANSI CASE WHEN expression.');
    }
    if (/\bMINUS\b/i.test(sql)) {
      sql = sql.replace(/\bMINUS\b/gi, 'EXCEPT');
      notes.push('Translated Oracle MINUS set operator to ANSI EXCEPT.');
    }
  } else if (dialect === 'postgresql') {
    if (/\bILIKE\b/i.test(sql)) {
      sql = sql.replace(/\bILIKE\b/gi, 'LIKE');
      notes.push('Translated PostgreSQL ILIKE to case-insensitive LIKE.');
    }
    if (/\bNOW\s*\(\s*\)/i.test(sql)) {
      sql = sql.replace(/\bNOW\s*\(\s*\)/gi, "DATETIME('now')");
      notes.push("Translated PostgreSQL NOW() to DATETIME('now').");
    }
    if (/\bDATE_TRUNC\s*\(\s*'(year|month|day)'\s*,\s*([^)]+)\)/i.test(sql)) {
      sql = sql.replace(/\bDATE_TRUNC\s*\(\s*'(year|month|day)'\s*,\s*([^)]+)\)/gi, (_m, unit: string, col: string) => {
        const u = unit.toLowerCase();
        if (u === 'year') return `strftime('%Y-01-01', ${col.trim()})`;
        if (u === 'month') return `strftime('%Y-%m-01', ${col.trim()})`;
        return `strftime('%Y-%m-%d', ${col.trim()})`;
      });
      notes.push('Translated PostgreSQL DATE_TRUNC() to SQLite strftime().');
    }
    if (/::\s*(NUMERIC|FLOAT|DECIMAL|REAL|DOUBLE\s+PRECISION)/i.test(sql)) {
      sql = sql.replace(
        /([a-zA-Z_][a-zA-Z0-9_]*\s*\([^()]*\)|[a-zA-Z0-9_."]+)\s*::\s*(NUMERIC|FLOAT|DECIMAL|REAL|DOUBLE\s+PRECISION)/gi,
        'CAST($1 AS REAL)'
      );
      notes.push('Translated PostgreSQL ::numeric/float cast to CAST(... AS REAL).');
    }
    if (/::\s*(INT|INTEGER|BIGINT)/i.test(sql)) {
      sql = sql.replace(
        /([a-zA-Z_][a-zA-Z0-9_]*\s*\([^()]*\)|[a-zA-Z0-9_."]+)\s*::\s*(INT|INTEGER|BIGINT)/gi,
        'CAST($1 AS INTEGER)'
      );
      notes.push('Translated PostgreSQL ::int cast to CAST(... AS INTEGER).');
    }
  } else if (dialect === 'mysql') {
    if (/\bNOW\s*\(\s*\)/i.test(sql)) {
      sql = sql.replace(/\bNOW\s*\(\s*\)/gi, "DATETIME('now')");
      notes.push("Translated MySQL NOW() to DATETIME('now').");
    }
    if (/\bIF\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/i.test(sql)) {
      sql = sql.replace(/\bIF\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/gi, 'IIF($1, $2, $3)');
      notes.push('Translated MySQL IF(cond, a, b) to IIF(cond, a, b).');
    }
  }

  return { sql, notes };
}

export function validateUserSqlSafety(sql: string): string | null {
  const normalized = sql.toLowerCase();
  if (/\b_vos_[a-z0-9_]+/.test(normalized)) {
    return 'Access denied: Internal workstation metadata tables (_vos_*) cannot be accessed or modified via SQL Studio.';
  }
  if (/\b(sqlite_master|sqlite_schema|sqlite_temp_master|sqlite_temp_schema)\b/.test(normalized)) {
    return 'Access denied: Direct queries to sqlite_master/sqlite_schema are restricted. Use the Schema Explorer panel instead.';
  }
  if (/\b(attach\s+database|load_extension|pragma\s+writable_schema)\b/.test(normalized)) {
    return 'Security restriction: ATTACH DATABASE, LOAD_EXTENSION, and unsafe PRAGMA statements are disabled.';
  }
  return null;
}
