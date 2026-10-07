// Offline support for the installed game. Network first, so a new release is
// picked up as soon as the device is online; the cache is only a fallback.
const CACHE = "super-pupa-run-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    // Always check with the server (a cheap 304 when nothing changed) so an
    // update never mixes a new page with an older script or stylesheet.
    fetch(new Request(request.url, { cache: "no-cache", credentials: "same-origin" }))
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
