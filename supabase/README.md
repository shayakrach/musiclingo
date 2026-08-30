# Supabase setup

MusicLingo uses [Supabase](https://supabase.com) (free tier) for the shared song catalog and per-user libraries, split into three tables (see [`schema.sql`](./schema.sql)):

- `songs` — one row per real song: lyrics, extracted word list, difficulty. Independent of target language.
- `song_translations` — one row per (song, target language): the actual teaching content (translated lines, word meanings, clues, confusables, distractors, tenses) — the part that's inherently written *in* the target language.
- `user_songs` — which (song, target language) pairs each signed-in user has added to their own library.

This split exists so that giving an existing song a second target-language translation means adding one small `song_translations` row, not re-typing/re-generating the whole song (lyrics + word list) again.

## One-time setup

1. Create a free Supabase project (see project README/CLAUDE.md for the walkthrough).
2. Open **SQL Editor** in the Supabase dashboard → New query.
3. Paste the contents of [`schema.sql`](./schema.sql) and run it. (This drops any old-shape `songs`/`user_songs` tables first — see the file's header comment if you have real data to carry over.)
4. Grab your **Project URL** and **anon/publishable key** from Project Settings → API — these go into the app's client config (not secret; safe for client-side code).

## Adding a song to the catalog

There's no in-app admin form yet. Add songs directly via SQL Editor, in two steps:

```sql
-- 1. The song itself — lyrics + word list, one row regardless of how many translations exist
insert into songs (id, title, artist, difficulty, source_lang, accent_label, streaming_links, unique_word_count, lines, vocabulary)
values (
  'song_id',
  'Song Title',
  'Artist Name',
  'Beginner / Intermediate',
  'Spanish',
  '',
  '{"spotify": "", "appleMusic": "", "youtube": "", "youtubeMusic": ""}',
  0,
  '[]',   -- lines: [{id, text, order}, ...]
  '[]'    -- vocabulary: [{id, word, lineId}, ...]
);

-- 2. One translation — repeat this insert (with a different target_lang) to add
--    the same song for another target language later, without redoing step 1
insert into song_translations (song_id, target_lang, lines, vocabulary)
values (
  'song_id',
  'American English',
  '[]',   -- lines: [{lineId, translation}, ...] — lineId matches songs.lines[].id
  '[]'    -- vocabulary: [{vocabId, meaning, clue, confusableWith, distractors, tenses}, ...] — vocabId matches songs.vocabulary[].id
);
```

**Never paste real song lyrics/vocabulary content into a place that isn't this
private database** — it's copyrighted, same rule as the old `data.js`/`data/`
approach.

## In-app feedback (submit-feedback Edge Function)

The Settings → "💬 Send Feedback" form calls a Supabase Edge Function
(`functions/submit-feedback`) which files a GitHub issue on this repo, tagged
`bug` / `enhancement` / `question` plus `user-feedback`. It doesn't touch the
database at all — it's serverless compute (a separate free-tier quota from
Postgres storage) that calls the GitHub API server-side, so a GitHub token
never reaches the browser.

**One-time setup (dashboard, no CLI/Docker needed):**

1. Create a GitHub **fine-grained personal access token**
   (https://github.com/settings/tokens?type=beta) scoped to just this repo,
   with **Issues: Read and write** permission. No other permissions needed.
2. In the Supabase dashboard → **Edge Functions** → **Create a new function**
   → name it `submit-feedback` → paste in the contents of
   [`functions/submit-feedback/index.ts`](./functions/submit-feedback/index.ts)
   → Deploy.
3. Still in Edge Functions, open `submit-feedback` → **Secrets** (or the
   project's general Edge Functions secrets page) → add `GITHUB_TOKEN` with
   the token from step 1. (`SUPABASE_URL` / `SUPABASE_ANON_KEY` are injected
   automatically — nothing to do there.)

After that, the function is live at the URL the Supabase client already
knows how to reach (`supabaseClient.functions.invoke("submit-feedback", ...)`
in `assets/app.js`) — no client-side config needed.

Whenever `functions/submit-feedback/index.ts` changes in this repo, redeploy
by pasting the updated file into the same dashboard editor and clicking
Deploy again (or use the Supabase CLI if you set one up later).
