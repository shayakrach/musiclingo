// MusicLingo — offline service worker
// Caches the app shell so it can still open without a network connection
// once it's been visited at least once.

const CACHE_NAME = "musiclingo-cache-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/style.css",
  "./assets/app.js",
  "./assets/icons/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        // Fetch with no-store rather than cache.addAll()'s default request
        // behavior — otherwise the browser's own HTTP cache can hand back a
        // stale response here, baking staleness straight into a "fresh"
        // precache on install.
        APP_SHELL.map((url) =>
          fetch(url, { cache: "no-store" }).then((response) => {
            if (response && response.status === 200) return cache.put(url, response);
          })
        )
      ))
      .catch(() => {
        // If the exact filenames don't match (e.g. hosted under a different
        // name), installation still succeeds — caching just happens lazily
        // via the fetch handler below instead.
      })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // no-store: without this, the browser's own HTTP cache can hand back
      // a stale response here even though we're explicitly trying to
      // revalidate — silently defeating this whole background-refresh step.
      const networkFetch = fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      // Serve from cache instantly if we have it, but still refresh the
      // cache in the background so updates aren't stuck forever.
      return cached || networkFetch;
    })
  );
});
