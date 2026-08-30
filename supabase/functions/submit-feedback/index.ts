// MusicLingo — submit-feedback Edge Function
//
// Receives { tag, message } from the app's feedback form and creates a
// GitHub issue on this repo, labeled by tag. The GitHub token stays
// server-side (set as the GITHUB_TOKEN secret in the Supabase dashboard) —
// it is never exposed to the browser.
//
// SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically by the
// Supabase Edge Runtime; only GITHUB_TOKEN needs to be set manually.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_REPO = "shayakrach/musiclingo";

const TAG_LABELS: Record<string, string> = {
  bug: "bug",
  feature: "enhancement",
  question: "question"
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (!GITHUB_TOKEN) {
    return jsonResponse({ error: "Server misconfigured: GITHUB_TOKEN not set." }, 500);
  }

  let payload: { tag?: string; message?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const message = (payload.message || "").trim();
  if (!message) {
    return jsonResponse({ error: "Message is required." }, 400);
  }
  if (message.length > 4000) {
    return jsonResponse({ error: "Message is too long (max 4000 characters)." }, 400);
  }

  const tag = TAG_LABELS[payload.tag || ""] ? payload.tag! : "question";
  const label = TAG_LABELS[tag];

  // Identify the signed-in user, if any, from the caller's auth header.
  let reporter = "anonymous";
  const authHeader = req.headers.get("Authorization");
  if (authHeader) {
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data } = await supabaseClient.auth.getUser();
      if (data?.user?.email) reporter = data.user.email;
    } catch {
      // Not signed in / invalid token — fall back to anonymous.
    }
  }

  const titleLine = message.split("\n")[0].slice(0, 60);
  const title = `[${tag}] ${titleLine}`;
  const body = `**Reported by:** ${reporter}\n\n${message}`;

  const ghResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "musiclingo-feedback-function"
    },
    body: JSON.stringify({ title, body, labels: [label, "user-feedback"] })
  });

  if (!ghResponse.ok) {
    const detail = await ghResponse.text();
    return jsonResponse({ error: "Failed to create GitHub issue.", detail }, 502);
  }

  const issue = await ghResponse.json();
  return jsonResponse({ ok: true, issueUrl: issue.html_url });
});
