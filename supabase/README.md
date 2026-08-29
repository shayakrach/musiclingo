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
