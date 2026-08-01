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


## Firebase cloud-sync setup

This package is already connected to the Firebase project `mac-workout`.

Before using cloud sync:

1. Open Firebase Console → Firestore Database → Rules.
2. Replace the existing rules with the contents of `firestore.rules.txt`.
3. Click **Publish**.
4. Upload the app files to the GitHub workout repository and wait for Pages to redeploy.
5. Create an account inside the workout app.
6. Sign in with the same email and password on iPhone and iPad.

### Sync behavior
- Data is saved locally immediately.
- Signed-in data is also saved to `users/{uid}/apps/macWorkout`.
- On first sign-in, existing local workout data is uploaded if no cloud profile exists.
- When cloud data already exists, it loads onto the signed-in device.
