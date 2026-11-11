// Điều khiển một trận: nhập liệu cảm ứng/chuột, hoạt ảnh, gọi core. Logic game nằm hết trong core/.
import { createBattle, step } from '../core/battle.js';
import { applyPath } from '../core/move.js';
import { areAdjacent } from '../core/board.js';
import { newRecord } from '../core/replay.js';
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

export function startGame({ canvas, ctx, t, seed, team, enemies, onEnd }) {
  const g = canvas.getContext('2d');
  let state = createBattle(ctx, { seed, team, enemies });
  const record = newRecord(seed, team, enemies);
  let busy = false;
  let alive = true;
  let drag = null;
  const dragMs = ctx.config.dragTimeMs;
  const allowDiag = ctx.config.board.allowDiagonal;

  const view = {
    t,
    seed,
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
  }
  sync();

  const enemyX = (i) => (W / state.enemies.length) * i + W / state.enemies.length / 2;
  const floater = (s, x, y, color, size = 26) => view.floaters.push({ s, x, y, color, size, age: 0, life: 700 });

  function applyHits(hits) {
    for (const h of hits) {
      if (h.kind === 'damage') {
        view.enemies[h.enemy].hp -= h.amount;
        floater(`-${h.amount}`, enemyX(h.enemy), 150, '#ffd84a');
      } else {
        view.hp = Math.min(view.maxHp, view.hp + h.amount);
        floater(`+${h.amount}`, W / 2, 350, '#7dffa0');
      }
    }
  }

  async function animate(events) {
    for (const e of events) {
      if (!alive) return;
      if (e.type === 'step') {
        const st = e.step;
        view.board = structuredClone(st.boardBefore);
        view.hl = new Set(st.groups.flatMap((x) => x.cells));
        view.combo = e.combos;
        await sleep(330);
        applyHits(e.hits);
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
      } else if (e.type === 'skill') {
        applyHits(e.hits);
        view.board = structuredClone(e.board);
        await sleep(350);
      } else if (e.type === 'enemyAttack') {
        view.shake = { enemy: e.enemy };
        view.hp = Math.max(0, view.hp - e.amount);
        floater(`-${e.amount}`, W / 2, 350, '#ff6b6b', 30);
        await sleep(350);
        view.shake = null;
      }
    }
  }

  async function run(action) {
    busy = true;
    view.canAct = false;
    const r = step(ctx, state, action);
    if (r.events[0]?.type === 'invalid') {
      sync();
      busy = false;
      view.canAct = true;
      return;
    }
    record.actions.push(action);
    await animate(r.events);
    state = r.state;
    sync();
    view.combo = 0;
    busy = false;
    view.canAct = state.status === 'playing';
    if (state.status !== 'playing' && alive) onEnd(state.status, record);
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
    if (p.y >= 388 && p.y <= 466) {
      const idx = Math.floor((p.x - 12) / 104);
      if (idx >= 0 && idx < state.members.length && state.members[idx].skillCd === 0) run({ type: 'skill', index: idx });
      return;
    }
    const c = cellAt(p.x, p.y);
    if (c < 0) return;
    canvas.setPointerCapture?.(ev.pointerId);
    drag = { path: [c], x: p.x, y: p.y, t0: 0 };
    view.drag = drag;
  }

  function onMove(ev) {
    if (!drag) return;
    const p = pos(ev);
    drag.x = p.x;
    drag.y = p.y;
    const c = cellAt(p.x, p.y);
    if (c < 0) return;
    const ctr = cellCenter(c);
    if (Math.hypot(p.x - ctr.x, p.y - ctr.y) > CELL * 0.42) return; // chỉ đổi ô khi vào gần tâm ô
    const last = drag.path[drag.path.length - 1];
    if (c === last) return;
    if (drag.path.length >= 2 && c === drag.path[drag.path.length - 2]) {
      drag.path.pop();
    } else if (!drag.path.includes(c) && areAdjacent(last, c, allowDiag)) {
      drag.path.push(c);
      if (!drag.t0) drag.t0 = performance.now();
    } else return;
    view.board = drag.path.length >= 2 ? applyPath(state.board, drag.path) : structuredClone(state.board);
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
    draw(g, view, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    getState: () => state,
    getRecord: () => record,
    destroy() {
      alive = false;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', release);
      canvas.removeEventListener('pointercancel', release);
    },
  };
}
