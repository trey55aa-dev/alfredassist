// Alfred service worker — offline shell + asset cache.
// Strategy: network-first for navigation (SPA shell), stale-while-revalidate
// for static assets, pass-through for all external APIs.

// Bump this version whenever cached behaviour changes — the activate handler
// deletes every cache that isn't the current one, purging stale assets so a
// restart can never serve an old bundle.
const CACHE = "alfred-v2";
const SHELL = ["/", "/index.html"];

// External origins that must never be intercepted
const BYPASS_HOSTS = [
  "supabase.co",
  "googleapis.com",
  "accounts.google.com",
  "graph.microsoft.com",
  "login.microsoftonline.com",
  "somafm.com",
  "ice1.somafm.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;

  // SPA navigation: always pull a fresh shell from the network (bypassing the
  // HTTP cache) so new builds load immediately; fall back to cache when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        });
        return cached || network;
      })
    )
  );
});
