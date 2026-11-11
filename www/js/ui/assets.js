// Tải asset theo manifest. Thiếu file thì getImg trả null và UI tự vẽ hình khối thay thế.
const images = new Map();

export const getImg = (key) => images.get(key) ?? null;

function loadImage(src) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

// onProgress(done, total). Không bao giờ ném lỗi: manifest hỏng hoặc thiếu thì chạy với hình khối.
export async function preloadAssets(onProgress = () => {}) {
  let manifest;
  try {
    manifest = await (await fetch('assets/manifest.json')).json();
  } catch {
    return { loaded: 0, total: 0 };
  }
  const entries = Object.entries(manifest.images ?? {});
  let done = 0;
  let loaded = 0;
  onProgress(0, entries.length);
  // Giới hạn song song để không nghẽn máy yếu.
  const queue = entries.slice();
  const worker = async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const im = await loadImage(e[1]);
      if (im) {
        images.set(e[0], im);
        loaded++;
      }
      onProgress(++done, entries.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { loaded, total: entries.length };
}
