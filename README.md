# MusicLingo

Learn vocabulary from song lyrics — flashcards, multiple-choice quizzes, grammar forms, and per-word clues, built from real songs.

## How it works

- Pick a song, then quiz yourself on its vocabulary with multiple-choice questions
- Each word comes with a memory clue, grammar forms (tenses/conjugations), and — where available — a highlighted line from the song showing it in context
- Tracks your stats per word (times seen, accuracy) and keeps a history of past rounds
- Supports 8 interface languages and works with any source/target language pair
- Installable as a PWA (works offline once loaded, can be added to your phone's home screen)

## Project structure

```
index.html              — HTML shell (markup only, no inline CSS/JS)
assets/
  style.css              — all app styles
  app.js                  — all app logic
  icons/icon.svg           — app icon (favicon, apple-touch-icon, PWA manifest icons)
manifest.webmanifest    — PWA manifest
sw.js                   — service worker, enables offline support
data/                   — real song data, fetched at runtime (NOT included in this repo — see below)
```

For a rundown of every external service this app uses (Supabase, Google
sign-in, GitHub) and where each one's credentials live, see
[`INTEGRATIONS.md`](INTEGRATIONS.md).

## About the `data/` folder

This repo does **not** include real song data, since song lyrics are copyrighted. The song library starts empty — real songs come from either the shared Supabase catalog (see `supabase/README.md`; sign in and use "📚 Browse Catalog" to add one to your own library) or, optionally, a local `data/` folder that is deliberately excluded via `.gitignore`.

If `data/manifest.json` is present alongside `index.html`, its songs are fetched and merged into the library. If it's missing, that's a normal no-op — the app still runs fine, just with whatever the Supabase catalog provides.

**Expected layout:**

```
data/manifest.json     — { "songs": ["some_song.json", ...] }
data/some_song.json    — one song object per file, shape below
```

**Song object shape:**

```js
{
  id: "song_id",
  title: "Song Title",
  artist: "Artist Name",
  difficulty: "Beginner / Intermediate",
  sourceLang: "Spanish",
  targetLang: "English",
  accentLabel: "",
  lines: [
    { id: 1, es: "...", en: "...", order: 1 }
  ],
  vocabulary: [
    {
      es: "word", en: "meaning", clue: "...",
      lineId: 1,
      confusableWith: { word: "...", meaning: "...", difference: "..." },
      distractors: ["...", "...", "..."],
      tenses: [{ label: "...", word: "...", meaning: "..." }]
    }
  ]
}
```

> Note: an older version of this app loaded a single gitignored `data.js` file instead. That mechanism has been superseded by the `data/` folder above.

## Running locally

Just open `index.html` in a browser. No build step, no dependencies, no server required.

For full offline/PWA support (install to home screen), the file needs to be served over HTTPS or `localhost` rather than opened directly as `file://` — any static host (GitHub Pages, Netlify, Vercel) works.

## Adding a new song

The in-app "➕ Add New Song" button generates a prompt (with a fixed JSON schema) that you paste into an AI assistant along with a short excerpt of the song's lyrics. The AI's response can then be saved as a new `data/<song_id>.json` file and added to `data/manifest.json`'s `songs` array by hand. This part of the workflow is still evolving.

## Tech

Vanilla JS, no frameworks, no build tools — static HTML/CSS/JS served as-is, plus the optional `data/`/service-worker files above.
