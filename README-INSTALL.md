# Workout Redemption v3.2.0 — complete GitHub Pages deployment

This is a FULL replacement of the existing GitHub Pages app shell, built from your uploaded v3.1.1 files, not a standalone plugin. It retains Firebase config, authentication, user data structure, 16-week Program roadmap, and existing navigation.

## Deployment
1. In the current app, open Settings → Export backup. Check Cloud sync status and last synced time. Keep the exported JSON somewhere safe.
2. Commit the eight files from this ZIP to the **root of the existing GitHub Pages publishing branch**, replacing the older files: `index.html`, `app.js`, `styles.css`, `service-worker.js`, `manifest.json`, and three icons. Do not upload the ZIP or an enclosing directory.
3. Wait for GitHub Pages deployment to finish. Open the app and check Program reads `v3.2.0`. Reload if needed; the service worker is network-first with offline fallback.
4. Verify an existing workout still appears, then log a *test set*, verify per-set load and "Reps left?" persistence, confirm cloud sync, and confirm the same log on another device.
5. Program remains read-only. Today is the only workout editing screen.

## Safety
Do not clear browser website data unless backups and Firebase sync are confirmed. This package has static/logic smoke tests but has NOT been exercised against your live Firebase account or iPhone. Deploy to a staging branch/site first if possible.
