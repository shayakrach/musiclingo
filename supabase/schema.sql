-- MusicLingo — Supabase schema (v2: normalized song / translation split)
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- This replaces the earlier one-table-per-language-pair design. A song's
-- lyrics and word list (source_lang side) are language-pair-independent —
-- they shouldn't be re-typed/re-generated every time the same song gets a
-- new target-language translation. So:
--
--   songs             — one row per real song: lyrics, extracted word list,
--                        difficulty, streaming links. Independent of target
--                        language.
--   song_translations — one row per (song, target_lang): the actual
--                        teaching content (translated lines, word meanings,
--                        clues, confusables, distractors, tenses) — this is
--                        the part that's inherently written IN the target
--                        language, so it's the part that repeats per pair.
--
-- Adding a second target language for an existing song = one new
-- song_translations row, not a whole duplicated songs row.
--
-- Model: both tables are shared and publicly readable, no write policy (see
-- supabase/README.md — added via SQL Editor directly, which bypasses RLS).
-- user_songs now also carries target_lang, since a user can add the same
-- song under more than one translation.

-- ============================================================================
-- 0. Decommission the old (v1) schema
-- ============================================================================
-- The old `songs` table stored one full row per (song, target_lang) pair —
-- being replaced by the songs/song_translations split above. If you have
-- real song rows in the old shape, export/regenerate them into the new
-- shape BEFORE running this (see supabase/README.md) — this drops them.
drop table if exists user_songs;
drop table if exists song_translations;
drop table if exists songs;

-- ============================================================================
-- 1. Songs — language-pair-independent content
-- ============================================================================
create table if not exists songs (
  id text primary key,                          -- e.g. "yafyufa_eyal_golan"
  title text not null,
  artist text not null,
  difficulty text not null,
  source_lang text not null,
  accent_label text not null default '',
  streaming_links jsonb not null default '{}',   -- {spotify, appleMusic, youtube, youtubeMusic}
  unique_word_count int not null default 0,
  lines jsonb not null,                          -- [{id, text, order}, ...]
  vocabulary jsonb not null,                     -- [{id, word, lineId}, ...]
  created_at timestamptz not null default now()
);

alter table songs enable row level security;

create policy "songs are publicly readable"
  on songs for select
  using (true);

-- ============================================================================
-- 2. Song translations — the per-(song, target_lang) teaching content
-- ============================================================================
create table if not exists song_translations (
  song_id text references songs(id) not null,
  target_lang text not null,
  lines jsonb not null,                          -- [{lineId, translation}, ...]
  vocabulary jsonb not null,                     -- [{vocabId, meaning, clue, confusableWith, distractors, tenses}, ...]
  created_at timestamptz not null default now(),
  primary key (song_id, target_lang)
);

alter table song_translations enable row level security;

create policy "song_translations are publicly readable"
  on song_translations for select
  using (true);

-- ============================================================================
-- 3. Per-user personal library
-- ============================================================================
create table if not exists user_songs (
  user_id uuid references auth.users(id) not null,
  song_id text references songs(id) not null,
  target_lang text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, song_id, target_lang)
);

alter table user_songs enable row level security;

create policy "users manage their own library"
  on user_songs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
