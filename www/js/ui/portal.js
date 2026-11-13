// Nghi thức triệu hồi: pháp trận phát sáng -> nạp năng lượng -> cột sáng bùng nổ -> thẻ bay ra khỏi cổng từng tấm (hiếm nhất ra cuối).
// Chỉ là hiệu ứng UI (Math.random, đồng hồ trình duyệt; không đụng core).
const COL = { 3: [120, 190, 255], 4: [196, 128, 255], 5: [255, 216, 74] };
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const WHITE = [255, 248, 225];
const CHARGE = 1500; // ms nạp năng lượng
const BURST = 650;   // ms bùng nổ
const GAP = 300;     // ms giữa hai thẻ
const FLY = 420;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (k) => 1 - (1 - k) * (1 - k) * (1 - k);

function circle(g, cx, cy, R, rot, col, power, alpha = 1) {
  g.save();
  g.translate(cx, cy);
  g.globalAlpha = alpha;
  const gl = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.35);
  gl.addColorStop(0, rgb(col, 0.35 + 0.4 * power));
  gl.addColorStop(0.6, rgb(col, 0.12 + 0.15 * power));
  gl.addColorStop(1, rgb(col, 0));
  g.fillStyle = gl;
  g.beginPath(); g.arc(0, 0, R * 1.35, 0, 6.3); g.fill();
  g.strokeStyle = rgb(mix(col, WHITE, 0.45), 0.95);
  g.lineCap = 'round';
  // vòng ngoài + vạch chia
  g.lineWidth = Math.max(2, R * 0.025);
  g.beginPath(); g.arc(0, 0, R, 0, 6.3); g.stroke();
  g.beginPath(); g.arc(0, 0, R * 0.93, 0, 6.3); g.stroke();
  g.save(); g.rotate(rot);
  for (let i = 0; i < 48; i++) { const a = (i / 48) * 6.283; const l = i % 4 === 0 ? 0.1 : 0.05; g.beginPath(); g.moveTo(Math.cos(a) * R * (0.93 - l), Math.sin(a) * R * (0.93 - l)); g.lineTo(Math.cos(a) * R * 0.93, Math.sin(a) * R * 0.93); g.stroke(); }
  g.restore();
  // vòng nét đứt quay ngược + ký tự
  g.save(); g.rotate(-rot * 1.4);
  g.setLineDash([R * 0.07, R * 0.05]); g.lineWidth = Math.max(1.5, R * 0.02);
  g.beginPath(); g.arc(0, 0, R * 0.78, 0, 6.3); g.stroke();
  g.setLineDash([]);
  for (let i = 0; i < 8; i++) { g.save(); g.rotate((i / 8) * 6.283); g.translate(R * 0.66, 0); g.fillStyle = rgb(mix(col, WHITE, 0.6), 0.9); g.beginPath(); g.moveTo(0, -R * 0.045); g.lineTo(R * 0.04, 0); g.lineTo(0, R * 0.045); g.lineTo(-R * 0.04, 0); g.closePath(); g.fill(); g.restore(); }
  g.restore();
  // hai tam giác đan nhau (lục mang)
  g.save(); g.rotate(rot * 0.7);
  g.lineWidth = Math.max(2, R * 0.03);
  for (const flip of [0, 1]) { g.beginPath(); for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.283 + (flip ? Math.PI / 3 : 0) - Math.PI / 2; const x = Math.cos(a) * R * 0.58; const y = Math.sin(a) * R * 0.58; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  g.restore();
  // lõi
  const c = g.createRadialGradient(0, 0, 0, 0, 0, R * (0.16 + 0.1 * power));
  c.addColorStop(0, 'rgba(255,255,255,1)'); c.addColorStop(0.5, rgb(mix(col, WHITE, 0.5), 0.85)); c.addColorStop(1, rgb(col, 0));
  g.fillStyle = c; g.beginPath(); g.arc(0, 0, R * (0.16 + 0.1 * power), 0, 6.3); g.fill();
  g.restore();
}

// host: phần tử position:relative. targets: [{ rarity, el }]. Trả { el (vùng chạm), start(), skip(), canSkip }.
export function createRitual(host, targets, { onPop, onDone, onStart, sfx, big = false, reduced = false, seen = false, tip = '', skipLabel = 'Skip', vibrate }) {
  const hr = host.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.className = 'fw-cv rt-cv';
  cv.width = Math.round(hr.width * dpr); cv.height = Math.round(hr.height * dpr);
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const W = hr.width, H = hr.height;
  const cx = W / 2, cy = H * 0.46;
  const R = Math.min(W * 0.36, 150);
  const maxR = Math.max(...targets.map((x) => x.rarity));
  const fin = COL[maxR] || COL[3];
  const hit = document.createElement('div');
  hit.id = 'lp-orb'; hit.className = 'rt-hit'; hit.setAttribute('role', 'button'); hit.tabIndex = 0;
  hit.style.cssText = `left:${cx - R}px;top:${cy - R}px;width:${R * 2}px;height:${R * 2}px`;
  const tipEl = document.createElement('div'); tipEl.className = 'rt-tip'; tipEl.textContent = tip;
  tipEl.style.top = `${cy + R + 22}px`;
  host.append(cv, hit, tipEl);

  const popped = new Set();
  const pop = (i) => { if (!popped.has(i)) { popped.add(i); onPop?.(i); } };
  let state = 'idle'; let raf = 0; let t0 = 0; let vt = 0; let prev = 0; let speed = 1; let finished = false; let fast = false;
  const parts = []; const rings = []; const comets = [];
  let skipBtn = null;
  // thứ tự lật: thấp -> cao, thẻ hiếm nhất ra cuối
  const order = targets.map((x, i) => i).sort((a, b) => targets[a].rarity - targets[b].rarity || a - b);
  const sched = []; // { at, i }
  let acc = CHARGE + BURST;
  order.forEach((i) => { const r = targets[i].rarity; if (r === 5) acc += 450; sched.push({ at: acc, i, fired: false, landed: false }); acc += r === 5 ? GAP + 350 : GAP; });
  const total = acc + FLY + 800;

  const finish = () => {
    if (finished) return;
    finished = true; cancelAnimationFrame(raf);
    cv.remove(); hit.remove(); tipEl.remove(); skipBtn?.remove();
    targets.forEach((_, i) => pop(i));
    host.classList.remove('rt-shake', 'rt-src', 'lp-on');
    onDone?.();
  };

  const spark = (x, y, col, n, sp, life = 700) => { for (let k = 0; k < n; k++) { const a = Math.random() * 6.283; const v = sp * (0.3 + Math.random() * 0.7); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: life * (0.6 + Math.random() * 0.6), c: col, s: 1.4 + Math.random() * 2.2, gy: 120 }); } };

  const flash = () => { const f = document.getElementById('flash'); if (!f) return; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); };

  function frame(now) {
    if (finished) return;
    const dtr = Math.min(50, now - prev); prev = now;
    vt += dtr * speed;
    const dt = (dtr * speed) / 1000;
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    let ccx = cx; let ccy = cy; let cR = R; let power; let col; let rot;
    if (state === 'idle') {
      power = 0.25 + 0.1 * Math.sin(now / 500); col = mix(WHITE, fin, 0); col = [180, 200, 255]; rot = now / 3000;
      circle(g, cx, cy, R, rot, col, power);
    } else {
      const t = vt;
      if (t < CHARGE) {
        const k = t / CHARGE;
        power = 0.2 + 0.8 * k * k;
        col = mix([180, 200, 255], k > 0.55 ? fin : [200, 215, 255], k > 0.55 ? clamp((k - 0.55) / 0.35) : 0);
        rot = (t / 1000) * (1 + 14 * k * k);
        circle(g, cx, cy, R * (1 + 0.04 * Math.sin(t / 60) * k), rot, col, power);
        // năng lượng xoáy vào tâm
        if (Math.random() < 0.9 + k * 2) { const a = Math.random() * 6.283; const rr = R * (1.5 + Math.random() * 0.5); parts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, vx: 0, vy: 0, life: 0, max: 600, c: mix(col, WHITE, 0.5), s: 1.5 + Math.random() * 1.6, sink: { x: cx, y: cy, a } }); }
        if (k > 0.3) { g.fillStyle = rgb(col, 0.5 * k); const bw = R * 0.5 * k; g.fillRect(cx - bw / 2, cy - R * 2 * k * k, bw, R * 2 * k * k); }
      } else if (t < CHARGE + BURST) {
        const k = (t - CHARGE) / BURST;
        if (!rings.length && !state.includes('b')) { state += 'b'; flash(); host.classList.add('rt-shake'); vibrate?.(maxR === 5 ? [60, 40, 90] : 40); sfx?.(maxR >= 4 ? 'rare' : 'reveal'); if (maxR === 5) sfx?.('bossIn'); for (let r = 0; r < (maxR === 5 ? 3 : 2); r++) rings.push({ r: R * 0.3, v: 520 + r * 200, w: 5 - r, a: 1, d: r * 80 }); spark(cx, cy, fin, maxR === 5 ? 90 : 55, 360, 900); }
        power = 1; rot = 14 + (t / 1000) * 12; col = fin;
        const s = 1 - 0.5 * ease(k);
        circle(g, cx, cy, R * (1 + 0.1 * (1 - k)), rot, mix(fin, WHITE, 0.3 * (1 - k)), 1, 1);
        // cột sáng
        const pw = R * (0.9 * (1 - k * 0.6) + 0.2); const grd = g.createLinearGradient(0, cy, 0, 0);
        grd.addColorStop(0, rgb(mix(fin, WHITE, 0.6), 0.95)); grd.addColorStop(1, rgb(fin, 0));
        g.fillStyle = grd; g.fillRect(cx - pw / 2, 0, pw, cy);
        if (maxR >= 4) { g.save(); g.translate(cx, cy); g.rotate(vt / 900); const n = maxR === 5 ? 14 : 8; for (let i = 0; i < n; i++) { g.rotate(6.283 / n); const gr = g.createLinearGradient(0, 0, R * 2.6, 0); gr.addColorStop(0, rgb(fin, 0.5 * (1 - k))); gr.addColorStop(1, rgb(fin, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -4); g.lineTo(R * 2.6, -R * 0.12); g.lineTo(R * 2.6, R * 0.12); g.lineTo(0, 4); g.fill(); } g.restore(); }
        void s;
      } else {
        // pha thẻ: cổng thu nhỏ lên đỉnh
        const k = ease(clamp((t - CHARGE - BURST) / 500));
        ccx = cx; ccy = cy + (30 - cy) * k; cR = R + (26 - R) * k;
        if (!host.classList.contains('rt-src')) { host.classList.add('rt-src'); host.classList.remove('rt-shake'); }
        const cur = sched.find((e) => e.fired && !e.landed);
        const lastCol = COL[(cur ? targets[cur.i].rarity : maxR)] || fin;
        circle(g, ccx, ccy, cR, vt / 500, mix(lastCol, WHITE, 0.2), 0.7, t > total - 700 ? clamp((total - t) / 700) : 1);
        for (const e of sched) {
          if (!e.fired && t >= e.at) { e.fired = true; e.start = t; const tg = targets[e.i]; const r = tg.el.getBoundingClientRect(); e.tx = r.left - hr.left + r.width / 2; e.ty = r.top - hr.top + r.height / 2; sfx?.('move'); }
          if (e.fired && !e.landed) {
            const kk = clamp((t - e.start) / FLY); const tg = targets[e.i]; const c = COL[tg.rarity] || COL[3];
            const x = ccx + (e.tx - ccx) * ease(kk); const y = ccy + (e.ty - ccy) * ease(kk) - Math.sin(kk * Math.PI) * 40;
            comets.push({ x, y, life: 0, max: 260, c, s: tg.rarity === 5 ? 6 : 4 });
            g.fillStyle = rgb(mix(c, WHITE, 0.6), 1); g.beginPath(); g.arc(x, y, tg.rarity === 5 ? 7 : 5, 0, 6.3); g.fill();
            if (kk >= 1) { e.landed = true; pop(e.i); spark(e.tx, e.ty, c, tg.rarity === 5 ? 70 : tg.rarity === 4 ? 44 : 26, tg.rarity === 5 ? 260 : 190, 800); rings.push({ x: e.tx, y: e.ty, r: 10, v: tg.rarity === 5 ? 380 : 240, w: tg.rarity === 5 ? 4 : 2.5, a: 1, c, d: 0 }); sfx?.(tg.rarity >= 4 ? 'rare' : 'reveal'); if (tg.rarity >= 4) { flash(); vibrate?.(tg.rarity === 5 ? [50, 30, 70] : 30); host.classList.remove('rt-shake'); void host.offsetWidth; host.classList.add('rt-shake'); setTimeout(() => host.classList.remove('rt-shake'), 450); } }
          }
        }
      }
    }
    // vệt sao chổi
    for (let i = comets.length - 1; i >= 0; i--) { const p = comets[i]; p.life += dtr * speed; if (p.life >= p.max) { comets.splice(i, 1); continue; } const a = 1 - p.life / p.max; g.globalAlpha = a * 0.8; g.fillStyle = rgb(p.c); g.beginPath(); g.arc(p.x, p.y, p.s * a, 0, 6.3); g.fill(); }
    // vòng sóng
    for (let i = rings.length - 1; i >= 0; i--) { const q = rings[i]; if (q.d > 0) { q.d -= dtr * speed; continue; } q.r += q.v * dt; q.a -= dt * 1.4; if (q.a <= 0) { rings.splice(i, 1); continue; } g.globalAlpha = q.a; g.strokeStyle = rgb(q.c || fin, 1); g.lineWidth = q.w; g.beginPath(); g.arc(q.x ?? cx, q.y ?? cy, q.r, 0, 6.3); g.stroke(); }
    // hạt
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dtr * speed;
      if (p.life >= p.max) { parts.splice(i, 1); continue; }
      if (p.sink) { const dx = p.sink.x - p.x; const dy = p.sink.y - p.y; const d = Math.hypot(dx, dy) || 1; p.x += (dx / d) * 260 * dt + (-dy / d) * 120 * dt; p.y += (dy / d) * 260 * dt + (dx / d) * 120 * dt; if (d < 14) { parts.splice(i, 1); continue; } }
      else { p.vy += (p.gy || 0) * dt; p.vx *= 0.98; p.x += p.vx * dt; p.y += p.vy * dt; }
      const a = 1 - p.life / p.max; g.globalAlpha = a; g.fillStyle = typeof p.c === 'string' ? p.c : rgb(p.c); g.beginPath(); g.arc(p.x, p.y, p.s * (0.5 + a * 0.5), 0, 6.3); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (state !== 'idle' && vt >= total && !parts.length) return finish();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (state !== 'idle') return;
    state = 'run'; vt = 0;
    hit.remove(); tipEl.remove();
    host.classList.remove('lp-on'); host.classList.add('rt-src');
    host.querySelector('h2')?.style.setProperty('visibility', 'hidden');
    sfx?.('summon'); vibrate?.(25);
    try { localStorage.setItem('rsp.sumSeen', '1'); } catch { /* bỏ qua */ }
    onStart?.();
    if (reduced) return finish();
    if (seen) { skipBtn = document.createElement('button'); skipBtn.className = 'rt-skip'; skipBtn.id = 'rt-skip'; skipBtn.textContent = skipLabel; skipBtn.onclick = skip; host.append(skipBtn); }
  }
  function skip() {
    if (state === 'idle' || fast || !seen) return;
    fast = true;
    if (vt < CHARGE + BURST) { vt = CHARGE + BURST; rings.length = 0; flash(); }
    // gom lịch: thẻ thường tới liền, 5★ giữ nhịp
    let acc2 = vt + 100; for (const e of sched) { if (e.fired) continue; e.at = acc2; acc2 += targets[e.i].rarity === 5 ? 700 : 110; }
    speed = 1;
  }
  host.classList.add('lp-on');
  hit.addEventListener('click', start);
  hit.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && start());
  prev = performance.now(); t0 = prev;
  raf = requestAnimationFrame(frame);
  void t0;
  return { start, skip, finish, get seen() { return seen; } };
}
export const ritualSeen = () => { try { return localStorage.getItem('rsp.sumSeen') === '1'; } catch { return false; } };
