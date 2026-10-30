/* Rumbo: permite abrir la app sin señal. La página siempre se pide primero a internet (así llegan las
   actualizaciones); si no hay señal o tarda más de 4 s, se usa la última copia guardada. Los datos no pasan por aquí. */
const CACHE = 'rumbo-v2';
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-180.png'];
const CDN = /^(www\.gstatic\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)$/;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    e.respondWith((async () => {
      const nav = r.mode === 'navigate';
      const key = nav ? './' : r;
      const net = fetch(r).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      });
      const cached = await caches.match(key, { ignoreSearch: true });
      if (!cached) return net;
      return Promise.race([
        net.catch(() => cached),
        new Promise(ok => setTimeout(() => ok(cached), 4000))
      ]);
    })());
    return;
  }
  if (CDN.test(u.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(r);
      const net = fetch(r).then(res => {
        if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })());
  }
});
