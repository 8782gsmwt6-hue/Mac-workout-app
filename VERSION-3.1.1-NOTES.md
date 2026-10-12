# Smart Coach 3.1.1 — Program tab display fix

The v3.1 Program screen already contains a read-only 16-week roadmap, schedule and workout previews. A screenshot showing reps and RIR editable on Program indicates an old page is being served.

This maintenance release makes the version visible on the Program screen, updates cache-busted script/style URLs and changes the service worker to network-first for app shell files with offline fallback. All workout storage and Firebase structures remain unchanged.

## Deployment

1. Export workout backup in Settings and confirm the last sync.
2. Upload **all files** in the ZIP, including `app.js`, `index.html`, `styles.css`, and `service-worker.js`, to the **repository root** on the GitHub Pages publishing branch. Do not upload just the ZIP or the enclosing directory.
3. Wait until GitHub Pages deploys the change. Open the website in Safari, refresh, close the tab and reopen it if needed. A second refresh may be needed for a previously active service worker.
4. Open Program and look for `YOUR TRAINING ROADMAP · v3.1.1` above the 16-week grid. Program should not show editable set inputs.
5. If old inputs still appear, check the deployed `index.html` and `app.js` files on GitHub Pages first. If the deployment is correct but the old version persists, use Safari website-data controls for that site as a last resort **only after ensuring Firebase has synced and a backup exists**; site data removal can erase unsynced local records.

This is a deployment/cache fix; live iOS and Firebase testing is still required.
