// Offline support for the installed game. Network first, so a new release is
// picked up as soon as the device is online; the cache is only a fallback.
const CACHE = "super-pupa-run-v51-knights";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20261012e",
  "./game.js?v=20261012e",
  "./cards-engine.js?v=20261012e",
  "./cards-fx.js?v=20261012e",
  "./cards-3d.js",
  "./cards.js?v=20261012e",
  "./cards.css?v=20261012e",
  "./pupa3d.js?v=20261014l",
  "./config.js?v=20261011a",
  "./account.js?v=20261011h",
  "./manifest.json",
  "./vendor/three-bundle.min.js",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/cherry-night.webp",
  "./assets/thorn-shroom.webp",
  "./assets/pupa.glb",
  "./assets/pupa-texture.webp",
  "./assets/pupa-hero-3d.webp",
  "./assets/pupa-hero.webp",
  "./assets/pupa-run-1.webp",
  "./assets/pupa-run-2.webp",
  "./assets/pupa-run-3.webp",
  "./assets/pupa-run-4.webp",
  "./assets/pupa-run-5.webp",
  "./assets/pupa-run-6.webp",
  "./assets/jibjib.glb",
  "./assets/jibjib-texture.webp",
  "./assets/jibjib-hero.webp",
  "./assets/dragon.glb",
  "./assets/dragon-texture.webp",
  "./assets/dragon-pet.webp",
  "./assets/baitoey.glb",
  "./assets/baitoey-texture.webp",
  "./assets/baitoey-hero.webp",
  "./assets/ikuya.glb",
  "./assets/ikuya-texture.webp",
  "./assets/ikuya-hero.webp",
  "./assets/pangji.glb",
  "./assets/pangji-texture.webp",
  "./assets/pangji-hero.webp",
  "./assets/pupav2.glb",
  "./assets/pupav2-texture.webp",
  "./assets/pupav2-hero.webp",
  "./assets/pumpkin.glb",
  "./assets/sakura-hero.webp",
  "./assets/chantra-hero.webp",
  "./assets/thongkham-hero.webp",
  "./assets/miu-hero.webp",
  "./assets/ratri-hero.webp",
  "./assets/phloeng-hero.webp",
  "./assets/mekha-hero.webp",
  "./assets/fasai-hero.webp",
  "./assets/moonrabbit-pet.webp",
  "./assets/starowl-pet.webp",
  "./assets/silverwolf-pet.webp",
  "./assets/seraphina-hero.webp",
  "./assets/asani-hero.webp",
  "./assets/phoenix-pet.webp",
  "./assets/vajira-hero.webp",
  "./assets/chada-hero.webp",
  "./assets/anchan-hero.webp",
  "./assets/phayak-hero.webp",
  "./assets/wayu-hero.webp",
  "./assets/sila-hero.webp",
  "./assets/nilakan-hero.webp",
  "./assets/arunee-hero.webp",
  "./assets/pupa-card.webp",
  "./assets/minibat-pet.webp",
  "./assets/starsprite-pet.webp",
  "./assets/firefly-pet.webp",
  "./assets/kitten-pet.webp",
  "./assets/naphalai-hero.webp",
  "./assets/qilin-pet.webp",
  "./assets/boss-serpent.webp",
  "./assets/boss-golem.webp",
  "./assets/boss-icedragon.webp",
  "./assets/boss-reaper.webp",
  "./assets/boss-kraken.webp",
  "./assets/news-world6.webp",
  "./assets/news-world7.webp",
  "./assets/news-world8.webp",
  "./assets/news-world9.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});
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
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
