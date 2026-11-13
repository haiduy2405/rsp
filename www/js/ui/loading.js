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
  const viFirst = /[^\x00-\x7F]/.test(title) || !/[^\x00-\x7F]/.test(subtitle || ''); // tên tiếng Việt luôn ở trên
  arcTitle(art.querySelector('svg'), viFirst ? title : subtitle, viFirst ? subtitle : title);
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
  const sub = document.createElement('div');
  sub.className = 'ld-sub';
  sub.textContent = subtitle;
  const track = document.createElement('div');
  track.className = 'ld-track';
  track.append(bar);
  box.append(track, pct, tip, tap);
  el.append(box);
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

// Tên game uốn theo vòm cầu vồng (tâm 200,330 trong viewBox cảnh): tên chính chữ vàng viền nâu, tên phụ nhỏ hơn ở vòng ngoài.
function arcTitle(svg, main, sub) {
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs, txt) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (txt) e.textContent = txt; return e; };
  const defs = mk('defs', {});
  const grad = mk('linearGradient', { id: 'arcGold', x1: 0, y1: 0, x2: 0, y2: 1 });
  [['0', '#fff6c0'], ['.5', '#ffd75a'], ['1', '#e8921c']].forEach(([o, c]) => grad.append(mk('stop', { offset: o, 'stop-color': c })));
  defs.append(grad);
  const arc = (id, r) => mk('path', { id, d: `M${200 - r} 330A${r} ${r} 0 0 1 ${200 + r} 330`, fill: 'none' });
  defs.append(arc('arcA', 164), arc('arcB', 135));
  svg.append(defs);
  const g = mk('g', { class: 'arc-title' });
  const rows = [];
  const line = (id, txt, size, budget) => {
    const mkText = (cls, extra) => { const t = mk('text', { class: cls, 'font-size': size, 'text-anchor': 'middle', ...extra }); const tp = mk('textPath', { href: `#${id}`, startOffset: '50%' }, txt); t.append(tp); return t; };
    const shadow = mkText('arc-sh', { dy: 3 });
    const body = mkText('arc-tx', {});
    g.append(shadow, body);
    rows.push({ nodes: [shadow, body], size, budget });
  };
  line('arcA', main.toUpperCase(), 36, 372);
  if (sub) line('arcB', sub.toUpperCase(), 19, 262);
  const tw = svg.querySelector('.tower'); // chữ nằm dưới Tháp để đỉnh Tháp đè lên chữ, không bị chữ che
  if (tw) tw.parentNode.insertBefore(g, tw); else svg.append(g);
  const fit = () => rows.forEach((r) => {
    r.nodes.forEach((n) => n.setAttribute('font-size', r.size));
    const w = r.nodes[1].getComputedTextLength?.() || 0;
    if (!w) return;
    const k = Math.min(1.5, r.budget / w);
    r.nodes.forEach((n) => n.setAttribute('font-size', (r.size * k).toFixed(1)));
  });
  requestAnimationFrame(fit);
  document.fonts?.ready.then(fit);
  document.fonts?.load?.("900 34px Fraunces").then(fit).catch(() => {});
  setTimeout(fit, 600);
}
