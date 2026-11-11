// Vẽ canvas (hình khối màu tạm, chưa có art). Không chứa logic game.
import { COLS, ROWS } from '../core/board.js';

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

// view: { board:{cells,enh}, enemies:[{id,element,hp,maxHp,cd,every}], hp, maxHp, members:[{id,element,skillCd}],
//         hl:Set, fall:array|null, fallT:0..1, drag:{path,x,y}|null, timer:0..1|null, floaters:[], shake, combo, turn, flash }
export function draw(g, view, t) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#12152b';
  g.fillRect(0, 0, W, H);

  // quái
  const n = view.enemies.length;
  const slot = W / Math.max(1, n);
  view.enemies.forEach((e, i) => {
    const cx = slot * i + slot / 2;
    const dead = e.hp <= 0;
    const sh = view.shake && view.shake.enemy === i ? Math.sin(t * 0.06) * 8 : 0;
    g.save();
    g.globalAlpha = dead ? 0.2 : 1;
    g.fillStyle = COLORS[e.element];
    g.globalAlpha *= 0.25;
    g.fillRect(cx - 70 + sh, 90, 140, 150);
    g.globalAlpha = dead ? 0.2 : 1;
    drawOrb(g, e.element, cx + sh, 160, 46);
    g.restore();
    bar(g, cx - 65, 255, 130, 12, e.hp / e.maxHp, '#ff6b6b');
    text(g, view.t(`monster.${e.id}`), cx, 280, 15);
    if (!dead) text(g, view.t('battle.attackIn', { n: e.cd }), cx, 302, 13, '#ffb86b');
  });

  // HUD
  text(g, view.t('battle.turn', { n: view.turn + 1 }), 16, 24, 15, '#9aa2ff', 'left');
  text(g, view.t('battle.seed', { seed: view.seed }), W - 16, 24, 13, '#6a71b8', 'right');
  if (view.combo > 0) text(g, view.t('battle.combo', { n: view.combo }), W / 2, 330, 34, '#ffd84a');

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
  for (let i = 0; i < COLS * ROWS; i++) {
    const type = view.board.cells[i];
    if (type < 0) continue;
    if (i === held) continue;
    const p = cellCenter(i);
    let y = p.y;
    if (view.fall) y -= view.fall[i] * CELL * (1 - view.fallT);
    if (y < BOARD_Y - CELL / 2) continue;
    const pulse = view.hl && view.hl.has(i) ? 1 + Math.sin(t * 0.03) * 0.12 : 1;
    const alpha = view.hl && view.hl.has(i) ? 0.75 : 1;
    drawOrb(g, type, p.x, y, 34 * pulse, !!view.board.enh[i], alpha);
  }
  if (held >= 0) {
    const type = view.board.cells[held];
    drawOrb(g, type, view.drag.x, view.drag.y, 40, !!view.board.enh[held]);
  }

  // chữ nổi (sát thương, hồi máu)
  for (const f of view.floaters) {
    const k = f.age / f.life;
    g.save();
    g.globalAlpha = 1 - k * k;
    text(g, f.s, f.x, f.y - k * 40, f.size || 24, f.color);
    g.restore();
  }
}
