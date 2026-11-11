// Điều khiển một trận: nhập liệu cảm ứng/chuột, hoạt ảnh, gọi core. Logic game nằm hết trong core/.
import { applyPath } from '../core/move.js';
import { areAdjacent } from '../core/board.js';
import { step as coreStep } from '../core/battle.js';
import { W, H, CELL, cellAt, cellCenter, draw } from './render.js';

const sleep = (ms, fn) =>
  new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      if (fn) fn(k);
      k < 1 ? requestAnimationFrame(tick) : res();
    };
    tick();
  });
const easeOut = (k) => 1 - (1 - k) * (1 - k);

// stepper(state, action) -> { state, events }: do bên ngoài cung cấp (chuyến leo tháp ghi lại hành động).
// onEnd(finalState) gọi sau khi hoạt ảnh kết thúc và trận đã phân thắng thua.
const NOFX = { sfx() {}, vibrate() {} };

// Gợi ý cho người mới: tìm một nước đổi 2 ô kề nhau tạo ra combo, ưu tiên hệ có trong đội.
function findHint(ctx, state) {
  let best = null;
  for (let a = 0; a < 30; a++) {
    if (state.locked.includes(a)) continue;
    const ra = (a / 6) | 0;
    for (const b of [a + 1, a + 6]) {
      if (b >= 30 || state.locked.includes(b) || (b === a + 1 && b % 6 === 0)) continue;
      void ra;
      const r = coreStep(ctx, state, { type: 'move', path: [a, b] });
      const st = r.events.find((e) => e.type === 'step');
      if (!st) continue;
      const dmg = st.hits.reduce((n, h) => n + (h.kind === 'damage' ? h.amount : 0), 0);
      if (!best || dmg > best.dmg) best = { path: [a, b], dmg };
    }
  }
  return best?.path ?? null;
}

export function startGame({ canvas, ctx, t, state: initial, stepper, titleText, onEnd, fx = NOFX, hint = false }) {
  const g = canvas.getContext('2d');
  let state = initial;
  let busy = false;
  let alive = true;
  let drag = null;
  const dragMs = ctx.config.dragTimeMs + (initial.dragBonusMs || 0);
  const allowDiag = ctx.config.board.allowDiagonal;

  const view = {
    t,
    titleText,
    locked: [],
    teamFx: [],
    duos: [],
    turn: 0,
    combo: 0,
    board: structuredClone(state.board),
    enemies: [],
    members: [],
    hp: 0,
    maxHp: 0,
    hl: null,
    fall: null,
    fallT: 1,
    drag: null,
    timer: null,
    floaters: [],
    particles: [],
    hint: null,
    shots: [],
    rings: [],
    hurt: 0,
    shake: null,
    canAct: true,
  };

  function sync() {
    view.turn = state.turn;
    view.board = structuredClone(state.board);
    view.enemies = state.enemies.map((e) => ({ ...e }));
    view.members = state.members.map((m) => ({ ...m }));
    view.hp = state.hp;
    view.maxHp = state.maxHp;
    view.locked = state.locked.slice();
    view.teamFx = state.team.effects.map((e) => ({ ...e }));
    view.duos = state.duos.map((d) => ({ ...d }));
  }
  sync();
  if (hint) {
    const hp = findHint(ctx, state);
    if (hp) view.hint = { path: hp, text: t('tut.hint') };
  }

  const enemyX = (i) => (W / state.enemies.length) * i + W / state.enemies.length / 2;
  const floater = (s, x, y, color, size = 26) => view.floaters.push({ s, x: Math.max(70, Math.min(W - 70, x)), y, color, size, age: 0, life: 1000 });

  const memberPos = (id) => {
    const i = Math.max(0, state.members.findIndex((m) => m.id === id));
    return { x: 12 + i * 104 + 49, y: 388 + 28, el: state.members[i]?.element ?? 3 };
  };
  const dmgSize = (a) => Math.min(54, 28 + Math.log10(Math.max(10, a)) * 6);

  // Mỗi đòn: quả cầu bay từ nhân vật tới quái, tới nơi mới trừ máu + số nổi + rung quái.
  function applyHits(hits, stagger = 90) {
    let k = 0;
    for (const h of hits) {
      if (h.kind === 'damage') {
        const src = memberPos(h.from);
        const ex = enemyX(h.enemy);
        view.shots.push({ x0: src.x, y0: src.y, x1: ex, y1: 160, col: src.el, delay: k * stagger, life: 260, age: 0, done: false, onHit: () => {
          fx.sfx('hit');
          const en = view.enemies[h.enemy];
          en.hp -= h.amount;
          en.hit = 1;
          floater(h.amount === 0 && h.absorbed ? t('battle.blocked') : `-${h.amount}`, ex + ((k % 3) - 1) * 26, 150 - (k % 2) * 22, '#ffd84a', dmgSize(h.amount));
          if (h.thawed) floater(t('effect.freeze.name'), ex, 200, '#9ad0ff', 20);
        } });
        k++;
      } else if (h.kind === 'reflect') {
        view.hp = Math.max(0, view.hp - h.amount);
        floater(`-${h.amount}`, W / 2, 350, '#ff9f6b');
      } else if (h.amount > 0) {
        fx.sfx('heal');
        view.hp = Math.min(view.maxHp, view.hp + h.amount);
        floater(`+${h.amount}`, W / 2, 350, '#7dffa0', 30);
      }
    }
    return k ? k * stagger + 260 : 0; // thời gian cần chờ
  }
  async function animate(events) {
    for (const e of events) {
      if (!alive) return;
      if (e.type === 'step') {
        const st = e.step;
        view.board = structuredClone(st.boardBefore);
        view.hl = new Set(st.groups.flatMap((x) => x.cells));
        view.combo = e.combos;
        fx.sfx(e.combos > 1 ? 'combo' : 'match');
        st.groups.forEach((g, gi) => {
          const xs = g.cells.map((c) => cellCenter(c));
          const cx = xs.reduce((a, q) => a + q.x, 0) / xs.length;
          const cy = xs.reduce((a, q) => a + q.y, 0) / xs.length;
          floater(t('battle.combo', { n: e.comboStart + gi }), cx, cy, '#ffffff', 22);
          // Ngọc hệ không có ai trong đội: báo rõ vì sao không có sát thương.
          if (g.type !== 5 && !state.members.some((m) => m.element === g.type)) floater(t('battle.noAttacker'), cx, cy + 26, '#ff9aa8', 16);
        });
        await sleep(330);
        const wait = applyHits(e.hits);
        for (const i of st.cleared) {
          const c = cellCenter(i);
          const col = st.boardBefore.cells[i];
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + i;
            view.particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * 0.18, vy: Math.sin(a) * 0.18 - 0.05, col, age: 0, life: 420 });
          }
        }
        const cleared = structuredClone(st.boardBefore);
        for (const i of st.cleared) cleared.cells[i] = -1;
        view.board = cleared;
        view.hl = null;
        await sleep(120);
        view.board = structuredClone(st.board);
        view.fall = st.falls;
        await sleep(260, (k) => (view.fallT = easeOut(k)));
        view.fall = null;
        view.fallT = 1;
        await sleep(Math.max(0, wait - 380));
      } else if (e.type === 'skill' || e.type === 'duo') {
        fx.sfx('skill');
        for (const who of e.type === 'duo' ? [e.slot, e.slot + 1] : [e.member]) {
          const m = state.members[who];
          if (m) view.rings.push({ x: 12 + who * 104 + 49, y: 416, col: m.element, age: 0, life: 600 });
        }
        const wait = applyHits(e.hits);
        view.board = structuredClone(e.board);
        await sleep(Math.max(350, wait));
      } else if (e.type === 'enemyAttack') {
        view.shake = { enemy: e.enemy };
        if (e.amount > 0) {
          view.hurt = 1;
          fx.sfx('hurt');
          fx.vibrate(40);
        }
        if (e.blocked > 0) floater(t('battle.blocked'), W / 2 - 80, 350, '#6bd5ff', 26);
        if (e.amount > 0) {
          view.hp = Math.max(0, view.hp - e.amount);
          floater(`-${e.amount}`, W / 2, 350, '#ff6b6b', 30);
        }
        await sleep(350);
        view.shake = null;
      } else if (e.type === 'reflect') {
        if (e.to === 'enemy') {
          view.enemies[e.enemy].hp = Math.max(0, view.enemies[e.enemy].hp - e.amount);
          floater(`-${e.amount}`, enemyX(e.enemy), 150, '#ff9f6b');
        }
      } else if (e.type === 'dot' || e.type === 'regen') {
        const good = e.type === 'regen';
        if (e.target === 'enemy') floater(`${good ? '+' : '-'}${e.amount}`, enemyX(e.enemy), 120, good ? '#7dffa0' : '#c58bff');
        else floater(`${good ? '+' : '-'}${e.amount}`, W / 2, 350, good ? '#7dffa0' : '#c58bff');
        await sleep(200);
      }
    }
  }

  async function run(action) {
    busy = true;
    view.canAct = false;
    const r = stepper(state, action);
    if (r.events[0]?.type === 'invalid') {
      sync();
      busy = false;
      view.canAct = true;
      return;
    }
    const hadStep = r.events.some((e) => e.type === 'step');
    if (action.type === 'move' && !hadStep) floater(t('battle.noCombo'), W / 2, 700, '#c8ccff', 30);
    const startHp = state.enemies.reduce((a, e) => a + e.hp, 0);
    await animate(r.events);
    const total = startHp - r.state.enemies.reduce((a, e) => a + e.hp, 0);
    if (total > 0 && r.events.filter((e) => e.type === 'step').length) {
      floater(t('battle.turnTotal', { n: total }), W / 2, 440, '#ffd84a', 34);
      await sleep(350);
    }
    state = r.state;
    sync();
    view.combo = 0;
    busy = false;
    view.canAct = state.status === 'playing';
    if (state.status !== 'playing' && alive) onEnd(state);
  }

  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - rect.left) * W) / rect.width, y: ((ev.clientY - rect.top) * H) / rect.height };
  }

  function release() {
    if (!drag) return;
    const d = drag;
    drag = null;
    view.drag = null;
    view.timer = null;
    if (d.path.length >= 2) run({ type: 'move', path: d.path });
    else view.board = structuredClone(state.board);
  }

  function onDown(ev) {
    if (busy || state.status !== 'playing') return;
    const p = pos(ev);
    for (const d of state.duos) {
      const cx = 12 + (d.slot + 1) * 104 - 3;
      if (Math.abs(p.x - cx) <= 30 && p.y >= 377 && p.y <= 399) {
        if (d.cd === 0) run({ type: 'duo', index: d.slot });
        return;
      }
    }
    if (p.y >= 388 && p.y <= 466) {
      const idx = Math.floor((p.x - 12) / 104);
      if (idx >= 0 && idx < state.members.length && state.members[idx].skillCd === 0) run({ type: 'skill', index: idx });
      return;
    }
    const c = cellAt(p.x, p.y);
    if (c < 0 || state.locked.includes(c)) return;
    view.hint = null;
    canvas.setPointerCapture?.(ev.pointerId);
    fx.sfx('pick');
    drag = { path: [c], x: p.x, y: p.y, t0: 0 };
    view.drag = drag;
  }

  // Thử thêm ô (px,py); trả về true nếu đường kéo thay đổi.
  function tryCell(c) {
    if (c < 0 || state.locked.includes(c)) return false;
    const last = drag.path[drag.path.length - 1];
    if (c === last) return false;
    if (drag.path.length >= 2 && c === drag.path[drag.path.length - 2]) {
      drag.path.pop();
      return true;
    }
    if (!drag.path.includes(c) && areAdjacent(last, c, allowDiag)) {
      drag.path.push(c);
      fx.sfx('move');
      fx.vibrate(8);
      if (!drag.t0) drag.t0 = performance.now();
      return true;
    }
    return false;
  }

  function onMove(ev) {
    if (!drag) return;
    // Ngón tay di chuyển nhanh có thể bỏ qua ô: nội suy từ vị trí trước tới vị trí mới, bước nhỏ hơn 1/4 ô.
    const events = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
    const pts = (events.length ? events : [ev]).map(pos);
    let changed = false;
    for (const p of pts) {
      const dx = p.x - drag.x;
      const dy = p.y - drag.y;
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (CELL / 4)));
      for (let k = 1; k <= n; k++) {
        const x = drag.x + (dx * k) / n;
        const y = drag.y + (dy * k) / n;
        const c = cellAt(x, y);
        if (c < 0) continue;
        const ctr = cellCenter(c);
        if (Math.hypot(x - ctr.x, y - ctr.y) > CELL * 0.46) continue; // chỉ đổi ô khi vào gần tâm ô
        if (tryCell(c)) changed = true;
      }
      drag.x = p.x;
      drag.y = p.y;
    }
    if (changed) view.board = drag.path.length >= 2 ? applyPath(state.board, drag.path) : structuredClone(state.board);
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  let last = performance.now();
  function frame(now) {
    if (!alive) return;
    const dt = now - last;
    last = now;
    if (drag && drag.t0) {
      const k = 1 - (now - drag.t0) / dragMs;
      view.timer = Math.max(0, k);
      if (k <= 0) release();
    }
    for (const f of view.floaters) f.age += dt;
    view.floaters = view.floaters.filter((f) => f.age < f.life);
    for (const q of view.particles) {
      q.age += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 0.0004 * dt;
    }
    view.particles = view.particles.filter((q) => q.age < q.life);
    view.hurt = Math.max(0, view.hurt - dt / 450);
    for (const r of view.rings) r.age += dt;
    view.rings = view.rings.filter((r) => r.age < r.life);
    for (const sh of view.shots) {
      sh.age += dt;
      if (!sh.done && sh.age >= sh.delay + sh.life) {
        sh.done = true;
        sh.onHit();
      }
    }
    view.shots = view.shots.filter((sh) => !sh.done);
    for (const en of view.enemies) {
      en.hit = Math.max(0, (en.hit || 0) - dt / 260);
      en.hpShow = en.hpShow == null ? en.hp : en.hpShow + (en.hp - en.hpShow) * Math.min(1, dt / 120);
    }
    draw(g, view, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    getState: () => state,
    destroy() {
      alive = false;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', release);
      canvas.removeEventListener('pointercancel', release);
    },
  };
}
