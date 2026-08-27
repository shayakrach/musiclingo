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
index.html   — the entire app (HTML, CSS, JS in one file)
data.js      — real song data (NOT included in this repo — see below)
sw.js        — service worker, enables offline support
```

## About `data.js`

This repo does **not** include real song data, since song lyrics are copyrighted. `index.html` ships with a small placeholder "demo" song so the app runs out of the box, but the actual song content lives in a separate `data.js` file that is deliberately excluded via `.gitignore`.

If `data.js` is present in the same folder as `index.html`, it's loaded automatically and overrides the placeholder data. If it's missing, the app just runs on the demo song instead of breaking.

**`data.js` shape:**

```js
const ExternalSongLibraryOverride = {
  "song_id": {
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
};
```

## Running locally

Just open `index.html` in a browser. No build step, no dependencies, no server required.

For full offline/PWA support (install to home screen), the file needs to be served over HTTPS or `localhost` rather than opened directly as `file://` — any static host (GitHub Pages, Netlify, Vercel) works.

## Adding a new song

The in-app "➕ Add New Song" button generates a prompt (with a fixed JSON schema) that you paste into an AI assistant along with a short excerpt of the song's lyrics. The AI's response can then be merged into `data.js` by hand. This part of the workflow is still evolving.

## Tech

Vanilla JS, no frameworks, no build tools — everything runs from a single HTML file plus the optional data/service-worker files above.
