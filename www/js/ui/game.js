// Điều khiển một trận: nhập liệu cảm ứng/chuột, hoạt ảnh, gọi core. Logic game nằm hết trong core/.
import { applyPath } from '../core/move.js';
import { areAdjacent } from '../core/board.js';
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

export function startGame({ canvas, ctx, t, state: initial, stepper, titleText, onEnd, fx = NOFX }) {
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

  const enemyX = (i) => (W / state.enemies.length) * i + W / state.enemies.length / 2;
  const floater = (s, x, y, color, size = 26) => view.floaters.push({ s, x, y, color, size, age: 0, life: 700 });

  function applyHits(hits) {
    for (const h of hits) {
      if (h.kind === 'damage') {
        fx.sfx('hit');
        view.enemies[h.enemy].hp -= h.amount;
        floater(h.amount === 0 && h.absorbed ? t('battle.blocked') : `-${h.amount}`, enemyX(h.enemy), 150, '#ffd84a');
      } else if (h.kind === 'reflect') {
        view.hp = Math.max(0, view.hp - h.amount);
        floater(`-${h.amount}`, W / 2, 350, '#ff9f6b');
      } else {
        fx.sfx('heal');
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
        fx.sfx(e.combos > 1 ? 'combo' : 'match');
        await sleep(330);
        applyHits(e.hits);
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
      } else if (e.type === 'skill' || e.type === 'duo') {
        fx.sfx('skill');
        applyHits(e.hits);
        view.board = structuredClone(e.board);
        await sleep(350);
      } else if (e.type === 'enemyAttack') {
        view.shake = { enemy: e.enemy };
        if (e.amount > 0) {
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
    await animate(r.events);
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
    canvas.setPointerCapture?.(ev.pointerId);
    fx.sfx('pick');
    drag = { path: [c], x: p.x, y: p.y, t0: 0 };
    view.drag = drag;
  }

  function onMove(ev) {
    if (!drag) return;
    const p = pos(ev);
    drag.x = p.x;
    drag.y = p.y;
    const c = cellAt(p.x, p.y);
    if (c < 0 || state.locked.includes(c)) return;
    const ctr = cellCenter(c);
    if (Math.hypot(p.x - ctr.x, p.y - ctr.y) > CELL * 0.42) return; // chỉ đổi ô khi vào gần tâm ô
    const last = drag.path[drag.path.length - 1];
    if (c === last) return;
    if (drag.path.length >= 2 && c === drag.path[drag.path.length - 2]) {
      drag.path.pop();
    } else if (!drag.path.includes(c) && areAdjacent(last, c, allowDiag)) {
      drag.path.push(c);
      fx.sfx('move');
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
    for (const q of view.particles) {
      q.age += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 0.0004 * dt;
    }
    view.particles = view.particles.filter((q) => q.age < q.life);
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
