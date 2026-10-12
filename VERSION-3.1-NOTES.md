# Smart Coach 3.1 — Distinct Today and Program tabs

- Today remains the sole screen for editing and saving weight, reps, per-set RIR and completion.
- Program is now a read-only 16-week roadmap with four-week-row tiles, per-day status, scheduled exercises and archived block summary.
- Select a week and day to preview, then use **Open this workout in Today** to log a workout.
- Previewing an older week in Program does not change your current training week or stored workout data.
- A training session opened from Program uses that selected week as the browsing week; the actual training-week setting remains unchanged.
- Existing Firebase configuration, workouts, training block history, progression rules and backup format are unchanged.
- Cache version incremented to v31 for updated assets.

## Deploy
Back up your data first in Settings. Replace your GitHub Pages files with the contents of the ZIP. Reopen the installed app. Verify the Program tab, then Today, and confirm your previous sets still appear.

Testing: JavaScript static syntax and package integrity were checked. Live Firebase/iPhone testing was not possible in this environment.
