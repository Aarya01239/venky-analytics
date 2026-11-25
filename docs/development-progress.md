# Development checkpoint

## Shortcut mastery

- Shortcut Trainer derives Unpracticed, Learning, and Mastered from this browser's saved attempts. Mastered requires at least five attempts and at least 80% accuracy. The app selector scopes the mastery count, and the searchable reference can be filtered by level.
- Chromium verifies the Learning-to-Mastered transition after five correct attempts, the Mastered filter, and the same level after reload.

## Shortcut reference

- Shortcut Trainer includes a reference searchable by app, action or a full key combination such as `Ctrl+Shift+L`. The existing app selector scopes the list. Browser- and system-reserved entries identify their on-screen simulation.
- Selecting Practice opens the chosen shortcut and moves keyboard focus to its prompt. Chromium covers exact chord lookup, action search, capture and simulation entry points, and the empty state.

## Shortcut practice by app

- Shortcut Trainer filters practice by app and supports optional ten-second attempts. Starting a timed attempt focuses the keyboard capture area for supported chords. Browser- or system-reserved chords are practiced with the on-screen simulation.
- A missed deadline counts as an incorrect attempt. Cancelling or switching tasks leaves the unfinished attempt out of history. Successful timed attempts record their response time and show a saved per-shortcut average.
- Chromium verifies the Jupyter filter, a successful timed Shift+Enter chord, response-time reporting, and a missed deadline in the same history. Shortcut history remains browser-local.

## Typing goals and progress

- Timed typing has a configurable goal of one to five completed tests per browser-local day. Cancelled and empty tests do not count. Goal and completed count persist independently of the rolling twelve-result list.
- Recent results show a WPM bar and exact accuracy for each test. The selected duration determines the comparison group. The longest bar represents the best recent WPM in that group.
- Chromium exercises reaching a goal, reload persistence, separate result views by duration, cancellation, and a date rollover while the page remains open.

## Timed typing follow-up

- Keyboard Skills Lab offers 30- and 60-second timed typing tests. The score uses correct characters at timeout for WPM and counts corrected mistakes in accuracy. The twelve most recent timed results are saved in this browser, separately from regular typing records.
- The Chromium smoke suite uses a controlled clock to verify timeout, an edited mistake, scoring, result persistence after reload, a 60-second selection, and cancellation with no saved result.

## Keyboard practice follow-up

- Typing Studio tracks attempts and mistakes against expected keys when a drill is completed. It shows up to eight keys ranked by missed share and offers a focused drill for each. Focused drills update key practice history while regular exercises retain their separate WPM record.
- Shortcut Trainer saves per-shortcut results in the current browser and can reopen the tested shortcut with the lowest accuracy. Both direct key capture and reserved-key simulation contribute to that history.
- Chromium smoke checks cover corrected typing mistakes, focused drill completion, unchanged regular WPM history, shortcut practice selection, and both histories after reload. TypeScript and production builds passed.

## Second development pass

- Python Studio starts with the Pyodide core. The worker loads Python packages required by the current cell. Saved cells using `pd`, `np` and `plt` aliases still receive the matching imports on demand.
- Cell references such as `/workspace/retail_sales.csv` load only that registered CSV. The worker reuses CSVs until their dataset version changes or the kernel restarts. For paths constructed at runtime, select the dataset and use **Mount active CSV**. The workspace dashboard may still make its existing active-dataset request.
- Communication Studio saves the most recent 20 explicitly saved sessions in the current browser. Each record contains the scenario, date and elapsed timer duration. Transcripts remain in memory and the app does not record audio.
- TypeScript and production build passed. The browser suite verifies speaking history across reloads. Chromium ran real Pyodide 0.26.4 from local distribution assets. The core boot and a standard-library cell made no notebook CSV or wheel requests. A cell that read the retail CSV made one dataset request, and rerunning the cell reused the mounted CSV. Third-party scientific package downloads and live audio remain unverified.

## Delivered in this pass

- Fixed the clean-checkout build by narrowing the SQLite data ignore rule and adding starter curriculum and career catalogs under `src/data/`. The original curriculum files were absent from the reachable Git history. The replacement includes 14 tracks, two lessons, two SQL challenges, two interview questions, and one project brief.
- Added Communication Studio with five professional scenarios, a configurable 40-minute default timer, browser prompt playback, optional microphone transcription, editable transcripts, Telugu guidance, and self-review rubrics.
- Added explicit Gemini selection, no-key fallback, and curated offline guidance in English, Telugu script, and Romanized Telugu. Auto mode uses the curated guidance, so opening the tutor never triggers a paid request.
- Expanded the Keyboard Skills Lab with more drills, raw WPM and accuracy that counts corrected mistakes. Browser-reserved shortcuts use a button-based simulation. The existing typing score history key is retained.
- Split studio code into on-demand chunks. Added a deterministic synthetic JSON generator in File Manager for sales, merchant payments and marketing, including an optional dirty-data mode.
- Added Career Prep with a browser-local application tracker and manual phrase matching for a job description and resume. Practice studios remain accessible when the workspace API fails while the site assets are reachable.
- Updated SQL challenge grading to use the registered reference and a disposable SQLite snapshot.

## Verification and compatibility

- Runtime used for validation: Node 24.22.3, Bun 1.4.5, and headless Chromium. The frozen Bun lock installed successfully. Plain npm installation hit the existing Vite/esbuild peer dependency mismatch. Use the Bun lock for reproducibility.
- TypeScript check and production Vite build passed. A production Express process started with a fresh temporary data directory.
- Chromium desktop and 390 px mobile tests exercised navigation, typing completion and stored history, keyboard detection and simulation, the speaking timer and editable transcript, and the curated fallback after the Gemini endpoint returned HTTP 503 without a key.
- The same smoke run verified a HyperFormula calculation, SQLite aggregation, a correct registered challenge, unknown challenge rejection, deterministic synthetic payment JSON with duplicates and missing values, successful JSON re-import, job tracker persistence and keyword gaps, and a workspace startup failure with continued typing access. The backup rehearsal stopped the server, copied the isolated SQLite database, passed `PRAGMA integrity_check`, restarted against the copy, and found the saved lesson progress and generated dataset.
- Gzip estimates from Vite put the entry JS chunk at approximately 138 kB, down from 869 kB before code splitting on the repaired baseline. The dashboard's shared chart chunk adds about 120 kB. These are build estimates. Network compression, slow-network timings and real-device transfer remain unmeasured. Excel and export chunks still trigger Vite's large-chunk warning.
- Real microphone recognition, audible speech and Telugu voice inventories require testing with actual browsers and a microphone. The available Telugu voices depend on the device. The studio uses turn-by-turn browser transcription and displays a self-review rubric. It provides no pronunciation score.
- Browser AI weights, Gemini success with an API key, Pyodide downloads, full analytics regression coverage and offline reload remain unverified or pending. No model assets were added.

## Deployment and recovery

This is a single-workspace Express service with one in-memory SQLite instance and disk snapshots. Use a single service instance, a durable writable volume, and an HTTPS access gateway that authenticates users before granting access to both the website and API routes. A static-only host cannot serve the API. A short-lived container filesystem cannot retain the database. Keep Gemini disabled unless the authenticated host has quota controls.

Back up by stopping the service cleanly and copying the configured `SQLITE_DB_PATH`, or `$DATA_DIR/venky_os.sqlite` when no override is set, to a protected location. Verify with SQLite `PRAGMA integrity_check` in a maintenance environment. For recovery, back up the current file first, stop the service, restore the verified file to that same path with the correct ownership, and restart. Confirm health and a known dataset or project before resuming use. Browser typing history and career applications live in local storage and are outside the SQLite backup. Communication transcripts are session-only.

The available Sites runtime accepts static output or a Worker fetch handler. The existing Express server writes SQLite snapshots to a local filesystem, so that host would require an API and storage migration. Direct AI Studio synchronization was unavailable in this run. In the original AI Studio project, inspect its GitHub integration and branch selection. Use `development/learning-studios` if that interface supports switching to the development branch. If the integration tracks only `main`, review the branch changes and merge through GitHub after validation, then refresh the linked AI Studio app. Before deploying, confirm the tracked commit, configured Secrets, authentication and persistent storage. The exact AI Studio controls and the deployment were unverified.

## Continuation

1. Verify Gemini with a user-managed key and exercise the real microphone and Telugu voice on Chrome desktop and Android. Keep the curated approach available without a key.
2. Verify Pandas and Matplotlib downloads, plots and notebook exports over a live network. Validate additional Excel formulas and workbook persistence.
3. Extend keyboard practice with additional passages, lessons and longer-term progress summaries. Expand the learning, interview, analytics and project modules using the acceptance checklist.
4. Add private hosting, access controls, rate limits, and a restore rehearsal. Verify deployment before releasing a URL.


## Repeatable smoke test

From the checkout with the production build ready, run `python tests/smoke_browser.py` using a Python environment with Playwright and Chromium installed. Set `CHROMIUM_EXECUTABLE` to use a specific Chromium build if needed. The suite uses port 4317, a temporary database, and an explicitly empty Gemini key. Optionally set `PYODIDE_ASSET_DIR` to the installed Pyodide 0.26.4 distribution to exercise browser-side Python and CSV requests without fetching the runtime from its CDN. See [dependency inventory](dependencies.md) for the direct package licenses.
