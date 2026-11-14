# Smart Coach 3.3 — Muscle Progress Dashboard

Based on the user-confirmed v3.2.2 iPhone-fit build. All current Today, Program, Firebase, archived training blocks, and exercise-finish coach features are retained.

## New Progress graphs
Eight separate progression charts: chest, shoulders, back, biceps, triceps, pull-ups, push-ups, legs. Charts use completed set records (including per-set loads) in both current and archived training blocks. Weighted exercise groups are charted as total volume (lb lifted) per recorded program week; bodyweight groups as total reps per recorded program week. Rest days, absent logs, and incomplete sets are not falsely plotted as zero. Filter each chart by its included exercise and by last 4, last 8, or all recorded weeks.

## Interpretation notes
Weekly training volume can change because of more sets, reps, load or exercise selection; it is not a direct measurement of muscular strength or muscle size. Use the single-exercise filter when assessing exercise-specific progression. Historical workout data remains untouched.

## Install
1. Export backup and verify Firebase synced.
2. Replace existing GitHub Pages root files with ZIP contents.
3. Refresh Safari. Confirm Program version v3.3.0 and Progress shows eight graphs.
4. Check your prior workouts and sync. Test another device before deleting older files.

Static syntax and simulated UI tests do not establish live Firebase or physical-device behavior.
