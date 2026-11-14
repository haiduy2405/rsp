// Service worker: chơi offline. Mã/JSON ưu tiên mạng (luôn mới); ảnh/âm thanh/font lấy từ cache và làm mới ngầm.
// Tên bộ nhớ đệm phải khớp CACHE_NAME trong js/ui/offline.js (nút "Tải dữ liệu offline" ghi vào cùng chỗ).
const CACHE = 'rsp-v1';
// build: 0.125.0 #238 (tools/stamp-version.js ghi đè dòng này mỗi bản dựng → sw.js đổi byte → trình duyệt cài SW mới)
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
      ? caches.match(req).then((hit) => {
          const net = fetch(req, { cache: 'no-cache' }).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return res; });
          return hit || net;
        })
      : fetch(req, { cache: 'no-cache' }).then((res) => { const c = res.clone(); caches.open(CACHE).then((x) => x.put(req, c)); return res; }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html'))),
  );
});
