# Smart Coach — Strength Progression 2.0

Updates the supplied v1 package without changing Firebase project configuration, Firestore document path, user accounts, or the existing localStorage key.

## Changes
- Working load carries forward from the most recent earlier completed workout of the same exercise, including workouts on a different training day. A newly selected week will no longer reset to the program default. Empty, never-completed old entries no longer block carryforward; an explicitly edited upcoming load can be kept before sets are completed.
- Each working set now records its own RIR. Old whole-exercise RIR remains in stored data but isn't fabricated into individual set entries.
- Strength trend is calculated from the currently selected week's completed reps versus the last earlier logged same-day session. Previously, the trend examined the last two weeks with logs regardless of which week was selected.
- Adds effort-aware next-load recommendation. Weight increases are suggestions, never silently applied.
- Adds Strength Progression cards on the Progress screen, using recorded completed sets and actual loads.
- Service worker cache version bumped so returning installed users receive updated files.

## Deployment
Back up your current workout data with Settings > Export backup before deploying. Replace the existing website files with the contents of this ZIP at the same hosting location. Keep the existing Firebase project and authorized website domain unchanged. The unchanged storage key and cloud document path preserve existing data. Refresh/relaunch the iPhone home-screen app after deployment; if it serves an old cached page, close and reopen it once.

## Notes
- The app stores one load per exercise session; per-set load is not tracked. RIR now is per set.
- The recommendation only unlocks when all prescribed sets have reps at/above top of the range, with a recorded RIR of 1–2 on each set. Use judgment for bodyweight and timed exercises.
- Existing previously recorded RIR was exercise-level and cannot accurately be converted to per-set RIR.
- This package contains code changes, not your personal cloud workout records; no cloud data was accessed or changed.
