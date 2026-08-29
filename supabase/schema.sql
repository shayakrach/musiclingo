-- MusicLingo — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- Model: the song catalog is shared and publicly readable. Signed-in users
-- can add catalog songs to their own personal library; they cannot add or
-- edit catalog songs themselves. For now there's no in-app admin write flow —
-- catalog songs get added by running INSERT statements directly in the SQL
-- Editor (which runs with full DB access and isn't restricted by the RLS
-- policies below), so no admin auth/policy is needed yet. Add a write policy
-- here later if an in-app admin flow gets built.
--
-- Field names inside `lines`/`vocabulary` intentionally match assets/app.js's
-- current shape (es/en/tenses), not the newer word/meaning/forms naming used
-- by the (currently unused) in-app "Add New Song" prompt — see CLAUDE.md for
-- that discrepancy. These are generic labels, not literally Spanish/English —
-- source_lang/target_lang vary per song since the app supports many language
-- pairs.

-- ============================================================================
-- 1. Shared song catalog
-- ============================================================================
create table if not exists songs (
  id text primary key,                          -- e.g. "cafe_y_lluvia"
  title text not null,
  artist text not null,
  difficulty text not null,
  source_lang text not null,
  target_lang text not null,
  accent_label text not null default '',
  streaming_links jsonb not null default '{}',   -- {spotify, appleMusic, youtube, youtubeMusic}
  unique_word_count int not null default 0,
  lines jsonb not null,                          -- [{id, es, en, order}, ...]
  vocabulary jsonb not null,                     -- [{es, en, clue, lineId, confusableWith, distractors, tenses}, ...]
  created_at timestamptz not null default now()
);

alter table songs enable row level security;

-- Anyone (including anonymous visitors) can read the catalog.
create policy "songs are publicly readable"
  on songs for select
  using (true);

-- No insert/update/delete policy on purpose: with RLS enabled and no write
-- policy, the public API can't write to this table at all. Catalog songs are
-- added via SQL Editor `insert` statements instead (see supabase/README.md).

-- ============================================================================
-- 2. Per-user personal library (which catalog songs a user has added)
-- ============================================================================
create table if not exists user_songs (
  user_id uuid references auth.users(id) not null,
  song_id text references songs(id) not null,
  added_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

alter table user_songs enable row level security;

-- Users can only see/manage their own library entries.
create policy "users manage their own library"
  on user_songs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
