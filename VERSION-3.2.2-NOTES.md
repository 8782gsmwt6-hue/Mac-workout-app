# Smart Coach 3.2.2 — iPhone viewport fix

Source: latest v3.2.0 supplied by user, with 3.2.1 compact coaching changes retained.

## Changes
- Constrain main content and all workout/grid containers to viewport width.
- Stack the hero banner (including the week pill) vertically on phones instead of squeezing it into two columns.
- Let the weekly navigation labels wrap, and force day tiles to stay within seven equal-width columns.
- Prevent Safari text autosizing from unexpectedly inflating labels.
- Preserve the existing per-set loads, reps, RIR, auto week progression, archived blocks, Firebase sync and exercise-completion coaching modal.

## Safari check
If the app is still clipped and the bottom navigation is off-screen, Safari may be pinch-zoomed or using non-100% page zoom. Pinch inward to return to normal or use Safari page settings to set zoom to 100%. Then refresh after deployment.

## Deployment
Export backup and confirm sync before replacing the root GitHub Pages files. Replace index.html, app.js, styles.css, manifest.json, service-worker.js and three icons. Do not upload the enclosing directory. Test actual iPhone and Firebase sync.
