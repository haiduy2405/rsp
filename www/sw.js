// Service worker: chơi offline sau lần tải đầu. Mã/JSON ưu tiên mạng (luôn mới), ảnh/âm thanh ưu tiên cache.
const CACHE = 'rsp-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const heavy = /\.(webp|png|jpg|mp3|ogg|wav|woff2?)$/i.test(new URL(req.url).pathname);
  e.respondWith(
    heavy
      ? caches.match(req).then((hit) => hit || fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return res; }))
      : fetch(req).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
