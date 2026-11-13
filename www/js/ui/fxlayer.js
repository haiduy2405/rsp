// Lớp hiệu ứng ăn mừng phủ lên toàn game: pháo hoa, pháo giấy, tia lấp lánh. Chỉ là UI, không ảnh hưởng core.
const GOLD = ['#ccf7ff', '#99dfed', '#e7fafe', '#ffd24a'];
const MIX = ['#adf1ff', '#ff6b8a', '#6bd5ff', '#7dffa0', '#b58bff', '#8fecff', '#ffffff'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export function createFxLayer(canvas) {
  const g = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  let parts = [];
  let rockets = [];
  let raf = 0;
  let last = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width;
    H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  }
  window.addEventListener('resize', resize);

  function loop(now) {
    const dt = Math.min(48, now - last);
    last = now;
    if (!W) resize();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // tên lửa
    rockets = rockets.filter((r) => {
      r.t += dt;
      const k = Math.min(1, r.t / r.life);
      r.x = r.x0 + (r.x1 - r.x0) * k;
      r.y = r.y0 + (r.y1 - r.y0) * (1 - (1 - k) * (1 - k));
      if (Math.random() < 0.8) parts.push({ kind: 'spark', x: r.x, y: r.y, vx: rnd(-0.02, 0.02), vy: rnd(0.02, 0.06), g: 0.0002, life: 420, age: 0, col: '#ccf7ff', size: 2 });
      if (k >= 1) {
        explode(r.x, r.y, r.col);
        return false;
      }
      return true;
    });
    parts = parts.filter((p) => {
      p.age += dt;
      if (p.age >= p.life) return false;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'confetti') {
        p.vx *= 0.995;
        p.rot += p.spin * dt;
        p.sway += dt * 0.006;
        p.x += Math.sin(p.sway) * 0.35;
      }
      const k = p.age / p.life;
      g.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      g.fillStyle = p.col;
      if (p.kind === 'confetti') {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(1, Math.cos(p.sway * 1.7)); // lật mặt giấy
        g.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
        g.restore();
      } else if (p.kind === 'ray') {
        g.strokeStyle = p.col;
        g.lineWidth = p.size;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 90, p.y - p.vy * 90);
        g.stroke();
      } else {
        g.beginPath();
        g.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2);
        g.fill();
      }
      return true;
    });
    g.globalAlpha = 1;
    if (parts.length || rockets.length) raf = requestAnimationFrame(loop);
    else {
      raf = 0;
      g.clearRect(0, 0, W, H);
    }
  }
  function kick() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }

  function explode(x, y, col) {
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(-0.05, 0.05);
      const sp = rnd(0.12, 0.34);
      parts.push({ kind: 'ray', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.00022, life: rnd(900, 1400), age: 0, col: i % 5 === 0 ? '#ffffff' : col, size: 2.4 });
    }
    for (let i = 0; i < 16; i++) parts.push({ kind: 'dot', x, y, vx: rnd(-0.08, 0.08), vy: rnd(-0.08, 0.08), g: 0.00012, life: rnd(500, 900), age: 0, col: '#dff8fd', size: rnd(1.5, 3) });
    kick();
  }
  const api = {
    firework(x, y, col = pick(MIX), delay = 0) {
      setTimeout(() => {
        if (!W) resize();
        rockets.push({ x0: x + rnd(-20, 20), x1: x, y0: H * 0.95, y1: y, t: 0, life: rnd(520, 760), col, x, y: H });
        kick();
      }, delay);
    },
    confetti(count = 90, fromY = -20) {
      if (!W) resize();
      for (let i = 0; i < count; i++) {
        parts.push({ kind: 'confetti', x: rnd(0, W), y: fromY - rnd(0, 120), vx: rnd(-0.05, 0.05), vy: rnd(0.08, 0.2), g: 0.00004, life: rnd(2600, 4200), age: 0, col: pick(MIX), size: rnd(4, 7), rot: rnd(0, 6), spin: rnd(-0.01, 0.01), sway: rnd(0, 6) });
      }
      kick();
    },
    // pháo giấy bắn từ hai góc dưới
    cannons(count = 60) {
      if (!W) resize();
      for (const side of [0, 1]) {
        for (let i = 0; i < count; i++) {
          const a = (side ? Math.PI - rnd(0.9, 1.45) : rnd(0.9, 1.45)) * -1;
          const sp = rnd(0.5, 1.05);
          parts.push({ kind: 'confetti', x: side ? W : 0, y: H * 0.85, vx: Math.cos(a) * sp * (side ? -1 : 1) * -1, vy: Math.sin(a) * sp, g: 0.0011, life: rnd(1800, 3000), age: 0, col: pick(MIX), size: rnd(4, 7), rot: rnd(0, 6), spin: rnd(-0.015, 0.015), sway: rnd(0, 6) });
        }
      }
      kick();
    },
    // tia lấp lánh vàng bung ra từ một điểm (mở rương, nhặt đồ hiếm)
    sparkle(x, y, n = 24, col) {
      if (!W) resize();
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2);
        const sp = rnd(0.06, 0.28);
        parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.08, g: 0.0003, life: rnd(500, 1000), age: 0, col: col || pick(GOLD), size: rnd(1.6, 3.6) });
      }
      kick();
    },
    // vòi pháo giấy nhỏ + tia sáng tại điểm chạm (nhận thưởng): cols = bảng màu
    burst(x, y, cols = MIX, n = 26) {
      if (!W) resize();
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + rnd(-0.9, 0.9);
        const sp = rnd(0.25, 0.62);
        parts.push({ kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.0010, life: rnd(900, 1500), age: 0, col: pick(cols), size: rnd(3, 5.5), rot: rnd(0, 6.3), spin: rnd(-0.012, 0.012), sway: rnd(0, 6.3) });
      }
      for (let i = 0; i < Math.round(n * 0.7); i++) {
        const a = rnd(0, Math.PI * 2);
        const sp = rnd(0.05, 0.22);
        parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.05, g: 0.00025, life: rnd(400, 800), age: 0, col: pick(cols), size: rnd(1.4, 3) });
      }
      kick();
    },
    celebrate() {
      if (!W) resize();
      const spots = [[0.25, 0.28], [0.75, 0.24], [0.5, 0.18], [0.2, 0.42], [0.8, 0.4]];
      spots.forEach(([fx, fy], i) => api.firework(W * fx, H * fy, pick(MIX), i * 260));
      setTimeout(() => api.cannons(46), 120);
      setTimeout(() => api.confetti(60), 700);
    },
    clear() {
      parts = [];
      rockets = [];
    },
  };
  return api;
}
