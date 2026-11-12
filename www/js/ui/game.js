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
    const cand = [a + 1, a + 6];
    if (ctx.config.board.allowDiagonal) cand.push(a + 7, a + 5);
    for (const b of cand) {
      if (b >= 30 || state.locked.includes(b)) continue;
      const dc = Math.abs((b % 6) - (a % 6));
      if (dc > 1 || (b === a + 1 && b % 6 === 0)) continue;
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

export function startGame({ canvas, ctx, t, state: initial, stepper, titleText, onEnd, fx = NOFX, hint = false, onInspect = null, celebrate = null, intro = null }) {
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
    view.enemies = state.enemies.map((e) => ({ ...e, deadAge: e.hp <= 0 ? 9999 : undefined }));
    view.members = state.members.map((m) => ({ ...m }));
    view.hp = state.hp;
    view.maxHp = state.maxHp;
    view.locked = state.locked.slice();
    view.teamFx = state.team.effects.map((e) => ({ ...e }));
    view.duos = state.duos.map((d) => ({ ...d }));
    view.focus = Number.isInteger(state.focus) && state.enemies[state.focus]?.hp > 0 ? state.focus : -1;
  }
  sync();
  // Cutscene mở màn: chặn thao tác tới khi xong; chạm để bỏ qua.
  if (intro) {
    view.intro = { age: 0, dur: intro.dur || 2600, ...intro };
    busy = true;
    view.canAct = false;
    view.enemies.forEach((e) => (e.landed = false));
    fx.sfx('whoosh');
  }
  if (hint) {
    const hp = findHint(ctx, state);
    if (hp) view.hint = { path: hp, text: t('tut.hint') };
  }

  const enemyX = (i) => (W / state.enemies.length) * i + W / state.enemies.length / 2;
  const floater = (s, x, y, color, size = 26, kind = 'text', life = 1000) => view.floaters.push({ s, x: Math.max(70, Math.min(W - 70, x)), y, color, size, kind, age: 0, life });
  const nf = new Intl.NumberFormat(typeof document !== 'undefined' ? document.documentElement.lang || 'vi' : 'vi');
  const fmt = (n) => nf.format(n);
  const LIGHT = ['#9fd2ff', '#ffb098', '#a6f0b4', '#fff0a0', '#d2b0ff', '#ffc0da']; // màu số theo hệ

  const memberPos = (id) => {
    const i = Math.max(0, state.members.findIndex((m) => m.id === id));
    return { x: 12 + i * 104 + 49, y: 394 + 26, el: state.members[i]?.element ?? 3 };
  };
  // cỡ số theo tỉ lệ máu quái bị mất: đòn nhỏ vẫn đọc được, đòn lớn nổi bật nhưng không tràn màn
  const dmgSize = (a, maxHp) => 34 + Math.min(1, (a / Math.max(1, maxHp)) * 3) * 34;

  // Mỗi đòn: quả cầu bay từ nhân vật tới quái, tới nơi mới trừ máu + số nổi + rung quái.
  function applyHits(hits, stagger = 90, finalKill = false) {
    let k = 0;
    const stack = {};
    const life = finalKill ? 300 : 260;
    for (const h of hits) {
      if (h.kind === 'damage') {
        const src = memberPos(h.from);
        const ex = enemyX(h.enemy);
        const n = (stack[h.enemy] = (stack[h.enemy] || 0) + 1) - 1;
        view.shots.push({ x0: src.x, y0: src.y, x1: ex, y1: 160, col: src.el, delay: k * stagger, life, age: 0, done: false, onHit: () => {
          fx.sfx('hit');
          const en = view.enemies[h.enemy];
          const before = en.hp;
          en.hp -= h.amount;
          en.hit = 1;
          const big = h.amount / Math.max(1, en.maxHp) >= 0.3;
          const lbl = h.amount === 0 && h.absorbed ? t('battle.blocked') : fmt(h.amount);
          floater(lbl, ex + ((n % 3) - 1) * 40, 128 - Math.min(3, n) * 26, LIGHT[src.el] || '#ffd84a', h.amount === 0 ? 24 : dmgSize(h.amount, en.maxHp), 'dmg', 1100);
          if (big) {
            view.rings.push({ x: ex, y: 160, col: src.el, age: 0, life: 420 });
            view.camShake = Math.max(view.camShake || 0, 6);
          }
          if (h.thawed) floater(t('effect.freeze.name'), ex, 210, '#9ad0ff', 20);
          if (before > 0 && en.hp <= 0) killEnemy(h.enemy, finalKill);
        } });
        k++;
      } else if (h.kind === 'reflect') {
        view.hp = Math.max(0, view.hp - h.amount);
        floater(`-${fmt(h.amount)}`, W / 2, 350, '#ff9f6b', 34, 'dmg');
      } else if (h.amount > 0) {
        fx.sfx('heal');
        view.hp = Math.min(view.maxHp, view.hp + h.amount);
        floater(`+${fmt(h.amount)}`, W / 2, 352, '#7dffa0', 38, 'dmg');
      }
    }
    return k ? (k - 1) * stagger + life : 0; // thời gian cần chờ
  }
  // Quái chết: nổ hạt theo hệ, rung, và nếu là quái cuối thì dừng hình ngắn trước khi chuyển slow-motion.
  function killEnemy(i, finalKill) {
    const en = view.enemies[i];
    en.deadAge = 0;
    const ex = enemyX(i);
    for (let q = 0; q < (finalKill ? 44 : 24); q++) {
      const a = (q / (finalKill ? 44 : 24)) * Math.PI * 2;
      const sp = 0.1 + Math.random() * (finalKill ? 0.34 : 0.22);
      view.particles.push({ x: ex, y: 165, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.06, col: en.element, age: 0, life: 700 + Math.random() * 400 });
    }
    view.whiteFlash = finalKill ? 0.9 : 0.45;
    view.camShake = finalKill ? 14 : 8;
    fx.sfx('kill');
    fx.vibrate?.(finalKill ? 70 : 35);
    if (finalKill) view.freeze = 160;
  }
  // Nhịp hoạt ảnh (ms): người chơi được "chiêm ngưỡng" từng combo rồi mới thấy đòn đánh.
  const ANIM = { preview: 900, previewNext: 450, groupHold: 320, groupPop: 200, fall: 560, afterFall: 220, finale: 800, preShot: 200, stagger: 170, postShot: 350 };
  const tally = (add) => {
    const ty = (view.tally ||= { shown: 0, target: 0, pulse: 0 });
    ty.target = add == null ? 0 : ty.target + add;
    if (add != null) ty.pulse = 1;
  };
  const splitHits = (hits) => {
    // gộp mọi đòn của cả lượt theo (người đánh, quái): mỗi cặp một quả cầu với tổng sát thương
    const map = new Map();
    let heal = 0;
    const out = [];
    for (const h of hits) {
      if (h.kind === 'damage') {
        const key = `${h.from}|${h.enemy}`;
        const m = map.get(key) || { kind: 'damage', from: h.from, enemy: h.enemy, amount: 0, raw: 0, absorbed: 0, thawed: false };
        m.amount += h.amount;
        m.raw += h.raw || 0;
        m.absorbed += h.absorbed || 0;
        m.thawed = m.thawed || !!h.thawed;
        map.set(key, m);
      } else if (h.kind === 'heal') heal += h.amount;
      else out.push(h);
    }
    const res = [...map.values()];
    if (heal > 0) res.push({ kind: 'heal', amount: heal });
    return res.concat(out);
  };
  let celebrated = false;
  async function animate(events, finalKill = false) {
    let pendingHits = [];
    let isFirstStep = true;
    let sawStep = false;
    async function flush() {
      if (!sawStep) return;
      sawStep = false;
      // đòn cuối: số sát thương dự tính nổ to rồi mới bắn
      view.hl = null;
      const ty = view.tally;
      if (ty && ty.target > 0) {
        fx.sfx('finale');
        fx.vibrate(25);
        ty.pulse = 2;
        view.rings.push({ x: W / 2 + 70, y: 340, col: 3, age: 0, life: 700 });
        await sleep(ANIM.finale);
      }
      await sleep(ANIM.preShot);
      const hits = splitHits(pendingHits);
      pendingHits = [];
      tally(null);
      if (finalKill) await finalBlow(hits);
      else {
        const wait = applyHits(hits, ANIM.stagger);
        await sleep(wait + ANIM.postShot);
      }
      view.combo = 0;
    }
    // Đòn kết liễu quái cuối: chuyển slow-motion, dừng hình khi trúng, rồi pháo hoa.
    async function finalBlow(hits) {
      fx.sfx('whoosh');
      view.slow = 0.25;
      const wait = applyHits(hits, ANIM.stagger * 1.4, true);
      await sleep((wait + 150) / view.slow);
      await sleep(750);
      await sleep(520, (k) => (view.slow = 0.25 + 0.75 * easeOut(k)));
      view.slow = 1;
      await victoryBurst();
    }
    async function victoryBurst() {
      if (celebrated) return;
      celebrated = true;
      fx.sfx('fanfare');
      celebrate?.();
      await sleep(1700);
    }
    for (const e of events) {
      if (!alive) return;
      if (e.type !== 'step') await flush();
      if (e.type === 'step') {
        const st = e.step;
        sawStep = true;
        view.board = structuredClone(st.boardBefore);
        const dmg = e.hits.filter((x) => x.kind === 'damage').reduce((a, x) => a + x.amount, 0);
        pendingHits.push(...e.hits);
        const ng = st.groups.length;
        let given = 0;
        // xem lại thành quả: sáng đồng thời mọi nhóm vừa ghép được, rồi mới nổ từng nhóm
        view.hl = new Set(st.groups.flatMap((x) => x.cells));
        fx.sfx(isFirstStep ? 'preview' : 'match');
        await sleep(isFirstStep ? ANIM.preview : ANIM.previewNext);
        isFirstStep = false;
        for (let gi = 0; gi < ng; gi++) {
          const g = st.groups[gi];
          const xs = g.cells.map((c) => cellCenter(c));
          const cx = xs.reduce((a, q) => a + q.x, 0) / xs.length;
          const cy = xs.reduce((a, q) => a + q.y, 0) / xs.length;
          view.hl = new Set(g.cells);
          view.combo = e.comboStart + gi;
          fx.sfx(view.combo > 1 ? 'combo' : 'match', 1 + Math.min(8, view.combo - 1) * 0.06);
          fx.vibrate(10);
          floater(t('battle.combo', { n: view.combo }), cx, cy, '#ffffff', 22 + Math.min(14, view.combo));
          if (g.type !== 5 && !state.members.some((m) => m.element === g.type)) floater(t('battle.noAttacker'), cx, cy + 26, '#ff9aa8', 16);
          const share = gi === ng - 1 ? dmg - given : Math.round(dmg / ng);
          given += share;
          if (share > 0) tally(share);
          await sleep(ANIM.groupHold);
          const cleared = view.board;
          for (const i of g.cells) {
            const c = cellCenter(i);
            const col = st.boardBefore.cells[i];
            for (let k = 0; k < 6; k++) {
              const ang = (k / 6) * Math.PI * 2 + i;
              view.particles.push({ x: c.x, y: c.y, vx: Math.cos(ang) * 0.2, vy: Math.sin(ang) * 0.2 - 0.05, col, age: 0, life: 460 });
            }
            cleared.cells[i] = -1;
          }
          view.hl = null;
          await sleep(ANIM.groupPop);
        }
        view.board = structuredClone(st.board);
        view.fall = st.falls;
        fx.sfx('drop');
        await sleep(ANIM.fall, (k) => (view.fallT = easeOut(k)));
        view.fall = null;
        view.fallT = 1;
        await sleep(ANIM.afterFall);
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
    await flush();
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
    view.tally = { shown: 0, target: 0, pulse: 0 };
    const hadStep = r.events.some((e) => e.type === 'step');
    if (action.type === 'move' && !hadStep) floater(t('battle.noCombo'), W / 2, 700, '#c8ccff', 30);
    celebrated = false;
    await animate(r.events, r.state.status === 'won');
    if (r.state.status === 'won' && !celebrated && alive) {
      celebrated = true;
      fx.sfx('fanfare');
      celebrate?.();
      await sleep(1500);
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

  // Nhấn giữ tướng/quái: xem chi tiết. Chạm nhanh vào tướng: dùng kỹ năng.
  let press = null;
  function startPress(kind, idx, p, ev) {
    clearTimeout(press?.timer);
    press = { kind, idx, x: p.x, y: p.y, fired: false, id: ev.pointerId };
    if (onInspect) press.timer = setTimeout(() => { if (press) { press.fired = true; fx.vibrate?.(15); onInspect(kind, idx); } }, 450);
  }
  function endPress(ev, cancel) {
    if (!press) return;
    const pr = press;
    press = null;
    clearTimeout(pr.timer);
    if (cancel || pr.fired) return;
    if (busy || state.status !== 'playing') return;
    if (pr.kind === 'enemy') {
      if (state.enemies[pr.idx]?.hp > 0) {
        const r = stepper(state, { type: 'target', index: pr.idx });
        if (r.events[0]?.type !== 'invalid') {
          state = r.state;
          sync();
          fx.sfx('pick');
          view.lockFlash = 1;
        }
      }
      return;
    }
    if (state.members[pr.idx]?.skillCd === 0) run({ type: 'skill', index: pr.idx });
  }

  function onDown(ev) {
    const p0 = pos(ev);
    if (view.intro) {
      view.intro.age = Math.max(view.intro.age, view.intro.dur - 650); // bỏ qua tới "Bắt đầu!"
      return;
    }
    if (state.status !== 'playing' || busy) {
      // đang bận: chỉ cho xem chi tiết
      if (p0.y >= 384 && p0.y <= 466) { const i = Math.floor((p0.x - 12) / 104); if (i >= 0 && i < state.members.length) startPress('member', i, p0, ev); }
      else if (p0.y >= 80 && p0.y <= 330 && state.enemies.length) startPress('enemy', Math.min(state.enemies.length - 1, Math.floor(p0.x / (W / state.enemies.length))), p0, ev);
      return;
    }
    const p = p0;
    for (const d of state.duos) {
      const cx = 12 + (d.slot + 1) * 104 - 3;
      if (Math.abs(p.x - cx) <= 30 && p.y >= 380 && p.y <= 406) {
        if (d.cd === 0) run({ type: 'duo', index: d.slot });
        return;
      }
    }
    if (p.y >= 384 && p.y <= 466) {
      const idx = Math.floor((p.x - 12) / 104);
      if (idx >= 0 && idx < state.members.length) startPress('member', idx, p, ev);
      return;
    }
    if (p.y >= 80 && p.y <= 330 && state.enemies.length) {
      const idx = Math.min(state.enemies.length - 1, Math.floor(p.x / (W / state.enemies.length)));
      startPress('enemy', idx, p, ev);
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
  function slideFrom(dest, src) {
    // Viên ngọc bị đi qua trượt từ ô nó đang ở (src) về ô trống mà viên cầm để lại (dest).
    const from = cellCenter(src);
    (view.slides ||= {})[dest] = { x: from.x, y: from.y, age: 0 };
  }

  // Đi một bước sang ô kề n (lùi một bước = hoàn tác).
  function stepTo(n) {
    const last = drag.path[drag.path.length - 1];
    if (drag.path.length >= 2 && n === drag.path[drag.path.length - 2]) {
      drag.path.pop();
      slideFrom(last, n);
      fx.sfx('move');
      return;
    }
    drag.path.push(n);
    slideFrom(last, n);
    fx.sfx(['move', 'move2', 'move3'][(drag.path.length - 2) % 3]);
    fx.vibrate(8);
    if (!drag.t0) drag.t0 = performance.now();
  }

  const cr = (c) => [Math.floor(c / 6), c % 6];
  // khoảng cách theo số bước đi (Chebyshev khi cho đi chéo, Manhattan khi không)
  const manh = (a, b) => { const [ar, ac] = cr(a); const [br, bc] = cr(b); const dr = Math.abs(ar - br); const dc = Math.abs(ac - bc); return allowDiag ? Math.max(dr, dc) : dr + dc; };
  function segDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    const k = l2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
    return Math.hypot(px - (x0 + k * dx), py - (y0 + k * dy));
  }

  // Ngón tay (x,y) vừa đi từ (px,py): đưa viên cầm tới ô chứa ngón tay. Nếu ngón tay cắt góc hoặc đi rất nhanh
  // nhảy qua ô, các ô trung gian được bắc cầu theo quỹ đạo ngón tay nên không bị mất bước.
  function follow(x, y, px, py) {
    const c = cellAt(x, y);
    if (c < 0) return false;
    let last = drag.path[drag.path.length - 1];
    if (c === last) return false;
    const dc = Math.hypot(x - cellCenter(c).x, y - cellCenter(c).y);
    const dl = Math.hypot(x - cellCenter(last).x, y - cellCenter(last).y);
    if (dc > dl - CELL * 0.06) return false; // trễ nhẹ chống rung ở biên ô
    let moved = false;
    for (let guard = 0; guard < 8 && last !== c; guard++) {
      let target = c;
      if (!areAdjacent(last, c, allowDiag)) {
        let best = null;
        for (const n of cellsAround(last)) {
          if (state.locked.includes(n) || manh(n, c) >= manh(last, c)) continue;
          const d = segDist(cellCenter(n).x, cellCenter(n).y, px, py, x, y);
          if (!best || d < best.d) best = { n, d };
        }
        if (!best) break;
        target = best.n;
      } else if (state.locked.includes(c)) break;
      stepTo(target);
      last = target;
      moved = true;
    }
    return moved;
  }
  function cellsAround(c) {
    const [r, k] = cr(c);
    const out = [];
    if (r > 0) out.push(c - 6);
    if (r < 4) out.push(c + 6);
    if (k > 0) out.push(c - 1);
    if (k < 5) out.push(c + 1);
    if (allowDiag) {
      if (r > 0 && k > 0) out.push(c - 7);
      if (r > 0 && k < 5) out.push(c - 5);
      if (r < 4 && k > 0) out.push(c + 5);
      if (r < 4 && k < 5) out.push(c + 7);
    }
    return out;
  }

  function onMove(ev) {
    if (press && !press.fired) { const q = pos(ev); if (Math.hypot(q.x - press.x, q.y - press.y) > 18) endPress(ev, true); }
    if (!drag) return;
    // Ngón tay di chuyển nhanh có thể bỏ qua ô: nội suy từ vị trí trước tới vị trí mới, bước nhỏ hơn 1/4 ô.
    const events = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
    const pts = (events.length ? events : [ev]).map(pos);
    let changed = false;
    for (const p of pts) {
      const dx = p.x - drag.x;
      const dy = p.y - drag.y;
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (CELL / 4)));
      let qx = drag.x, qy = drag.y;
      for (let k = 1; k <= n; k++) {
        const x = drag.x + (dx * k) / n;
        const y = drag.y + (dy * k) / n;
        if (follow(x, y, qx, qy)) changed = true;
        qx = x;
        qy = y;
      }
      drag.x = p.x;
      drag.y = p.y;
    }
    if (changed) view.board = drag.path.length >= 2 ? applyPath(state.board, drag.path) : structuredClone(state.board);
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  const up = (ev) => { endPress(ev, false); release(); };
  const cancel = (ev) => { endPress(ev, true); release(); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);

  let last = performance.now();
  function frame(now) {
    if (!alive) return;
    const real = now - last;
    last = now;
    let dt = real;
    if (view.freeze > 0) { view.freeze -= real; dt = 0; } else dt = real * (view.slow ?? 1);
    if (drag && drag.t0) {
      const k = 1 - (now - drag.t0) / dragMs;
      view.timer = Math.max(0, k);
      if (k <= 0) release();
    }
    if (view.tally) { const ty = view.tally; ty.shown += (ty.target - ty.shown) * Math.min(1, real / 120); if (Math.abs(ty.target - ty.shown) < 1) ty.shown = ty.target; ty.pulse = Math.max(0, ty.pulse - dt / 500); }
    if (view.intro) {
      const it = view.intro;
      const prev = it.age;
      it.age += real;
      view.enemies.forEach((e, i) => {
        const land = 250 + i * 230 + 520 * 0.62;
        if (!e.landed && it.age >= land) {
          e.landed = true;
          const ex = (W / Math.max(1, view.enemies.length)) * i + W / Math.max(1, view.enemies.length) / 2;
          view.rings.push({ x: ex, y: 235, col: e.element, age: 0, life: 520 });
          for (let k = 0; k < 10; k++) view.particles.push({ x: ex + (k - 5) * 9, y: 232, vx: (k - 4.5) * 0.02, vy: -0.05 - Math.random() * 0.05, col: e.element, age: 0, life: 500 + Math.random() * 300 });
          view.camShake = Math.max(view.camShake || 0, it.danger ? 9 : 5);
          fx.sfx('hurt');
          fx.vibrate?.(it.danger ? 35 : 15);
        }
      });
      if (prev < 650 && it.age >= 650) fx.sfx(it.danger ? 'finale' : 'preview');
      if (prev < it.dur - 650 && it.age >= it.dur - 650) fx.sfx('combo');
      if (it.age >= it.dur) {
        view.intro = null;
        busy = false;
        view.canAct = true;
      }
    }
    if (view.lockFlash) view.lockFlash = Math.max(0, view.lockFlash - dt / 400);
    if (view.slides) for (const k in view.slides) { view.slides[k].age += dt; if (view.slides[k].age > 180) delete view.slides[k]; }
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
      en.hpShow = en.hpShow == null ? en.hp : en.hpShow + (en.hp - en.hpShow) * Math.min(1, real / 120);
      if (en.deadAge !== undefined && en.deadAge < 9999) en.deadAge += dt;
    }
    // máy quay: vignette + phóng nhẹ khi slow-motion, rung và chớp trắng khi trúng nặng
    const sl = (view.slow ?? 1) < 1;
    view.vig = (view.vig || 0) + ((sl ? 1 : 0) - (view.vig || 0)) * Math.min(1, real / 160);
    view.zoom = (view.zoom || 1) + ((sl ? 1.06 : 1) - (view.zoom || 1)) * Math.min(1, real / 220);
    view.camShake = Math.max(0, (view.camShake || 0) - real / 30);
    view.whiteFlash = Math.max(0, (view.whiteFlash || 0) - real / 330);
    draw(g, view, now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    getDragPath: () => (drag ? drag.path.slice() : null),
    getState: () => state,
    isBusy: () => busy,
    destroy() {
      alive = false;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      clearTimeout(press?.timer);
    },
  };
}
