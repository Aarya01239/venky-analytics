# Development checkpoint

## Delivered in this pass

- Fixed the clean-checkout build by narrowing the SQLite data ignore rule and adding starter curriculum and career catalogs under `src/data/`. The original curriculum files were absent from the reachable Git history. The replacement includes 14 tracks, two lessons, two SQL challenges, two interview questions, and one project brief.
- Added Communication Studio with five professional scenarios, a configurable 40-minute default timer, browser prompt playback, optional microphone transcription, editable transcripts, Telugu guidance, and self-review rubrics.
- Added explicit Gemini selection, no-key fallback, and curated offline guidance in English, Telugu script, and Romanized Telugu. Auto mode uses the curated guidance, so opening the tutor never triggers a paid request.
- Expanded the Keyboard Skills Lab with more drills, raw WPM and accuracy that counts corrected mistakes. Browser-reserved shortcuts use a button-based simulation. The existing typing score history key is retained.
- Split studio code into on-demand chunks. Added a deterministic synthetic JSON generator in File Manager for sales, merchant payments and marketing, including an optional dirty-data mode.
- Updated SQL challenge grading to use the registered reference and a disposable SQLite snapshot.

## Verification and compatibility

- Runtime used for validation: Node 24.22.3, Bun 1.4.5, and headless Chromium. The frozen Bun lock installed successfully. Plain npm installation hit the existing Vite/esbuild peer dependency mismatch. Use the Bun lock for reproducibility.
- TypeScript check and production Vite build passed. A production Express process started with a fresh temporary data directory.
- Chromium desktop and 390 px mobile tests exercised navigation, typing completion and stored history, keyboard detection and simulation, the speaking timer and editable transcript, and the curated fallback after the Gemini endpoint returned HTTP 503 without a key.
- The same smoke run verified SQLite aggregation, a correct registered challenge, unknown challenge rejection, deterministic synthetic payment JSON with duplicates and missing values, and successful JSON re-import.
- Gzip estimates from Vite put the entry JS chunk at approximately 138 kB, down from 869 kB before code splitting on the repaired baseline. The dashboard's shared chart chunk adds about 120 kB. These are build estimates. Network compression, slow-network timings and real-device transfer remain unmeasured. Excel and export chunks still trigger Vite's large-chunk warning.
- Real microphone recognition, audible speech and Telugu voice inventories require testing with actual browsers and a microphone. The available Telugu voices depend on the device. The studio uses turn-by-turn browser transcription and displays a self-review rubric. It provides no pronunciation score.
- Browser AI weights, Gemini success with an API key, Pyodide downloads, full analytics regression coverage and offline reload remain unverified or pending. No model assets were added.

## Deployment and recovery

This is a single-workspace Express service with one in-memory SQLite instance and disk snapshots. Use a single service instance, a durable writable volume, and an HTTPS access gateway that authenticates users before granting access to both the website and API routes. A static-only host cannot serve the API. A short-lived container filesystem cannot retain the database. Keep Gemini disabled unless the authenticated host has quota controls.

Back up by stopping the service cleanly and copying the configured `SQLITE_DB_PATH`, or `$DATA_DIR/venky_os.sqlite` when no override is set, to a protected location. Verify with SQLite `PRAGMA integrity_check` in a maintenance environment. For recovery, back up the current file first, stop the service, restore the verified file to that same path with the correct ownership, and restart. Confirm health and a known dataset or project before resuming use. Browser typing history lives in local storage and is outside the SQLite backup. Communication transcripts are session-only.

Direct AI Studio synchronization was unavailable in this run. In the original AI Studio project, inspect its GitHub integration and branch selection. Use `development/learning-studios` if that interface supports switching to the development branch. If the integration tracks only `main`, review the branch changes and merge through GitHub after validation, then refresh the linked AI Studio app. Before deploying, confirm the tracked commit, configured Secrets, authentication and persistent storage. The exact AI Studio controls and the deployment were unverified.

## Continuation

1. Verify Gemini with a user-managed key and exercise the real microphone and Telugu voice on Chrome desktop and Android. Keep the curated approach available without a key.
2. Mount only selected datasets in Python, load libraries when required, and test Python execution and exports. Validate Excel formulas and workbook persistence.
3. Add adaptive keyboard drills and durable practice histories, then extend the existing learning, interview, analytics and project modules using the acceptance checklist.
4. Add private hosting, access controls, rate limits, and a restore rehearsal. Verify deployment before releasing a URL.
