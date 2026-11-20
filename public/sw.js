/* Dorm Happy Hub PWA service worker.
 * Cache only same-origin static assets. Never cache authenticated pages,
 * Supabase/API requests, tenant records, payment data, or login responses.
 */
const CACHE_NAME = "dorm-happy-hub-static-v1";
const OFFLINE_URL = "/offline.html";
const APP_SHELL_ASSETS = [OFFLINE_URL, "/dorm-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith("dorm-happy-hub-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => {
      const offline = await caches.match(OFFLINE_URL);
      return offline || new Response("กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อใช้งาน Dorm Happy Hub", {
        status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }));
    return;
  }
  const isStaticAsset = ["script", "style", "image", "font"].includes(request.destination)
    || url.pathname.startsWith("/assets/");
  if (!isStaticAsset) return;
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response?.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  }));
});
