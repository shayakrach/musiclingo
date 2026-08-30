# Integrations

A plain-language index of every external service this app talks to, what
it's for, and where its credentials actually live. **No secrets are stored
here or anywhere in this repo** — only IDs/keys that are safe to be public,
and pointers to the dashboards where the real secrets are configured.

## Supabase

**Project:** `fxjjouvympnrlxcqvyyb` — https://supabase.com/dashboard/project/fxjjouvympnrlxcqvyyb

The backend for everything account/data-related:

- **Database** — `songs`, `song_translations`, `user_songs` tables (the shared song catalog + per-user libraries). Schema: [`supabase/schema.sql`](supabase/schema.sql). Details: [`supabase/README.md`](supabase/README.md).
- **Auth** — Google sign-in only (no email/password). Configured at Authentication → Providers → Google.
- **Edge Function** — `submit-feedback`, files GitHub issues from the in-app feedback form. Source: [`supabase/functions/submit-feedback/index.ts`](supabase/functions/submit-feedback/index.ts).

**Credentials:**
| What | Where it lives | Secret? |
|---|---|---|
| Project URL + anon/publishable key | Hardcoded in `assets/app.js` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) | No — meant to be public, that's what the anon key is for |
| `GITHUB_TOKEN` (used by the Edge Function to create issues) | Supabase dashboard → Edge Functions → `submit-feedback` → Secrets | **Yes** — never in this repo |

## Google (Sign in with Google)

A Google Cloud project provides the OAuth client Supabase Auth uses.

- **Google Cloud Console:** https://console.cloud.google.com/ — project holding the OAuth consent screen + client
- **Client ID**: not secret (it's public in the auth redirect URL anyway) — configured directly in Supabase's Google provider settings, not stored in this repo
- **Client Secret**: **only** lives in Supabase dashboard → Authentication → Providers → Google — never in this repo
- **Authorized JavaScript origins**: `https://shayakrach.github.io`, `http://localhost:5500` (add more here if you test on other local ports)
- **Authorized redirect URI**: `https://fxjjouvympnrlxcqvyyb.supabase.co/auth/v1/callback`

## GitHub

- **Repo:** `shayakrach/musiclingo`, hosted via **GitHub Pages** at https://shayakrach.github.io/musiclingo/ (Settings → Pages)
- **Fine-grained personal access token** (Issues: Read and write, scoped to this one repo) — generated at https://github.com/settings/personal-access-tokens, used only as the `GITHUB_TOKEN` Supabase secret above. Not stored in this repo. Regenerate + update the Supabase secret if it expires.
- **Labels used by the feedback flow:** `bug`, `enhancement`, `question`, `song-request`, `user-feedback` (see `supabase/functions/submit-feedback/index.ts` for the tag→label mapping)

## Static, no-auth dependencies

These are loaded from CDNs but don't involve accounts/credentials — nothing to lose track of:

- **Google Fonts** (Fraunces, Manrope, JetBrains Mono) — linked in `index.html`
- **`@supabase/supabase-js`** — loaded from jsdelivr in `index.html`

## If you're picking this project back up after a while

1. Check this file for what's connected.
2. For each one, click through to its dashboard to confirm it's still active (Supabase free projects pause after 7 days idle — just needs a click to resume).
3. If a secret needs rotating, update it **only** in the dashboard listed above — never add it to a file in this repo.
