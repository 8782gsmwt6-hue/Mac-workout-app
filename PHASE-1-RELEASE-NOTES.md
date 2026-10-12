# Smart Coach 3.0 — Phase 1 and Continued Training Blocks

## What's new

- **Repeatable 16-week training blocks:** Settings → Training blocks → Start next 16-week block. A confirmation archives your current block and creates an empty Week 1 for the next block. The previous 16 weeks stay in `archivedBlocks` within the same saved state and are included in JSON exports and Firebase document sync.
- **Lifetime progression:** Prior completed sets, working loads, reps and per-set RIR from older blocks inform future workout targets; the new block doesn't revert dumbbells to the default prescribed weight.
- **Effort-aware load recommendations:** Completed top-range reps with roughly 1–3 RIR prompt a suggestion to *consider* heavier weight. Recommendations are not automatic weight changes. Missing RIR is called out.
- **Strength history across blocks:** The strength dashboard compares recorded sets from all blocks; Progress → Weekly history includes archived and current block entries.
- **Skipped-workout handling:** Today's screen includes a Mark selected workout skipped / undo control; skipped days are not counted as training weeks. Existing completed sets and finished workouts cannot be marked skipped without clearing their status first.
- **Backups:** JSON export includes all archived blocks, RIR and new metadata; import validates the data structure and requests confirmation before replacing local state.
- **Privacy and synchronization:** Existing Firebase project, login and storage document are retained. This version still syncs the entire state object, using last-writer-wins conflict handling, **not** record-by-record merging. To avoid concurrent edit conflicts, finish edits and confirm Synced before opening another device.

## Upgrade steps

1. In the current app, Settings → Export backup, and save the JSON file somewhere safe **before** deploying.
2. Replace the GitHub Pages deployment with the ZIP contents, keeping the same Firebase account.
3. Close/reopen the home-screen app and confirm the new Training blocks control is shown in Settings.
4. Verify that Week 5 and earlier data are still visible, and that previously logged working loads are carried forward.
5. **Do not start the next training block until you intend to reset your program to Week 1.** You may start Block 2 after finishing Week 16 or choose to start it sooner.
6. Export a fresh backup immediately before starting any new block.

## Important limitations

- Old records have workout week/day but not necessarily reliable real workout dates. The app does not invent dates.
- Existing activity-based advancement still requires at least one legitimate logged strength workout in the prior training week and a new Monday; skipped calendar weeks don't advance the 16-week program.
- New blocks are advanced explicitly with the button, not silently when Week 16 ends.
- The app does not have an equipment inventory or automatically schedule deloads based on physiology. Use good form and pain-free training, especially after long breaks.
- Browser/Node syntax and core archiving-history tests were run; a live iPhone and Firebase multi-device round trip have **not** been tested in this environment.
