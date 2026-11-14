# Smart Coach 3.2.1 — Compact Today + Between-exercise Coaching

Built on your uploaded v3.2.0 source, preserving per-set loads, RIR selections, training blocks, Firebase authentication and sync, and the Program roadmap.

- Fit iPhone widths without horizontal overflow, including the hero, header, and set grids.
- Start long pre-workout guidance and missed-workout controls collapsed.
- Replace the long repeated in-card coaching/trend sections with concise targets.
- New **Finish exercise · Coach tip** button validates completed reps for all prescribed sets, saves an additive `exerciseCompleted` flag and opens a brief coaching dialog with current results and next exercise. **OK** dismisses the dialog and scrolls to the following exercise.
- Existing workout completion and summary remain unchanged; no existing logs are deleted or migrated.

Before installing: export a backup and confirm Firebase sync. Deploy the eight website files to the publishing root. This build is source-validated but not exercised against your live Firebase account. Test on iPhone before relying on it.
