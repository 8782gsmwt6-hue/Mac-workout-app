# Mac Workout App

A mobile-first, installable workout tracker built for iPhone and iPad.

## Included
- Today's Jayflex workout
- Set-by-set rep logging
- RIR and actual load tracking
- 16-week progression guidance
- Weekly body-weight, waist, sleep, energy, soreness, and notes
- Progress dashboard and chart
- Offline support after first load
- Export/import backup
- Dark mode

## Publish with GitHub Pages
1. Upload all files and the `icons` folder to the repository root.
2. Open repository **Settings**.
3. Open **Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/root`.
6. Save.
7. Open the GitHub Pages address in Safari.
8. Tap **Share → Add to Home Screen**.

Workout records are stored locally in the browser on the device. Use Export Backup regularly.


## Flexible workout-day update
- The Today screen now has a **Workout to do today** dropdown.
- You can choose any scheduled workout on any calendar day.
- A make-up workout is logged against the workout selected, not the current weekday.
- Existing workout history remains compatible.


## Real-time cloud version

- Firebase login persists between sessions.
- Changes are written after a short delay.
- Firestore updates are listened to in real time.
- The newest `metaUpdatedAt` value wins during conflicts.
- Settings includes **Sync now**, current status, and last-sync time.
- Use the same Firebase account on iPhone and iPad.


## Cloud data deletion fix
- The reset button now erases both local data and the signed-in Firestore profile.
- The empty workout state then syncs to every device using the same account.
- The button shows progress and reports cloud deletion failures.


## Authoritative cloud reset
- Adds a reset marker that overrides older workout data on every device.
- Temporarily pauses the real-time listener while resetting.
- Cancels pending uploads before clearing.
- Prevents an iPhone or iPad with stale local data from restoring deleted test entries.
