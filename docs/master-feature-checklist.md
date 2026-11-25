# Master feature checklist

All items are targets, not verified completion. Mark complete only with test evidence.

## Analytics
- [ ] Excel per-cell formulas, pivots, dashboards
- [ ] SQL autocomplete, challenges, joins
- [ ] Python notebooks, statistics, cleaning, visualization
- [ ] Power BI concepts, DAX and Power Query practice (not a full Power BI clone)
- [ ] Reporting and dashboard builder
- [ ] BA BRD/FRD/BPMN, Agile/Scrum/Jira practice
- [ ] Product, marketing/GA4, customer/RFM, financial, operations, research analytics
- [ ] AI automation and real-world analyst simulator

## Communication
- [ ] Two-way English voice, Telugu voice explanations across modules
- [ ] Grammar, vocabulary, listening, fluency and pronunciation practice (no unsupported scoring)
- [ ] HR/technical interviews, stakeholder conversations, presentation, data storytelling
- [ ] Configurable 40-minute sessions, transcripts, corrections, progress

## Keyboard
- [ ] Touch typing, English/SQL/Python/Excel exercises, WPM and accuracy
- [ ] Weak-key adaptive practice, history and goals
- [ ] Actual shortcut detection and guided reserved-shortcut simulation for Windows, Excel, Power BI, SQL, VS Code, Jupyter, Word, PowerPoint, Chrome and Google Workspace

## Career
- [ ] ATS resume builder, JD analyzer, skill gap, application tracker
- [ ] Portfolio, real-world projects, learning dashboard and daily targets

## AI and data
- [ ] Optional Gemini, opt-in open-source browser AI, graceful provider failure
- [ ] Contextual bilingual tutor; offline non-AI exercises
- [ ] Expand dataset library toward 150 varied datasets, on-demand synthetic generator, related tables and dirty data, provenance/license for public data
- [ ] CSV/Excel/JSON import/export, answer validation

## Delivery
- [ ] Browser-only, no required desktop installs or paid subscription
- [ ] Low bandwidth, lazy loading, no automatic large model downloads
- [ ] Responsive mobile/laptop UI, autosave, backup and recovery
- [ ] Preserve existing modules and data; basic security for online deployment
- [ ] Typecheck, build, browser regression, AI failure tests, deployment and documented limitations

Read development-requirements.md as well. Keep untested features unchecked; do not merge untested code. Free hosting, voice quality and browser AI performance depend on actual platform limits.

## Development branch acceptance status

Statuses apply to the slice described. Parent checkboxes stay open when work remains. Test details, runtime instructions and the continuation checkpoint are in [Development checkpoint](development-progress.md).

| Requirement | Status and evidence | Remaining work |
|---|---|---|
| Existing code, branch and data | Implemented and tested for clean checkout. Source catalogs now tracked. TypeScript, build and isolated production boot passed. | Original untracked AI Studio content is unavailable from reachable Git history. Full regression and merge pending. |
| Typing Studio | Partially implemented. `SkillsPracticeModule.tsx` provides English, business email, SQL, Python, Excel, home row and numeric drills. Chromium verified corrected mistakes, persisted per-key accuracy, focused drills for weak keys, timed scoring, daily goals and a duration-specific WPM chart. | Full lessons, symbols, finger placement, consistency, keyboard heatmaps and advanced progression. |
| Shortcut Studio | Partially implemented. `SkillsPracticeModule.tsx` captures a focused shortcut and offers reserved-key simulation. Chromium verified both, Tab navigation, persisted per-shortcut accuracy, weakest-shortcut review, app filtering, timed attempts, response-time reporting, searchable reference with direct practice, persisted mastery levels, and difficulty-specific practice. | Broader shortcut coverage across the remaining apps. |
| Hybrid AI | Partially implemented. `GeminiPanel.tsx`, `offlineTutor.ts` and existing server adapter. Chromium verified missing-key fallback. | Open-source browser model, hardware/download consent and cache, automatic provider availability, quota and success checks. |
| Contextual tutor | Partially implemented. Existing context goes to explicitly selected Gemini. Offline exercises use active module and language. | Per-artifact contextual explanations in every module, tiered lessons, interactive hints and follow-up tests. |
| Telugu/English voice teaching | Partially implemented. `browserSpeech.ts`, `GeminiPanel.tsx` and Communication Studio expose playback, speed, stop and Telugu transcript fallback. | Device voice verification, English immersion, context selection, voice questions and model voice support. |
| Communication Studio | Partially implemented. `CommunicationStudioModule.tsx` implements prompts, turn-based browser transcription and editable responses, configurable timer and manual rubric. Text, timer and browser-local session history were tested in Chromium. | Live voice, audio verification, pronunciation recognition, corrections, additional scenarios and daily routines. |
| Excel | Partially implemented. Chromium verified a HyperFormula SUM calculation in `ExcelStudioModule.tsx`. | Validate additional formulas, multiple sheets, workbook import/export and persistence, pivots, formatting, validation and dashboards. |
| SQL | Partially implemented. `SqlStudioModule.tsx`, `server.ts` and `curriculum.ts` cover native SQLite, dialect translations and seeded exercises. | More exercises, editor autocomplete, relationships, complete dialect coverage, history edge cases and query performance training. |
| Python and notebooks | Partially implemented. `PythonStudioModule.tsx` loads packages per cell and fetches referenced CSVs on demand. Real Pyodide verified core execution and CSV reading. | Live scientific package and plotting tests, notebook persistence and exports, DataFrame workflows, SciPy and scikit-learn. |
| Statistics and research | Implemented but unverified as existing functionality in `StatisticsLabModule.tsx`. | Test assumptions, effect size, inference, regression, experiment and research scenarios and answer validation. |
| Power BI | Implemented but unverified as existing simulation in `PowerBiWorkspaceModule.tsx`. | Expand and verify DAX, model relationships, filter context, transformations and interactive reporting. |
| Cleaning and visualization | Implemented but unverified as existing functionality in their studio modules. | Reversible cleaning, profiles, advanced charts, saved configurations and export regression. |
| Business Analysis | Partially implemented. Existing BA workspace and testable-criteria lesson. | Full stakeholder, requirements, process mapping, Agile/Jira, UAT, traceability and scenario assessments. |
| Specialized analytics | Partially implemented. Existing domain workspaces, 14 career tracks and three generator scenarios. | Expand product, marketing, customer, financial, supply chain, fintech, research, strategy and responsible automation practice and assessments. |
| Dataset library | Partially implemented. Existing samples plus `SyntheticDatasetGenerator.tsx` for reproducible 20–1,000-row JSON with optional missing values, duplicates, format issues and outliers. | Approximately 150 scenarios, configurable schemas, related tables, business graders, provenance records and additional export options. |
| Analyst job simulator | Not implemented. | Stakeholder requests, change events, deadlines, staged submissions, verbal delivery and rubric scoring. |
| Interviews | Partially implemented. Existing studio uses the new starter catalog. Communication Studio includes behavioral practice. | Role and technical question banks, voice mock rounds, structured feedback and verified answer practice across modules. |
| Career center | Partially implemented. Existing portfolio builder and 14 career tracks plus a Chromium-tested application tracker and explicit phrase matching in `CareerPractice.tsx`. | Resume and cover letter builder, richer skill gap review, interview tracker, LinkedIn guidance and export verification. |
| Projects | Partially implemented. Existing project shell and one actionable starter blueprint. | Cover more tools, dedicated project evaluation, milestones, README and interview presentation guidance. |
| Learning system | Partially implemented. Existing server progress and two starter lessons with quizzes. | Complete role-based sequences, spaced repetition, flashcards, daily and weekly targets, streaks and review metrics. |
| Unified dashboard | Partially implemented. Existing dashboard builds with restored career and curriculum catalogs. | Studio-level metrics and next actions grounded in actual practice data. |
| UI and accessibility | Partially implemented. Existing themes, search, navigation and browser mobile smoke test. | Phone and desktop coverage across all modules, assistive technology and accessibility audit. |
| Persistence, backup, privacy and security | Partially implemented. SQLite backup, integrity check, restore and saved progress verified against an isolated copy. Typing and application history use browser storage. | User-facing backup, automatic integrity checks, access controls and rate limits for hosted use. |
| Performance and low data | Partially implemented. Studio splitting reduced the entry chunk. Tutor requires no automatic model download. Chromium verified typing access during a workspace API outage. | Optional offline caching, low-data setting, smaller export chunks, virtualized tables and network measurements. |
| Public deployment and AI Studio sync | Blocked. No confirmed authenticated runtime with a durable volume and publishing access. | Verify eligible infrastructure, access boundary, volume, sync controls and the deployed URL. |
| Testing and handoff | Partially implemented. See the checkpoint for verified tests and component-level gaps. | Complete regressions, accessibility, live devices, deployment, current host limits and full license inventory. |
