# v3.2.0: incremental improvements from v3.1.1

1. **Smarter progressive overload**: reads completed reps, individual set loads, and effort data. Only recommends changes, never alters weight automatically. Missing or uncertain effort prevents auto-increase recommendations.
2. **Per-set loads**: each set gets its own weight/resistance field; legacy exercise-level loads remain the default and previous workout records are not rewritten on display. Total volume uses actual per-set load.
3. **Friendly RIR**: "Reps left?" with None, 1, 2, 3+, Not sure. Historical numerical RIR remains readable. "Not sure" is stored as unknown rather than zero.
4. **Calibration cue**: after four logged exercise exposures since the last marked calibration, offers an optional on-session benchmark. Pull-ups use strict reps; weighted exercises should use submaximal clean reps. Skip freely.
5. **Bodyweight tracking**: Progress now includes pull-up total reps and best single-set reps, separate from loaded exercise volume.
6. **Coaching insights**: existing coach recommendations now use completed per-set training data. No additional tabs.

Preserved: Firebase settings, auth, cloud sync, original program, week-advancement, existing data storage key, archived training blocks, navigation and visual design.

Limitations: Progression algorithm is deterministic, not medical or expert supervision; 3+ RIR is stored as the lower-bound 3. Calibration history is based on saved exercise exposures rather than actual timestamps. In-app testing and user validation remain necessary.
