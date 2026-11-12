// Vẽ canvas (hình khối màu tạm, chưa có art). Không chứa logic game.
import { COLS, ROWS } from '../core/board.js';

import { getImg } from './assets.js';

export const W = 540;
export const H = 960;
export const CELL = 90;
export const BOARD_X = 0;
export const BOARD_Y = 480;
export const COLORS = ['#3b9cff', '#ff5a3c', '#4cc46a', '#ffd84a', '#9a5cff', '#ff7fb0'];

export function cellCenter(i) {
  return { x: BOARD_X + (i % COLS) * CELL + CELL / 2, y: BOARD_Y + ((i / COLS) | 0) * CELL + CELL / 2 };
}

export function cellAt(px, py) {
  const c = Math.floor((px - BOARD_X) / CELL);
  const r = Math.floor((py - BOARD_Y) / CELL);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
  return r * COLS + c;
}

// Mỗi hệ một hình khác nhau để phân biệt khi mù màu.
export function drawOrb(g, type, x, y, r, enhanced = false, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  const im = getImg(`orb:${type}`);
  if (im) {
    g.drawImage(im, x - r, y - r, r * 2, r * 2);
    if (enhanced) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(x, y, r + 6, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    return;
  }
  g.fillStyle = COLORS[type];
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3;
  g.beginPath();
  if (type === 0) g.arc(x, y, r, 0, Math.PI * 2);
  else if (type === 1) {
    g.moveTo(x, y - r);
    g.lineTo(x + r * 0.95, y + r * 0.8);
    g.lineTo(x - r * 0.95, y + r * 0.8);
    g.closePath();
  } else if (type === 2) {
    const s = r * 0.85;
    g.roundRect(x - s, y - s, s * 2, s * 2, 10);
  } else if (type === 3) {
    g.moveTo(x, y - r);
    g.lineTo(x + r, y);
    g.lineTo(x, y + r);
    g.lineTo(x - r, y);
    g.closePath();
  } else if (type === 4) {
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  } else {
    g.moveTo(x, y + r);
    g.bezierCurveTo(x - r * 1.4, y + r * 0.1, x - r * 0.7, y - r * 1.0, x, y - r * 0.35);
    g.bezierCurveTo(x + r * 0.7, y - r * 1.0, x + r * 1.4, y + r * 0.1, x, y + r);
    g.closePath();
  }
  g.fill();
  g.stroke();
  if (enhanced) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, y, r + 6, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

// Thanh máu: rãnh tối, viền, thân có độ bóng và vạch chia.
function bar(g, x, y, w, h, frac, color, light) {
  g.fillStyle = 'rgba(4,5,18,0.85)';
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  const fw = Math.max(0, w * Math.min(1, frac));
  if (fw > 0) {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, light || '#ffffff');
    gr.addColorStop(0.35, color);
    gr.addColorStop(1, color);
    g.fillStyle = gr;
    g.fillRect(x, y, fw, h);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(x, y, fw, Math.max(1, h * 0.28));
  }
  g.fillStyle = 'rgba(4,5,18,0.3)';
  for (let k = 1; k < 10; k++) g.fillRect(x + (w * k) / 10 - 0.5, y, 1, h);
  g.strokeStyle = 'rgba(226,183,90,0.7)';
  g.lineWidth = 1;
  g.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
}

// Bốn góc vàng: dấu hiệu "điểm dị" của UI.
function brackets(g, x, y, w, h, len, color, lw = 2) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.beginPath();
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    g.moveTo(cx + dx * len, cy);
    g.lineTo(cx, cy);
    g.lineTo(cx, cy + dy * len);
  }
  g.stroke();
  g.restore();
}
function panel(g, x, y, w, h, accent) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, 'rgba(33,40,100,0.88)');
  gr.addColorStop(1, 'rgba(10,13,40,0.94)');
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(77,86,184,0.9)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (accent) {
    g.fillStyle = accent;
    g.fillRect(x + 1, y + 1, w - 2, 3);
  }
}

// Chữ có viền tối và tô chuyển sắc (trên sáng, dưới màu hệ) kèm quầng sáng nhẹ.
function outlined(g, str, x, y, size, top, bottom, family, lw = 5, weight = '700') {
  g.save();
  g.font = `${weight} ${size}px ${family}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.miterLimit = 2;
  g.lineWidth = lw;
  g.strokeStyle = 'rgba(8,8,28,0.95)';
  g.shadowColor = bottom;
  g.shadowBlur = size * 0.35;
  g.strokeText(str, x, y);
  g.shadowBlur = 0;
  const gr = g.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  gr.addColorStop(0, top);
  gr.addColorStop(0.55, top);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillText(str, x, y);
  g.restore();
}
const bounceOut = (x) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
const SANS = '"Be Vietnam Pro", system-ui, sans-serif';
const SERIF = 'Cormorant, "Times New Roman", serif';
const TALLY_AT = { x: W / 2 + 90, y: 340 }; // ô tổng sát thương (khớp game.js)
const POP_LIGHT = ['#b8e0ff', '#ffc0ac', '#b8f5c4', '#fff4b0', '#dcc4ff', '#ffd0e4']; // màu sáng theo hệ cho số của tướng
const easeOut = (k) => 1 - (1 - k) ** 3;
const NUM = 'Oswald, "Be Vietnam Pro", system-ui, sans-serif'; // số: chữ cao hẹp, dễ đọc khi to
function text(g, s, x, y, size, color = '#e8ebff', align = 'center', weight = '600', family = SANS) {
  g.fillStyle = color;
  g.font = `${weight} ${size}px ${family}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

const NEG = new Set(['burn', 'poison', 'stun', 'freeze', 'atkDown', 'lock']);
// Biểu tượng hiệu ứng: ô chữ viết tắt + số lượt, tiêu cực màu đỏ, tích cực màu xanh (khác nhau cả viền).
function badges(g, effects, x, y, view, align = 'left') {
  g.font = `600 11px ${SANS}`;
  const items = effects.map((e) => {
    const base = view.t(`effect.${e.key}.short`) + (e.key === 'poison' ? `×${e.stacks}` : '');
    const label = `${base} ${e.turns > 99 ? '∞' : e.turns}`;
    return { e, label, w: Math.max(46, Math.ceil(g.measureText(label).width) + 12) }; // ô tự giãn theo chữ, không bị cắt
  });
  const total = items.reduce((a, i) => a + i.w + 4, -4);
  let bx = align === 'center' ? x - total / 2 : x;
  for (const { e, label, w } of items) {
    const neg = NEG.has(e.key);
    g.fillStyle = neg ? '#6b2a35' : '#1f5a42';
    g.strokeStyle = neg ? '#ff8a98' : '#7dffb0';
    g.lineWidth = neg ? 2 : 1;
    g.beginPath();
    g.roundRect(bx, y, w, 18, neg ? 3 : 9);
    g.fill();
    g.stroke();
    text(g, label, bx + w / 2, y + 9, 11, '#ffffff');
    bx += w + 4;
  }
}

// Hiệu ứng trạng thái vẽ trên quái: Bỏng lửa bay lên, Độc bong bóng, Choáng sao xoay, Đóng băng khối băng, Khiên vòng sáng.
function statusFx(g, effects, x, y, t) {
  const has = (k) => effects.some((e) => e.key === k);
  g.save();
  if (has('freeze')) {
    g.fillStyle = 'rgba(150,215,255,0.45)';
    g.strokeStyle = '#d8f2ff';
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(x - 56, y - 56, 112, 112, 14);
    g.fill();
    g.stroke();
  }
  if (has('burn')) {
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.0012 + i / 6) % 1);
      g.globalAlpha = 1 - k;
      g.fillStyle = i % 2 ? '#ffb347' : '#ff5a3c';
      g.beginPath();
      g.arc(x - 40 + i * 16 + Math.sin(t * 0.01 + i) * 4, y + 50 - k * 100, 7 * (1 - k) + 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (has('poison')) {
    for (let i = 0; i < 5; i++) {
      const k = ((t * 0.0008 + i / 5) % 1);
      g.globalAlpha = 0.9 * (1 - k);
      g.strokeStyle = '#7dff6a';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x - 36 + i * 18, y + 40 - k * 80, 6 + (i % 3) * 2, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (has('stun')) {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.006 + (i * Math.PI * 2) / 3;
      g.globalAlpha = 1;
      g.fillStyle = '#ffe66b';
      g.font = '700 22px system-ui';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('★', x + Math.cos(a) * 46, y - 56 + Math.sin(a) * 12);
    }
  }
  if (has('shield') || has('immune')) {
    g.globalAlpha = 0.5 + Math.sin(t * 0.006) * 0.2;
    g.strokeStyle = has('immune') ? '#ffe9a0' : '#6bd5ff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, y, 62, 0, Math.PI * 2);
    g.stroke();
  }
  if (has('atkDown')) {
    g.globalAlpha = 1;
    g.fillStyle = '#ff8a98';
    g.font = '800 26px system-ui';
    g.textAlign = 'center';
    g.fillText('▼', x + 54, y - 40);
  }
  g.restore();
}

// view: { board:{cells,enh}, enemies:[{id,element,hp,maxHp,cd,every}], hp, maxHp, members:[{id,element,skillCd}],
//         hl:Set, fall:array|null, fallT:0..1, drag:{path,x,y}|null, timer:0..1|null, floaters:[], shake, combo, turn, flash }
export function draw(g, view, t) {
  g.clearRect(0, 0, W, H);
  g.save();
  if (view.camShake > 0.2) g.translate(Math.sin(t * 0.13) * view.camShake * 0.6, Math.cos(t * 0.17) * view.camShake * 0.6);
  if ((view.zoom || 1) > 1.001) {
    g.translate(W / 2, 190);
    g.scale(view.zoom, view.zoom);
    g.translate(-W / 2, -190);
  }
  g.fillStyle = '#12152b';
  g.fillRect(0, 0, W, H);
  const bg = getImg('bg:battle');
  if (bg) g.drawImage(bg, 0, 0, W, H);

  // quái
  const n = view.enemies.length;
  const slot = W / Math.max(1, n);
  view.enemies.forEach((e, i) => {
    const cx = slot * i + slot / 2;
    const dead = e.hp <= 0;
    const dk = dead ? Math.min(1, (e.deadAge ?? 9999) / 650) : 0; // tiến độ tan biến
    if (dk >= 1) return;
    const ik = view.intro ? Math.max(0, Math.min(1, (view.intro.age - (250 + i * 230)) / 520)) : 1; // rơi vào cảnh
    if (ik <= 0) return;
    const introY = view.intro ? -(1 - bounceOut(ik)) * 260 : 0;
    const sh = (view.shake && view.shake.enemy === i ? Math.sin(t * 0.06) * 8 : 0) + (e.hit ? Math.sin(t * 0.09) * 10 * e.hit : 0);
    g.save();
    g.translate(0, introY);
    g.globalAlpha = (dead ? 1 - dk : 1) * Math.min(1, ik * 3);
    g.fillStyle = COLORS[e.element];
    g.globalAlpha *= 0.25;
    if (!getImg(`monster:${e.id}`)) g.fillRect(cx - 70 + sh, 90, 140, 150);
    g.globalAlpha = dead ? 1 - dk : 1;
    const mi = getImg(`monster:${e.id}`);
    const sc = 1 + 0.08 * (e.hit || 0) + dk * 0.35;
    if (mi) {
      const bob = dead ? 0 : Math.sin(t * 0.003 + i) * 3;
      const sz = 150 * sc;
      g.drawImage(mi, cx + sh - sz / 2, 165 - sz / 2 + bob, sz, sz);
    } else drawOrb(g, e.element, cx + sh, 160, 46 * (1 + 0.12 * (e.hit || 0)));
    if (e.effects?.length && !dead) statusFx(g, e.effects, cx + sh, 160, t);
    if (e.hit) {
      g.globalAlpha = 0.55 * e.hit;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx + sh, 160, 50, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    if (view.focus === i && !dead) {
      // khóa mục tiêu: vòng ngắm xoay + bốn góc
      const R = 84 + (view.lockFlash || 0) * 14;
      g.save();
      g.translate(cx + sh, 165);
      g.rotate(t * 0.0012);
      g.strokeStyle = '#ff4d5e';
      g.lineWidth = 4;
      g.shadowColor = '#ff4d5e';
      g.shadowBlur = 14;
      for (let q = 0; q < 4; q++) {
        g.rotate(Math.PI / 2);
        g.beginPath();
        g.arc(0, 0, R, -0.35, 0.35);
        g.stroke();
        g.beginPath();
        g.moveTo(R + 6, 0);
        g.lineTo(R + 20, 0);
        g.stroke();
      }
      g.restore();
      text(g, view.t('battle.locked'), cx, 98, 13, '#ff8a96');
    }
    g.globalAlpha = dead ? 1 - dk : 1;
    panel(g, cx - 82, 244, 164, 76, null);
    brackets(g, cx - 82, 244, 164, 76, 9, view.focus === i ? '#ff4d5e' : '#e2b75a');
    g.fillStyle = COLORS[e.element];
    g.fillRect(cx - 82, 244, 4, 76);
    text(g, view.t(`monster.${e.id}`), cx + 2, 258, 15, '#ffe9ad', 'center', '700', SERIF);
    bar(g, cx - 70, 270, 140, 11, (e.hpShow ?? e.hp) / e.maxHp, '#e8475b', '#ff9aa6');
    text(g, `${Math.max(0, Math.round(e.hp))}`, cx, 276, 9, '#ffffff', 'center', '800');
    if (!dead) {
      const off = e.effects?.some((x) => x.key === 'stun' || x.key === 'freeze');
      text(g, off ? view.t('effect.stun.name') : view.t('battle.attackIn', { n: e.cd }), cx, 294, 12, off ? '#9ad0ff' : '#ffc27a');
      if (e.effects?.length) badges(g, e.effects, cx, 302, view, 'center');
    }
    g.globalAlpha = 1;
  });

  for (const r of view.rings || []) {
    const k = r.age / r.life;
    g.globalAlpha = 1 - k;
    g.strokeStyle = COLORS[r.col];
    g.lineWidth = 8 * (1 - k) + 2;
    g.beginPath();
    g.arc(r.x, r.y, 20 + k * 120, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  for (const sh of view.shots || []) {
    const k = (sh.age - sh.delay) / sh.life;
    if (k < 0) continue;
    const x = sh.x0 + (sh.x1 - sh.x0) * k;
    const y = sh.y0 + (sh.y1 - sh.y0) * k - Math.sin(k * Math.PI) * 40;
    for (let j = 3; j >= 0; j--) {
      const kk = Math.max(0, k - j * 0.05);
      const tx = sh.x0 + (sh.x1 - sh.x0) * kk;
      const ty = sh.y0 + (sh.y1 - sh.y0) * kk - Math.sin(kk * Math.PI) * 40;
      g.globalAlpha = 0.18 * (4 - j);
      g.fillStyle = COLORS[sh.col];
      g.beginPath();
      g.arc(tx, ty, 14 - j * 2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  for (const q of view.particles || []) {
    g.globalAlpha = 1 - q.age / q.life;
    g.fillStyle = COLORS[q.col] || '#fff';
    g.beginPath();
    g.arc(q.x, q.y, 5, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  // HUD
  g.fillStyle = 'rgba(5,6,22,0.62)';
  g.fillRect(0, 0, W, 38);
  g.fillStyle = 'rgba(226,183,90,0.55)';
  g.fillRect(0, 38, W, 1.5);
  text(g, view.t('battle.turn', { n: view.turn + 1 }), 16, 20, 15, '#ffe9ad', 'left', '700');
  text(g, view.titleText, W - 16, 20, 13, '#aab2f0', 'right');
  const sh = (view.teamFx || []).find((e) => e.key === 'shield');
  if (sh) text(g, view.t('battle.shield', { n: sh.pool }), W - 16, 336, 15, '#6bd5ff', 'right', '700');
  if (view.teamFx?.length) badges(g, view.teamFx, 16, 326, view);
  if (view.combo > 0) {
    outlined(g, `${view.combo}`, W / 2 - 128, 338, 54 + Math.min(16, view.combo * 2), '#fff3b0', '#e2a52a', NUM, 5);
    text(g, view.t('battle.comboWord'), W / 2 - 128, 364, 13, '#ffe9ad', 'center', '700');
  }
  if (view.tally && view.tally.shown > 0) outlined(g, new Intl.NumberFormat(document.documentElement.lang || 'vi').format(Math.round(view.tally.shown)), W / 2 + 90, 340, Math.round(50 * (1 + 0.4 * Math.min(1, view.tally.pulse))), '#fff0d0', '#ff7a2a', NUM, 5);

  // máu đội chung
  bar(g, 16, 372, W - 32, 14, view.hp / view.maxHp, '#2fa86c', '#a8f5cb');
  text(g, `${Math.round(view.hp)} / ${view.maxHp}`, W / 2, 379, 11, '#ffffff', 'center', '800');

  // đội hình
  view.members.forEach((m, i) => {
    const x = 12 + i * 104;
    const lead = i === 0;
    const y = lead ? 384 : 394; // đội trưởng cao hơn 10px
    const oy = lead ? 10 : 0;
    const ready = m.skillCd === 0;
    panel(g, x, y, 98, 70 + oy, lead ? '#ffd24a' : COLORS[m.element]);
    if (lead) {
      g.save();
      g.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.004);
      g.strokeStyle = '#ffd24a';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, 96, 68 + oy);
      g.restore();
      // vương miện nhỏ + nhãn
      g.fillStyle = '#ffd24a';
      g.beginPath();
      const cx0 = x + 14, cy0 = y + 15;
      g.moveTo(cx0 - 7, cy0 + 4); g.lineTo(cx0 - 8, cy0 - 5); g.lineTo(cx0 - 3, cy0); g.lineTo(cx0, cy0 - 7); g.lineTo(cx0 + 3, cy0); g.lineTo(cx0 + 8, cy0 - 5); g.lineTo(cx0 + 7, cy0 + 4);
      g.closePath();
      g.fill();
      text(g, view.t('team.leader'), x + 58, y + 14, 10, '#ffe9ad', 'center', '800');
    }
    drawOrb(g, m.element, x + 49, y + 26 + oy / 2 + (lead ? 4 : 0), 18);
    text(g, view.t(`char.${m.id}`), x + 49, y + 50 + oy, 11, lead ? '#fff4c9' : '#e7eaff', 'center', lead ? '800' : '600');
    if (ready) text(g, view.t('battle.skillReady'), x + 49, y + 63 + oy, 11, '#7dffa0', 'center', '700');
    else {
      // hồi chiêu: chấm đầy = số lượt còn lại
      const n = m.skillMax || 1;
      const gap = Math.min(12, 80 / n);
      const x0 = x + 49 - ((n - 1) * gap) / 2;
      for (let k = 0; k < n; k++) {
        g.fillStyle = k < m.skillCd ? '#8a93d8' : 'rgba(138,147,216,0.25)';
        g.beginPath();
        g.arc(x0 + k * gap, y + 62 + oy, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (ready && view.canAct) {
      const glow = 0.55 + 0.45 * Math.sin(t * 0.006);
      g.save();
      g.globalAlpha = glow;
      brackets(g, x - 2, y - 2, 102, 74 + oy, 12, '#7dffa0', 2.5);
      g.restore();
    }
  });

  // nút Duo nằm giữa hai ô liền kề
  for (const d of view.duos || []) {
    const cx = 12 + (d.slot + 1) * 104 - 3;
    const ready = d.cd === 0;
    g.fillStyle = ready ? '#e2b75a' : '#2a3070';
    g.beginPath();
    g.roundRect(cx - 28, 384, 56, 22, 3);
    g.fill();
    g.strokeStyle = ready ? '#fff0bd' : '#4a56b8';
    g.lineWidth = 1;
    g.stroke();
    text(g, ready ? view.t('battle.duo') : `${view.t('battle.duo')} ${d.cd}`, cx, 395.5, 12, ready ? '#2a1600' : '#aab0ff', 'center', '800');
  }

  // đồng hồ kéo
  g.fillStyle = 'rgba(4,5,18,0.9)';
  g.fillRect(0, 468, W, 10);
  if (view.timer !== null) {
    const low = view.timer < 0.25;
    g.fillStyle = low ? '#ff5468' : '#e2b75a';
    g.shadowColor = g.fillStyle;
    g.shadowBlur = low ? 14 : 8;
    g.fillRect(0, 470, W * view.timer, 6);
    g.shadowBlur = 0;
  }

  // bàn: khung kính, mỗi ô là một hốc bo nhẹ
  g.fillStyle = 'rgba(5,6,22,0.92)';
  g.fillRect(0, BOARD_Y, W, ROWS * CELL);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      g.fillStyle = (r + c) % 2 ? 'rgba(30,36,92,0.55)' : 'rgba(22,27,72,0.55)';
      g.beginPath();
      g.roundRect(BOARD_X + c * CELL + 2, BOARD_Y + r * CELL + 2, CELL - 4, CELL - 4, 8);
      g.fill();
    }
  g.fillStyle = 'rgba(226,183,90,0.55)';
  g.fillRect(0, BOARD_Y - 1, W, 1.5);
  g.fillRect(0, BOARD_Y + ROWS * CELL - 0.5, W, 1.5);
  const held = view.drag && view.drag.path.length ? view.drag.path[view.drag.path.length - 1] : -1;
  g.save();
  g.beginPath();
  g.rect(0, BOARD_Y, W, ROWS * CELL + 30);
  g.clip(); // ngọc rơi từ trên xuống không được đè lên hàng tướng
  // viên đang cầm luồn bên dưới
  if (held >= 0) drawOrb(g, view.board.cells[held], view.drag.x, view.drag.y, 40, !!view.board.enh[held], 0.92);
  const lifted = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const type = view.board.cells[i];
    if (type < 0) continue;
    if (i === held) continue;
    const p = cellCenter(i);
    let x = p.x;
    let y = p.y;
    if (view.fall) y -= view.fall[i] * CELL * (1 - view.fallT);
    if (y < BOARD_Y - CELL / 2) continue;
    const sl = view.slides && view.slides[i];
    if (sl) {
      const k = Math.min(1, sl.age / 160);
      const e = 1 - (1 - k) * (1 - k);
      x = sl.x + (p.x - sl.x) * e;
      y = sl.y + (p.y - sl.y) * e;
      lifted.push({ i, type, x, y, k });
      continue;
    }
    const pulse = view.hl && view.hl.has(i) ? 1 + Math.sin(t * 0.03) * 0.12 : 1;
    const alpha = view.hl && view.hl.has(i) ? 0.75 : 1;
    if (view.hl && view.hl.has(i)) {
      // vùng ghép được: viền sáng nhấp nháy quanh ô
      g.save();
      g.globalAlpha = 0.55 + 0.35 * Math.sin(t * 0.012);
      g.strokeStyle = '#fff3b0';
      g.shadowColor = '#ffd24a';
      g.shadowBlur = 12;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(p.x - CELL / 2 + 3, p.y - CELL / 2 + 3, CELL - 6, CELL - 6, 9);
      g.stroke();
      g.restore();
    }
    drawOrb(g, type, x, y, 34 * pulse, !!view.board.enh[i], 1);
  }
  // viên bị đi qua nổi lên: to hơn một chút, có bóng, vẽ phía trên viên đang cầm
  for (const l of lifted) {
    const up = Math.sin(l.k * Math.PI);
    g.save();
    g.globalAlpha = 0.35 * up;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(l.x + 4, l.y + 14 + up * 6, 34, 26, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    drawOrb(g, l.type, l.x, l.y - up * 8, 34 * (1 + 0.22 * up), !!view.board.enh[l.i]);
  }
  g.restore();

  if (view.hint && !view.drag) {
    const pts = view.hint.path.map(cellCenter);
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 6;
    g.setLineDash([12, 10]);
    g.beginPath();
    pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
    g.stroke();
    g.setLineDash([]);
    const k = (t % 1400) / 1400;
    const q = { x: pts[0].x + (pts[1].x - pts[0].x) * Math.min(1, k * 1.4), y: pts[0].y + (pts[1].y - pts[0].y) * Math.min(1, k * 1.4) };
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(q.x, q.y, 20, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffd84a';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(q.x, q.y, 28 + Math.sin(t * 0.01) * 4, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(8,9,22,0.85)';
    g.fillRect(0, 932, W, 28);
    text(g, view.hint.text, W / 2, 946, 15, '#ffe9a0');
  }

  for (const i of view.locked || []) {
    const c = i % COLS;
    const r = (i / COLS) | 0;
    const x = BOARD_X + c * CELL;
    const y = BOARD_Y + r * CELL;
    g.fillStyle = 'rgba(10,10,20,0.55)';
    g.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
    g.strokeStyle = '#ff8a98';
    g.lineWidth = 3;
    g.strokeRect(x + 6, y + 6, CELL - 12, CELL - 12);
    g.fillStyle = '#ffd0d6';
    g.fillRect(x + CELL / 2 - 10, y + CELL / 2 - 2, 20, 16);
    g.beginPath();
    g.arc(x + CELL / 2, y + CELL / 2 - 2, 7, Math.PI, 0);
    g.stroke();
  }

  if (view.hurt > 0) {
    const gr = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
    gr.addColorStop(0, 'rgba(255,40,40,0)');
    gr.addColorStop(1, `rgba(255,40,40,${0.55 * view.hurt})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  // chữ nổi: nảy ra (overshoot), bay lên chậm, mờ dần ở cuối
  for (const f of view.floaters) {
    const k = f.age / f.life;
    const pop = Math.min(1, f.age / 150);
    const back = 1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2); // easeOutBack
    const sc = f.kind === 'dmg' ? 0.35 + 0.65 * back + (f.age < 150 ? 0.18 * (1 - pop) : 0) : 0.6 + 0.4 * back;
    const rise = 46 * (1 - Math.pow(1 - Math.min(1, k * 1.3), 2));
    g.save();
    g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    g.translate(f.x, f.y - rise);
    g.scale(sc, sc);
    if (f.kind === 'dmg') outlined(g, f.s, 0, 0, f.size || 40, '#ffffff', f.color, NUM, Math.max(4, (f.size || 40) * 0.13));
    else outlined(g, f.s, 0, 0, f.size || 24, f.color, f.color, SANS, 4, '800');
    g.restore();
  }
  // số sát thương từng tướng: nảy ở ô tướng, rồi bay gộp vào ô tổng
  for (const q of view.pops || []) {
    if (q.age < q.delay) continue;
    const t = q.age - q.delay;
    const pop = Math.min(1, t / 200);
    const back = 1 + 2.4 * Math.pow(pop - 1, 3) + 1.4 * Math.pow(pop - 1, 2);
    let x = q.x, y = q.y - 14 * easeOut(Math.min(1, t / 400)), sc = 0.3 + 0.7 * back, a = 1;
    if (t > q.hold) {
      const e = Math.min(1, (t - q.hold) / q.fly) ** 2.2;
      x += (TALLY_AT.x - x) * e;
      y += (TALLY_AT.y - y) * e;
      sc *= 1 - 0.5 * e;
      a = 1 - 0.7 * e * e;
    }
    const col = COLORS[q.el] || '#ffd84a';
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.scale(sc, sc);
    const halo = g.createRadialGradient(0, 0, 4, 0, 0, q.size * 1.1);
    halo.addColorStop(0, `${col}66`);
    halo.addColorStop(1, `${col}00`);
    g.fillStyle = halo;
    g.fillRect(-q.size * 1.4, -q.size * 1.1, q.size * 2.8, q.size * 2.2);
    outlined(g, q.s, 0, 0, q.size, POP_LIGHT[q.el] || '#fff0a0', col, NUM, Math.max(5, q.size * 0.16), '700');
    g.restore();
  }
  g.restore(); // hết máy quay

  // vignette khi slow-motion, chớp trắng khi quái chết
  if (view.vig > 0.01) {
    const gr = g.createRadialGradient(W / 2, 330, 160, W / 2, 330, 640);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,10,${0.7 * view.vig})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  if (view.whiteFlash > 0.01) {
    g.fillStyle = `rgba(255,255,255,${view.whiteFlash * 0.6})`;
    g.fillRect(0, 0, W, H);
  }
  if (view.intro) drawIntro(g, view);
}

// Cutscene mở màn: thanh phim, màn che bàn ngọc, biển tên tầng, cảnh báo đỏ (Elite/Boss), "Bắt đầu!".
const ease = (x) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;
function drawIntro(g, view) {
  const it = view.intro;
  const a = it.age;
  const T = it.dur;
  const barK = Math.min(ease(a / 380), 1 - ease((a - (T - 700)) / 420));
  const bh = 70 * barK;
  // màn che khu bàn ngọc + HUD, tan dần ở cuối
  const veil = 0.94 * (1 - ease((a - (T - 900)) / 700));
  if (veil > 0.01) {
    g.fillStyle = `rgba(4,5,18,${veil})`;
    g.fillRect(0, 372, W, H - 372);
  }
  if (it.danger) {
    const pulse = 0.5 + 0.5 * Math.sin(a * 0.012);
    const k = Math.min(1, a / 300) * (1 - ease((a - (T - 800)) / 500));
    g.fillStyle = `rgba(190,20,40,${0.22 * pulse * k})`;
    g.fillRect(0, 0, W, 372);
  }
  g.fillStyle = '#05061a';
  g.fillRect(0, 0, W, bh);
  g.fillRect(0, H - bh, W, bh);
  g.fillStyle = it.danger ? '#ff5a6a' : '#e2b75a';
  g.fillRect(0, bh - 2, W, 2);
  g.fillRect(0, H - bh, W, 2);
  // biển tên giữa khu che
  const bk = ease((a - 650) / 450) * (1 - ease((a - (T - 900)) / 380));
  if (bk > 0.01) {
    const cy = 560;
    g.save();
    g.globalAlpha = bk;
    const lw = 250 * bk;
    g.fillStyle = it.danger ? '#ff5a6a' : '#e2b75a';
    g.fillRect(W / 2 - lw, cy - 52, lw * 2, 2);
    g.fillRect(W / 2 - lw, cy + 52, lw * 2, 2);
    if (it.danger) text(g, it.warn, W / 2, cy - 30, 15, '#ff8a96', 'center', '800');
    else text(g, it.sub, W / 2, cy - 30, 15, '#e2b75a', 'center', '800');
    g.translate((1 - bk) * -40, 0);
    outlined(g, it.title, W / 2, cy + 8, it.title.length > 16 ? 30 : 38, '#ffffff', it.danger ? '#ff5a6a' : '#ffd24a', SERIF, 6, '700');
    if (it.danger) text(g, it.sub, W / 2, cy + 38, 13, '#ffe9ad', 'center', '700');
    g.restore();
  }
  // "Bắt đầu!"
  const sk = (a - (T - 650)) / 650;
  if (sk > 0 && sk < 1) {
    const pop = ease(sk * 3);
    g.save();
    g.globalAlpha = 1 - ease((sk - 0.55) / 0.45);
    g.translate(W / 2, 330);
    g.scale(0.6 + 0.5 * pop, 0.6 + 0.5 * pop);
    outlined(g, it.go, 0, 0, 62, '#ffffff', '#ffd24a', SERIF, 8, '700');
    g.restore();
  }
}
