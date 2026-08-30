# Supabase setup

MusicLingo uses [Supabase](https://supabase.com) (free tier) for two things:

- `songs` — the shared song catalog (publicly readable, admin-only writes for now)
- `user_songs` — which catalog songs each signed-in user has added to their own library

## One-time setup

1. Create a free Supabase project (see project README/CLAUDE.md for the walkthrough).
2. Open **SQL Editor** in the Supabase dashboard → New query.
3. Paste the contents of [`schema.sql`](./schema.sql) and run it.
4. Grab your **Project URL** and **anon/publishable key** from Project Settings → API — these go into the app's client config (not secret; safe for client-side code).

## Adding a song to the catalog

There's no in-app admin form yet. Add songs directly via SQL Editor:

```sql
insert into songs (id, title, artist, difficulty, source_lang, target_lang, accent_label, streaming_links, unique_word_count, lines, vocabulary)
values (
  'song_id',
  'Song Title',
  'Artist Name',
  'Beginner / Intermediate',
  'Spanish',
  'American English',
  '',
  '{"spotify": "", "appleMusic": "", "youtube": "", "youtubeMusic": ""}',
  0,
  '[]',   -- lines array
  '[]'    -- vocabulary array
);
```

Fill in `lines`/`vocabulary` with the real JSON arrays (shape matches the demo song in `assets/app.js` — `es`/`en`/`tenses`, not the newer `word`/`meaning`/`forms` naming from the currently-unused "Add New Song" prompt).

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
