    // ============================================================================
    // MUSICLINGO — FILE MAP
    //
    // This file is organized top-to-bottom in the order things run/are used:
    //
    //   1. SongLibrary        — starts empty, populated from the Supabase catalog
    //                           and/or the data/ folder (see notes below)
    //   2. DB                 — the ONLY place that talks to localStorage.
    //                           Every read/write of saved data goes through here.
    //   3. App state           — in-memory variables for "what's happening right
    //                           now" (which song is open, current quiz progress)
    //   4. Settings & i18n     — user preferences, translations, the t() helper
    //   5. Voice / audio       — Web Speech API playback
    //   6. Song library view   — the home screen listing songs
    //   7. Confirm dialog      — reusable in-app Yes/No prompt (not native confirm)
    //   8. Quiz setup/filters  — the "choose what to practice" screen
    //   9. Round persistence   — pause/resume an in-progress round
    //  10. Quiz engine         — the actual question-by-question gameplay
    //  11. Clue & notes        — per-word hints and personal notes
    //  12. Navigation/tabs     — switching between screens within a song
    //  14. Settings page nav   — opening/closing the settings screen
    //  15. Modals              — the generic overlay used for Stats/History/etc.
    //  16. Table renderers     — Stats / History / Untested Words tables
    //  17. Boot sequence       — what runs when the page first loads
    //
    // Search for the "====" banners below to jump between sections.
    // ============================================================================

    // ============================================================================
    // 1. SONG LIBRARY DATA
    // ============================================================================
    // No hardcoded songs — SongLibrary starts empty and is populated at
    // runtime from the Supabase catalog (signed-in users only, see the
    // SUPABASE section below) and/or a local data/ folder (see DATA REPO
    // below). This used to include a placeholder demo song; removed since
    // real songs are now added directly to the Supabase catalog instead.

    const SongLibrary = {};

    // ============================================================================
    // DATA REPO — lazy-loaded external songs, one file per song
    // ============================================================================
    // Expects, alongside this HTML file:
    //   data/manifest.json          — { "songs": ["some_song.json", ...] }
    //   data/some_song.json         — a single song object (see README.md for
    //                                  the expected shape)
    //
    // This is entirely optional. If the "data" folder, the manifest, or any
    // individual song file is missing or fails to load, that's treated as a
    // normal, silent no-op — never an error that blocks the app. Loading also
    // requires the page to be served over http(s):// (or localhost); a raw
    // file:// double-click generally can't fetch sibling files this way,
    // matching the same limitation the old data.js approach had for scripts.
    let dataRepoSongs = {};

    async function loadSongsFromDataRepo() {
      let manifest;
      try {
        const manifestResponse = await fetch("data/manifest.json");
        if (!manifestResponse.ok) return; // no manifest — nothing to load, that's fine
        manifest = await manifestResponse.json();
      } catch (e) {
        // Folder/manifest missing, or fetch blocked (e.g. opened via file://).
        // Either way, fail silently — the app already works on demo songs alone.
        return;
      }

      const filenames = Array.isArray(manifest.songs) ? manifest.songs : [];

      for (const filename of filenames) {
        try {
          const songResponse = await fetch("data/" + filename);
          if (!songResponse.ok) continue; // this one file is missing/broken — skip it, keep going
          const songData = await songResponse.json();
          if (songData && songData.id) {
            dataRepoSongs[songData.id] = songData;
          }
        } catch (fileError) {
          // One bad file should never break the rest of the batch.
          continue;
        }
      }
    }

    function mergeDataRepoSongsIntoLibrary() {
      const loadedIds = Object.keys(dataRepoSongs);
      if (loadedIds.length === 0) return;

      Object.assign(SongLibrary, dataRepoSongs);

      // If the library view is currently what's on screen, refresh it so the
      // newly-arrived songs actually show up without needing a manual reload.
      const libraryView = document.getElementById("libraryView");
      if (libraryView && libraryView.style.display !== "none") {
        renderSongLibrary();
      }
    }

    // ============================================================================
    // PASTE SURROUNDING LYRIC LINES HERE (optional)
    // ============================================================================
    // The "Song Context" popup shows just the one line a word appears in by
    // default. If you want it to show a line or two of surrounding context
    // as well (with the current line clearly highlighted among them), paste
    // your own data into the array below — Claude won't write lyric content
    // into this file, so this part has to come from you.
    //
    // Each entry needs a "word" (must exactly match an existing 'es' value
    // in the vocabulary list above) plus optional "linesBefore" / "linesAfter"
    // arrays, each holding { "text": "...", "translation": "..." } objects,
    // in the order they appear in the song (earliest first).
    //
    // Example shape:
    //   {
    //     "word": "adoré",
    //     "linesBefore": [
    //       { "text": "the line right before, in Spanish", "translation": "its English translation" }
    //     ],
    //     "linesAfter": [
    //       { "text": "the line right after, in Spanish", "translation": "its English translation" }
    //     ]
    //   }
    //
    // Paste your whole array between the [ and ] below. Any word you don't
    // include here just keeps showing its single current line, same as now.
    const PASTED_SURROUNDING_LINES = [

    ];

    function mergeSurroundingLines() {
      if (!Array.isArray(PASTED_SURROUNDING_LINES) || PASTED_SURROUNDING_LINES.length === 0) return;
      const song = SongLibrary["azul_cristian_castro"];
      if (!song) return;

      PASTED_SURROUNDING_LINES.forEach(entry => {
        if (!entry || !entry.word) return;
        const match = song.vocabulary.find(w => w.es === entry.word);
        if (!match) return;
        if (Array.isArray(entry.linesBefore)) match.linesBefore = entry.linesBefore;
        if (Array.isArray(entry.linesAfter)) match.linesAfter = entry.linesAfter;
      });
    }

    // ============================================================================
    // PASTE LINE ORDER HERE (optional, recommended — replaces the old per-word
    // linesBefore/linesAfter approach above with something much simpler)
    // ============================================================================
    // Each song's "lines" table (see "lines:" inside the song entry above) holds
    // every unique line, each with a stable "id" — but those ids were assigned
    // in whatever order the words were originally listed, not the order the
    // lines actually appear in the song. To make the "Song Context" popup show
    // the real line before/after the current one, tell the app each line's true
    // position in the song by pasting an array below.
    //
    // You don't need to paste any lyric text here — just reference each line's
    // existing "id" (find it in the "lines" array above) and give it a sequence
    // number: 1 for the first line in the song, 2 for the second, and so on.
    // Repeated lines (like a chorus) can share sequence numbers across their
    // separate occurrences if you want, or just number them in listening order.
    //
    // Example shape:
    //   { "songId": "azul_cristian_castro", "id": 5, "order": 3 }
    //
    // Paste your whole array between the [ and ] below.
    const PASTED_LINE_ORDER = [

    ];

    function mergeLineOrder() {
      if (!Array.isArray(PASTED_LINE_ORDER) || PASTED_LINE_ORDER.length === 0) return;
      PASTED_LINE_ORDER.forEach(entry => {
        if (!entry || !entry.songId || typeof entry.id === "undefined" || typeof entry.order !== "number") return;
        const song = SongLibrary[entry.songId];
        if (!song || !Array.isArray(song.lines)) return;
        const line = song.lines.find(l => l.id === entry.id);
        if (line) line.order = entry.order;
      });
    }

function resolveWordLine(word) {
      const song = SongLibrary[activeSongId];
      if (word.lineId && song && Array.isArray(song.lines)) {
        const found = song.lines.find(l => l.id === word.lineId);
        if (found) return { text: found.es, translation: found.en };
      }
      if (word.line) {
        return { text: word.line, translation: word.lineEn };
      }
      return null;
    }

    const DB = {
      songs: {
        getAll() {
          return SongLibrary;
        },
        get(id) {
          return SongLibrary[id];
        },
        add(song) {
          SongLibrary[song.id] = song;
          let custom = {};
          try {
            custom = JSON.parse(localStorage.getItem("spa_custom_songs") || "{}");
          } catch (e) {
            custom = {};
          }
          custom[song.id] = song;
          localStorage.setItem("spa_custom_songs", JSON.stringify(custom));
        },
        remove(id) {
          delete SongLibrary[id];
          try {
            const custom = JSON.parse(localStorage.getItem("spa_custom_songs") || "{}");
            if (custom[id]) {
              delete custom[id];
              localStorage.setItem("spa_custom_songs", JSON.stringify(custom));
            }
          } catch (e) {
            // ignore corrupt data
          }
          DB.hiddenSongs.add(id);
        },
        loadCustomIntoLibrary() {
          try {
            const raw = localStorage.getItem("spa_custom_songs");
            const custom = raw ? JSON.parse(raw) : {};
            Object.keys(custom).forEach(id => {
              SongLibrary[id] = custom[id];
            });
          } catch (e) {
            // corrupt data shouldn't block app boot
          }
        }
      },

      hiddenSongs: {
        getAll() {
          try {
            return JSON.parse(localStorage.getItem("spa_hidden_songs") || "[]");
          } catch (e) {
            return [];
          }
        },
        add(id) {
          const hidden = DB.hiddenSongs.getAll();
          if (!hidden.includes(id)) {
            hidden.push(id);
            localStorage.setItem("spa_hidden_songs", JSON.stringify(hidden));
          }
        },
        applyToLibrary() {
          DB.hiddenSongs.getAll().forEach(id => {
            delete SongLibrary[id];
          });
        }
      },

      stats: {
        get(songId) {
          try {
            return JSON.parse(localStorage.getItem(`spa_stats_${songId}`) || "{}");
          } catch (e) {
            return {};
          }
        },
        save(songId, statsObj) {
          localStorage.setItem(`spa_stats_${songId}`, JSON.stringify(statsObj));
        },
        clear(songId) {
          localStorage.removeItem(`spa_stats_${songId}`);
        }
      },

      notes: {
        get(songId) {
          try {
            return JSON.parse(localStorage.getItem(`spa_notes_${songId}`) || "{}");
          } catch (e) {
            return {};
          }
        },
        save(songId, notesObj) {
          localStorage.setItem(`spa_notes_${songId}`, JSON.stringify(notesObj));
        },
        clear(songId) {
          localStorage.removeItem(`spa_notes_${songId}`);
        }
      },

      // Per-song streaming link data the user has added/edited themselves,
      // plus which platform they've chosen to use for that specific song
      // (overriding the app-wide default just for this one song). Kept
      // entirely separate from each song's own built-in data so it survives
      // even for songs whose data comes from a static file/data repo.
      streamingOverrides: {
        get(songId) {
          try {
            return JSON.parse(localStorage.getItem(`spa_streaming_${songId}`) || "{}");
          } catch (e) {
            return {};
          }
        },
        save(songId, overrideObj) {
          localStorage.setItem(`spa_streaming_${songId}`, JSON.stringify(overrideObj));
        },
        setLink(songId, platform, url) {
          const current = DB.streamingOverrides.get(songId);
          current.links = current.links || {};
          current.links[platform] = url;
          DB.streamingOverrides.save(songId, current);
        },
        setSelectedPlatform(songId, platform) {
          const current = DB.streamingOverrides.get(songId);
          current.selectedPlatform = platform;
          DB.streamingOverrides.save(songId, current);
        },
        clear(songId) {
          localStorage.removeItem(`spa_streaming_${songId}`);
        }
      },

      history: {
        get(songId) {
          try {
            return JSON.parse(localStorage.getItem(`spa_history_${songId}`) || "[]");
          } catch (e) {
            return [];
          }
        },
        save(songId, historyArr) {
          localStorage.setItem(`spa_history_${songId}`, JSON.stringify(historyArr));
        },
        clear(songId) {
          localStorage.removeItem(`spa_history_${songId}`);
        }
      },

      currentRound: {
        get(songId) {
          return parseInt(localStorage.getItem(`spa_current_round_${songId}`) || "1");
        },
        save(songId, roundNumber) {
          localStorage.setItem(`spa_current_round_${songId}`, roundNumber);
        },
        clear(songId) {
          localStorage.removeItem(`spa_current_round_${songId}`);
        }
      },

      lastMistakes: {
        get(songId) {
          try {
            return JSON.parse(localStorage.getItem(`spa_last_mistakes_${songId}`) || "[]");
          } catch (e) {
            return [];
          }
        },
        save(songId, mistakesArr) {
          localStorage.setItem(`spa_last_mistakes_${songId}`, JSON.stringify(mistakesArr));
        },
        clear(songId) {
          localStorage.removeItem(`spa_last_mistakes_${songId}`);
        }
      },

      activeRound: {
        get(songId) {
          try {
            const raw = localStorage.getItem(`spa_active_round_${songId}`);
            return raw ? JSON.parse(raw) : null;
          } catch (e) {
            return null;
          }
        },
        save(songId, state) {
          localStorage.setItem(`spa_active_round_${songId}`, JSON.stringify(state));
        },
        clear(songId) {
          localStorage.removeItem(`spa_active_round_${songId}`);
        }
      },

      settings: {
        get() {
          try {
            return JSON.parse(localStorage.getItem("spa_user_settings"));
          } catch (e) {
            return null;
          }
        },
        save(settingsObj) {
          localStorage.setItem("spa_user_settings", JSON.stringify(settingsObj));
        }
      },

      wipeAll() {
        localStorage.clear();
      },

      clearSongData(songId) {
        DB.stats.clear(songId);
        DB.notes.clear(songId);
        DB.history.clear(songId);
        DB.currentRound.clear(songId);
        DB.lastMistakes.clear(songId);
        DB.activeRound.clear(songId);
      }
    };

    // ============================================================================
    // 2.5 SUPABASE — auth + shared song catalog
    // ============================================================================
    // Optional, like the data repo above: if the Supabase CDN script didn't
    // load (offline, blocked, opened via file://), every function below is a
    // silent no-op and the app works exactly the same on demo/custom songs.
    //
    // Model: `songs` is a shared, publicly-readable catalog (see
    // supabase/schema.sql). Signed-in users can add a catalog song to their
    // own library, which both (a) saves it locally via DB.songs.add — same
    // mechanism as manually-added custom songs — and (b) records it in the
    // `user_songs` table so it's still there if they sign in on another
    // device. There's no in-app way to add to the catalog itself yet.
    const SUPABASE_URL = "https://fxjjouvympnrlxcqvyyb.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_WHS2PtK4LegFVYiNEjsM6A_sLKy5gP_";

    const supabaseClient = (typeof window.supabase !== "undefined")
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;

    let currentUser = null;
    let catalogTranslationsCache = null; // null = not fetched yet

    // A catalog entry is a song_translations row with its parent songs row
    // embedded (see fetchCatalogTranslations) — merge the two into the flat
    // shape the quiz engine expects. The song's lyrics/word list (songs.*)
    // are language-pair-independent; the translation row supplies the
    // per-word meaning/clue/etc, written in the target language.
    function catalogLibraryId(songId, targetLang) {
      return songId + "__" + targetLang;
    }

    function mergeSongTranslation(row) {
      const song = row.songs;
      if (!song) return null;

      const translationLinesById = {};
      (row.lines || []).forEach(l => { translationLinesById[l.lineId] = l.translation; });

      const translationVocabById = {};
      (row.vocabulary || []).forEach(v => { translationVocabById[v.vocabId] = v; });

      return {
        id: catalogLibraryId(song.id, row.target_lang),
        title: song.title,
        artist: song.artist,
        difficulty: song.difficulty,
        sourceLang: song.source_lang,
        targetLang: row.target_lang,
        accentLabel: song.accent_label || "",
        streamingLinks: song.streaming_links || {},
        isDemo: false,
        lines: (song.lines || []).map(l => ({
          id: l.id,
          es: l.text,
          en: translationLinesById[l.id] || "",
          order: l.order
        })),
        vocabulary: (song.vocabulary || []).map(v => {
          const t = translationVocabById[v.id] || {};
          return {
            es: v.word,
            en: t.meaning || "",
            clue: t.clue || "",
            lineId: v.lineId,
            confusableWith: t.confusableWith || null,
            distractors: t.distractors || [],
            tenses: t.tenses || []
          };
        })
      };
    }

    function updateAccountUI() {
      const signedOutForm = document.getElementById("accountSignedOutForm");
      const signedInInfo = document.getElementById("accountSignedInInfo");
      const signedOutNote = document.getElementById("accountSignedOutNote");
      if (!signedOutForm || !signedInInfo) return;

      if (currentUser) {
        signedOutForm.style.display = "none";
        signedOutNote.style.display = "none";
        signedInInfo.style.display = "block";
        document.getElementById("accountEmailDisplay").textContent = currentUser.email || "";
      } else {
        signedOutForm.style.display = "block";
        signedOutNote.style.display = "block";
        signedInInfo.style.display = "none";
      }
    }

    function showAccountAuthError(message) {
      const el = document.getElementById("accountAuthError");
      if (!el) return;
      el.textContent = message || "";
      el.classList.toggle("visible", !!message);
    }

    async function handleGoogleSignIn() {
      if (!supabaseClient) return;
      showAccountAuthError("");
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.href }
      });
      if (error) {
        showAccountAuthError(error.message);
      }
    }

    async function handleSignOut() {
      if (!supabaseClient) return;
      await supabaseClient.auth.signOut();
    }

    // Pulls the signed-in user's previously-added (song, target_lang) pairs
    // and merges them into the local library — this is what makes "add to
    // my library" show up again after signing in on a different device.
    async function syncMyCatalogSongsIntoLibrary() {
      if (!supabaseClient || !currentUser) return;
      try {
        const { data: mine, error: mineError } = await supabaseClient
          .from("user_songs")
          .select("song_id, target_lang");
        if (mineError || !Array.isArray(mine) || mine.length === 0) return;

        const translations = await fetchCatalogTranslations();
        mine.forEach(({ song_id, target_lang }) => {
          const row = translations.find(r => r.songs && r.songs.id === song_id && r.target_lang === target_lang);
          if (row) DB.songs.add(mergeSongTranslation(row));
        });

        const libraryView = document.getElementById("libraryView");
        if (libraryView && libraryView.style.display !== "none") {
          renderSongLibrary();
        }
      } catch (e) {
        // Network hiccup or table missing — never block the app over this.
      }
    }

    function initSupabaseAuth() {
      if (!supabaseClient) return;

      supabaseClient.auth.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        updateAccountUI();
        if (currentUser) {
          syncMyCatalogSongsIntoLibrary();
        }
      });

      supabaseClient.auth.getSession().then(({ data }) => {
        currentUser = data.session ? data.session.user : null;
        updateAccountUI();
        if (currentUser) syncMyCatalogSongsIntoLibrary();
      });
    }

    // Each row is one (song, target_lang) pair with its parent song
    // embedded — a song with two translations shows up as two rows here,
    // each addable independently.
    async function fetchCatalogTranslations() {
      if (!supabaseClient) return [];
      if (catalogTranslationsCache) return catalogTranslationsCache;
      try {
        const { data, error } = await supabaseClient
          .from("song_translations")
          .select("target_lang, lines, vocabulary, songs(*)");
        if (error || !Array.isArray(data)) return [];
        catalogTranslationsCache = data;
        return data;
      } catch (e) {
        return [];
      }
    }

    async function openCatalogModal() {
      const modal = document.getElementById("catalogModal");
      const signedOutNote = document.getElementById("catalogSignedOutNote");
      const loadingNote = document.getElementById("catalogLoadingNote");
      const emptyNote = document.getElementById("catalogEmptyNote");
      const list = document.getElementById("catalogList");

      modal.style.display = "flex";
      signedOutNote.style.display = supabaseClient && !currentUser ? "block" : "none";
      loadingNote.style.display = "block";
      emptyNote.style.display = "none";
      list.innerHTML = "";

      const rows = await fetchCatalogTranslations();
      loadingNote.style.display = "none";

      const notYetAdded = rows.filter(row => row.songs && !SongLibrary[catalogLibraryId(row.songs.id, row.target_lang)]);
      if (notYetAdded.length === 0) {
        emptyNote.style.display = "block";
        return;
      }

      notYetAdded.forEach(row => {
        const song = row.songs;
        const item = document.createElement("div");
        item.className = "song-card";
        item.style.marginBottom = "0.6rem";
        item.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.6rem;">
            <div>
              <div style="font-weight:600;">${escapeHtml(song.title)}</div>
              <div style="color: var(--text-muted); font-size: 0.85rem;">${escapeHtml(song.artist)}</div>
              <div style="color: var(--azul); font-size: 0.8rem;">${escapeHtml(song.source_lang)} → ${escapeHtml(row.target_lang)}</div>
            </div>
            <button class="practice-btn" style="white-space:nowrap;" ${currentUser ? "" : "disabled"}
              onclick="addCatalogSongToLibrary('${song.id}', '${row.target_lang}')">➕ Add</button>
          </div>
        `;
        list.appendChild(item);
      });
    }

    function closeCatalogModal() {
      document.getElementById("catalogModal").style.display = "none";
    }

    async function addCatalogSongToLibrary(songId, targetLang) {
      if (!supabaseClient || !currentUser) return;
      const rows = await fetchCatalogTranslations();
      const row = rows.find(r => r.songs && r.songs.id === songId && r.target_lang === targetLang);
      if (!row) return;

      DB.songs.add(mergeSongTranslation(row));

      const { error } = await supabaseClient
        .from("user_songs")
        .insert({ user_id: currentUser.id, song_id: songId, target_lang: targetLang });
      if (error && error.code !== "23505") {
        // 23505 = already added (unique violation) — fine, treat as success.
      }

      closeCatalogModal();
      const libraryView = document.getElementById("libraryView");
      if (libraryView && libraryView.style.display !== "none") {
        renderSongLibrary();
      }
    }

    // Bug reports / feature requests, sent to a Supabase Edge Function which
    // files them as GitHub issues (see supabase/functions/submit-feedback).
    // Doesn't require sign-in — works for anonymous visitors too, though a
    // signed-in user's email is attached server-side for follow-up.
    function setFeedbackError(message) {
      const errorEl = document.getElementById("feedbackError");
      errorEl.textContent = message || "";
      errorEl.classList.toggle("visible", !!message);
    }

    function openFeedbackModal() {
      document.getElementById("feedbackTagSelect").value = "bug";
      document.getElementById("feedbackMessageInput").value = "";
      setFeedbackError("");
      document.getElementById("feedbackSuccessNote").style.display = "none";
      const btn = document.getElementById("feedbackSubmitBtn");
      btn.disabled = false;
      btn.textContent = "Submit";
      document.getElementById("feedbackModal").style.display = "flex";
    }

    function closeFeedbackModal() {
      document.getElementById("feedbackModal").style.display = "none";
    }

    async function submitFeedback() {
      const successEl = document.getElementById("feedbackSuccessNote");
      const btn = document.getElementById("feedbackSubmitBtn");
      setFeedbackError("");
      successEl.style.display = "none";

      if (!supabaseClient) {
        setFeedbackError("Feedback isn't available right now.");
        return;
      }

      const tag = document.getElementById("feedbackTagSelect").value;
      const message = document.getElementById("feedbackMessageInput").value.trim();
      if (!message) {
        setFeedbackError("Please enter a message.");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Sending…";

      try {
        const { data, error } = await supabaseClient.functions.invoke("submit-feedback", {
          body: { tag, message }
        });
        if (error || !data || data.error) {
          setFeedbackError((data && data.error) || "Couldn't send feedback — please try again.");
          return;
        }
        successEl.textContent = "Thanks! Your feedback was sent.";
        successEl.style.display = "block";
        document.getElementById("feedbackMessageInput").value = "";
      } catch (e) {
        setFeedbackError("Couldn't send feedback — please try again.");
      } finally {
        btn.disabled = false;
        btn.textContent = "Submit";
      }
    }

    // ============================================================================
    // 3. APP STATE — in-memory only. Reset on page reload; not persisted directly
    // (the DB layer above handles what gets saved and when).
    // ============================================================================

    // Which song is open, and everything about the words in it / progress so far
    let activeSongId = null;
    let vocabularyList = [];
    let stats = {};
    let userNotes = {};
    let roundHistory = [];
    let currentRound = 1;
    let lastRoundMistakes = [];

    // The current quiz round in progress (if any)
    let isGameActive = false;
    let currentQueue = [];
    let currentActiveFilterName = "All Words";
    let currentIndex = 0;
    let score = 0;
    let answered = false;
    let thisRoundMistakes = [];

    let availableVoices = [];

    // ============================================================================
    // 4. SETTINGS & LOCALIZATION
    // ============================================================================
    const DEFAULT_SETTINGS = { name: "Messi", language: "American English" };
    let userSettings = { ...DEFAULT_SETTINGS };

    // ============================================================================
    // STREAMING PLATFORMS — icon, brand color, and link-validation prefix for
    // each supported platform. Adding a new platform later just means adding
    // one more entry here; everything else (icon rendering, the switcher menu,
    // the add/edit popup and its validation) reads from this config.
    // ============================================================================
    const STREAMING_PLATFORMS = {
      spotify: {
        label: "Spotify",
        color: "#1DB954",
        prefixes: ["https://open.spotify.com/"],
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24 0-.375-.06-.585-.195-1.755-1.065-3.9-1.29-6.45-.72-.166.045-.42.135-.585.135-.48 0-.795-.375-.795-.81 0-.42.24-.675.615-.75 2.85-.6 5.4-.315 7.395.9.24.15.4.33.4.72 0 .375-.24.72-.6.72zm1.35-3.045c-.3 0-.51-.15-.72-.27-2.055-1.245-5.19-1.635-7.62-.885-.315.09-.42.15-.66.15-.51 0-.9-.42-.9-.93 0-.45.24-.75.66-.885 2.85-.87 6.3-.435 8.7 1.005.315.195.51.435.51.9 0 .51-.4.915-.97.915zm.135-3.075C16.65 9.75 12.9 9.6 10.5 10.35c-.375.12-.585.195-.9.195-.6 0-1.08-.48-1.08-1.08 0-.6.36-.945.75-1.065C12.15 7.5 16.5 7.68 19.5 9.435c.345.195.6.51.6 1.08 0 .6-.48 1.08-1.095 1.08z"/></svg>'
      },
      appleMusic: {
        label: "Apple Music",
        color: "#FA243C",
        prefixes: ["https://music.apple.com/"],
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h6V3H9z"/></svg>'
      },
      youtube: {
        label: "YouTube",
        color: "#FF0000",
        prefixes: ["https://www.youtube.com/", "https://youtube.com/", "https://youtu.be/"],
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21.582 6.186a2.506 2.506 0 0 0-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418a2.506 2.506 0 0 0-1.768 1.768C2 7.746 2 12 2 12s0 4.254.418 5.814a2.506 2.506 0 0 0 1.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.506 2.506 0 0 0 1.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM9.75 15.5v-7l6 3.5-6 3.5z"/></svg>'
      },
      youtubeMusic: {
        label: "YouTube Music",
        color: "#FF3D3D",
        prefixes: ["https://music.youtube.com/"],
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-4.5v-7l6 3.5-6 3.5z"/></svg>'
      }
    };

    const STREAMING_PLATFORM_ORDER = ["spotify", "appleMusic", "youtube", "youtubeMusic"];

    function isValidStreamingUrl(platform, url) {
      const config = STREAMING_PLATFORMS[platform];
      if (!config || !url) return false;
      return config.prefixes.some(prefix => url.indexOf(prefix) === 0);
    }

    // Merges a song's own built-in streamingLinks with any per-song overrides
    // the user has added/edited locally — overrides win when both exist.
    function getEffectiveStreamingLinks(song) {
      if (!song) return {};
      const base = song.streamingLinks || {};
      const overrides = (DB.streamingOverrides.get(song.id).links) || {};
      return Object.assign({}, base, overrides);
    }

    // Decides which single platform the icon should represent right now:
    // 1) a per-song choice the user has explicitly made, if it still has a link
    // 2) otherwise the app-wide default, if it has a link for this song
    // 3) otherwise whichever platform happens to have a link, in a fixed order
    // 4) otherwise null — no link exists for this song on any platform
    const AVAILABLE_LANGUAGES = [
      "American English",
      "British English",
      "Hebrew",
      "Spanish",
      "Portuguese",
      "French",
      "Italian",
      "German"
    ];

    // ============================================================================
    // LANGUAGE REGIONS / FLAGS
    // ============================================================================
    // Each language maps to a list of region options (flag + label), since a
    // language alone doesn't always specify an accent/country (e.g. Spanish
    // could be Argentina, Spain, Mexico...). The first entry in each list is
    // today's default. This is built as a list (not a single flag) so a future
    // settings UI can let the user pick a different region per language
    // without needing any data restructuring — only a selection needs storing.
    const LANGUAGE_REGIONS = {
      "American English": [{ code: "US", flag: "🇺🇸", label: "United States" }],
      "British English": [{ code: "GB", flag: "🇬🇧", label: "United Kingdom" }],
      "Hebrew": [{ code: "IL", flag: "🇮🇱", label: "Israel" }],
      "Spanish": [
        { code: "AR", flag: "🇦🇷", label: "Argentina" },
        { code: "ES", flag: "🇪🇸", label: "Spain" },
        { code: "MX", flag: "🇲🇽", label: "Mexico" }
      ],
      "Portuguese": [
        { code: "PT", flag: "🇵🇹", label: "Portugal" },
        { code: "BR", flag: "🇧🇷", label: "Brazil" }
      ],
      "French": [{ code: "FR", flag: "🇫🇷", label: "France" }],
      "Italian": [{ code: "IT", flag: "🇮🇹", label: "Italy" }],
      "German": [{ code: "DE", flag: "🇩🇪", label: "Germany" }]
    };

    // Returns the currently selected flag for a language — today this is
    // always the first (default) region option; later this can check a saved
    // per-language user preference before falling back to the default.
    function getLanguageFlag(languageName) {
      const options = LANGUAGE_REGIONS[languageName];
      if (!options || options.length === 0) return "";
      // Future: check userSettings.languageRegions[languageName] here first
      return options[0].flag;
    }

    let currentLang = DEFAULT_SETTINGS.language;

    const TRANSLATIONS = {
      "American English": {
        argentineVoiceBadge: "🇦🇷 Argentine Voice",
        songsNavBtn: "📚 Songs",
        resetBtn: "🗑️ Reset",
        libraryTitle: "Song Practice Library",
        libraryGreeting: "Welcome back, {name}!",
        editSettingsBtn: "⚙️ Edit Settings",
        wordsLabel: "Words",
        practicedLabel: "Practiced",
        untestedLabel: "Untested",
        artistLabel: "Artist:",
        practiceNowBtn: "Practice Now →",
        tabQuiz: "Quiz Mode",
        tabUntested: "Never Guessed",
        tabStats: "Word Statistics",
        tabHistory: "Round History",
        tabSettings: "⚙️ Settings",
        settingsHeader: "⚙️ Settings",
        settingsNameLabel: "Name",
        settingsLanguageLabel: "Preferred Language",
        settingsSaved: "✓ Saved",
        backBtn: "⬅ Back",
        setupChooseSubtitle: "Choose which subset of vocabulary words you want to practice in this round:",
        filterAllWords: "All Words", filterAllWordsDesc: "(Full Lyric Vocabulary)",
        filterUntested: "Never Guessed Yet", filterUntestedDesc: "(0 previous attempts)",
        filterLastMistakes: "Mistakes from Last Round", filterLastMistakesDesc: "(Wrong / Skipped)",
        filterAccuracy: "Accuracy under:",
        filterAllMistakes: "Trouble Words", filterAllMistakesDesc: "(≥1 mistake overall)",
        startRoundBtn: "Start Round with Selected Words",
        roundLabel: "Round", wordLabel: "Word", scoreLabel: "Score",
        nextWordBtn: "Next Word →", exitGameBtn: "❌ Exit Game",
        clueNotesBtn: "💡 Clue & Notes", clueNotesBtnHide: "🙈 Clue & Notes",
        songContextBtn: "🎵 Context", songContextBtnHide: "🙈 Context", lineContextModalTitleText: "Song Context",
        tensesBtn: "⏳ Tenses & Conjugations", tensesBtnHide: "🙈 Tenses & Conjugations",
        dontKnowBtn: "🤷‍♂️ I Don't Know",
        translationHidden: "🔒 Translation hidden until you answer",
        hiddenShort: "🔒 Hidden",
        tensesHeader: "Tenses & Grammatical Forms:",
        cluesHeader: "💡 Clues & Notes",
        addClueBtn: "+ Add Clue",
        noCluesYet: "No clues yet — add one!",
        deleteConfirmText: "Delete this clue/note?",
        yesBtn: "✅ Yes", cancelBtn: "✖️ Cancel",
        untestedTitle: "Words Never Guessed Yet",
        statsTitle: "Per-Word Performance Stats",
        historyTitle: "Global Round History & Rankings",
        thSpanish: "Spanish", thTranslation: "Translation", thLyric: "Lyric Line & Translation", thClueHook: "Clue / Hook",
        thWord: "Word", thMeaning: "Meaning", thSeen: "Seen", thCorrect: "Correct", thAccuracy: "Accuracy", thNotes: "Notes",
        thRound: "Round", thFilterMode: "Filter Mode", thDateTime: "Date & Time", thScore: "Score",
        noticeTitle: "🚀 Song Ingestion Engine",
        noticeBody: "The option to add and parse custom songs is currently under active development. In the next release, you will be able to paste lyrics, generate automated clues, and train on custom tracks!",
        noticeBtn: "Understood",
        infoModalTitle: "Information",
        exitToLibraryConfirm: "Exit current quiz round and return to song library?",
        resetAllConfirm: "Reset ALL data across all songs in storage?",
        resetAllDone: "All data reset!",
        resetSongConfirmTemplate: 'Reset all stored progress, stats, and history for "{song}"?',
        resetSongDone: "Song data reset!",
        exitGameConfirm: "Are you sure you want to exit the current round? Your unfinished progress for this round will be discarded.",
        noFilterMatch: "No words match this filter! Please select another option.",
        roundCompleteTemplate: "Round {round} Completed, {name}!\nMode: {mode}\nYour Score: {score}/{total} ({pct}%)\n\nSetting up Round {nextRound}...",
        allWordsMastered: "🎉 Amazing! You have practiced every single word in this song!",
        noRoundsYet: "No completed rounds yet for this song!",
        dangerZoneLabel: "Danger Zone",
        dangerZoneDesc: "Permanently erases saved progress. This can't be undone.",
        continueBannerTitle: "Continue where you left off",
        continueBtn: "▶ Continue",
        discardBtn: "Discard",
        modeSelectLabel: "Practice Mode",
        playBtn: "▶ Play",
        wordsInRoundTemplate: "{count} words in this round",
        ticketCountTemplate: "🎫 {count} song ticket(s) ready to practice",
        continueBtn: "Continue →",
        confusableHintLabel: "Don't confuse with",
        findLyricsLinkText: "Search for the lyrics",
        noVoiceWarningTemplate: "🔇 No {lang} voice found on this device — check your device's text-to-speech / accessibility settings.",
        hearLineBtn: "Hear Line",
        layoutSideBySideBtn: "Side by Side",
        layoutInlineBtn: "Inline",
        lineContextEmptyNote: "No extra surrounding lines added for this word yet.",
        listenOnPrefix: "Listen on",
        addLinkBtn: "+ Add link",
        addLinkModalTitlePrefix: "Add",
        pasteLinkLabel: "Paste the link",
        invalidLinkError: "That doesn't look like a valid link — it should start with {prefix}",
        deleteSongBtn: "Delete this song",
        demoBadge: "Demo",
        deleteSongConfirmTemplate: 'Delete "{song}"? This removes all your progress, stats, and notes for it — this can\'t be undone.',
      },
      "British English": {
        argentineVoiceBadge: "🇦🇷 Argentine Voice",
        songsNavBtn: "📚 Songs",
        resetBtn: "🗑️ Reset",
        libraryTitle: "Song Practice Library",
        libraryGreeting: "Welcome back, {name}!",
        editSettingsBtn: "⚙️ Edit Settings",
        wordsLabel: "Words",
        practicedLabel: "Practised",
        untestedLabel: "Untested",
        artistLabel: "Artist:",
        practiceNowBtn: "Practise Now →",
        tabQuiz: "Quiz Mode",
        tabUntested: "Never Guessed",
        tabStats: "Word Statistics",
        tabHistory: "Round History",
        tabSettings: "⚙️ Settings",
        settingsHeader: "⚙️ Settings",
        settingsNameLabel: "Name",
        settingsLanguageLabel: "Preferred Language",
        settingsSaved: "✓ Saved",
        backBtn: "⬅ Back",
        setupChooseSubtitle: "Choose which subset of vocabulary words you'd like to practise in this round:",
        filterAllWords: "All Words", filterAllWordsDesc: "(Full Lyric Vocabulary)",
        filterUntested: "Never Guessed Yet", filterUntestedDesc: "(0 previous attempts)",
        filterLastMistakes: "Mistakes from Last Round", filterLastMistakesDesc: "(Wrong / Skipped)",
        filterAccuracy: "Accuracy under:",
        filterAllMistakes: "Trouble Words", filterAllMistakesDesc: "(≥1 mistake overall)",
        startRoundBtn: "Start Round with Selected Words",
        roundLabel: "Round", wordLabel: "Word", scoreLabel: "Score",
        nextWordBtn: "Next Word →", exitGameBtn: "❌ Exit Game",
        clueNotesBtn: "💡 Clue & Notes", clueNotesBtnHide: "🙈 Clue & Notes",
        songContextBtn: "🎵 Context", songContextBtnHide: "🙈 Context", lineContextModalTitleText: "Song Context",
        tensesBtn: "⏳ Tenses & Conjugations", tensesBtnHide: "🙈 Tenses & Conjugations",
        dontKnowBtn: "🤷‍♂️ I Don't Know",
        translationHidden: "🔒 Translation hidden until you answer",
        hiddenShort: "🔒 Hidden",
        tensesHeader: "Tenses & Grammatical Forms:",
        cluesHeader: "💡 Clues & Notes",
        addClueBtn: "+ Add Clue",
        noCluesYet: "No clues yet — add one!",
        deleteConfirmText: "Delete this clue/note?",
        yesBtn: "✅ Yes", cancelBtn: "✖️ Cancel",
        untestedTitle: "Words Never Guessed Yet",
        statsTitle: "Per-Word Performance Stats",
        historyTitle: "Global Round History & Rankings",
        thSpanish: "Spanish", thTranslation: "Translation", thLyric: "Lyric Line & Translation", thClueHook: "Clue / Hook",
        thWord: "Word", thMeaning: "Meaning", thSeen: "Seen", thCorrect: "Correct", thAccuracy: "Accuracy", thNotes: "Notes",
        thRound: "Round", thFilterMode: "Filter Mode", thDateTime: "Date & Time", thScore: "Score",
        noticeTitle: "🚀 Song Ingestion Engine",
        noticeBody: "The option to add and parse custom songs is currently under active development. In the next release, you'll be able to paste lyrics, generate automated clues, and train on custom tracks!",
        noticeBtn: "Understood",
        infoModalTitle: "Information",
        exitToLibraryConfirm: "Exit current quiz round and return to song library?",
        resetAllConfirm: "Reset ALL data across all songs in storage?",
        resetAllDone: "All data reset!",
        resetSongConfirmTemplate: 'Reset all stored progress, stats, and history for "{song}"?',
        resetSongDone: "Song data reset!",
        exitGameConfirm: "Are you sure you want to exit the current round? Your unfinished progress for this round will be discarded.",
        noFilterMatch: "No words match this filter! Please select another option.",
        roundCompleteTemplate: "Round {round} Completed, {name}!\nMode: {mode}\nYour Score: {score}/{total} ({pct}%)\n\nSetting up Round {nextRound}...",
        allWordsMastered: "🎉 Amazing! You have practiced every single word in this song!",
        noRoundsYet: "No completed rounds yet for this song!",
        dangerZoneLabel: "Danger Zone",
        dangerZoneDesc: "Permanently erases saved progress. This can't be undone.",
        continueBannerTitle: "Continue where you left off",
        continueBtn: "▶ Continue",
        discardBtn: "Discard",
        modeSelectLabel: "Practice Mode",
        playBtn: "▶ Play",
        wordsInRoundTemplate: "{count} words in this round",
        ticketCountTemplate: "🎫 {count} song ticket(s) ready to practice",
        continueBtn: "Continue →",
        confusableHintLabel: "Don't confuse with",
        findLyricsLinkText: "Search for the lyrics",
        noVoiceWarningTemplate: "🔇 No {lang} voice found on this device — check your device's text-to-speech / accessibility settings.",
        hearLineBtn: "Hear Line",
        layoutSideBySideBtn: "Side by Side",
        layoutInlineBtn: "Inline",
        lineContextEmptyNote: "No extra surrounding lines added for this word yet.",
        listenOnPrefix: "Listen on",
        addLinkBtn: "+ Add link",
        addLinkModalTitlePrefix: "Add",
        pasteLinkLabel: "Paste the link",
        invalidLinkError: "That doesn't look like a valid link — it should start with {prefix}",
        deleteSongBtn: "Delete this song",
        demoBadge: "Demo",
        deleteSongConfirmTemplate: 'Delete "{song}"? This removes all your progress, stats, and notes for it — this can\'t be undone.',
      },
      "Hebrew": {
        argentineVoiceBadge: "🇦🇷 קול ארגנטינאי",
        songsNavBtn: "📚 שירים",
        resetBtn: "🗑️ איפוס",
        libraryTitle: "ספריית תרגול שירים",
        libraryGreeting: "ברוך שובך, {name}!",
        editSettingsBtn: "⚙️ ערוך הגדרות",
        wordsLabel: "מילים",
        practicedLabel: "תורגלו",
        untestedLabel: "לא נבדק",
        artistLabel: "אמן:",
        practiceNowBtn: "תרגל עכשיו ←",
        tabQuiz: "מצב חידון",
        tabUntested: "מעולם לא נוחש",
        tabStats: "סטטיסטיקת מילים",
        tabHistory: "היסטוריית סבבים",
        tabSettings: "⚙️ הגדרות",
        settingsHeader: "⚙️ הגדרות",
        settingsNameLabel: "שם",
        settingsLanguageLabel: "שפה מועדפת",
        settingsSaved: "✓ נשמר",
        backBtn: "⬅ חזרה",
        setupChooseSubtitle: "בחר אילו מילים לתרגל בסבב הזה:",
        filterAllWords: "כל המילים", filterAllWordsDesc: "(כל אוצר המילים בשיר)",
        filterUntested: "מעולם לא נוחש", filterUntestedDesc: "(0 ניסיונות קודמים)",
        filterLastMistakes: "טעויות מהסבב האחרון", filterLastMistakesDesc: "(שגוי / דילוג)",
        filterAccuracy: "דיוק מתחת ל:",
        filterAllMistakes: "מילים בעייתיות", filterAllMistakesDesc: "(טעות אחת או יותר בסך הכל)",
        startRoundBtn: "התחל סבב עם המילים שנבחרו",
        roundLabel: "סבב", wordLabel: "מילה", scoreLabel: "ניקוד",
        nextWordBtn: "המילה הבאה ←", exitGameBtn: "❌ יציאה מהמשחק",
        clueNotesBtn: "💡 רמז והערות", clueNotesBtnHide: "🙈 רמז והערות",
        songContextBtn: "🎵 הקשר", songContextBtnHide: "🙈 הקשר", lineContextModalTitleText: "הקשר בשיר",
        tensesBtn: "⏳ זמנים והטיות", tensesBtnHide: "🙈 זמנים והטיות",
        dontKnowBtn: "🤷‍♂️ אני לא יודע",
        translationHidden: "🔒 התרגום מוסתר עד שתענה",
        hiddenShort: "🔒 מוסתר",
        tensesHeader: "זמנים וצורות דקדוקיות:",
        cluesHeader: "💡 רמזים והערות",
        addClueBtn: "+ הוסף רמז",
        noCluesYet: "עדיין אין רמזים — הוסף אחד!",
        deleteConfirmText: "למחוק את הרמז/הערה הזו?",
        yesBtn: "✅ כן", cancelBtn: "✖️ ביטול",
        untestedTitle: "מילים שמעולם לא נוחשו",
        statsTitle: "ביצועים לפי מילה",
        historyTitle: "היסטוריית סבבים ודירוגים",
        thSpanish: "ספרדית", thTranslation: "תרגום", thLyric: "שורת השיר ותרגום", thClueHook: "רמז / אסוציאציה",
        thWord: "מילה", thMeaning: "משמעות", thSeen: "נראה", thCorrect: "נכון", thAccuracy: "דיוק", thNotes: "הערות",
        thRound: "סבב", thFilterMode: "מצב סינון", thDateTime: "תאריך ושעה", thScore: "ניקוד",
        noticeTitle: "🚀 מנוע הטמעת שירים",
        noticeBody: "האפשרות להוסיף ולנתח שירים מותאמים אישית נמצאת כרגע בפיתוח פעיל. בגרסה הבאה תוכל להדביק מילות שיר, ליצור רמזים אוטומטיים ולתרגל על רצועות מותאמות אישית!",
        noticeBtn: "הבנתי",
        infoModalTitle: "מידע",
        exitToLibraryConfirm: "לצאת מהסבב הנוכחי ולחזור לספריית השירים?",
        resetAllConfirm: "לאפס את כל הנתונים בכל השירים באחסון?",
        resetAllDone: "כל הנתונים אופסו!",
        resetSongConfirmTemplate: 'לאפס את כל ההתקדמות, הסטטיסטיקות וההיסטוריה עבור "{song}"?',
        resetSongDone: "נתוני השיר אופסו!",
        exitGameConfirm: "האם אתה בטוח שברצונך לצאת מהסבב הנוכחי? ההתקדמות שלא נשמרה תימחק.",
        noFilterMatch: "אין מילים התואמות את הסינון הזה! בחר אפשרות אחרת.",
        roundCompleteTemplate: "סבב {round} הושלם, {name}!\nמצב: {mode}\nהניקוד שלך: {score}/{total} ({pct}%)\n\nמכין את סבב {nextRound}...",
        allWordsMastered: "🎉 מדהים! תרגלת כל מילה בשיר הזה!",
        noRoundsYet: "עדיין אין סבבים שהושלמו בשיר הזה!",
        dangerZoneLabel: "אזור מסוכן",
        dangerZoneDesc: "מוחק לצמיתות את ההתקדמות השמורה. לא ניתן לבטל פעולה זו.",
        continueBannerTitle: "המשך מהמקום שבו הפסקת",
        continueBtn: "▶ המשך",
        discardBtn: "מחק",
        modeSelectLabel: "מצב תרגול",
        playBtn: "▶ שחק",
        wordsInRoundTemplate: "{count} מילים בסבב הזה",
        ticketCountTemplate: "🎫 {count} כרטיסי שירים מוכנים לתרגול",
        continueBtn: "המשך ←",
        listenOnPrefix: "האזן ב",
        addLinkBtn: "+ הוסף קישור",
        addLinkModalTitlePrefix: "הוסף",
        pasteLinkLabel: "הדבק את הקישור",
        invalidLinkError: "זה לא נראה כמו קישור תקין — הוא צריך להתחיל ב-{prefix}",
        confusableHintLabel: "אל תתבלבל עם",
        findLyricsLinkText: "חפש את מילות השיר",
        hearLineBtn: "השמע שורה",
        layoutSideBySideBtn: "זה לצד זה",
        layoutInlineBtn: "בשורה אחת",
        lineContextEmptyNote: "עדיין לא נוספו שורות הקשר נוספות למילה זו.",
        noVoiceWarningTemplate: "🔇 לא נמצא קול {lang} במכשיר זה — בדוק את הגדרות הנגישות/הקראת הטקסט של המכשיר שלך.",
        deleteSongBtn: "מחק שיר זה",
        demoBadge: "הדגמה",
        deleteSongConfirmTemplate: 'למחוק את "{song}"? פעולה זו תמחק את כל ההתקדמות, הסטטיסטיקות וההערות שלך עבורו — לא ניתן לבטל פעולה זו.',
      },
      "Spanish": {
        argentineVoiceBadge: "🇦🇷 Voz Argentina",
        songsNavBtn: "📚 Canciones",
        resetBtn: "🗑️ Reiniciar",
        libraryTitle: "Biblioteca de Práctica de Canciones",
        libraryGreeting: "¡Bienvenido de nuevo, {name}!",
        editSettingsBtn: "⚙️ Editar Configuración",
        wordsLabel: "Palabras",
        practicedLabel: "Practicadas",
        untestedLabel: "Sin Probar",
        artistLabel: "Artista:",
        practiceNowBtn: "Practicar Ahora →",
        tabQuiz: "Modo Cuestionario",
        tabUntested: "Nunca Adivinadas",
        tabStats: "Estadísticas de Palabras",
        tabHistory: "Historial de Rondas",
        tabSettings: "⚙️ Configuración",
        settingsHeader: "⚙️ Configuración",
        settingsNameLabel: "Nombre",
        settingsLanguageLabel: "Idioma Preferido",
        settingsSaved: "✓ Guardado",
        backBtn: "⬅ Atrás",
        setupChooseSubtitle: "Elige qué subconjunto de vocabulario quieres practicar en esta ronda:",
        filterAllWords: "Todas las Palabras", filterAllWordsDesc: "(Vocabulario Completo)",
        filterUntested: "Nunca Adivinadas", filterUntestedDesc: "(0 intentos previos)",
        filterLastMistakes: "Errores de la Última Ronda", filterLastMistakesDesc: "(Incorrectas / Omitidas)",
        filterAccuracy: "Precisión menor a:",
        filterAllMistakes: "Palabras Difíciles", filterAllMistakesDesc: "(≥1 error en total)",
        startRoundBtn: "Iniciar Ronda con las Palabras Seleccionadas",
        roundLabel: "Ronda", wordLabel: "Palabra", scoreLabel: "Puntaje",
        nextWordBtn: "Siguiente Palabra →", exitGameBtn: "❌ Salir del Juego",
        clueNotesBtn: "💡 Pista y Notas", clueNotesBtnHide: "🙈 Pista y Notas",
        songContextBtn: "🎵 Contexto", songContextBtnHide: "🙈 Contexto", lineContextModalTitleText: "Contexto de la Canción",
        tensesBtn: "⏳ Tiempos y Conjugaciones", tensesBtnHide: "🙈 Tiempos y Conjugaciones",
        dontKnowBtn: "🤷‍♂️ No Lo Sé",
        translationHidden: "🔒 Traducción oculta hasta que respondas",
        hiddenShort: "🔒 Oculto",
        tensesHeader: "Tiempos y Formas Gramaticales:",
        cluesHeader: "💡 Pistas y Notas",
        addClueBtn: "+ Agregar Pista",
        noCluesYet: "Aún no hay pistas — ¡agrega una!",
        deleteConfirmText: "¿Eliminar esta pista/nota?",
        yesBtn: "✅ Sí", cancelBtn: "✖️ Cancelar",
        untestedTitle: "Palabras Nunca Adivinadas",
        statsTitle: "Estadísticas de Rendimiento por Palabra",
        historyTitle: "Historial Global de Rondas y Clasificaciones",
        thSpanish: "Español", thTranslation: "Traducción", thLyric: "Línea de la Canción y Traducción", thClueHook: "Pista / Gancho",
        thWord: "Palabra", thMeaning: "Significado", thSeen: "Vistas", thCorrect: "Correctas", thAccuracy: "Precisión", thNotes: "Notas",
        thRound: "Ronda", thFilterMode: "Modo de Filtro", thDateTime: "Fecha y Hora", thScore: "Puntaje",
        noticeTitle: "🚀 Motor de Ingesta de Canciones",
        noticeBody: "La opción para agregar y analizar canciones personalizadas está actualmente en desarrollo activo. ¡En la próxima versión podrás pegar letras, generar pistas automáticas y entrenar con canciones personalizadas!",
        noticeBtn: "Entendido",
        infoModalTitle: "Información",
        exitToLibraryConfirm: "¿Salir de la ronda actual y volver a la biblioteca de canciones?",
        resetAllConfirm: "¿Reiniciar TODOS los datos de todas las canciones en el almacenamiento?",
        resetAllDone: "¡Todos los datos reiniciados!",
        resetSongConfirmTemplate: '¿Reiniciar todo el progreso, estadísticas e historial guardados para "{song}"?',
        resetSongDone: "¡Datos de la canción reiniciados!",
        exitGameConfirm: "¿Estás seguro de que quieres salir de la ronda actual? Tu progreso sin terminar se descartará.",
        noFilterMatch: "¡Ninguna palabra coincide con este filtro! Selecciona otra opción.",
        roundCompleteTemplate: "¡Ronda {round} Completada, {name}!\nModo: {mode}\nTu Puntaje: {score}/{total} ({pct}%)\n\nPreparando la Ronda {nextRound}...",
        allWordsMastered: "🎉 ¡Increíble! ¡Has practicado cada palabra de esta canción!",
        noRoundsYet: "¡Aún no hay rondas completadas para esta canción!",
        dangerZoneLabel: "Zona de Peligro",
        dangerZoneDesc: "Borra permanentemente el progreso guardado. Esto no se puede deshacer.",
        continueBannerTitle: "Continúa donde lo dejaste",
        continueBtn: "▶ Continuar",
        discardBtn: "Descartar",
        modeSelectLabel: "Modo de Práctica",
        playBtn: "▶ Jugar",
        wordsInRoundTemplate: "{count} palabras en esta ronda",
        ticketCountTemplate: "🎫 {count} entradas de canciones listas para practicar",
        continueBtn: "Continuar →",
        listenOnPrefix: "Escuchar en",
        addLinkBtn: "+ Agregar enlace",
        addLinkModalTitlePrefix: "Agregar",
        pasteLinkLabel: "Pega el enlace",
        invalidLinkError: "Eso no parece un enlace válido — debe comenzar con {prefix}",
        confusableHintLabel: "No confundir con",
        findLyricsLinkText: "Buscar la letra",
        hearLineBtn: "Escuchar Línea",
        layoutSideBySideBtn: "Lado a Lado",
        layoutInlineBtn: "En Línea",
        lineContextEmptyNote: "Aún no se han agregado líneas de contexto adicionales para esta palabra.",
        noVoiceWarningTemplate: "🔇 No se encontró una voz en {lang} en este dispositivo — revisa la configuración de accesibilidad/texto a voz de tu dispositivo.",
        deleteSongBtn: "Eliminar esta canción",
        demoBadge: "Demo",
        deleteSongConfirmTemplate: '¿Eliminar "{song}"? Esto borra todo tu progreso, estadísticas y notas para ella — esto no se puede deshacer.',
      },
      "Portuguese": {
        argentineVoiceBadge: "🇦🇷 Voz Argentina",
        songsNavBtn: "📚 Músicas",
        resetBtn: "🗑️ Redefinir",
        libraryTitle: "Biblioteca de Prática de Músicas",
        libraryGreeting: "Bem-vindo de volta, {name}!",
        editSettingsBtn: "⚙️ Editar Configurações",
        wordsLabel: "Palavras",
        practicedLabel: "Praticadas",
        untestedLabel: "Não Testadas",
        artistLabel: "Artista:",
        practiceNowBtn: "Praticar Agora →",
        tabQuiz: "Modo Questionário",
        tabUntested: "Nunca Adivinhadas",
        tabStats: "Estatísticas de Palavras",
        tabHistory: "Histórico de Rodadas",
        tabSettings: "⚙️ Configurações",
        settingsHeader: "⚙️ Configurações",
        settingsNameLabel: "Nome",
        settingsLanguageLabel: "Idioma Preferido",
        settingsSaved: "✓ Salvo",
        backBtn: "⬅ Voltar",
        setupChooseSubtitle: "Escolha qual subconjunto de vocabulário você quer praticar nesta rodada:",
        filterAllWords: "Todas as Palavras", filterAllWordsDesc: "(Vocabulário Completo)",
        filterUntested: "Nunca Adivinhadas", filterUntestedDesc: "(0 tentativas anteriores)",
        filterLastMistakes: "Erros da Última Rodada", filterLastMistakesDesc: "(Erradas / Puladas)",
        filterAccuracy: "Precisão abaixo de:",
        filterAllMistakes: "Palavras Difíceis", filterAllMistakesDesc: "(≥1 erro no total)",
        startRoundBtn: "Iniciar Rodada com as Palavras Selecionadas",
        roundLabel: "Rodada", wordLabel: "Palavra", scoreLabel: "Pontuação",
        nextWordBtn: "Próxima Palavra →", exitGameBtn: "❌ Sair do Jogo",
        clueNotesBtn: "💡 Dica e Notas", clueNotesBtnHide: "🙈 Dica e Notas",
        songContextBtn: "🎵 Contexto", songContextBtnHide: "🙈 Contexto", lineContextModalTitleText: "Contexto da Música",
        tensesBtn: "⏳ Tempos e Conjugações", tensesBtnHide: "🙈 Tempos e Conjugações",
        dontKnowBtn: "🤷‍♂️ Não Sei",
        translationHidden: "🔒 Tradução oculta até você responder",
        hiddenShort: "🔒 Oculto",
        tensesHeader: "Tempos e Formas Gramaticais:",
        cluesHeader: "💡 Dicas e Notas",
        addClueBtn: "+ Adicionar Dica",
        noCluesYet: "Ainda sem dicas — adicione uma!",
        deleteConfirmText: "Excluir esta dica/nota?",
        yesBtn: "✅ Sim", cancelBtn: "✖️ Cancelar",
        untestedTitle: "Palavras Nunca Adivinhadas",
        statsTitle: "Estatísticas de Desempenho por Palavra",
        historyTitle: "Histórico Global de Rodadas e Classificações",
        thSpanish: "Espanhol", thTranslation: "Tradução", thLyric: "Linha da Música e Tradução", thClueHook: "Dica / Gancho",
        thWord: "Palavra", thMeaning: "Significado", thSeen: "Vistas", thCorrect: "Corretas", thAccuracy: "Precisão", thNotes: "Notas",
        thRound: "Rodada", thFilterMode: "Modo de Filtro", thDateTime: "Data e Hora", thScore: "Pontuação",
        noticeTitle: "🚀 Motor de Ingestão de Músicas",
        noticeBody: "A opção de adicionar e analisar músicas personalizadas está atualmente em desenvolvimento ativo. Na próxima versão, você poderá colar letras, gerar dicas automáticas e treinar com faixas personalizadas!",
        noticeBtn: "Entendi",
        infoModalTitle: "Informação",
        exitToLibraryConfirm: "Sair da rodada atual e voltar à biblioteca de músicas?",
        resetAllConfirm: "Redefinir TODOS os dados de todas as músicas no armazenamento?",
        resetAllDone: "Todos os dados foram redefinidos!",
        resetSongConfirmTemplate: 'Redefinir todo o progresso, estatísticas e histórico salvos para "{song}"?',
        resetSongDone: "Dados da música redefinidos!",
        exitGameConfirm: "Tem certeza de que deseja sair da rodada atual? Seu progresso não salvo será descartado.",
        noFilterMatch: "Nenhuma palavra corresponde a este filtro! Selecione outra opção.",
        roundCompleteTemplate: "Rodada {round} Concluída, {name}!\nModo: {mode}\nSua Pontuação: {score}/{total} ({pct}%)\n\nPreparando a Rodada {nextRound}...",
        allWordsMastered: "🎉 Incrível! Você praticou todas as palavras desta música!",
        noRoundsYet: "Ainda não há rodadas concluídas para esta música!",
        dangerZoneLabel: "Zona de Perigo",
        dangerZoneDesc: "Apaga permanentemente o progresso salvo. Isso não pode ser desfeito.",
        continueBannerTitle: "Continue de onde parou",
        continueBtn: "▶ Continuar",
        discardBtn: "Descartar",
        modeSelectLabel: "Modo de Prática",
        playBtn: "▶ Jogar",
        wordsInRoundTemplate: "{count} palavras nesta rodada",
        ticketCountTemplate: "🎫 {count} ingressos de músicas prontos para praticar",
        continueBtn: "Continuar →",
        listenOnPrefix: "Ouvir no",
        addLinkBtn: "+ Adicionar link",
        addLinkModalTitlePrefix: "Adicionar",
        pasteLinkLabel: "Cole o link",
        invalidLinkError: "Isso não parece um link válido — deve começar com {prefix}",
        confusableHintLabel: "Não confundir com",
        findLyricsLinkText: "Buscar a letra",
        hearLineBtn: "Ouvir Linha",
        layoutSideBySideBtn: "Lado a Lado",
        layoutInlineBtn: "Em Linha",
        lineContextEmptyNote: "Ainda não foram adicionadas linhas de contexto extras para esta palavra.",
        noVoiceWarningTemplate: "🔇 Nenhuma voz em {lang} encontrada neste dispositivo — verifique as configurações de acessibilidade/texto para fala do seu dispositivo.",
        deleteSongBtn: "Excluir esta música",
        demoBadge: "Demo",
        deleteSongConfirmTemplate: 'Excluir "{song}"? Isso remove todo o seu progresso, estatísticas e notas para ela — isso não pode ser desfeito.',
      },
      "French": {
        argentineVoiceBadge: "🇦🇷 Voix Argentine",
        songsNavBtn: "📚 Chansons",
        resetBtn: "🗑️ Réinitialiser",
        libraryTitle: "Bibliothèque de Pratique des Chansons",
        libraryGreeting: "Content de te revoir, {name} !",
        editSettingsBtn: "⚙️ Modifier les Paramètres",
        wordsLabel: "Mots",
        practicedLabel: "Pratiqués",
        untestedLabel: "Non Testés",
        artistLabel: "Artiste :",
        practiceNowBtn: "Pratiquer Maintenant →",
        tabQuiz: "Mode Quiz",
        tabUntested: "Jamais Devinés",
        tabStats: "Statistiques des Mots",
        tabHistory: "Historique des Rounds",
        tabSettings: "⚙️ Paramètres",
        settingsHeader: "⚙️ Paramètres",
        settingsNameLabel: "Nom",
        settingsLanguageLabel: "Langue Préférée",
        settingsSaved: "✓ Enregistré",
        backBtn: "⬅ Retour",
        setupChooseSubtitle: "Choisis le sous-ensemble de vocabulaire que tu veux pratiquer dans ce round :",
        filterAllWords: "Tous les Mots", filterAllWordsDesc: "(Vocabulaire Complet)",
        filterUntested: "Jamais Devinés", filterUntestedDesc: "(0 tentative précédente)",
        filterLastMistakes: "Erreurs du Dernier Round", filterLastMistakesDesc: "(Faux / Passés)",
        filterAccuracy: "Précision inférieure à :",
        filterAllMistakes: "Mots Difficiles", filterAllMistakesDesc: "(≥1 erreur au total)",
        startRoundBtn: "Commencer le Round avec les Mots Sélectionnés",
        roundLabel: "Round", wordLabel: "Mot", scoreLabel: "Score",
        nextWordBtn: "Mot Suivant →", exitGameBtn: "❌ Quitter la Partie",
        clueNotesBtn: "💡 Indice et Notes", clueNotesBtnHide: "🙈 Indice et Notes",
        songContextBtn: "🎵 Contexte", songContextBtnHide: "🙈 Contexte", lineContextModalTitleText: "Contexte de la Chanson",
        tensesBtn: "⏳ Temps et Conjugaisons", tensesBtnHide: "🙈 Temps et Conjugaisons",
        dontKnowBtn: "🤷‍♂️ Je Ne Sais Pas",
        translationHidden: "🔒 Traduction masquée jusqu'à ta réponse",
        hiddenShort: "🔒 Masqué",
        tensesHeader: "Temps et Formes Grammaticales :",
        cluesHeader: "💡 Indices et Notes",
        addClueBtn: "+ Ajouter un Indice",
        noCluesYet: "Pas encore d'indices — ajoutes-en un !",
        deleteConfirmText: "Supprimer cet indice/cette note ?",
        yesBtn: "✅ Oui", cancelBtn: "✖️ Annuler",
        untestedTitle: "Mots Jamais Devinés",
        statsTitle: "Statistiques de Performance par Mot",
        historyTitle: "Historique Global des Rounds et Classements",
        thSpanish: "Espagnol", thTranslation: "Traduction", thLyric: "Ligne de la Chanson et Traduction", thClueHook: "Indice / Astuce",
        thWord: "Mot", thMeaning: "Signification", thSeen: "Vus", thCorrect: "Corrects", thAccuracy: "Précision", thNotes: "Notes",
        thRound: "Round", thFilterMode: "Mode de Filtre", thDateTime: "Date et Heure", thScore: "Score",
        noticeTitle: "🚀 Moteur d'Ingestion de Chansons",
        noticeBody: "L'option d'ajouter et d'analyser des chansons personnalisées est actuellement en développement actif. Dans la prochaine version, tu pourras coller des paroles, générer des indices automatiques et t'entraîner sur des morceaux personnalisés !",
        noticeBtn: "Compris",
        infoModalTitle: "Information",
        exitToLibraryConfirm: "Quitter le round actuel et revenir à la bibliothèque de chansons ?",
        resetAllConfirm: "Réinitialiser TOUTES les données de toutes les chansons dans le stockage ?",
        resetAllDone: "Toutes les données ont été réinitialisées !",
        resetSongConfirmTemplate: "Réinitialiser toute la progression, les statistiques et l'historique enregistrés pour \"{song}\" ?",
        resetSongDone: "Données de la chanson réinitialisées !",
        exitGameConfirm: "Es-tu sûr de vouloir quitter le round actuel ? Ta progression non enregistrée sera perdue.",
        noFilterMatch: "Aucun mot ne correspond à ce filtre ! Sélectionne une autre option.",
        roundCompleteTemplate: "Round {round} Terminé, {name} !\nMode : {mode}\nTon Score : {score}/{total} ({pct}%)\n\nPréparation du Round {nextRound}...",
        allWordsMastered: "🎉 Incroyable ! Tu as pratiqué chaque mot de cette chanson !",
        noRoundsYet: "Aucun round terminé pour cette chanson pour le moment !",
        dangerZoneLabel: "Zone de Danger",
        dangerZoneDesc: "Efface définitivement la progression enregistrée. Ceci ne peut pas être annulé.",
        continueBannerTitle: "Continue là où tu t'es arrêté",
        continueBtn: "▶ Continuer",
        discardBtn: "Ignorer",
        modeSelectLabel: "Mode de Pratique",
        playBtn: "▶ Jouer",
        wordsInRoundTemplate: "{count} mots dans ce round",
        ticketCountTemplate: "🎫 {count} billets de chansons prêts à pratiquer",
        continueBtn: "Continuer →",
        listenOnPrefix: "Écouter sur",
        addLinkBtn: "+ Ajouter un lien",
        addLinkModalTitlePrefix: "Ajouter",
        pasteLinkLabel: "Colle le lien",
        invalidLinkError: "Cela ne ressemble pas à un lien valide — il doit commencer par {prefix}",
        confusableHintLabel: "Ne pas confondre avec",
        findLyricsLinkText: "Rechercher les paroles",
        hearLineBtn: "Écouter la Ligne",
        layoutSideBySideBtn: "Côte à Côte",
        layoutInlineBtn: "En Ligne",
        lineContextEmptyNote: "Aucune ligne de contexte supplémentaire n'a encore été ajoutée pour ce mot.",
        noVoiceWarningTemplate: "🔇 Aucune voix en {lang} trouvée sur cet appareil — vérifie les paramètres d'accessibilité/synthèse vocale de ton appareil.",
        deleteSongBtn: "Supprimer cette chanson",
        demoBadge: "Démo",
        deleteSongConfirmTemplate: "Supprimer « {song} » ? Cela efface toute ta progression, tes statistiques et tes notes pour elle — c'est irréversible.",
      },
      "Italian": {
        argentineVoiceBadge: "🇦🇷 Voce Argentina",
        songsNavBtn: "📚 Canzoni",
        resetBtn: "🗑️ Reimposta",
        libraryTitle: "Libreria di Pratica delle Canzoni",
        libraryGreeting: "Bentornato, {name}!",
        editSettingsBtn: "⚙️ Modifica Impostazioni",
        wordsLabel: "Parole",
        practicedLabel: "Praticate",
        untestedLabel: "Non Testate",
        artistLabel: "Artista:",
        practiceNowBtn: "Pratica Ora →",
        tabQuiz: "Modalità Quiz",
        tabUntested: "Mai Indovinate",
        tabStats: "Statistiche delle Parole",
        tabHistory: "Cronologia dei Round",
        tabSettings: "⚙️ Impostazioni",
        settingsHeader: "⚙️ Impostazioni",
        settingsNameLabel: "Nome",
        settingsLanguageLabel: "Lingua Preferita",
        settingsSaved: "✓ Salvato",
        backBtn: "⬅ Indietro",
        setupChooseSubtitle: "Scegli quale sottoinsieme di vocabolario vuoi praticare in questo round:",
        filterAllWords: "Tutte le Parole", filterAllWordsDesc: "(Vocabolario Completo)",
        filterUntested: "Mai Indovinate", filterUntestedDesc: "(0 tentativi precedenti)",
        filterLastMistakes: "Errori dell'Ultimo Round", filterLastMistakesDesc: "(Sbagliate / Saltate)",
        filterAccuracy: "Precisione inferiore a:",
        filterAllMistakes: "Parole Difficili", filterAllMistakesDesc: "(≥1 errore totale)",
        startRoundBtn: "Inizia Round con le Parole Selezionate",
        roundLabel: "Round", wordLabel: "Parola", scoreLabel: "Punteggio",
        nextWordBtn: "Parola Successiva →", exitGameBtn: "❌ Esci dal Gioco",
        clueNotesBtn: "💡 Indizio e Note", clueNotesBtnHide: "🙈 Indizio e Note",
        songContextBtn: "🎵 Contesto", songContextBtnHide: "🙈 Contesto", lineContextModalTitleText: "Contesto della Canzone",
        tensesBtn: "⏳ Tempi e Coniugazioni", tensesBtnHide: "🙈 Tempi e Coniugazioni",
        dontKnowBtn: "🤷‍♂️ Non Lo So",
        translationHidden: "🔒 Traduzione nascosta finché non rispondi",
        hiddenShort: "🔒 Nascosto",
        tensesHeader: "Tempi e Forme Grammaticali:",
        cluesHeader: "💡 Indizi e Note",
        addClueBtn: "+ Aggiungi Indizio",
        noCluesYet: "Ancora nessun indizio — aggiungine uno!",
        deleteConfirmText: "Eliminare questo indizio/nota?",
        yesBtn: "✅ Sì", cancelBtn: "✖️ Annulla",
        untestedTitle: "Parole Mai Indovinate",
        statsTitle: "Statistiche di Rendimento per Parola",
        historyTitle: "Cronologia Globale dei Round e Classifiche",
        thSpanish: "Spagnolo", thTranslation: "Traduzione", thLyric: "Riga della Canzone e Traduzione", thClueHook: "Indizio / Aggancio",
        thWord: "Parola", thMeaning: "Significato", thSeen: "Viste", thCorrect: "Corrette", thAccuracy: "Precisione", thNotes: "Note",
        thRound: "Round", thFilterMode: "Modalità Filtro", thDateTime: "Data e Ora", thScore: "Punteggio",
        noticeTitle: "🚀 Motore di Importazione Canzoni",
        noticeBody: "L'opzione per aggiungere e analizzare canzoni personalizzate è attualmente in fase di sviluppo attivo. Nella prossima versione potrai incollare testi, generare indizi automatici e allenarti su brani personalizzati!",
        noticeBtn: "Capito",
        infoModalTitle: "Informazioni",
        exitToLibraryConfirm: "Uscire dal round attuale e tornare alla libreria delle canzoni?",
        resetAllConfirm: "Reimpostare TUTTI i dati di tutte le canzoni nella memoria?",
        resetAllDone: "Tutti i dati sono stati reimpostati!",
        resetSongConfirmTemplate: 'Reimpostare tutti i progressi, le statistiche e la cronologia salvati per "{song}"?',
        resetSongDone: "Dati della canzone reimpostati!",
        exitGameConfirm: "Sei sicuro di voler uscire dal round attuale? I tuoi progressi non salvati andranno persi.",
        noFilterMatch: "Nessuna parola corrisponde a questo filtro! Seleziona un'altra opzione.",
        roundCompleteTemplate: "Round {round} Completato, {name}!\nModalità: {mode}\nIl Tuo Punteggio: {score}/{total} ({pct}%)\n\nPreparazione del Round {nextRound}...",
        allWordsMastered: "🎉 Incredibile! Hai praticato ogni singola parola di questa canzone!",
        noRoundsYet: "Ancora nessun round completato per questa canzone!",
        dangerZoneLabel: "Zona Pericolosa",
        dangerZoneDesc: "Cancella permanentemente i progressi salvati. Questa azione non può essere annullata.",
        continueBannerTitle: "Continua da dove avevi lasciato",
        continueBtn: "▶ Continua",
        discardBtn: "Ignora",
        modeSelectLabel: "Modalità Pratica",
        playBtn: "▶ Gioca",
        wordsInRoundTemplate: "{count} parole in questo round",
        ticketCountTemplate: "🎫 {count} biglietti di canzoni pronti per esercitarti",
        continueBtn: "Continua →",
        listenOnPrefix: "Ascolta su",
        addLinkBtn: "+ Aggiungi link",
        addLinkModalTitlePrefix: "Aggiungi",
        pasteLinkLabel: "Incolla il link",
        invalidLinkError: "Non sembra un link valido — deve iniziare con {prefix}",
        confusableHintLabel: "Non confondere con",
        findLyricsLinkText: "Cerca il testo",
        hearLineBtn: "Ascolta la Riga",
        layoutSideBySideBtn: "Fianco a Fianco",
        layoutInlineBtn: "In Linea",
        lineContextEmptyNote: "Nessuna riga di contesto aggiuntiva ancora aggiunta per questa parola.",
        noVoiceWarningTemplate: "🔇 Nessuna voce in {lang} trovata su questo dispositivo — controlla le impostazioni di accessibilità/sintesi vocale del tuo dispositivo.",
        deleteSongBtn: "Elimina questa canzone",
        demoBadge: "Demo",
        deleteSongConfirmTemplate: 'Eliminare "{song}"? Questo cancella tutti i tuoi progressi, statistiche e note per essa — questa azione non può essere annullata.',
      },
      "German": {
        argentineVoiceBadge: "🇦🇷 Argentinische Stimme",
        songsNavBtn: "📚 Lieder",
        resetBtn: "🗑️ Zurücksetzen",
        libraryTitle: "Lied-Übungsbibliothek",
        libraryGreeting: "Willkommen zurück, {name}!",
        editSettingsBtn: "⚙️ Einstellungen Bearbeiten",
        wordsLabel: "Wörter",
        practicedLabel: "Geübt",
        untestedLabel: "Ungetestet",
        artistLabel: "Künstler:",
        practiceNowBtn: "Jetzt Üben →",
        tabQuiz: "Quiz-Modus",
        tabUntested: "Nie Geraten",
        tabStats: "Wortstatistiken",
        tabHistory: "Rundenverlauf",
        tabSettings: "⚙️ Einstellungen",
        settingsHeader: "⚙️ Einstellungen",
        settingsNameLabel: "Name",
        settingsLanguageLabel: "Bevorzugte Sprache",
        settingsSaved: "✓ Gespeichert",
        backBtn: "⬅ Zurück",
        setupChooseSubtitle: "Wähle aus, welche Wortschatz-Untergruppe du in dieser Runde üben möchtest:",
        filterAllWords: "Alle Wörter", filterAllWordsDesc: "(Kompletter Liedwortschatz)",
        filterUntested: "Nie Geraten", filterUntestedDesc: "(0 vorherige Versuche)",
        filterLastMistakes: "Fehler aus der Letzten Runde", filterLastMistakesDesc: "(Falsch / Übersprungen)",
        filterAccuracy: "Genauigkeit unter:",
        filterAllMistakes: "Problemwörter", filterAllMistakesDesc: "(≥1 Fehler insgesamt)",
        startRoundBtn: "Runde mit Ausgewählten Wörtern Starten",
        roundLabel: "Runde", wordLabel: "Wort", scoreLabel: "Punktzahl",
        nextWordBtn: "Nächstes Wort →", exitGameBtn: "❌ Spiel Verlassen",
        clueNotesBtn: "💡 Hinweis & Notizen", clueNotesBtnHide: "🙈 Hinweis & Notizen",
        songContextBtn: "🎵 Kontext", songContextBtnHide: "🙈 Kontext", lineContextModalTitleText: "Liedkontext",
        tensesBtn: "⏳ Zeitformen & Konjugationen", tensesBtnHide: "🙈 Zeitformen & Konjugationen",
        dontKnowBtn: "🤷‍♂️ Ich Weiß Es Nicht",
        translationHidden: "🔒 Übersetzung verborgen, bis du antwortest",
        hiddenShort: "🔒 Verborgen",
        tensesHeader: "Zeitformen & Grammatische Formen:",
        cluesHeader: "💡 Hinweise & Notizen",
        addClueBtn: "+ Hinweis Hinzufügen",
        noCluesYet: "Noch keine Hinweise — füge einen hinzu!",
        deleteConfirmText: "Diesen Hinweis/diese Notiz löschen?",
        yesBtn: "✅ Ja", cancelBtn: "✖️ Abbrechen",
        untestedTitle: "Nie Geratene Wörter",
        statsTitle: "Leistungsstatistik pro Wort",
        historyTitle: "Globaler Rundenverlauf & Ranglisten",
        thSpanish: "Spanisch", thTranslation: "Übersetzung", thLyric: "Liedzeile & Übersetzung", thClueHook: "Hinweis / Eselsbrücke",
        thWord: "Wort", thMeaning: "Bedeutung", thSeen: "Gesehen", thCorrect: "Richtig", thAccuracy: "Genauigkeit", thNotes: "Notizen",
        thRound: "Runde", thFilterMode: "Filtermodus", thDateTime: "Datum & Uhrzeit", thScore: "Punktzahl",
        noticeTitle: "🚀 Lied-Import-Engine",
        noticeBody: "Die Option, eigene Lieder hinzuzufügen und zu analysieren, befindet sich derzeit in aktiver Entwicklung. In der nächsten Version kannst du Liedtexte einfügen, automatische Hinweise generieren und mit eigenen Titeln üben!",
        noticeBtn: "Verstanden",
        infoModalTitle: "Information",
        exitToLibraryConfirm: "Aktuelle Quizrunde beenden und zur Liedbibliothek zurückkehren?",
        resetAllConfirm: "ALLE Daten aller Lieder im Speicher zurücksetzen?",
        resetAllDone: "Alle Daten wurden zurückgesetzt!",
        resetSongConfirmTemplate: 'Gesamten gespeicherten Fortschritt, Statistiken und Verlauf für "{song}" zurücksetzen?',
        resetSongDone: "Lieddaten zurückgesetzt!",
        exitGameConfirm: "Bist du sicher, dass du die aktuelle Runde verlassen möchtest? Dein ungespeicherter Fortschritt geht verloren.",
        noFilterMatch: "Keine Wörter entsprechen diesem Filter! Wähle eine andere Option.",
        roundCompleteTemplate: "Runde {round} Abgeschlossen, {name}!\nModus: {mode}\nDeine Punktzahl: {score}/{total} ({pct}%)\n\nRunde {nextRound} wird vorbereitet...",
        allWordsMastered: "🎉 Fantastisch! Du hast jedes einzelne Wort in diesem Lied geübt!",
        noRoundsYet: "Noch keine abgeschlossenen Runden für dieses Lied!",
        dangerZoneLabel: "Gefahrenzone",
        dangerZoneDesc: "Löscht gespeicherten Fortschritt dauerhaft. Dies kann nicht rückgängig gemacht werden.",
        continueBannerTitle: "Weiter, wo du aufgehört hast",
        continueBtn: "▶ Weiter",
        discardBtn: "Verwerfen",
        modeSelectLabel: "Übungsmodus",
        playBtn: "▶ Spielen",
        wordsInRoundTemplate: "{count} Wörter in dieser Runde",
        ticketCountTemplate: "🎫 {count} Lied-Tickets bereit zum Üben",
        continueBtn: "Weiter →",
        listenOnPrefix: "Anhören auf",
        addLinkBtn: "+ Link hinzufügen",
        addLinkModalTitlePrefix: "Hinzufügen",
        pasteLinkLabel: "Link einfügen",
        invalidLinkError: "Das sieht nicht nach einem gültigen Link aus — er sollte mit {prefix} beginnen",
        confusableHintLabel: "Nicht verwechseln mit",
        findLyricsLinkText: "Liedtext suchen",
        hearLineBtn: "Zeile Anhören",
        layoutSideBySideBtn: "Nebeneinander",
        layoutInlineBtn: "Inline",
        lineContextEmptyNote: "Für dieses Wort wurden noch keine zusätzlichen Kontextzeilen hinzugefügt.",
        noVoiceWarningTemplate: "🔇 Keine {lang}-Stimme auf diesem Gerät gefunden — überprüfe die Sprachausgabe-/Bedienungshilfen-Einstellungen deines Geräts.",
        deleteSongBtn: "Dieses Lied löschen",
        demoBadge: "Demo",
        deleteSongConfirmTemplate: '"{song}" löschen? Dies entfernt deinen gesamten Fortschritt, Statistiken und Notizen dafür — dies kann nicht rückgängig gemacht werden.',
      }
    };

    function t(key) {
      const lang = TRANSLATIONS[currentLang] ? currentLang : "American English";
      return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS["American English"][key] || key;
    }

    function tName() {
      return (userSettings && userSettings.name) || DEFAULT_SETTINGS.name;
    }


    function loadSettings() {
      const saved = DB.settings.get();
      userSettings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
      currentLang = userSettings.language;
    }

    function populateLanguageSelect(selectEl) {
      if (!selectEl) return;
      selectEl.innerHTML = AVAILABLE_LANGUAGES
        .map(lang => `<option value="${lang}">${lang}</option>`)
        .join("");
    }

    function loadSettingsIntoForm(isModal) {
      const nameEl = document.getElementById(isModal ? "modalSettingsNameInput" : "settingsNameInput");
      const langEl = document.getElementById(isModal ? "modalSettingsLanguageInput" : "settingsLanguageInput");
      if (nameEl) nameEl.value = userSettings.name;
      if (langEl) {
        populateLanguageSelect(langEl);
        langEl.value = userSettings.language;
      }
    }

    function setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    function applyTranslations() {
      document.documentElement.dir = (currentLang === "Hebrew") ? "rtl" : "ltr";
      document.documentElement.lang = (currentLang === "Hebrew") ? "he" : "en";

      // Top bar
      // Song info bar
      setText("continueBannerTitle", t("continueBannerTitle"));
      setText("continueBtn", t("continueBtn"));
      setText("discardBtn", t("discardBtn"));
      if (activeSongId) updateSongInfoBar();
      if (activeSongId && document.getElementById("setupView").style.display === "block") renderContinueBanner();

      // Library view
      setText("libraryTitleText", t("libraryTitle"));
      setText("libraryGreetingText", t("libraryGreeting").replace("{name}", tName()));

      setText("confusableHintLabel", t("confusableHintLabel"));
      setText("demoBadge", t("demoBadge"));
      setText("lineContextModalTitle", "🎵 " + t("lineContextModalTitleText"));
      setText("lineContextModalAudioLabel", t("hearLineBtn"));
      updateLineContextLayoutBtnLabel();

      // Nav tabs
      setText("tabUntestedLabel", t("tabUntested"));
      setText("tabStatsMenuItem", t("tabStats"));
      setText("tabHistoryMenuItem", t("tabHistory"));

      // Settings view
      setText("settingsBackBtn", t("backBtn"));
      setText("settingsHeaderText", t("settingsHeader"));
      setText("settingsNameLabelText", t("settingsNameLabel"));
      setText("settingsLanguageLabelText", t("settingsLanguageLabel"));
      setText("settingsSavedIndicator", t("settingsSaved"));
      setText("dangerZoneLabelText", t("dangerZoneLabel"));
      setText("dangerZoneDescText", t("dangerZoneDesc"));
      setText("resetAllBtn", "🗑️ " + t("resetBtn").replace(/^🗑️\s*/, ""));

      // Setup / filter view
      setText("setupRoundLabel", t("roundLabel"));
      setText("modeSelectLabelText", t("modeSelectLabel"));
      setText("filterAccuracyText", t("filterAccuracy"));
      if (activeSongId) updateFilterCounts();

      // Quiz view
      setText("quizRoundLabel", t("roundLabel"));
      setText("quizWordLabel", t("wordLabel"));
      setText("quizScoreLabel", t("scoreLabel"));
      document.getElementById("nextBtn").textContent = t("nextWordBtn");
      document.getElementById("exitGameBtnText").title = t("exitGameBtn").replace(/^❌\s*/, "");
      setText("cluesHeaderText", "💡 " + t("cluesHeader").replace(/^💡\s*/, ""));
      document.getElementById("addClueBtn").textContent = t("addClueBtn");
      setText("tensesHeaderText", t("tensesHeader"));

      // Action buttons — respect current shown/hidden toggle state
      const clueOpen = document.getElementById("clueNotesBox").style.display === "block";
      const contextOpen = document.getElementById("contextBox").style.display === "block";
      const tenseOpen = document.getElementById("tenseBox").style.display === "block";
      document.getElementById("toggleClueBtn").textContent = clueOpen ? t("clueNotesBtnHide") : t("clueNotesBtn");
      document.getElementById("toggleContextBtn").textContent = contextOpen ? t("songContextBtnHide") : t("songContextBtn");
      document.getElementById("toggleTenseBtn").textContent = tenseOpen ? t("tensesBtnHide") : t("tensesBtn");
      document.getElementById("dontKnowBtn").textContent = t("dontKnowBtn");

      // Spoiler placeholders for the currently loaded word (only if not yet revealed)
      const contextEnglishEl = document.getElementById("contextEnglishText");
      if (contextEnglishEl && contextEnglishEl.classList.contains("spoiler-hidden")) {
        contextEnglishEl.textContent = t("translationHidden");
      }
      document.querySelectorAll(".tense-meaning.spoiler-hidden").forEach(el => {
        el.textContent = t("hiddenShort");
      });

      // Clue notes list (re-render if a word is loaded)
      if (isGameActive && currentQueue[currentIndex]) {
        renderClueNotes(currentQueue[currentIndex].es);
      }

      // Table headers
      setText("untestedTitleText", t("untestedTitle"));
      setText("thUntestedSpanish", t("thSpanish"));
      setText("thUntestedTranslation", t("thTranslation"));
      setText("thUntestedLyric", t("thLyric"));
      setText("thUntestedClueHook", t("thClueHook"));

      setText("statsTitleText", t("statsTitle"));
      setText("thStatsWord", t("thWord"));
      setText("thStatsMeaning", t("thMeaning"));
      setText("thStatsSeen", t("thSeen"));
      setText("thStatsCorrect", t("thCorrect"));
      setText("thStatsAccuracy", t("thAccuracy"));
      setText("thStatsNotes", t("thNotes"));

      setText("historyTitleText", t("historyTitle"));
      setText("thHistoryRound", t("thRound"));
      setText("thHistoryFilterMode", t("thFilterMode"));
      setText("thHistoryDateTime", t("thDateTime"));
      setText("thHistoryScore", t("thScore"));
      setText("thHistoryAccuracy", t("thAccuracy"));

      // Notice modal
      setText("noticeTitleText", "🚀 " + t("noticeTitle").replace(/^🚀\s*/, ""));
      setText("noticeBodyText", t("noticeBody"));
      setText("modalTitle", t("infoModalTitle"));
      const noticeBtn = document.getElementById("noticeModalBtn");
      if (noticeBtn) noticeBtn.textContent = t("noticeBtn");

      // Re-render dynamic lists so their generated markup picks up the new language
      renderSongLibrary();
      if (document.getElementById("untestedView").style.display === "block") {
        renderUntested(document.getElementById("untestedTableBody"));
      }
      if (document.getElementById("statsView").style.display === "block") {
        renderStats(document.getElementById("statsTableBody"));
      }
      if (document.getElementById("historyView").style.display === "block") {
        renderHistory(document.getElementById("historyTableBody"));
      }
    }

    function saveSettingsField(isModal, field) {
      const nameEl = document.getElementById(isModal ? "modalSettingsNameInput" : "settingsNameInput");
      const langEl = document.getElementById(isModal ? "modalSettingsLanguageInput" : "settingsLanguageInput");
      const indicator = document.getElementById(isModal ? "modalSettingsSavedIndicator" : "settingsSavedIndicator");

      if (field === "name") {
        userSettings.name = (nameEl.value || "").trim() || DEFAULT_SETTINGS.name;
        nameEl.value = userSettings.name;
      } else if (field === "language") {
        userSettings.language = (langEl.value || "").trim() || DEFAULT_SETTINGS.language;
        currentLang = userSettings.language;
      }

      DB.settings.save(userSettings);
      applyTranslations();

      if (indicator) {
        indicator.classList.add("visible");
        clearTimeout(indicator._hideTimeout);
        indicator._hideTimeout = setTimeout(() => {
          indicator.classList.remove("visible");
        }, 1800);
      }
    }

    loadSettings();

    // ============================================================================
    // 5. VOICE / AUDIO
    // ============================================================================
    function loadVoices() {
      if ("speechSynthesis" in window) {
        availableVoices = window.speechSynthesis.getVoices();
      }
    }
    loadVoices();
    if ("speechSynthesis" in window && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // ============================================================================
    // 6. SONG LIBRARY VIEW (home screen)
    // ============================================================================
    function renderSongLibrary() {
      const container = document.getElementById("songCardsContainer");
      if (!container) return;
      container.innerHTML = "";

      Object.values(SongLibrary).forEach(song => {
        const savedStats = DB.stats.get(song.id);

        const untestedCount = song.vocabulary.filter(item => !savedStats[item.es] || savedStats[item.es].seen === 0).length;
        const totalWords = song.vocabulary.length;
        const mastered = totalWords - untestedCount;

        const card = document.createElement("div");
        card.className = "song-card";
        card.innerHTML = `
          <button class="song-delete-btn" title="${t("deleteSongBtn")}" onclick="deleteSong('${song.id}')">🗑️</button>
          <div class="song-info">
            <h3>${song.title}${song.isDemo ? ` <span class="demo-badge">🧪 ${t("demoBadge")}</span>` : ""}</h3>
            <p>${t("artistLabel")} <strong>${song.artist}</strong> • ${song.difficulty}</p>
            <div class="song-meta">
              <span class="meta-chip">📖 ${totalWords} ${t("wordsLabel")}</span>
              <span class="meta-chip" style="color:var(--success);">✅ ${mastered} ${t("practicedLabel")}</span>
              <span class="meta-chip" style="color:var(--rosa);">⏳ ${untestedCount} ${t("untestedLabel")}</span>
              ${song.sourceLang && song.targetLang ? `<span class="meta-chip" style="color:var(--azul);">${getLanguageFlag(song.sourceLang)} ${song.sourceLang} → ${song.targetLang}</span>` : ""}
            </div>
          </div>
          <button class="practice-btn" onclick="selectSong('${song.id}')">${t("practiceNowBtn")}</button>
        `;
        container.appendChild(card);
      });

      const ticketCountEl = document.getElementById("libraryTicketCount");
      if (ticketCountEl) {
        const count = Object.keys(SongLibrary).length;
        ticketCountEl.textContent = t("ticketCountTemplate").replace("{count}", count);
      }
    }

    function getHiddenSongIds() {
      return DB.hiddenSongs.getAll();
    }

    function applyHiddenSongs() {
      DB.hiddenSongs.applyToLibrary();
    }

    function deleteSong(id) {
      const song = SongLibrary[id];
      if (!song) return;

      showConfirmDialog(t("deleteSongConfirmTemplate").replace("{song}", song.title), () => {
        DB.clearSongData(id);
        DB.songs.remove(id);
        renderSongLibrary();
      });
    }

    function selectSong(songId) {
      activeSongId = songId;
      const song = SongLibrary[songId];
      vocabularyList = song.vocabulary;

      stats = DB.stats.get(songId);
      userNotes = DB.notes.get(songId);
      roundHistory = DB.history.get(songId);
      currentRound = DB.currentRound.get(songId);
      lastRoundMistakes = DB.lastMistakes.get(songId);

      document.getElementById("activeSongTitle").textContent = song.title;
      document.getElementById("libraryView").style.display = "none";
      document.getElementById("navMenuWrapper").style.display = "inline-block";
      document.getElementById("topBar").style.display = "none";
      updateSongInfoBar();

      handleTabClick("setup");
    }

    function updateSongInfoBar() {
      const song = SongLibrary[activeSongId];
      if (!song) return;
      document.getElementById("songInfoTitle").textContent = song.title;
      document.getElementById("songInfoSourceLang").textContent =
        (song.sourceLang ? getLanguageFlag(song.sourceLang) + " " : "") + (song.sourceLang || "—");
      document.getElementById("songInfoTargetLang").textContent = song.targetLang || "—";
      const accentChip = document.getElementById("songInfoAccentChip");

      // App-level default: any Spanish song without its own explicit
      // accentLabel is assumed Argentine Rioplatense, matching the voice
      // engine's own default (see VOICE_LANG_MAP / getPreferredVoiceLang) —
      // keeps the badge consistent with what's actually heard. A song can
      // still override this by setting its own accentLabel in its data.
      const effectiveAccentLabel = song.accentLabel
        || (song.sourceLang === "Spanish" ? "🇦🇷 Argentine Rioplatense" : "");

      if (effectiveAccentLabel) {
        document.getElementById("songInfoAccent").textContent = effectiveAccentLabel.replace(/^🇦🇷\s*/, "");
        accentChip.style.display = "inline-flex";
      } else {
        accentChip.style.display = "none";
      }

      renderStreamingIcon(song);

      document.getElementById("songInfoBar").style.display = "flex";
    }

    // Renders the single adaptive streaming icon: whichever platform is
    // currently active for this song gets its logo/color, and the dropdown
    // beneath it always lists all 4 platforms (with an "add link" affordance
    // for any platform this song doesn't have a link for yet). Shows nothing
    // at all if the song has zero streaming links anywhere.
    function renderStreamingIcon(song) {
      const wrapper = document.getElementById("songInfoStreamingWrapper");
      const dropdown = document.getElementById("songInfoStreamingDropdown");

      const links = getEffectiveStreamingLinks(song);
      const hasAnyLink = STREAMING_PLATFORM_ORDER.some(p => links[p]);

      if (!hasAnyLink) {
        wrapper.style.display = "none";
        return;
      }
      wrapper.style.display = "inline-block";

      const selectedPlatform = (DB.streamingOverrides.get(song.id) || {}).selectedPlatform;

      dropdown.innerHTML = STREAMING_PLATFORM_ORDER.map(platform => {
        const config = STREAMING_PLATFORMS[platform];
        const hasLink = !!links[platform];
        const rightSide = hasLink
          ? (platform === selectedPlatform ? "✓" : "")
          : `<span style="opacity:0.6; font-size:0.75rem;">${t("addLinkBtn")}</span>`;
        return `
          <button class="nav-menu-item" style="display:flex; align-items:center; gap:0.5rem;" onclick="handleStreamingPlatformClick('${platform}')">
            <span style="color:${config.color}; display:flex;">${config.icon}</span>
            <span style="flex:1;">${config.label}</span>
            <span>${rightSide}</span>
          </button>
        `;
      }).join("");
    }

    function toggleStreamingMenu() {
      document.getElementById("songInfoStreamingDropdown").classList.toggle("open");
    }

    function closeStreamingMenu() {
      document.getElementById("songInfoStreamingDropdown").classList.remove("open");
    }

    let pendingStreamingLinkPlatform = null;

    function handleStreamingPlatformClick(platform) {
      closeStreamingMenu();
      const song = SongLibrary[activeSongId];
      if (!song) return;
      const links = getEffectiveStreamingLinks(song);

      if (links[platform]) {
        DB.streamingOverrides.setSelectedPlatform(song.id, platform);
        window.open(links[platform], "_blank", "noopener");
        renderStreamingIcon(song);
      } else {
        openStreamingLinkModal(platform);
      }
    }

    function openStreamingLinkModal(platform) {
      pendingStreamingLinkPlatform = platform;
      const config = STREAMING_PLATFORMS[platform];
      document.getElementById("streamingLinkModalTitle").textContent = t("addLinkModalTitlePrefix") + " " + config.label;
      document.getElementById("streamingLinkInputLabel").textContent = t("pasteLinkLabel");
      document.getElementById("streamingLinkInput").value = "";
      document.getElementById("streamingLinkInput").placeholder = config.prefixes[0] + "...";
      document.getElementById("streamingLinkError").textContent = "";
      document.getElementById("streamingLinkSaveBtn").disabled = true;
      document.getElementById("streamingLinkModal").style.display = "flex";
    }

    function closeStreamingLinkModal() {
      document.getElementById("streamingLinkModal").style.display = "none";
      pendingStreamingLinkPlatform = null;
    }

    function validateStreamingLinkInput() {
      const url = document.getElementById("streamingLinkInput").value.trim();
      const errorEl = document.getElementById("streamingLinkError");
      const saveBtn = document.getElementById("streamingLinkSaveBtn");

      if (!url) {
        errorEl.textContent = "";
        saveBtn.disabled = true;
        return false;
      }
      const valid = isValidStreamingUrl(pendingStreamingLinkPlatform, url);
      errorEl.textContent = valid ? "" : t("invalidLinkError").replace(
        "{prefix}", STREAMING_PLATFORMS[pendingStreamingLinkPlatform].prefixes[0]
      );
      saveBtn.disabled = !valid;
      return valid;
    }

    function saveStreamingLinkInput() {
      if (!validateStreamingLinkInput()) return;
      const song = SongLibrary[activeSongId];
      if (!song || !pendingStreamingLinkPlatform) return;

      const url = document.getElementById("streamingLinkInput").value.trim();
      DB.streamingOverrides.setLink(song.id, pendingStreamingLinkPlatform, url);
      DB.streamingOverrides.setSelectedPlatform(song.id, pendingStreamingLinkPlatform);

      closeStreamingLinkModal();
      renderStreamingIcon(song);
    }

    function returnToLibrary() {
      if (isGameActive) {
        saveActiveRoundState();
        isGameActive = false;
      }

      activeSongId = null;
      document.getElementById("navMenuWrapper").style.display = "none";
      document.getElementById("topBar").style.display = "flex";
      document.getElementById("songInfoBar").style.display = "none";
      document.getElementById("setupView").style.display = "none";
      document.getElementById("quizView").style.display = "none";
      document.getElementById("untestedView").style.display = "none";
      document.getElementById("statsView").style.display = "none";
      document.getElementById("historyView").style.display = "none";

      renderSongLibrary();
      document.getElementById("libraryView").style.display = "block";
    }

    function closeNoticeModal() {
      document.getElementById("noticeModal").style.display = "none";
    }

    // ============================================================================
    // 7. CONFIRM DIALOG — reusable in-app Yes/No prompt (deliberately not the
    // native browser confirm(), which gets silently blocked in some contexts).
    // ============================================================================
    let pendingConfirmCallback = null;

    function showConfirmDialog(message, onConfirm) {
      document.getElementById("confirmMessage").textContent = message;
      document.getElementById("confirmYesBtn").textContent = t("yesBtn");
      document.getElementById("confirmCancelBtn").textContent = t("cancelBtn");
      document.getElementById("confirmOverlay").style.display = "flex";
      pendingConfirmCallback = onConfirm;
    }

    function resolveConfirmDialog(result) {
      document.getElementById("confirmOverlay").style.display = "none";
      const callback = pendingConfirmCallback;
      pendingConfirmCallback = null;
      if (result && callback) callback();
    }

    function renderContextModalLine(text, translation, isCurrent, isHidden, targetWord, lineNumber) {
      const textHtml = isCurrent
        ? getHighlightedContext(text, targetWord)
        : escapeHtml(text);
      const translationHtml = isHidden
        ? ""
        : (translation ? escapeHtml(translation) : "");
      const numberPrefix = (typeof lineNumber === "number")
        ? `<span class="context-modal-line-number">${lineNumber}.</span> `
        : "";

      return `
        <div class="context-modal-line${isCurrent ? " current" : ""}">
          <div class="context-modal-line-text">${numberPrefix}${textHtml}</div>
          ${translationHtml ? `<div class="context-modal-line-translation">${translationHtml}</div>` : ""}
        </div>
      `;
    }

    function openLineContextModal() {
      const current = currentQueue[currentIndex];
      const wordLine = current ? resolveWordLine(current) : null;
      if (!current || !wordLine) return;

      const song = SongLibrary[activeSongId];
      const inlineEnglishEl = document.getElementById("contextEnglishText");
      const isHidden = inlineEnglishEl.classList.contains("spoiler-hidden");

      let linesBefore = [];
      let linesAfter = [];

      const currentLineObj = (song && Array.isArray(song.lines) && current.lineId)
        ? song.lines.find(l => l.id === current.lineId)
        : null;

      if (currentLineObj && typeof currentLineObj.order === "number") {
        // Preferred path: use each line's real sequence position in the song,
        // pulling up to 2 lines before and 2 after (fewer if near the start/end).
        const order = currentLineObj.order;
        linesBefore = [order - 2, order - 1]
          .map(o => song.lines.find(l => l.order === o))
          .filter(Boolean)
          .map(l => ({ text: l.es, translation: l.en, order: l.order }));
        linesAfter = [order + 1, order + 2]
          .map(o => song.lines.find(l => l.order === o))
          .filter(Boolean)
          .map(l => ({ text: l.es, translation: l.en, order: l.order }));
      } else {
        // Fallback: older per-word manually-pasted surrounding lines, if any
        if (Array.isArray(current.linesBefore)) linesBefore = current.linesBefore.slice(-2);
        if (Array.isArray(current.linesAfter)) linesAfter = current.linesAfter.slice(0, 2);
      }

      let html = "";
      linesBefore.forEach(l => {
        html += renderContextModalLine(l.text, l.translation, false, isHidden, current.es, l.order);
      });
      html += renderContextModalLine(wordLine.text, wordLine.translation, true, isHidden, current.es, currentLineObj ? currentLineObj.order : undefined);
      linesAfter.forEach(l => {
        html += renderContextModalLine(l.text, l.translation, false, isHidden, current.es, l.order);
      });

      if (isHidden) {
        html += `<p class="line-context-empty-note">${t("translationHidden")}</p>`;
      } else if (linesBefore.length === 0 && linesAfter.length === 0) {
        html += `<p class="line-context-empty-note">${t("lineContextEmptyNote")}</p>`;
      }

      const bodyEl = document.getElementById("lineContextModalBody");
      bodyEl.innerHTML = html;
      bodyEl.classList.toggle("side-by-side", lineContextSideBySide);
      updateLineContextLayoutBtnLabel();

      const layoutBtn = document.getElementById("lineContextLayoutBtn");
      layoutBtn.style.display = isHidden ? "none" : "inline-flex";

      document.getElementById("lineContextModalAudioBtn").onclick = () => playAudio(wordLine.text, 0.84);
      document.getElementById("lineContextModal").style.display = "flex";
    }

    let lineContextSideBySide = false;

    function toggleLineContextLayout() {
      lineContextSideBySide = !lineContextSideBySide;
      document.getElementById("lineContextModalBody").classList.toggle("side-by-side", lineContextSideBySide);
      updateLineContextLayoutBtnLabel();
    }

    function updateLineContextLayoutBtnLabel() {
      const btn = document.getElementById("lineContextLayoutBtn");
      if (!btn) return;
      btn.textContent = lineContextSideBySide ? ("📄 " + t("layoutInlineBtn")) : ("⬌ " + t("layoutSideBySideBtn"));
    }

    function closeLineContextModal() {
      document.getElementById("lineContextModal").style.display = "none";
    }

    // ============================================================================
    // 8. QUIZ SETUP / FILTERS (the "choose what to practice" screen)
    // ============================================================================
    function shuffle(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    const VOICE_LANG_MAP = {
      "Spanish": "es-AR",
      "Hebrew": "he-IL",
      "American English": "en-US",
      "British English": "en-GB",
      "French": "fr-FR",
      "German": "de-DE",
      "Italian": "it-IT",
      "Portuguese": "pt-BR"
    };

    function getPreferredVoiceLang() {
      const song = SongLibrary[activeSongId];
      const sourceLang = song && song.sourceLang;
      return VOICE_LANG_MAP[sourceLang] || "es-AR";
    }

    function showVoiceWarning(message) {
      const toast = document.getElementById("voiceWarningToast");
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add("visible");
      clearTimeout(toast._hideTimeout);
      toast._hideTimeout = setTimeout(() => {
        toast.classList.remove("visible");
      }, 4500);
    }

    function playAudio(text, rate = 0.88) {
      if (!("speechSynthesis" in window)) return;

      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);

      if (availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
      }

      const targetLang = getPreferredVoiceLang();
      const targetPrefix = targetLang.split("-")[0];

      let matchedVoice = availableVoices.find(v => v.lang === targetLang);

      if (!matchedVoice && targetLang === "es-AR") {
        matchedVoice = availableVoices.find(v =>
          v.lang === "es-AR" ||
          v.lang === "es_AR" ||
          v.name.toLowerCase().includes("argentin") ||
          v.name.toLowerCase().includes("buenos")
        );
      }

      if (!matchedVoice) {
        matchedVoice = availableVoices.find(v => v.lang.startsWith(targetPrefix));
      }

      // Some browsers still label Hebrew voices with the older "iw" code
      if (!matchedVoice && targetPrefix === "he") {
        matchedVoice = availableVoices.find(v => v.lang.startsWith("iw"));
      }

      if (matchedVoice) {
        u.voice = matchedVoice;
        u.lang = matchedVoice.lang;
      } else {
        u.lang = targetLang;
        // Only warn once voices have actually finished loading (avoids a
        // false alarm during the brief async window before they're ready).
        if (availableVoices.length > 0) {
          const song = SongLibrary[activeSongId];
          const langLabel = (song && song.sourceLang) || targetLang;
          showVoiceWarning(t("noVoiceWarningTemplate").replace("{lang}", langLabel));
        }
      }

      u.rate = rate; 
      u.pitch = 0.95;
      window.speechSynthesis.speak(u);
    }

    function getHighlightedContext(fullLine, targetWord) {
      const regex = new RegExp(`(?<=[^\\p{L}]|^)(${targetWord})(?=[^\\p{L}]|$)`, 'giu');
      return fullLine.replace(regex, `<mark>$1</mark>`);
    }

    function getFilteredWords(mode) {
      const threshold = parseFloat(document.getElementById("accuracyThreshold").value) || 70;

      if (mode === "all") {
        return vocabularyList;
      } else if (mode === "untested") {
        return vocabularyList.filter(item => !stats[item.es] || stats[item.es].seen === 0);
      } else if (mode === "last_mistakes") {
        return vocabularyList.filter(item => lastRoundMistakes.includes(item.es));
      } else if (mode === "accuracy") {
        return vocabularyList.filter(item => {
          const s = stats[item.es];
          if (!s || s.seen === 0) return true;
          const acc = (s.correct / s.seen) * 100;
          return acc < threshold;
        });
      } else if (mode === "all_mistakes") {
        return vocabularyList.filter(item => stats[item.es] && stats[item.es].wrong > 0);
      }
      return vocabularyList;
    }

    function updateFilterCounts() {
      if (!activeSongId) return;
      document.getElementById("setupRoundDisplay").textContent = currentRound;

      const threshold = parseFloat(document.getElementById("accuracyThreshold").value) || 70;

      document.getElementById("optAllWords").textContent = t("filterAllWords");
      document.getElementById("optUntested").textContent = t("filterUntested");
      document.getElementById("optLastMistakes").textContent = t("filterLastMistakes");
      document.getElementById("optAccuracy").textContent = `${t("filterAccuracy")} ${threshold}%`;
      document.getElementById("optAllMistakes").textContent = t("filterAllMistakes");

      updateUntestedCount();
      updateStartButtonCount();
    }

    function handleFilterModeChange() {
      const mode = document.getElementById("roundFilterSelect").value;
      document.getElementById("accuracyInlineRow").style.display = (mode === "accuracy") ? "flex" : "none";
      updateStartButtonCount();
    }

    function updateStartButtonCount() {
      const select = document.getElementById("roundFilterSelect");
      if (!select) return;
      const count = getFilteredWords(select.value).length;

      const summary = document.getElementById("wordCountSummary");
      summary.innerHTML = t("wordsInRoundTemplate").replace("{count}", `<strong>${count}</strong>`);
      summary.classList.toggle("zero-words", count === 0);

      const btn = document.getElementById("startRoundBtn");
      btn.textContent = t("playBtn");
      btn.disabled = (count === 0);
      btn.style.opacity = (count === 0) ? "0.5" : "1";
    }

    function resetAllData() {
      if (!activeSongId) {
        showConfirmDialog(t("resetAllConfirm"), () => {
          localStorage.clear();
          loadSettings();
          currentLang = userSettings.language;
          renderSongLibrary();
          applyTranslations();
          alert(t("resetAllDone"));
        });
        return;
      }

      showConfirmDialog(t("resetSongConfirmTemplate").replace("{song}", SongLibrary[activeSongId].title), () => {
        DB.clearSongData(activeSongId);

        stats = {};
        userNotes = {};
        roundHistory = [];
        currentRound = 1;
        lastRoundMistakes = [];
        updateFilterCounts();
        alert(t("resetSongDone"));
      });
    }

    // ============================================================================
    // 9. ROUND PERSISTENCE (pause/resume an in-progress round)
    // ============================================================================
    function saveActiveRoundState() {
      if (!activeSongId || !isGameActive) return;
      const state = {
        currentQueue, currentIndex, score, thisRoundMistakes,
        currentRound, filterName: currentActiveFilterName
      };
      DB.activeRound.save(activeSongId, state);
    }

    function loadActiveRoundState(songId) {
      return DB.activeRound.get(songId);
    }

    function clearActiveRoundState(songId) {
      DB.activeRound.clear(songId);
    }

    function renderContinueBanner() {
      const banner = document.getElementById("continueBanner");
      const saved = loadActiveRoundState(activeSongId);
      if (!saved || !saved.currentQueue || saved.currentQueue.length === 0) {
        banner.style.display = "none";
        return;
      }
      document.getElementById("continueBannerDetail").textContent =
        `${t("wordLabel")} ${saved.currentIndex + 1} / ${saved.currentQueue.length} · ${saved.filterName}`;
      banner.style.display = "flex";
    }

    function resumeActiveRound() {
      const saved = loadActiveRoundState(activeSongId);
      if (!saved) return;

      currentQueue = saved.currentQueue;
      currentIndex = saved.currentIndex;
      score = saved.score;
      thisRoundMistakes = saved.thisRoundMistakes;
      currentRound = saved.currentRound;
      currentActiveFilterName = saved.filterName;
      isGameActive = true;

      document.getElementById("roundDisplay").textContent = currentRound;
      document.getElementById("scoreDisplay").textContent = score;
      document.getElementById("setupView").style.display = "none";
      document.getElementById("quizView").style.display = "block";
      document.getElementById("topBar").style.display = "none";
      loadQuestion();
    }

    function discardActiveRound() {
      clearActiveRoundState(activeSongId);
      renderContinueBanner();
    }

    // ============================================================================
    // 10. QUIZ ENGINE (question-by-question gameplay)
    // ============================================================================
    function startConfiguredRound() {
      const select = document.getElementById("roundFilterSelect");
      const mode = select ? select.value : "all";
      
      const filterLabels = {
        all: "All Words",
        untested: "Never Guessed",
        last_mistakes: "Last Mistakes",
        accuracy: `< ${document.getElementById("accuracyThreshold").value}% Acc`,
        all_mistakes: "Trouble Words"
      };
      currentActiveFilterName = filterLabels[mode] || "Filtered";

      const filtered = getFilteredWords(mode);
      if (filtered.length === 0) {
        alert(t("noFilterMatch"));
        return;
      }

      isGameActive = true;
      currentQueue = shuffle(filtered);
      currentIndex = 0;
      score = 0;
      thisRoundMistakes = [];
      clearActiveRoundState(activeSongId);

      document.getElementById("roundDisplay").textContent = currentRound;
      document.getElementById("scoreDisplay").textContent = score;

      document.getElementById("setupView").style.display = "none";
      document.getElementById("quizView").style.display = "block";
      document.getElementById("topBar").style.display = "none";
      loadQuestion();
    }

    function exitGame() {
      saveActiveRoundState();
      isGameActive = false;
      document.getElementById("quizView").style.display = "none";
      document.getElementById("setupView").style.display = "block";
      document.getElementById("topBar").style.display = "none";
      updateFilterCounts();
      renderContinueBanner();
    }

    function loadQuestion() {
      answered = false;
      const feedbackEl = document.getElementById("feedback");
      feedbackEl.innerHTML = "";
      feedbackEl.className = "feedback-banner";
      document.getElementById("optionsContainer").style.display = "grid";
      document.getElementById("nextBtn").classList.remove("visible");
      document.getElementById("topActionsRow").style.display = "flex";
      document.getElementById("dontKnowBtn").style.display = "block";
      
      document.getElementById("clueNotesBox").style.display = "none";
      document.getElementById("toggleClueBtn").textContent = t("clueNotesBtn");
      document.getElementById("toggleClueBtn").classList.remove("active-btn");

      document.getElementById("contextBox").style.display = "none";
      document.getElementById("toggleContextBtn").textContent = t("songContextBtn");
      document.getElementById("toggleContextBtn").classList.remove("active-btn");

      document.getElementById("tenseBox").style.display = "none";
      document.getElementById("toggleTenseBtn").textContent = t("tensesBtn");
      document.getElementById("toggleTenseBtn").classList.remove("active-btn");

      document.getElementById("dontKnowBtn").disabled = false;

      const current = currentQueue[currentIndex];
      document.getElementById("currentWord").textContent = current.es;
      renderClueNotes(current.es);

      const confusableHint = document.getElementById("confusableHint");
      if (current.confusableWith && current.confusableWith.word) {
        document.getElementById("confusableWord").textContent = current.confusableWith.word;
        document.getElementById("confusableMeaning").textContent = current.confusableWith.meaning || "";
        document.getElementById("confusableDifference").textContent = current.confusableWith.difference || "";
        confusableHint.style.display = "block";
      } else {
        confusableHint.style.display = "none";
      }

      const contextLineHeader = document.getElementById("contextLineHeader");
      const contextSpanishEl = document.getElementById("contextSpanishText");
      const contextEnglishEl = document.getElementById("contextEnglishText");
      const listenLineBtn = document.getElementById("listenLineBtn");

      const wordLine = resolveWordLine(current);
      if (wordLine) {
        // Legacy format: a real lyric line, safe to display (hardcoded, non-AI-sourced song)
        contextLineHeader.style.display = "flex";
        contextSpanishEl.style.display = "block";
        contextSpanishEl.innerHTML = `“${getHighlightedContext(wordLine.text, current.es)}”`;
        contextEnglishEl.dataset.full = `Translation: "${wordLine.translation}"`;
        listenLineBtn.style.display = "inline-flex";
        listenLineBtn.onclick = () => playAudio(wordLine.text, 0.84);
      } else if (current.context) {
        // AI-imported format: a paraphrased description, no verbatim lyrics —
        // there's no lyric line to show, so hide the whole header row rather
        // than leaving an empty gap where it would have been.
        contextLineHeader.style.display = "none";
        contextSpanishEl.style.display = "none";
        contextEnglishEl.dataset.full = current.context;
        listenLineBtn.style.display = "none";
        listenLineBtn.onclick = null;
      } else {
        contextLineHeader.style.display = "none";
        contextSpanishEl.style.display = "none";
        contextEnglishEl.dataset.full = "";
        listenLineBtn.style.display = "none";
        listenLineBtn.onclick = null;
      }
      contextEnglishEl.textContent = t("translationHidden");
      contextEnglishEl.classList.add("spoiler-hidden");

      const tenseGrid = document.getElementById("tenseGrid");
      tenseGrid.innerHTML = "";
      if (current.tenses && current.tenses.length > 0) {
        current.tenses.forEach(tenseEntry => {
          const item = document.createElement("div");
          item.className = "tense-item";
          item.innerHTML = `
            <div class="tense-label">${tenseEntry.label}</div>
            <div class="tense-word">${tenseEntry.word}</div>
            <div class="tense-meaning spoiler-hidden" data-full="${escapeHtml(tenseEntry.meaning)}">${t("hiddenShort")}</div>
          `;
          tenseGrid.appendChild(item);
        });
      }

      document.getElementById("questionCounter").textContent = `${currentIndex + 1} / ${currentQueue.length}`;
      document.getElementById("progressBar").style.width = `${(currentIndex / currentQueue.length) * 100}%`;

      playAudio(current.es);

      let choices;
      if (current.distractors && current.distractors.length >= 3) {
        const shuffledDistractors = shuffle(current.distractors).slice(0, 3);
        choices = shuffle([current.en, ...shuffledDistractors]);
      } else {
        const pooled = vocabularyList.filter(item => item.es !== current.es).map(item => item.en);
        const shuffledDistractors = shuffle(pooled).slice(0, 3);
        choices = shuffle([current.en, ...shuffledDistractors]);
      }

      const container = document.getElementById("optionsContainer");
      container.innerHTML = "";
      choices.forEach(choice => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = choice;
        btn.onclick = () => selectOption(btn, choice, current);
        container.appendChild(btn);
      });
    }

    function autoRevealClues() {
      document.getElementById("clueNotesBox").style.display = "block";
      document.getElementById("toggleClueBtn").textContent = t("clueNotesBtnHide");
      document.getElementById("toggleClueBtn").classList.add("active-btn");

      document.getElementById("contextBox").style.display = "block";
      document.getElementById("toggleContextBtn").textContent = t("songContextBtnHide");
      document.getElementById("toggleContextBtn").classList.add("active-btn");

      document.getElementById("tenseBox").style.display = "block";
      document.getElementById("toggleTenseBtn").textContent = t("tensesBtnHide");
      document.getElementById("toggleTenseBtn").classList.add("active-btn");

      const contextEnglishEl = document.getElementById("contextEnglishText");
      if (contextEnglishEl.dataset.full) {
        contextEnglishEl.textContent = contextEnglishEl.dataset.full;
        contextEnglishEl.classList.remove("spoiler-hidden");
      }

      document.querySelectorAll(".tense-meaning.spoiler-hidden").forEach(el => {
        el.textContent = el.dataset.full;
        el.classList.remove("spoiler-hidden");
      });
    }

    const FEEDBACK_PHRASES = {
      correct: {
        "American English": [
          "¡Correcto! Well done.", "Nailed it!", "¡Excelente! That's right.", "Spot on!",
          "¡Muy bien! Correct.", "Yes! You've got it.", "¡Perfecto! Right on target.", "That's the one!",
          "¡Genial! Correct answer.", "Great job, correct!", "¡Así se hace! Correct.", "You nailed that word.",
          "Correct — nicely done.", "¡Bien hecho! That's it.", "Right answer, well played."
        ],
        "British English": [
          "¡Correcto! Well done.", "Spot on, nailed it!", "¡Excelente! That's right.", "Brilliant!",
          "¡Muy bien! Correct.", "Yes! You've got it.", "¡Perfecto! Right on the money.", "That's the one!",
          "¡Genial! Correct answer.", "Great job, correct!", "¡Así se hace! Correct.", "You nailed that word.",
          "Correct — nicely done.", "¡Bien hecho! That's it.", "Right answer, well played."
        ],
        "Hebrew": [
          "נכון! כל הכבוד.", "פגעת בול!", "מצוין! זה נכון.", "בדיוק!",
          "יופי! תשובה נכונה.", "כן! הבנת את זה.", "מושלם! ישר לפי העניין.", "זו התשובה הנכונה!",
          "גאוני! תשובה נכונה.", "עבודה טובה, נכון!", "ככה עושים את זה!", "קלעת למילה הזו.",
          "נכון — כל הכבוד.", "יפה מאוד! זהו זה.", "תשובה נכונה, שיחקת אותה."
        ],
        "Spanish": [
          "¡Correcto! Muy bien hecho.", "¡En el blanco!", "¡Excelente! Así es.", "¡Justo en el punto!",
          "¡Muy bien! Correcto.", "¡Sí! Lo lograste.", "¡Perfecto! Diste en el clavo.", "¡Esa es la respuesta!",
          "¡Genial! Respuesta correcta.", "¡Buen trabajo, correcto!", "¡Así se hace!", "Le diste a esa palabra.",
          "Correcto — muy bien.", "¡Bien hecho! Eso es.", "Respuesta correcta, bien jugado."
        ],
        "Portuguese": [
          "Correto! Muito bem.", "Na mosca!", "Excelente! Isso mesmo.", "Na medida certa!",
          "Muito bem! Correto.", "Sim! Você acertou.", "Perfeito! Bem na mira.", "Essa é a resposta!",
          "Genial! Resposta correta.", "Bom trabalho, correto!", "É assim que se faz!", "Você acertou essa palavra.",
          "Correto — muito bem.", "Bem feito! É isso mesmo.", "Resposta certa, muito bem jogado."
        ],
        "French": [
          "Correct ! Bien joué.", "En plein dans le mille !", "Excellent ! C'est ça.", "Parfaitement visé !",
          "Très bien ! Correct.", "Oui ! Tu l'as trouvé.", "Parfait ! En plein sur la cible.", "C'est la bonne réponse !",
          "Génial ! Bonne réponse.", "Bon travail, correct !", "Voilà comment on fait !", "Tu as trouvé ce mot.",
          "Correct — bien joué.", "Bien fait ! C'est ça.", "Bonne réponse, bien joué."
        ],
        "Italian": [
          "Corretto! Ben fatto.", "Centro pieno!", "Eccellente! Esatto.", "Colpito nel segno!",
          "Molto bene! Corretto.", "Sì! Ci sei arrivato.", "Perfetto! Proprio nel segno.", "Questa è la risposta giusta!",
          "Geniale! Risposta corretta.", "Ottimo lavoro, corretto!", "Così si fa!", "Hai azzeccato quella parola.",
          "Corretto — ben fatto.", "Ben fatto! Esatto.", "Risposta giusta, ben giocato."
        ],
        "German": [
          "Richtig! Gut gemacht.", "Genau ins Schwarze!", "Ausgezeichnet! Das stimmt.", "Genau getroffen!",
          "Sehr gut! Richtig.", "Ja! Du hast es geschafft.", "Perfekt! Genau ins Ziel.", "Das ist die richtige Antwort!",
          "Genial! Richtige Antwort.", "Gute Arbeit, richtig!", "So macht man das!", "Du hast das Wort getroffen.",
          "Richtig — gut gemacht.", "Gut gemacht! Genau das.", "Richtige Antwort, gut gespielt."
        ]
      },
      wrong: {
        "American English": [
          "Not quite — you'll get it next time!", "So close! Here's the right one:", "Nice try — that one's tricky:",
          "Almost! The correct word was:", "Don't worry, next time you'll nail it:", "Not this time — remember it for next time:",
          "Close, but not quite. It was:", "Missed it — here's the answer:", "That's alright, keep going. It was:",
          "Not the right one — the answer is:"
        ],
        "British English": [
          "Not quite — you'll get it next time!", "So close! Here's the right one:", "Good try — that one's tricky:",
          "Almost! The correct word was:", "Don't worry, next time you'll nail it:", "Not this time — remember it for next time:",
          "Close, but not quite. It was:", "Missed it — here's the answer:", "That's alright, keep going. It was:",
          "Not the right one — the answer is:"
        ],
        "Hebrew": [
          "לא בדיוק — בפעם הבאה תצליח!", "כמעט! הנה התשובה הנכונה:", "ניסיון יפה — זו מילה מכשילה:",
          "כמעט! המילה הנכונה הייתה:", "אל תדאג, בפעם הבאה תצליח:", "לא הפעם — תזכור לפעם הבאה:",
          "קרוב, אך לא בדיוק. זו הייתה:", "פספסת — הנה התשובה:", "זה בסדר, תמשיך הלאה. זו הייתה:",
          "לא זו התשובה — התשובה היא:"
        ],
        "Spanish": [
          "No exactamente — ¡lo lograrás la próxima vez!", "¡Muy cerca! Aquí está la correcta:", "Buen intento — esa es difícil:",
          "¡Casi! La palabra correcta era:", "No te preocupes, la próxima vez lo lograrás:", "Esta vez no — recuérdalo para la próxima:",
          "Cerca, pero no exacto. Era:", "No le diste — aquí está la respuesta:", "Está bien, sigue adelante. Era:",
          "Esa no es — la respuesta correcta es:"
        ],
        "Portuguese": [
          "Não foi dessa vez — na próxima você acerta!", "Muito perto! Aqui está a certa:", "Boa tentativa — essa é difícil:",
          "Quase! A palavra correta era:", "Não se preocupe, na próxima você consegue:", "Dessa vez não — lembre-se para a próxima:",
          "Perto, mas não exato. Era:", "Não foi dessa vez — aqui está a resposta:", "Tudo bem, continue. Era:",
          "Essa não é — a resposta correta é:"
        ],
        "French": [
          "Pas tout à fait — tu y arriveras la prochaine fois !", "Tout près ! Voici la bonne réponse :", "Bel essai — celui-là est piégeur :",
          "Presque ! Le bon mot était :", "Ne t'en fais pas, la prochaine fois tu l'auras :", "Pas cette fois — souviens-t'en pour la prochaine :",
          "Proche, mais pas tout à fait. C'était :", "Manqué — voici la réponse :", "Ce n'est rien, continue. C'était :",
          "Ce n'est pas la bonne — la réponse est :"
        ],
        "Italian": [
          "Non proprio — la prossima volta ce la farai!", "Vicinissimo! Ecco quella giusta:", "Bel tentativo — quella è complicata:",
          "Quasi! La parola corretta era:", "Non preoccuparti, la prossima volta ci riuscirai:", "Non questa volta — ricordala per la prossima:",
          "Vicino, ma non esatto. Era:", "Mancato — ecco la risposta:", "Va bene, continua così. Era:",
          "Non è quella giusta — la risposta è:"
        ],
        "German": [
          "Nicht ganz — nächstes Mal schaffst du es!", "So knapp! Hier ist die richtige:", "Guter Versuch — das ist ein kniffliges Wort:",
          "Fast! Das richtige Wort war:", "Keine Sorge, nächstes Mal klappt's:", "Diesmal nicht — merk es dir für's nächste Mal:",
          "Nah dran, aber nicht ganz. Es war:", "Knapp daneben — hier ist die Antwort:", "Kein Problem, weiter geht's. Es war:",
          "Das ist nicht richtig — die Antwort ist:"
        ]
      },
      idk: {
        "American English": [
          "No worries — now you know it for next time!", "That's okay! Here's the word to remember:", "All good — learning it now:",
          "No problem, next time you'll have it:", "That's fine! Here's the meaning:", "Not a problem — here's the word:",
          "It happens! The word means:", "No stress — now you've got it:", "Totally fine, here's the answer:",
          "You'll remember it next time. It means:"
        ],
        "British English": [
          "No worries — now you know it for next time!", "That's okay! Here's the word to remember:", "All good — learning it now:",
          "No bother, next time you'll have it:", "That's fine! Here's the meaning:", "Not a problem — here's the word:",
          "It happens! The word means:", "No stress — now you've got it:", "Totally fine, here's the answer:",
          "You'll remember it next time. It means:"
        ],
        "Hebrew": [
          "אין בעיה — עכשיו תדע לפעם הבאה!", "זה בסדר! הנה המילה לזכור:", "הכל טוב — לומדים אותה עכשיו:",
          "אין בעיה, בפעם הבאה תדע:", "זה בסדר! הנה המשמעות:", "אין בעיה — הנה המילה:",
          "זה קורה! המילה פירושה:", "ללא לחץ — עכשיו אתה יודע:", "הכל טוב, הנה התשובה:",
          "תזכור את זה בפעם הבאה. זה אומר:"
        ],
        "Spanish": [
          "No te preocupes — ¡ahora la sabrás para la próxima!", "¡Está bien! Aquí está la palabra para recordar:", "Todo bien — aprendiéndola ahora:",
          "No hay problema, la próxima vez la sabrás:", "¡Está bien! Aquí está el significado:", "No es problema — aquí está la palabra:",
          "¡Pasa! La palabra significa:", "Sin estrés — ahora ya la sabes:", "Totalmente bien, aquí está la respuesta:",
          "La recordarás la próxima vez. Significa:"
        ],
        "Portuguese": [
          "Sem problemas — agora você sabe para a próxima!", "Tudo bem! Aqui está a palavra para lembrar:", "Tudo certo — aprendendo agora:",
          "Sem problema, na próxima você vai saber:", "Tudo bem! Aqui está o significado:", "Sem problema — aqui está a palavra:",
          "Acontece! A palavra significa:", "Sem estresse — agora você sabe:", "Totalmente tranquilo, aqui está a resposta:",
          "Você vai lembrar na próxima vez. Significa:"
        ],
        "French": [
          "Pas de souci — tu la connaîtras la prochaine fois !", "C'est bon ! Voici le mot à retenir :", "Tout va bien — on l'apprend maintenant :",
          "Pas de problème, la prochaine fois tu la sauras :", "C'est bon ! Voici la signification :", "Aucun souci — voici le mot :",
          "Ça arrive ! Le mot signifie :", "Sans stress — maintenant tu le sais :", "Tout va bien, voici la réponse :",
          "Tu t'en souviendras la prochaine fois. Ça signifie :"
        ],
        "Italian": [
          "Nessun problema — ora la saprai per la prossima volta!", "Va bene! Ecco la parola da ricordare:", "Tutto bene — la stai imparando ora:",
          "Nessun problema, la prossima volta la saprai:", "Va bene! Ecco il significato:", "Non è un problema — ecco la parola:",
          "Succede! La parola significa:", "Senza stress — ora la sai:", "Tutto a posto, ecco la risposta:",
          "La ricorderai la prossima volta. Significa:"
        ],
        "German": [
          "Kein Problem — jetzt kennst du es für nächstes Mal!", "Alles gut! Hier ist das Wort zum Merken:", "Alles klar — du lernst es jetzt:",
          "Kein Problem, nächstes Mal weißt du es:", "Alles gut! Hier ist die Bedeutung:", "Kein Problem — hier ist das Wort:",
          "Passiert! Das Wort bedeutet:", "Kein Stress — jetzt hast du es:", "Alles gut, hier ist die Antwort:",
          "Du wirst dich nächstes Mal daran erinnern. Es bedeutet:"
        ]
      }
    };

    function getPhrasePool(kind) {
      const pool = FEEDBACK_PHRASES[kind];
      return pool[currentLang] || pool["American English"];
    }


    function pickRandom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function showFeedback(kind, line1, line2) {
      const feedback = document.getElementById("feedback");
      feedback.className = `feedback-banner visible feedback-${kind}`;
      feedback.innerHTML = line2
        ? `<div class="feedback-line1">${line1}</div><div class="feedback-line2">${line2}</div>`
        : `<div class="feedback-line1">${line1}</div>`;
    }

    function selectOption(btn, choice, current) {
      if (answered) return;
      answered = true;

      if (!stats[current.es]) {
        stats[current.es] = { seen: 0, correct: 0, wrong: 0 };
      }
      stats[current.es].seen++;

      const isCorrect = (choice === current.en);

      if (isCorrect) {
        score++;
        stats[current.es].correct++;
        btn.classList.add("correct");
        showFeedback("correct", pickRandom(getPhrasePool("correct")), current.en);
      } else {
        stats[current.es].wrong++;
        thisRoundMistakes.push(current.es);
        btn.classList.add("wrong");
        showFeedback("wrong", pickRandom(getPhrasePool("wrong")), current.en);

        document.querySelectorAll(".option-btn").forEach(b => {
          if (b.textContent === current.en) b.classList.add("correct");
        });
      }

      autoRevealClues();
      finishQuestionInteractions();
    }

    function handleDontKnow() {
      if (answered) return;
      answered = true;

      const current = currentQueue[currentIndex];
      if (!stats[current.es]) {
        stats[current.es] = { seen: 0, correct: 0, wrong: 0 };
      }
      stats[current.es].seen++;
      stats[current.es].wrong++;
      thisRoundMistakes.push(current.es);

      showFeedback("skip", pickRandom(getPhrasePool("idk")), current.en);

      document.querySelectorAll(".option-btn").forEach(b => {
        if (b.textContent === current.en) b.classList.add("correct");
      });

      autoRevealClues();
      finishQuestionInteractions();
    }

    function finishQuestionInteractions() {
      document.querySelectorAll(".option-btn").forEach(b => b.disabled = true);
      document.getElementById("optionsContainer").style.display = "none";
      document.getElementById("dontKnowBtn").disabled = true;
      document.getElementById("dontKnowBtn").style.display = "none";
      document.getElementById("scoreDisplay").textContent = score;
      document.getElementById("nextBtn").classList.add("visible");
      document.getElementById("topActionsRow").style.display = "none";

      DB.stats.save(activeSongId, stats);
      saveActiveRoundState();
      updateUntestedCount();
    }


    function advanceQuestion() {
      currentIndex++;
      if (currentIndex < currentQueue.length) {
        loadQuestion();
      } else {
        endRound();
      }
    }

    function endRound() {
      isGameActive = false;
      clearActiveRoundState(activeSongId);
      const percentage = Math.round((score / currentQueue.length) * 100);
      
      lastRoundMistakes = [...new Set(thisRoundMistakes)];
      DB.lastMistakes.save(activeSongId, lastRoundMistakes);

      roundHistory.unshift({
        round: currentRound,
        filter: currentActiveFilterName,
        date: new Date().toLocaleString(),
        score: `${score} / ${currentQueue.length}`,
        percentage: `${percentage}%`
      });
      DB.history.save(activeSongId, roundHistory);

      currentRound++;
      DB.currentRound.save(activeSongId, currentRound);

      alert(t("roundCompleteTemplate")
        .replace("{round}", currentRound - 1)
        .replace("{name}", tName())
        .replace("{mode}", currentActiveFilterName)
        .replace("{score}", score)
        .replace("{total}", currentQueue.length)
        .replace("{pct}", percentage)
        .replace("{nextRound}", currentRound));
      
      document.getElementById("quizView").style.display = "none";
      document.getElementById("setupView").style.display = "block";
      document.getElementById("topBar").style.display = "none";
      updateFilterCounts();
      renderContinueBanner();
    }

    function toggleClue() {
      const clueNotesBox = document.getElementById("clueNotesBox");
      const btn = document.getElementById("toggleClueBtn");

      if (clueNotesBox.style.display === "block") {
        clueNotesBox.style.display = "none";
        btn.textContent = t("clueNotesBtn");
        btn.classList.remove("active-btn");
      } else {
        clueNotesBox.style.display = "block";
        btn.textContent = t("clueNotesBtnHide");
        btn.classList.add("active-btn");
      }
    }

    function toggleContext() {
      const box = document.getElementById("contextBox");
      const btn = document.getElementById("toggleContextBtn");
      if (box.style.display === "block") {
        box.style.display = "none";
        btn.textContent = t("songContextBtn");
        btn.classList.remove("active-btn");
      } else {
        box.style.display = "block";
        btn.textContent = t("songContextBtnHide");
        btn.classList.add("active-btn");
      }
    }

    function toggleTense() {
      const box = document.getElementById("tenseBox");
      const btn = document.getElementById("toggleTenseBtn");
      if (box.style.display === "block") {
        box.style.display = "none";
        btn.textContent = t("tensesBtn");
        btn.classList.remove("active-btn");
      } else {
        box.style.display = "block";
        btn.textContent = t("tensesBtnHide");
        btn.classList.add("active-btn");
      }
    }

    // ============================================================================
    // 11. CLUE & NOTES (per-word hints and personal notes)
    // ============================================================================
    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    function getWordNotes(es) {
      if (!userNotes[es]) {
        const vocab = vocabularyList.find(v => v.es === es);
        const defaultClue = vocab ? vocab.clue : "";
        userNotes[es] = defaultClue ? [{ id: "default", text: defaultClue }] : [];
      }
      return userNotes[es];
    }

    function persistWordNotes() {
      DB.notes.save(activeSongId, userNotes);
    }

    function renderClueNotes(es) {
      const list = document.getElementById("clueNotesList");
      const notes = getWordNotes(es);
      list.innerHTML = "";

      if (notes.length === 0) {
        list.innerHTML = `<div class="clue-notes-empty">${t("noCluesYet")}</div>`;
        return;
      }

      notes.forEach(note => {
        const item = document.createElement("div");
        item.className = "clue-note-item";
        item.dataset.noteId = note.id;
        item.innerHTML = `
          <div class="clue-note-text">${escapeHtml(note.text)}</div>
          <div class="clue-note-actions">
            <button class="clue-note-action-btn" title="Edit" onclick="editClueNote('${es}', '${note.id}')">✏️</button>
            <button class="clue-note-action-btn delete-btn" title="Delete" onclick="deleteClueNote('${es}', '${note.id}')">🗑️</button>
          </div>
        `;
        list.appendChild(item);
      });
    }

    function editClueNote(es, noteId) {
      const notes = getWordNotes(es);
      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      const list = document.getElementById("clueNotesList");
      const item = list.querySelector(`[data-note-id="${CSS.escape(noteId)}"]`);
      if (!item) return;

      item.innerHTML = `
        <textarea class="clue-note-edit-input" id="editInput_${noteId}">${escapeHtml(note.text)}</textarea>
        <div class="clue-note-actions">
          <button class="clue-note-action-btn" title="Save" onclick="saveClueNoteEdit('${es}', '${noteId}')">✅</button>
          <button class="clue-note-action-btn" title="Cancel" onclick="renderClueNotes('${es}')">✖️</button>
        </div>
      `;
      const textarea = document.getElementById(`editInput_${noteId}`);
      textarea.focus();
      textarea.selectionStart = textarea.value.length;
    }

    function saveClueNoteEdit(es, noteId) {
      const textarea = document.getElementById(`editInput_${noteId}`);
      if (!textarea) return;
      const notes = getWordNotes(es);
      const val = textarea.value.trim();

      if (val) {
        const note = notes.find(n => n.id === noteId);
        if (note) note.text = val;
      } else {
        userNotes[es] = notes.filter(n => n.id !== noteId);
      }

      persistWordNotes();
      renderClueNotes(es);
    }

    function deleteClueNote(es, noteId) {
      const list = document.getElementById("clueNotesList");
      const item = list.querySelector(`[data-note-id="${CSS.escape(noteId)}"]`);
      if (!item) return;

      item.innerHTML = `
        <div class="clue-note-text" style="color:var(--error);">${t("deleteConfirmText")}</div>
        <div class="clue-note-actions">
          <button class="clue-note-action-btn delete-btn" title="Confirm delete" onclick="confirmDeleteClueNote('${es}', '${noteId}')">${t("yesBtn")}</button>
          <button class="clue-note-action-btn" title="Cancel" onclick="renderClueNotes('${es}')">${t("cancelBtn")}</button>
        </div>
      `;
    }

    function confirmDeleteClueNote(es, noteId) {
      const notes = getWordNotes(es);
      userNotes[es] = notes.filter(n => n.id !== noteId);
      persistWordNotes();
      renderClueNotes(es);
    }

    function addClueNote() {
      const current = currentQueue[currentIndex];
      if (!current) return;
      const es = current.es;
      const notes = getWordNotes(es);
      const newId = `n${Date.now()}`;
      notes.push({ id: newId, text: "" });
      persistWordNotes();
      renderClueNotes(es);
      editClueNote(es, newId);
    }

    function updateUntestedCount() {
      if (!vocabularyList) return;
      const untested = vocabularyList.filter(item => !stats[item.es] || stats[item.es].seen === 0);
      document.getElementById("untestedCount").textContent = untested.length;
    }

    // ============================================================================
    // 12. NAVIGATION / TABS (switching between screens within a song)
    // ============================================================================
    function handleTabClick(viewName) {
      // Untested / Stats / History always open as a popup now — never an
      // inline full-page view — regardless of whether a quiz round is active.
      if (viewName === "untested" || viewName === "stats" || viewName === "history") {
        openModal(viewName);
        return;
      }

      if (isGameActive && viewName !== "setup") {
        openModal(viewName);
        return;
      }
      if (isGameActive && viewName === "setup") return;

      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));


      document.getElementById("setupView").style.display = "none";
      document.getElementById("quizView").style.display = "none";
      document.getElementById("untestedView").style.display = "none";
      document.getElementById("statsView").style.display = "none";
      document.getElementById("historyView").style.display = "none";
      document.getElementById("settingsView").style.display = "none";

      if (viewName === "setup") {
        document.getElementById("setupView").style.display = "block";
        updateFilterCounts();
        renderContinueBanner();
      } else if (viewName === "settings") {
        settingsBackTarget = "setup";
        loadSettingsIntoForm();
        document.getElementById("settingsView").style.display = "block";
      }
    }

    function toggleNavMenu() {
      document.getElementById("navMenuDropdown").classList.toggle("open");
    }

    function closeNavMenu() {
      document.getElementById("navMenuDropdown").classList.remove("open");
    }

    let settingsBackTarget = "library";

    // ============================================================================
    // 14. SETTINGS PAGE NAVIGATION
    // ============================================================================
    function openSettingsFromLibrary() {
      settingsBackTarget = "library";
      document.getElementById("libraryView").style.display = "none";
      document.getElementById("navMenuWrapper").style.display = "none";
      loadSettingsIntoForm(false);
      document.getElementById("settingsView").style.display = "block";
    }

    function closeSettingsPage() {
      document.getElementById("settingsView").style.display = "none";

      if (settingsBackTarget === "library" || !activeSongId) {
        document.getElementById("libraryView").style.display = "block";
      } else {
        document.getElementById("navMenuWrapper").style.display = "inline-block";
        handleTabClick("setup");
      }
    }

    // ============================================================================
    // 15. MODALS (generic overlay used for Stats/History/Untested/Settings
    // while a quiz round is active)
    // ============================================================================
    function openModal(viewName) {
      const modal = document.getElementById("infoModal");
      const title = document.getElementById("modalTitle");
      const body = document.getElementById("modalBody");
      body.innerHTML = "";

      if (viewName === "untested") {
        title.textContent = `${t("tabUntested")} (${getFilteredWords("untested").length})`;
        const table = document.createElement("table");
        table.innerHTML = `<thead><tr><th>${t("thSpanish")}</th><th>${t("thTranslation")}</th><th>${t("thLyric")}</th><th>${t("thClueHook")}</th></tr></thead><tbody id="modalUntestedBody"></tbody>`;
        body.appendChild(table);
        renderUntested(document.getElementById("modalUntestedBody"));
      } else if (viewName === "stats") {
        title.textContent = t("tabStats");
        const table = document.createElement("table");
        table.innerHTML = `<thead><tr><th>${t("thWord")}</th><th>${t("thMeaning")}</th><th>${t("thSeen")}</th><th>${t("thCorrect")}</th><th>${t("thAccuracy")}</th><th>${t("thNotes")}</th></tr></thead><tbody id="modalStatsBody"></tbody>`;
        body.appendChild(table);
        renderStats(document.getElementById("modalStatsBody"));
      } else if (viewName === "history") {
        title.textContent = t("tabHistory");
        const table = document.createElement("table");
        table.innerHTML = `<thead><tr><th>${t("thRound")}</th><th>${t("thFilterMode")}</th><th>${t("thDateTime")}</th><th>${t("thScore")}</th><th>${t("thAccuracy")}</th></tr></thead><tbody id="modalHistoryBody"></tbody>`;
        body.appendChild(table);
        renderHistory(document.getElementById("modalHistoryBody"));
      } else if (viewName === "settings") {
        title.textContent = t("settingsHeader");
        const wrapper = document.createElement("div");
        wrapper.innerHTML = `
          <div class="settings-field">
            <label for="modalSettingsNameInput">${t("settingsNameLabel")}</label>
            <input type="text" id="modalSettingsNameInput" class="settings-input" placeholder="Messi"
              onblur="saveSettingsField(true, 'name')" />
          </div>
          <div class="settings-field">
            <label for="modalSettingsLanguageInput">${t("settingsLanguageLabel")}</label>
            <select id="modalSettingsLanguageInput" class="settings-input"
              onchange="saveSettingsField(true, 'language')"></select>
          </div>
          <div class="settings-saved-indicator" id="modalSettingsSavedIndicator">${t("settingsSaved")}</div>
        `;
        body.appendChild(wrapper);
        loadSettingsIntoForm(true);
      }

      modal.style.display = "flex";
    }

    function closeModal() {
      document.getElementById("infoModal").style.display = "none";
    }

    // ============================================================================
    // 16. TABLE RENDERERS (Stats / History / Untested Words)
    // ============================================================================
    function renderUntested(tbody) {
      tbody.innerHTML = "";
      const untested = vocabularyList.filter(item => !stats[item.es] || stats[item.es].seen === 0);

      if (untested.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--success); padding: 1.5rem;">${t("allWordsMastered")}</td></tr>`;
        return;
      }

      untested.forEach(w => {
        const tr = document.createElement("tr");
        const wordLine = resolveWordLine(w);
        const lyricCell = wordLine
          ? `<div style="font-style: italic; color: var(--text-muted);">${getHighlightedContext(wordLine.text, w.es)}</div>
             <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">${escapeHtml(wordLine.translation || "")}</div>`
          : `<div style="font-style: italic; color: var(--text-muted);">${escapeHtml(w.context || "")}</div>`;
        tr.innerHTML = `
          <td style="font-weight: 600; color: var(--accent);">${escapeHtml(w.es)}</td>
          <td>${escapeHtml(w.en)}</td>
          <td>${lyricCell}</td>
          <td style="color: var(--accent);">${escapeHtml(w.clue || "")}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    function renderStats(tbody) {
      tbody.innerHTML = "";

      vocabularyList.forEach(w => {
        const s = stats[w.es] || { seen: 0, correct: 0, wrong: 0 };
        const acc = s.seen > 0 ? Math.round((s.correct / s.seen) * 100) + "%" : "-";
        const noteEntries = userNotes[w.es];
        const note = noteEntries ? noteEntries.map(n => n.text).join(" | ") : (w.clue || "");

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-weight:600; color: var(--accent);">${w.es}</td>
          <td>${w.en}</td>
          <td>${s.seen}</td>
          <td style="color: var(--success);">${s.correct}</td>
          <td><strong>${acc}</strong></td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${note}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    function renderHistory(tbody) {
      tbody.innerHTML = "";

      if (roundHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">${t("noRoundsYet")}</td></tr>`;
        return;
      }

      roundHistory.forEach(h => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="font-weight: 700; color: var(--accent);">Round ${h.round}</td>
          <td style="color: var(--accent);">${h.filter || "All"}</td>
          <td>${h.date}</td>
          <td>${h.score}</td>
          <td style="color: var(--success); font-weight:700;">${h.percentage}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // ============================================================================
    // 17. BOOT SEQUENCE — what runs when the page first loads
    // ============================================================================
    document.getElementById("listenBtn").onclick = () => {
      playAudio(currentQueue[currentIndex].es);
    };

    window.onclick = function(event) {
      const modal = document.getElementById("infoModal");
      const notice = document.getElementById("noticeModal");
      const lineContext = document.getElementById("lineContextModal");
      const streamingLink = document.getElementById("streamingLinkModal");
      const catalog = document.getElementById("catalogModal");
      const feedback = document.getElementById("feedbackModal");
      if (event.target === modal) closeModal();
      if (event.target === notice) closeNoticeModal();
      if (event.target === lineContext) closeLineContextModal();
      if (event.target === streamingLink) closeStreamingLinkModal();
      if (event.target === catalog) closeCatalogModal();
      if (event.target === feedback) closeFeedbackModal();

      const navMenuWrapper = document.getElementById("navMenuWrapper");
      if (navMenuWrapper && !navMenuWrapper.contains(event.target)) {
        closeNavMenu();
      }

      const streamingWrapper = document.getElementById("songInfoStreamingWrapper");
      if (streamingWrapper && !streamingWrapper.contains(event.target)) {
        closeStreamingMenu();
      }
    };

    // Immediate initial mount execution
    DB.songs.loadCustomIntoLibrary();
    mergeSurroundingLines();
    mergeLineOrder();
    applyHiddenSongs();
    populateLanguageSelect(document.getElementById("settingsLanguageInput"));
    applyTranslations();
    initSupabaseAuth();

    // Lazily fetch any songs from the external data repo, if one is present
    // alongside this file (see the DATA REPO section above). This runs in
    // the background and never blocks startup — the app is already fully
    // usable on demo songs before this even starts, and stays that way if
    // the fetch fails or the data folder simply doesn't exist.
    loadSongsFromDataRepo().then(mergeDataRepoSongsIntoLibrary);

    // Register the offline service worker if one is present alongside this
    // file (sw.js). This is entirely optional — the app works exactly the
    // same without it, just without offline caching. Registration only
    // succeeds when served over HTTPS or localhost; it's silently skipped
    // when opened directly as a local file (file://) since browsers block
    // service workers there.
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {
          // sw.js not found or registration failed — app still works fine
        });
      });
    }
