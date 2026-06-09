// Single source of truth for the deployed app version.
//
// BUMP THIS on every user-facing code change (see CLAUDE.md → "Cache busting").
// It is the explicit, human-readable cache-busting knob for the installed PWA:
//   - it is woven into the service worker (app/sw.ts), so changing it changes
//     public/sw.js — the browser then re-installs the worker and, via
//     skipWaiting + clientsClaim, pushes the new code to every open client,
//     including iOS home-screen PWAs that otherwise sit on a stale cache;
//   - it is emitted as an <meta name="app-version"> tag (app/layout.tsx) so the
//     live build is verifiable from the page source / DevTools.
//
// Next.js content-hashes JS/CSS and Serwist revisions every precached asset, so
// real asset changes already bust automatically — this constant is the belt-and-
// suspenders that also covers server-only changes and gives us a visible marker.
//
// Format: YYYY.MM.DD.N (N = the Nth release that day). Always move it forward.
export const APP_VERSION = "2026.06.09.2";
