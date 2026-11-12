// Pháo hoa triệu hồi: mỗi mục tiêu có một viên pháo bay từ đáy lên đúng chỗ thẻ rồi nổ; thẻ hiện ra khi pháo nổ.
// Chỉ là hiệu ứng UI (dùng Math.random và đồng hồ trình duyệt, không đụng core).
const COLORS = {
  3: ['#bfe0ff', '#ffffff', '#8ec5ff'],
  4: ['#e3b8ff', '#ff9be8', '#c58bff'],
  5: ['#fff0a0', '#ffd84a', '#ffb347', '#ffffff'],
};
const FLIGHT = 620;

// host: phần tử có position:relative. targets: [{ rarity, el }]. onPop(i): thẻ i hiện ra. Trả { skip() }.
export function playFireworks(host, targets, { onPop, onDone, sfx, big = false, reduced = false }) {
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    cv.remove();
    targets.forEach((_, i) => pop(i));
    onDone?.();
  };
  let done = false;
  let raf = 0;
  const popped = new Set();
  const pop = (i) => { if (!popped.has(i)) { popped.add(i); onPop?.(i); } };
  const cv = document.createElement('canvas');
  cv.className = 'fw-cv';
  host.append(cv);
  if (reduced) { finish(); return { skip() {} }; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const hr = host.getBoundingClientRect();
  cv.width = Math.round(hr.width * dpr);
  cv.height = Math.round(hr.height * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);

  const n = targets.length;
  const gap = n > 1 ? 150 : 0;
  const rockets = targets.map((tg, i) => {
    const r = tg.el.getBoundingClientRect();
    const tx = r.left - hr.left + r.width / 2;
    const ty = r.top - hr.top + r.height / 2;
    return { i, rarity: tg.rarity, tx, ty, sx: tx + (Math.random() - 0.5) * 90, sy: hr.height + 10, t0: 280 + i * gap + (Math.random() * 60 | 0), burst: false };
  });
  const parts = [];
  const lastEnd = Math.max(...rockets.map((r) => r.t0 + FLIGHT)) + 900;
  const start = performance.now();
  let whooshed = 0;

  function explode(r) {
    const cols = COLORS[r.rarity] || COLORS[3];
    const count = (r.rarity === 5 ? 60 : r.rarity === 4 ? 44 : 32) * (big ? 1.6 : 1);
    const sp = (r.rarity === 5 ? 190 : 150) * (big ? 1.5 : 1);
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + Math.random() * 0.2;
      const v = sp * (0.35 + Math.random() * 0.65);
      parts.push({ x: r.tx, y: r.ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 650 + Math.random() * 450, c: cols[k % cols.length], s: 1.6 + Math.random() * (r.rarity === 5 ? 2.4 : 1.6) });
    }
    pop(r.i);
    sfx?.(r.rarity >= 4 ? 'rare' : 'reveal');
  }

  let prev = start;
  function frame(now) {
    if (done) return;
    const t = now - start;
    const dt = Math.min(50, now - prev) / 1000;
    prev = now;
    g.clearRect(0, 0, hr.width, hr.height);
    g.globalCompositeOperation = 'lighter';
    for (const r of rockets) {
      const k = (t - r.t0) / FLIGHT;
      if (k < 0) continue;
      if (k < 1) {
        if (!r.whoosh && whooshed < 3) { r.whoosh = true; whooshed++; sfx?.('move'); }
        const e = 1 - (1 - k) * (1 - k);
        const x = r.sx + (r.tx - r.sx) * e;
        const y = r.sy + (r.ty - r.sy) * e;
        const x0 = r.sx + (r.tx - r.sx) * (1 - (1 - Math.max(0, k - 0.12)) ** 2);
        const y0 = r.sy + (r.ty - r.sy) * (1 - (1 - Math.max(0, k - 0.12)) ** 2);
        g.strokeStyle = 'rgba(255, 220, 150, .75)';
        g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x, y); g.stroke();
        g.fillStyle = '#fff6d8';
        g.beginPath(); g.arc(x, y, 3.2, 0, 6.3); g.fill();
      } else if (!r.burst) { r.burst = true; explode(r); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt * 1000;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      p.vy += 220 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const a = 1 - p.life / p.max;
      g.globalAlpha = a;
      g.fillStyle = p.c;
      g.beginPath(); g.arc(p.x, p.y, p.s * (0.5 + a * 0.5), 0, 6.3); g.fill();
    }
    g.globalAlpha = 1;
    if (t >= lastEnd && !parts.length) return finish();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { skip: finish };
}
