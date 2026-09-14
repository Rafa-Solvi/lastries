// Service worker de Lastries (research R5). Plantilla: scripts/gen-sw-manifest.ts sustituye
// __PRECACHE__ y __VERSION__ y escribe dist/sw.js.
const VERSION = "__VERSION__";
const PRECACHE = __PRECACHE__;
const CACHE = `lastries-${VERSION}`;

self.addEventListener("install", (event) => {
  // Sin skipWaiting automático: la versión nueva queda en espera.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("lastries-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(caches.match("./index.html", { ignoreSearch: true }).then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "GET_VERSION") {
    event.ports[0]?.postMessage({ version: VERSION });
  } else if (data.type === "ACTIVATE") {
    // Único punto donde se llama a skipWaiting: petición explícita desde Ajustes.
    self.skipWaiting();
  }
});
