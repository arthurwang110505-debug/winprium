// AI 剪輯助理 — Service Worker
// 策略:App Shell 快取優先、頁面導航網路優先(失敗回快取)、API 請求永不快取。

const CACHE = "winprium-studio-v1";
const SHELL = ["./"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API(Agnes)與非 GET:直接穿透,絕不快取
  if (event.request.method !== "GET" || url.hostname.includes("agnes-ai.com")) {
    return;
  }

  // 頁面導航:網路優先,離線時回退到 App Shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() =>
          caches.match(event.request).then((hit) => hit || caches.match("./"))
        )
    );
    return;
  }

  // 同源靜態資源:快取優先,背景補快取
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(
        (hit) =>
          hit ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          })
      )
    );
  }
});
