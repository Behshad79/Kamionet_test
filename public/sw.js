/* Kamionet driver PWA: app-shell cache. Pages are network-first (fresh code), static assets cache-first. */
const CACHE = "kamionet-shell-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const isAsset = /\/_next\/static\/|\/icons\/|\.woff2?$/.test(req.url);
  if (isAsset) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return res; })));
    return;
  }
  e.respondWith(fetch(req).then((res) => { if (res.ok && req.mode === "navigate") { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); } return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match("./driver/"))));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const href = (e.notification.data && e.notification.data.href) || "./";
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => { for (const c of cs) { if ("focus" in c) { c.navigate(href); return c.focus(); } } return self.clients.openWindow(href); }));
});
