// Dữ liệu offline: tải trước toàn bộ tệp của game vào Cache Storage để chơi không cần mạng.
// Danh sách tệp lấy từ precache.json (sinh bởi tools/gen-precache.js). Service worker (sw.js) phục vụ từ cùng bộ nhớ đệm.
export const CACHE_NAME = 'rsp-v1';

export const offlineSupported = () => typeof caches !== 'undefined' && 'serviceWorker' in navigator;

async function manifest() {
  const res = await fetch('precache.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('precache.json');
  return res.json();
}

// { have, total, bytes } — số tệp đã có trong bộ nhớ đệm trên tổng số.
export async function offlineStatus() {
  const m = await manifest();
  const cache = await caches.open(CACHE_NAME);
  let have = 0;
  await Promise.all(m.files.map(async (f) => { if (await cache.match(f.u)) have++; }));
  return { have, total: m.files.length, bytes: m.bytes };
}

// Tải (hoặc làm mới) mọi tệp; onProgress(done, total). Ném lỗi nếu mất mạng giữa chừng.
export async function downloadOffline(onProgress = () => {}) {
  const m = await manifest();
  const cache = await caches.open(CACHE_NAME);
  const queue = m.files.slice();
  let done = 0;
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const res = await fetch(f.u, { cache: 'reload' });
      if (!res.ok) throw new Error(`${f.u}: ${res.status}`);
      await cache.put(f.u, res);
      onProgress(++done, m.files.length);
    }
  };
  onProgress(0, m.files.length);
  await Promise.all([worker(), worker(), worker(), worker()]);
}

export async function clearOffline() {
  return caches.delete(CACHE_NAME);
}

export const formatMB = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;
