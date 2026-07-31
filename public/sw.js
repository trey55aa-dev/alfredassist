// Alfred service worker — offline shell + asset cache.
// Strategy: network-first for navigation (SPA shell), stale-while-revalidate
// for static assets, pass-through for all external APIs.

// Bump this version whenever cached behaviour changes — the activate handler
// deletes every cache that isn't the current one, purging stale assets so a
// restart can never serve an old bundle.
const CACHE = "alfred-v4";
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

// ── Web Push: show Alfred's briefing even when the app is closed ──
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_e) { data = {}; }
  const title = data.title || "Alfred";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "alfred-briefing",
    renotify: true,
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab (or open one) at the briefing's target when tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
