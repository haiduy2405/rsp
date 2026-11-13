import { goldTitle } from './title.js';
// Màn hình tải: Tòa Tháp sáng dần từng tầng theo tiến độ, mẹo xoay vòng, chạm để vào.
// Dùng cả để che thời gian tải lẫn dạy luật chơi / giới thiệu thế giới (tips) và mở khóa âm thanh bằng cái chạm đầu tiên.
const TIP_COUNT = 8;
const TIP_MS = 3600;

function enterFullscreen() {
  const d = document.documentElement;
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone || document.fullscreenElement || !d.requestFullscreen) return; // iOS Safari không hỗ trợ; app cài sẵn đã toàn màn hình
  try { d.requestFullscreen({ navigationUI: 'hide' })?.catch(() => {}); } catch { /* bị từ chối: bỏ qua */ }
}

// Trả { el, setProgress(0..1), ready(): Promise } — ready() hiện lời nhắc "chạm để vào" và resolve khi người chơi chạm.
import { sceneEl } from './hub-art.js';

export function createLoading({ t, title, subtitle, version = '', auto = false }) {
  const el = document.createElement('div');
  el.className = 'loading';
  const bar = document.createElement('i');
  const pct = document.createElement('span');
  const tip = document.createElement('p');
  tip.className = 'ld-tip';
  const tap = document.createElement('p');
  tap.className = 'ld-tap';
  const art = sceneEl('0 0 400 800', 'ld-art'); // cảnh Tòa Tháp động (cùng màn chính), trôi chậm
  el.append(art);
  const rays = document.createElement('div'); // tia sáng xoay chậm sau Tòa Tháp
  rays.className = 'ld-rays';
  el.append(rays);
  for (let i = 0; i < 16; i++) { // đom đóm vàng bay lên (chỉ UI)
    const m = document.createElement('i');
    m.className = 'ld-mote';
    m.style.cssText = `left:${(i * 61 + 7) % 96 + 2}%;--dx:${((i * 37) % 60) - 30}px;animation-duration:${(7 + (i % 5) * 1.6).toFixed(1)}s;animation-delay:${(-i * 0.9).toFixed(1)}s`;
    el.append(m);
  }
  const box = document.createElement('div');
  box.className = 'ld-box';
  const h1 = document.createElement('h1');
  h1.textContent = title;
  // Tên game: chữ vàng gold 3D, có ánh đèn quét ngang (CSS .gold3d)
  goldTitle(h1, title, subtitle);
  const sub = document.createElement('div');
  sub.className = 'ld-sub';
  sub.textContent = subtitle;
  const track = document.createElement('div');
  track.className = 'ld-track';
  track.append(bar);
  const top = document.createElement('div');
  top.className = 'ld-top';
  top.append(h1);
  box.append(track, pct, tip, tap);
  el.append(top, box);
  if (version) {
    const ver = document.createElement('div');
    ver.className = 'ld-ver';
    ver.textContent = version;
    el.append(ver);
  }

  let n = Math.floor(Math.random() * TIP_COUNT); // chỉ UI, không phải core
  const showTip = () => {
    tip.classList.remove('in');
    void tip.offsetWidth;
    tip.textContent = t(`load.tip.${(n++ % TIP_COUNT) + 1}`);
    tip.classList.add('in');
  };
  showTip();
  const timer = setInterval(showTip, TIP_MS);

  const setProgress = (p) => {
    const v = Math.max(0, Math.min(1, p));
    bar.style.width = `${v * 100}%`;
    pct.textContent = `${Math.round(v * 100)}%`;
  };
  setProgress(0);

  const ready = () => new Promise((resolve) => {
    setProgress(1);
    if (auto) { clearInterval(timer); resolve(); return; }
    tap.textContent = t('load.tap');
    el.classList.add('done');
    // Phím/chạm bất kỳ: vào game và đẩy toàn màn hình ngay trong cử chỉ của người chơi (pointerup mới tính là kích hoạt trên cảm ứng).
    const go = () => {
      el.removeEventListener('pointerup', go);
      removeEventListener('keydown', go);
      clearInterval(timer);
      enterFullscreen();
      resolve();
    };
    el.addEventListener('pointerup', go);
    addEventListener('keydown', go);
  });
  return { el, setProgress, ready };
}
