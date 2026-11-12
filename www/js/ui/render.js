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

function bar(g, x, y, w, h, frac, color) {
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(x, y, w, h);
  g.fillStyle = color;
  g.fillRect(x, y, Math.max(0, w * Math.min(1, frac)), h);
}

function text(g, s, x, y, size, color = '#e8ebff', align = 'center', weight = '600') {
  g.fillStyle = color;
  g.font = `${weight} ${size}px system-ui, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

const NEG = new Set(['burn', 'poison', 'stun', 'freeze', 'atkDown', 'lock']);
// Biểu tượng hiệu ứng: ô chữ viết tắt + số lượt, tiêu cực màu đỏ, tích cực màu xanh (khác nhau cả viền).
function badges(g, effects, x, y, view, align = 'left') {
  const w = 46;
  const total = effects.length * (w + 4) - 4;
  let bx = align === 'center' ? x - total / 2 : x;
  for (const e of effects) {
    const neg = NEG.has(e.key);
    g.fillStyle = neg ? '#6b2a35' : '#1f5a42';
    g.strokeStyle = neg ? '#ff8a98' : '#7dffb0';
    g.lineWidth = neg ? 2 : 1;
    g.beginPath();
    g.roundRect(bx, y, w, 18, neg ? 3 : 9);
    g.fill();
    g.stroke();
    let label = view.t(`effect.${e.key}.short`);
    if (e.key === 'poison') label += `×${e.stacks}`;
    text(g, `${label} ${e.turns > 99 ? '∞' : e.turns}`, bx + w / 2, y + 9, 11, '#ffffff');
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
    const sh = (view.shake && view.shake.enemy === i ? Math.sin(t * 0.06) * 8 : 0) + (e.hit ? Math.sin(t * 0.09) * 10 * e.hit : 0);
    g.save();
    g.globalAlpha = dead ? 0.2 : 1;
    g.fillStyle = COLORS[e.element];
    g.globalAlpha *= 0.25;
    if (!getImg(`monster:${e.id}`)) g.fillRect(cx - 70 + sh, 90, 140, 150);
    g.globalAlpha = dead ? 0.2 : 1;
    const mi = getImg(`monster:${e.id}`);
    const sc = 1 + 0.08 * (e.hit || 0);
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
    bar(g, cx - 65, 255, 130, 12, (e.hpShow ?? e.hp) / e.maxHp, '#ff6b6b');
    text(g, `${Math.max(0, Math.round(e.hp))}`, cx, 266, 10, '#ffffff');
    text(g, view.t(`monster.${e.id}`), cx, 280, 15);
    if (!dead) {
      const off = e.effects?.some((x) => x.key === 'stun' || x.key === 'freeze');
      text(g, off ? view.t('effect.stun.name') : view.t('battle.attackIn', { n: e.cd }), cx, 302, 13, off ? '#9ad0ff' : '#ffb86b');
      if (e.effects?.length) badges(g, e.effects, cx, 314, view, 'center');
    }
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
  text(g, view.t('battle.turn', { n: view.turn + 1 }), 16, 24, 15, '#9aa2ff', 'left');
  text(g, view.titleText, W - 16, 24, 13, '#8a91d8', 'right');
  const sh = (view.teamFx || []).find((e) => e.key === 'shield');
  if (sh) text(g, view.t('battle.shield', { n: sh.pool }), W - 16, 330, 16, '#6bd5ff', 'right');
  if (view.teamFx?.length) badges(g, view.teamFx, 16, 336, view);
  if (view.combo > 0) text(g, view.t('battle.combo', { n: view.combo }), W / 2 - 110, 340, 30 + Math.min(10, view.combo), '#ffd84a');
  if (view.tally && view.tally.shown > 0) text(g, `${Math.round(view.tally.shown)}`, W / 2 + 70, 340, Math.round(34 * (1 + 0.45 * Math.min(1, view.tally.pulse))), '#ff8a3c');

  // máu đội chung
  bar(g, 16, 358, W - 32, 18, view.hp / view.maxHp, '#4cc46a');
  text(g, `${Math.round(view.hp)} / ${view.maxHp}`, W / 2, 367, 13, '#0b0d1a');

  // đội hình
  view.members.forEach((m, i) => {
    const x = 12 + i * 104;
    const y = 388;
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(x, y, 98, 78);
    drawOrb(g, m.element, x + 49, y + 28, 20);
    text(g, view.t(`char.${m.id}`), x + 49, y + 58, 11, '#cfd3ff');
    const ready = m.skillCd === 0;
    text(g, ready ? view.t('battle.skillReady') : view.t('battle.skillCd', { n: m.skillCd }), x + 49, y + 72, 11, ready ? '#7dffa0' : '#8a8fc0');
    if (ready && view.canAct) {
      g.strokeStyle = '#7dffa0';
      g.lineWidth = 2;
      g.strokeRect(x, y, 98, 78);
    }
  });

  // nút Duo nằm giữa hai ô liền kề
  for (const d of view.duos || []) {
    const cx = 12 + (d.slot + 1) * 104 - 3;
    const ready = d.cd === 0;
    g.fillStyle = ready ? '#ffb347' : '#3a3f78';
    g.beginPath();
    g.roundRect(cx - 30, 377, 60, 22, 11);
    g.fill();
    text(g, ready ? view.t('battle.duo') : `${view.t('battle.duo')} ${d.cd}`, cx, 388, 12, ready ? '#2a1600' : '#aab0ff');
  }

  // đồng hồ kéo
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 466, W, 8);
  if (view.timer !== null) {
    g.fillStyle = view.timer < 0.25 ? '#ff6b6b' : '#6b79ff';
    g.fillRect(0, 466, W * view.timer, 8);
  }

  // bàn
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      g.fillStyle = (r + c) % 2 ? '#171a36' : '#1c2040';
      g.fillRect(BOARD_X + c * CELL, BOARD_Y + r * CELL, CELL, CELL);
    }
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
    drawOrb(g, type, x, y, 34 * pulse, !!view.board.enh[i], alpha);
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

  // chữ nổi (sát thương, hồi máu)
  for (const f of view.floaters) {
    const k = f.age / f.life;
    g.save();
    g.globalAlpha = 1 - k * k;
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(10,10,25,0.85)';
    g.lineJoin = 'round';
    g.font = `800 ${f.size || 24}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeText(f.s, f.x, f.y - k * 40);
    text(g, f.s, f.x, f.y - k * 40, f.size || 24, f.color, 'center', '800');
    g.restore();
  }
}
