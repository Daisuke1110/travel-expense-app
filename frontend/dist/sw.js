const CACHE_NAME = "travel-expense-static-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isStaticAsset =
    ["script", "style", "image", "font", "manifest"].includes(
      req.destination,
    ) || url.pathname === "/manifest.webmanifest";

  // APIはキャッシュしない
  if (url.pathname.startsWith("/trips") || url.pathname.startsWith("/me"))
    return;

  // SPA遷移は index.html を返す
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }

  // 静的アセットは Cache First
  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return res;
          })
        );
      }),
    );
  }
});
