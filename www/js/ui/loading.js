// Màn hình tải: Tòa Tháp sáng dần từng tầng theo tiến độ, mẹo xoay vòng, chạm để vào.
// Dùng cả để che thời gian tải lẫn dạy luật chơi / giới thiệu thế giới (tips) và mở khóa âm thanh bằng cái chạm đầu tiên.
const NS = 'http://www.w3.org/2000/svg';
const FLOORS = 12;
const TIP_COUNT = 8;
const TIP_MS = 3600;

function towerSVG() {
  let tiers = '';
  for (let i = 0; i < FLOORS; i++) {
    const y1 = 700 - i * 40;
    const y0 = y1 - 40;
    const w1 = 92 - i * 6.5;
    const w0 = 92 - (i + 1) * 6.5;
    tiers += `<path d="M${200 - w1} ${y1} L${200 - w0} ${y0} L${200 + w0} ${y0} L${200 + w1} ${y1}Z" fill="#151842" stroke="#07081c" stroke-width="1.5"/>`;
    tiers += `<g class="fl" data-i="${i}"><rect x="${200 - w0 * 0.5}" y="${y0 + 12}" width="${w0}" height="12" rx="6" fill="#ffd98a"/><ellipse cx="200" cy="${y0}" rx="${w0 + 8}" ry="4" fill="none" stroke="#e2b75a" stroke-width="1.6"/></g>`;
  }
  return `<svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" xmlns="${NS}" aria-hidden="true">
<defs><linearGradient id="ld-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050619"/><stop offset=".6" stop-color="#1b1a5a"/><stop offset="1" stop-color="#2a3a86"/></linearGradient>
<radialGradient id="ld-gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd98a" stop-opacity=".5"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>
<rect width="400" height="800" fill="url(#ld-sky)"/>
<g transform="translate(0 -110)"><circle class="ld-glow" cx="200" cy="420" r="230" fill="url(#ld-gl)"/>${tiers}
<path d="M200 190 L216 230 L200 250 L184 230Z" fill="#ffe9ad" class="ld-gem"/></g></svg>`;
}

// Trả { el, setProgress(0..1), ready(): Promise } — ready() hiện lời nhắc "chạm để vào" và resolve khi người chơi chạm.
export function createLoading({ t, title, subtitle, auto = false }) {
  const el = document.createElement('div');
  el.className = 'loading';
  const bar = document.createElement('i');
  const pct = document.createElement('span');
  const tip = document.createElement('p');
  tip.className = 'ld-tip';
  const tap = document.createElement('p');
  tap.className = 'ld-tap';
  el.innerHTML = towerSVG();
  const box = document.createElement('div');
  box.className = 'ld-box';
  const h1 = document.createElement('h1');
  h1.textContent = title;
  // Logo thật; nếu ảnh không tải được thì giữ chữ tiêu đề.
  const logo = new Image();
  logo.className = 'ld-logo';
  logo.alt = title;
  logo.onload = () => h1.replaceChildren(logo);
  logo.src = 'assets/ui/logo.webp';
  const sub = document.createElement('div');
  sub.className = 'ld-sub';
  sub.textContent = subtitle;
  const track = document.createElement('div');
  track.className = 'ld-track';
  track.append(bar);
  box.append(h1, ...(subtitle && subtitle !== title ? [sub] : []), track, pct, tip, tap);
  el.append(box);

  const floors = [...el.querySelectorAll('.fl')];
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
    floors.forEach((f, i) => f.classList.toggle('on', v * FLOORS > i));
  };
  setProgress(0);

  const ready = () => new Promise((resolve) => {
    setProgress(1);
    if (auto) { clearInterval(timer); resolve(); return; }
    tap.textContent = t('load.tap');
    el.classList.add('done');
    el.addEventListener('pointerdown', () => { clearInterval(timer); resolve(); }, { once: true });
  });
  return { el, setProgress, ready };
}
