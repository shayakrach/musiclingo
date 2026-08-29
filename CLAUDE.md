# CLAUDE.md

Guidance for Claude Code (or any future assistant) working in this repo.

## What this is

MusicLingo — a vanilla JS/HTML/CSS PWA for learning vocabulary from song lyrics
(flashcards, multiple-choice quizzes, clues, grammar forms). No build step, no
framework, no package.json — the app runs directly from static files.

## Structure

```
index.html            — HTML shell only: markup, no inline CSS/JS
assets/
  style.css            — all app styles
  app.js                — all app logic
  icons/icon.svg         — single vector icon, reused for favicon/apple-touch-icon/manifest
manifest.webmanifest   — PWA manifest
sw.js                  — offline service worker (cache-first app shell + runtime caching)
data/                  — real song content, fetched at runtime (gitignored, see below)
```

## The `data/` folder and copyrighted content

Real song lyrics are copyrighted, so real song data is **never committed**.
`data/` is in `.gitignore`. At runtime, `assets/app.js` tries to fetch:

- `data/manifest.json` — `{ "songs": ["some_song.json", ...] }`
- `data/<song>.json` — one song object per file (same shape as the demo songs
  hardcoded in `assets/app.js`)

If `data/` or any file in it is missing, that's treated as a silent no-op —
the app still works fine on its built-in demo song(s). This fetch requires
the page to be served over `http(s)://` or `localhost`; it's skipped when
opened directly as `file://`.

There is also a legacy `data.js` file (older `<script>`-based loading
mechanism, superseded by the `data/` fetch approach above but kept
gitignored out of caution — see repo history / README before removing it).

**Never print, quote, or reproduce contents of `data/*.json` or `data.js` in
chat or commit them to git** — they contain real copyrighted lyrics.

## Editing the app

- Edit `assets/app.js` and `assets/style.css` directly — do not reintroduce
  inline `<style>`/`<script>` blocks into `index.html`.
- When bumping the app version (shown in the `<title>` and the in-app
  version badge), update it in both `index.html` and `assets/app.js`.
- If you change which files need to be available offline, update the
  `APP_SHELL` array in `sw.js` and bump `CACHE_NAME` (e.g. `v2` → `v3`) so
  clients pick up the new precache list.

## Workflow note

Historically, whole-app updates arrived as a single monolithic exported
HTML file (e.g. `MusicLingo vX.Y.Z.html`) dropped into `index.html`. As of
this restructure, the app is split into `assets/style.css` + `assets/app.js`
— dropping in a new monolithic file would blow that structure away. Prefer
editing `assets/` directly going forward.
