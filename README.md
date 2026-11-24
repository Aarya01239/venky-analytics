# Venky Analytics OS

A laptop-first, full-stack personal analytics workstation for learning, practicing, executing, analyzing, reporting, and delivering real-world work across **14 analyst career tracks**.

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS v4 (Dark default + Light theme), Recharts, HyperFormula (Excel formula engine), SheetJS (`xlsx`), `simple-statistics`, `jstat`, `jspdf`, `docx`, and an isolated **Pyodide WebAssembly Worker** for sandboxed client-side Python (Pandas, NumPy, Matplotlib).
- **Backend**: Express + TypeScript (`server.ts`) running on Port 3000 with:
  - **Persistent SQLite Engine (`sql.js`)**: Automatically saved to `data/venky_os.sqlite` on disk. Stores all workspace metadata (`_vos_*` tables) AND real queryable relational datasets.
  - **Unified Dataset Registry**: Any CSV, XLSX, XLS, or JSON uploaded once in File Manager—or cleaned in Data Cleaning Lab—is indexed into SQLite and immediately reusable across SQL Studio, Excel Studio, Python Studio (`/workspace/<table>.csv`), Statistics Lab, Power BI Workspace, Visualization Studio, and Reporting Studio.
  - **Server-Side Gemini AI Proxy (`/api/ai/assist`)**: Uses `@google/genai` (`gemini-4-hydrogen`) exclusively on the backend. Never exposes `GEMINI_API_KEY` to client code. Supports 5 modes (`Analyst`, `Learn`, `Practice`, `Interview`, `Report`) and `English`, `Telugu (తెలుగు)`, or `Bilingual` responses.

## Security & Engine Transparency

1. **No Arbitrary Server-Side Python Execution**: User Python notebooks execute strictly inside a dedicated browser Pyodide WebAssembly Worker with a 25-second execution timeout and manual kernel restart.
2. **SQL Guardrails**: User queries cannot read or mutate internal `_vos_*` metadata tables, and dangerous SQLite pragmas (`ATTACH DATABASE`, `LOAD_EXTENSION`) are blocked.
3. **Database Dialect Compatibility**: SQL Studio executes natively on SQLite 3 (supporting CTEs, Window Functions, Views, Indexes, Joins, DDL/DML, and `EXPLAIN QUERY PLAN`) and provides a transparent compatibility translator for common Oracle (`NVL`, `SYSDATE`, `FROM DUAL`, `FETCH FIRST`), PostgreSQL (`ILIKE`, `::numeric`), and MySQL (`NOW()`, `IF()`) syntax. Full Oracle PL/SQL stored procedures require an external Oracle Database server (e.g., Docker `gvenzl/oracle-free`) or hosted PostgreSQL instance.
4. **Power BI Compatibility**: Browser-based BI canvas, Star Schema visualizer, and DAX evaluator support rapid prototyping and learning alongside step-by-step `.dax` / CSV export workflows for Microsoft Power BI Desktop (`.pbix`).

## Environment Variables

Configure via `.env` (or AI Studio **Settings > Secrets**):

```bash
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="http://localhost:3000"
```

## Local Development & Deployment

```bash
npm install
npm run dev      # Starts Express + Vite middleware on http://localhost:3000
npm run build    # Production bundle into dist/
npm run lint     # TypeScript type-check (tsc --noEmit)
```
