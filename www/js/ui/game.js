// Điều khiển một trận: nhập liệu cảm ứng/chuột, hoạt ảnh, gọi core. Logic game nằm hết trong core/.
import { applyPath } from '../core/move.js';
import { areAdjacent } from '../core/board.js';
import { elementMultiplier } from '../core/damage.js';
import { step as coreStep } from '../core/battle.js';
import { findHintAsync } from './hint.js';
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
const DIAG_ASSIST = 0.38; // tỉ lệ ô: lệch ngang và dọc đều vượt ngưỡng này thì tính là bước chéo
const SKILL_SFX = ['water', 'fire', 'wood', 'light', 'dark', 'heart']; // chỉ số hệ → hậu tố tên âm kỹ năng
const NOFX = { sfx() {}, vibrate() {} };


export function startGame({ canvas, ctx, t, state: initial, stepper, titleText, onEnd, fx = NOFX, hint = false, onInspect = null, celebrate = null, intro = null, onSkillAsk = null, onSettled = null, hintOpts = {}, guard = null, onReject = null, onLock = null }) {
  let moveGuard = guard; // tutorial: chỉ cho đúng nước/hành động được chỉ định
  const g = canvas.getContext('2d');
  let state = initial;
  let busy = false;
  let alive = true;
  let drag = null;
  const dragMs = ctx.config.dragTimeMs + (initial.dragBonusMs || 0);
  const allowDiag = ctx.config.board.allowDiagonal;

  const view = {
    t,
    rel: (el) => { const e = view.enemies.find((x) => x.hp > 0); return e ? elementMultiplier(el, e.element, ctx.config) : 1; }, // khắc/bị khắc quái đang bị nhắm
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
    pops: [], // số sát thương của từng tướng, nảy ở ô tướng rồi bay gộp vào tổng
    particles: [],
    hint: null,
    shots: [],
    rings: [],
    blasts: [], // ngọc đang nổ: bóng ngọc phình + lóe sáng
    tint: null, // lóe màu hệ phủ cả màn khi tung kỹ năng
    comboPop: 0, // 1→0: số combo nảy to mỗi lần tăng
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
    view.duos = state.duos.map((d) => ({ ...d, ready: duoReady(d) }));
    view.freezeTurns = state.freeze || 0;
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
    const s0 = state;
    findHintAsync(ctx, s0, undefined, 4, hintOpts).then((hp) => { if (hp && alive && state === s0 && !view.hint) view.hint = { path: hp.path, text: t('tut.hint', { n: hp.combos }) }; });
  }

  const TALLY = { x: W / 2 + 90, y: 340 }; // nơi vẽ tổng sát thương (khớp render.js)
  const enemyX = (i) => (W / state.enemies.length) * i + W / state.enemies.length / 2;
  // Kỹ năng theo hệ: lớp hạt riêng (bong bóng / tàn lửa / lá / tia sáng / khói tím / tim) + lóe màu nhẹ toàn màn.
  const castFx = (el) => {
    const R = Math.random;
    const P = view.particles;
    const add = (n, mk) => { for (let i = 0; i < n; i++) P.push({ age: 0, ...mk(i) }); };
    view.tint = { col: el, age: 0, life: 520 };
    if (el === 0) add(20, () => ({ shape: 'bubble', x: R() * W, y: 560 + R() * 360, vx: (R() - 0.5) * 0.03, vy: -0.05 - R() * 0.09, g: -0.00003, size: 5 + R() * 9, col: 0, life: 1100 + R() * 500 }));
    else if (el === 1) add(44, () => ({ shape: 'ember', x: R() * W, y: 700 + R() * 240, vx: (R() - 0.5) * 0.06, vy: -0.13 - R() * 0.2, g: -0.00008, size: 3 + R() * 4.5, color: R() < 0.5 ? '#ffb347' : '#ff6a2a', life: 800 + R() * 500 }));
    else if (el === 2) add(18, () => ({ shape: 'leaf', x: R() * W, y: -10 + R() * 120, vx: (R() - 0.5) * 0.05, vy: 0.05 + R() * 0.08, g: 0, size: 7 + R() * 6, rot: R() * 6, vr: (R() - 0.5) * 0.008, col: 2, life: 1300 + R() * 500 }));
    else if (el === 3) add(26, () => ({ shape: 'spark', x: 30 + R() * (W - 60), y: 130 + R() * 640, vx: 0, vy: -0.01, g: 0, size: 5 + R() * 8, color: R() < 0.5 ? '#fff6c0' : '#ffd84a', life: 700 + R() * 600 }));
    else if (el === 4) add(16, () => ({ shape: 'wisp', x: R() * W, y: 200 + R() * 400, vx: (R() - 0.5) * 0.03, vy: -0.02 - R() * 0.04, g: 0, size: 14 + R() * 16, color: R() < 0.5 ? '#8a4cff' : '#4b2a8a', life: 1100 + R() * 500 }));
    else add(14, () => ({ shape: 'heart', x: 40 + R() * (W - 80), y: 520 + R() * 380, vx: (R() - 0.5) * 0.03, vy: -0.07 - R() * 0.08, g: 0, size: 12 + R() * 10, color: R() < 0.5 ? '#ff8fba' : '#ffc2d8', life: 1100 + R() * 400 }));
  };
  const floater = (s, x, y, color, size = 26, kind = 'text', life = 1000) => view.floaters.push({ s, x: Math.max(70, Math.min(W - 70, x)), y, color, size, kind, age: 0, life });
  const nf = new Intl.NumberFormat(typeof document !== 'undefined' ? document.documentElement.lang || 'vi' : 'vi');
  const fmt = (n) => nf.format(n);
  const LIGHT = ['#9fd2ff', '#ffb098', '#a6f0b4', '#fff0a0', '#d2b0ff', '#ffc0da']; // màu số theo hệ

  const memberPos = (id) => {
    const du = state.duos.find((d) => d.id === id);
    if (du) return { x: 12 + du.slot * 104 + 49 + 52, y: 466 - 48, el: state.members[du.slot]?.element ?? 3 };
    const i = Math.max(0, state.members.findIndex((m) => m.id === id));
    return { x: 12 + i * 104 + 49, y: 466 - 48, el: state.members[i]?.element ?? 3 };
  };
  // cỡ số theo tỉ lệ máu quái bị mất: đòn nhỏ vẫn đọc được, đòn lớn nổi bật nhưng không tràn màn
  const duoReady = (d) => !!d && state.members[d.slot]?.skillCd === 0 && state.members[d.slot + 1]?.skillCd === 0 && state.members[d.slot]?.skillMax > 0 && state.members[d.slot + 1]?.skillMax > 0;
  const duoOf = (idx) => state.duos.find((d) => d.slot === idx || d.slot + 1 === idx);
  const dmgSize = (a, maxHp) => 34 + Math.min(1, (a / Math.max(1, maxHp)) * 3) * 34;

  // Mỗi đòn: quả cầu bay từ nhân vật tới quái, tới nơi mới trừ máu + số nổi + rung quái.
  function applyHits(hits, stagger = 90, finalKill = false, onFinal = null) {
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
          // khắc hệ: số to hơn + màu nóng + vòng sáng; bị kháng: số nhỏ hơn, xám (không còn chữ, đỡ rối)
          const em = h.amount > 0 ? elementMultiplier(src.el, en.element, ctx.config) : 1;
          const strong = em > 1; const weak = em < 1;
          const lbl = h.amount === 0 && h.absorbed ? t('battle.blocked') : `${strong ? '▲' : weak ? '▼' : ''}${fmt(h.amount)}`;
          floater(lbl, ex + ((n % 3) - 1) * 40, 128 - Math.min(3, n) * 26, strong ? '#ffd84a' : weak ? '#b9b2a8' : LIGHT[src.el] || '#ffd84a', h.amount === 0 ? 24 : Math.round(dmgSize(h.amount, en.maxHp) * (strong ? 1.25 : weak ? 0.8 : 1)), 'dmg', strong ? 1300 : 1100);
          if (strong && n === 0) {
            view.rings.push({ x: ex, y: 160, col: src.el, age: 0, life: 520 });
            view.rings.push({ x: ex, y: 160, col: 3, age: 0, life: 380 });
            for (let p = 0; p < 12; p++) { const a = (p / 12) * 6.283; view.particles.push({ x: ex, y: 160, vx: Math.cos(a) * 0.28, vy: Math.sin(a) * 0.28, color: p % 2 ? '#fff0a0' : '#ffb347', age: 0, life: 520 }); }
            view.camShake = Math.max(view.camShake || 0, 5);
            en.hit = 1.4;
            fx.sfx('combo', 1.15);
          }
          if (big) {
            view.rings.push({ x: ex, y: 160, col: src.el, age: 0, life: 420 });
            view.camShake = Math.max(view.camShake || 0, 6);
          }
          if (h.thawed) floater(t('effect.freeze.name'), ex, 210, '#9ad0ff', 20);
          if (before > 0 && en.hp <= 0) {
            // chỉ đòn làm quái CUỐI CÙNG chết mới là đòn kết liễu (slow-motion bắt đầu từ đây)
            const last = finalKill && view.enemies.every((e2) => e2.hp <= 0);
            killEnemy(h.enemy, last);
            if (last) onFinal?.();
          }
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
  // Quái chết: nổ hạt theo hệ, rung; đòn làm quái cuối chết thì dừng hình ngắn rồi chuyển slow-motion (từ đúng đòn đó).
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
  const ANIM = { popHold: 380, flyTime: 280, preview: 0, previewNext: 0, groupHold: 30, groupPop: 110, fall: 300, afterFall: 50, finale: 800, preShot: 200, stagger: 170, postShot: 350 };
  const tally = (add) => {
    const ty = (view.tally ||= { shown: 0, target: 0, pulse: 0 });
    ty.target = add == null ? 0 : ty.target + add;
    if (add != null) ty.pulse = 1;
  };
  // Nhóm ngọc tan tới đâu, các tướng ăn nhóm đó nảy số sát thương (màu theo hệ) ngay trên ô tướng,
  // giữ một nhịp rồi bay vào ô tổng. Cuối lượt tổng nổ to rồi mới bắn vào quái.
  let popN = 0;
  function spawnPops(hits, gi) {
    const per = new Map();
    for (const h of hits) if (h.kind === 'damage' && h.group === gi && h.amount > 0) per.set(h.from, (per.get(h.from) || 0) + h.amount);
    const hp0 = Math.max(1, state.enemies[0]?.maxHp || 1);
    for (const [id, amt] of per) {
      const pos = memberPos(id);
      const k = popN++ % 3;
      const q = { s: fmt(amt), amt, x: pos.x + (k - 1) * 16, y: 440 + (k - 1) * 14, el: pos.el, size: Math.round(32 + Math.min(1, (amt / hp0) * 3) * 26), delay: 0, age: 0, hold: ANIM.popHold, fly: ANIM.flyTime };
      view.pops.push(q);
      fx.sfx('hit', 1 + Math.min(6, view.combo) * 0.06);
      setTimeout(() => {
        if (!alive) return;
        view.rings.push({ x: TALLY.x, y: TALLY.y, col: q.el, age: 0, life: 320 });
        tally(amt);
      }, q.hold + q.fly);
    }
  }
  // Hồi máu: mỗi tướng nảy số hồi (xanh) theo phần Hồi của mình, bay vào thanh máu đội; bàn cờ sáng xanh.
  // Máu cộng ngay khi số tới nơi; đòn hồi của ngọc bị bỏ qua ở flush để không cộng đôi.
  const HEAL_AT = { x: W / 2, y: 378 };
  function spawnHealPops(hits, gi, g) {
    const heal = hits.filter((h) => h.kind === 'heal' && h.from === 'orb' && h.group === gi).reduce((a, h) => a + h.amount, 0);
    if (heal <= 0) return;
    const total = Math.max(1, state.members.reduce((a, m) => a + m.heal, 0));
    let left = heal;
    const hs = state.members.filter((m) => m.heal > 0);
    hs.forEach((m, k) => {
      const amt = k === hs.length - 1 ? left : Math.round((heal * m.heal) / total);
      left -= amt;
      if (amt <= 0) return;
      const pos = memberPos(m.id);
      const q = { s: `+${fmt(amt)}`, amt, x: pos.x, y: 430 - (k % 2) * 14, el: 5, heal: true, size: Math.round(30 + Math.min(1, amt / Math.max(1, view.maxHp) * 4) * 22), delay: k * 60, age: 0, hold: 360, fly: 300 };
      view.pops.push(q);
      setTimeout(() => {
        if (!alive) return;
        view.hp = Math.min(view.maxHp, view.hp + amt);
        view.hpPulse = 1;
        view.rings.push({ x: HEAL_AT.x, y: HEAL_AT.y, col: 2, age: 0, life: 420 });
        for (let p = 0; p < 6; p++) view.particles.push({ x: HEAL_AT.x + (p - 3) * 22, y: HEAL_AT.y, vx: (p - 2.5) * 0.02, vy: -0.08 - (p % 3) * 0.03, color: '#8dffb0', age: 0, life: 700 });
      }, q.delay + q.hold + q.fly);
    });
    fx.sfx('heal');
    view.healGlow = 1;
    // lá sáng bay lên từ các ngọc tim vừa tan
    for (const i of g.cells) {
      const c = cellCenter(i);
      for (let p = 0; p < 3; p++) view.particles.push({ x: c.x + (p - 1) * 10, y: c.y, vx: (p - 1) * 0.01, vy: -0.09 - p * 0.025, color: p % 2 ? '#b8ffd0' : '#6bf0a0', age: 0, life: 900 });
    }
  }
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
      } else if (h.kind === 'heal') {
        if (h.from !== 'orb') heal += h.amount; // hồi của ngọc đã cộng lúc số nảy
      }
      else out.push(h);
    }
    const res = [...map.values()];
    if (heal > 0) res.push({ kind: 'heal', amount: heal });
    return res.concat(out);
  };
  // Nhóm 4 ngọc: nhân hệ số lớn; nhóm 5+ ngọc: sinh ra Ngọc Nâng Cấp (mỗi ngọc nâng cấp trong nhóm sau này +25% sát thương).
  // NỔ NGỌC: cấp 1 (3 ngọc) gọn; cấp 2 (4 ngọc) thêm vòng sóng + tia sáng; cấp 3 (5+ ngọc) bùng lớn, sao nổ, lóe màn, rung mạnh.
  function blastGroup(g, boardBefore, cx, cy) {
    const R = Math.random, P = view.particles;
    const tier = g.size >= 5 ? 3 : g.size === 4 ? 2 : 1;
    const hot = ['#ffffff', '#fff0a0'];
    g.cells.forEach((i, n) => {
      const c = cellCenter(i);
      const type = boardBefore.cells[i];
      view.blasts.push({ x: c.x, y: c.y, type, enh: !!boardBefore.enh[i], tier, age: 0, delay: n * 14, life: 260 });
      const shards = 5 + tier * 3;
      for (let k = 0; k < shards; k++) {
        const a = R() * 6.283, sp = 0.14 + R() * (0.16 + tier * 0.07);
        P.push({ shape: 'shard', x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.1, g: 0.0007, size: 4 + R() * (3 + tier * 1.5), rot: R() * 6, vr: (R() - 0.5) * 0.03, col: type, age: 0, life: 420 + R() * 260 });
      }
      for (let k = 0; k < 2 + tier * 2; k++) {
        const a = R() * 6.283, sp = 0.08 + R() * 0.28;
        P.push({ shape: 'glint', x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.0001, size: 4 + R() * 6, color: hot[k % 2], age: 0, life: 300 + R() * 300 });
      }
    });
    view.rings.push({ x: cx, y: cy, col: g.type, age: 0, life: 300 + tier * 90, r0: 14, r1: 70 + tier * 45 });
    if (tier >= 2) view.rings.push({ x: cx, y: cy, col: 3, age: 0, life: 420, r0: 6, r1: 120 + tier * 30 });
    if (tier >= 3) {
      view.rings.push({ x: cx, y: cy, col: g.type, age: 0, life: 620, r0: 10, r1: 220 });
      for (let k = 0; k < 18; k++) {
        const a = (k / 18) * 6.283 + R() * 0.2, sp = 0.35 + R() * 0.3;
        P.push({ shape: 'glint', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, size: 7 + R() * 7, color: k % 2 ? '#fff0a0' : '#ffffff', age: 0, life: 520 + R() * 200 });
      }
      view.whiteFlash = Math.max(view.whiteFlash || 0, 0.35);
    }
    view.camShake = Math.max(view.camShake || 0, 2 + tier * 2.5);
    view.blastFlash = { x: cx, y: cy, col: g.type, tier, age: 0, life: 200 + tier * 60 };
    fx.vibrate?.(8 + tier * 8);
  }
  const i0keep = (g) => (g.size >= 5 ? g.cells[0] : -1);
  let pendEnh = []; // ô sẽ có Ngọc Nâng Cấp mới sau khi bàn rơi xong
  function bigMatchFx(g, cx, cy, keep) {
    const el = g.type;
    const five = g.size >= 5;
    floater(five ? t('battle.enhance') : t('battle.four', { n: g.size }), cx, cy - 34, five ? '#ffe27a' : '#ffffff', five ? 30 : 24, 'text', 1200);
    view.rings.push({ x: cx, y: cy, col: el, age: 0, life: five ? 620 : 420 });
    view.camShake = Math.max(view.camShake || 0, five ? 7 : 4);
    fx.sfx(five ? 'enhance' : 'combo', 1.1);
    fx.vibrate?.(five ? 30 : 15);
    if (five && keep >= 0) {
      const to = cellCenter(keep);
      for (const i of g.cells) {
        const c = cellCenter(i);
        view.particles.push({ x: c.x, y: c.y, vx: (to.x - c.x) / 520, vy: (to.y - c.y) / 520, color: '#ffe27a', age: 0, life: 520 });
      }
      pendEnh.push(keep);
    }
  }
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
      let slowed = false;
      const wait = applyHits(hits, ANIM.stagger * 1.4, true, () => {
        slowed = true;
        fx.sfx('whoosh');
        view.slow = 0.25;
      });
      // các đòn trước đòn kết liễu chạy tốc độ thường
      await sleep(wait + 150);
      for (let g = 0; g < 90 && !slowed && alive; g++) await sleep(16);
      if (slowed) {
        await sleep(750);
        await sleep(520, (k) => (view.slow = 0.25 + 0.75 * easeOut(k)));
        view.slow = 1;
      }
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
        pendingHits.push(...e.hits);
        const ng = st.groups.length;
        // xem lại thành quả: sáng đồng thời mọi nhóm vừa ghép được, rồi mới nổ từng nhóm
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
          view.comboPop = 1;
          fx.sfx(view.combo > 1 ? 'combo' : 'match', 1 + Math.min(8, view.combo - 1) * 0.06);
          fx.vibrate(10);
          floater(t('battle.combo', { n: view.combo }), cx, cy, '#ffffff', 22 + Math.min(14, view.combo));
          if (g.type !== 5 && !state.members.some((m) => m.element === g.type)) floater(t('battle.noAttacker'), cx, cy + 26, '#ff9aa8', 16);
          await sleep(ANIM.groupHold);
          spawnPops(e.hits, gi);
          if (g.type === 5) spawnHealPops(e.hits, gi, g);
          if (g.size >= 4) bigMatchFx(g, cx, cy, i0keep(g));
          const cleared = view.board;
          for (const i of g.cells) cleared.cells[i] = -1;
          blastGroup(g, st.boardBefore, cx, cy);
          view.hl = null;
          await sleep(ANIM.groupPop);
        }
        view.board = structuredClone(st.board);
        view.enhPop = pendEnh.map((i) => ({ i, age: 0 }));
        pendEnh = [];
        view.fall = st.falls;
        fx.sfx('drop');
        await sleep(ANIM.fall, (k) => (view.fallT = easeOut(k)));
        view.fall = null;
        view.fallT = 1;
        await sleep(ANIM.afterFall);
      } else if (e.type === 'skill' || e.type === 'duo' || e.type === 'passive') {
        // Kỹ năng đúng hệ của tướng tung ra (Duo dùng tiếng kép riêng); thiếu mẫu thì rơi về tiếng chung.
        castFx(state.members[e.type === 'duo' ? e.slot : e.member]?.element ?? 5);
        if (e.type === 'duo') {
          // hợp lực: hai hệ cùng bung, chữ DUO, vòng sáng hội tụ giữa hai tướng, rung màn
          setTimeout(() => castFx(state.members[e.slot + 1]?.element ?? 5), 160);
          const mx = 12 + e.slot * 104 + 101;
          floater(t('battle.duoCast'), W / 2, 250, '#fff0a0', 46, 'text', 1500);
          view.rings.push({ x: mx, y: 416, col: 3, age: 0, life: 820 }, { x: mx, y: 416, col: state.members[e.slot]?.element ?? 3, age: 0, life: 640 });
          for (let q = 0; q < 26; q++) { const a = (q / 26) * 6.283; view.particles.push({ x: mx, y: 416, vx: Math.cos(a) * 0.3, vy: Math.sin(a) * 0.3 - 0.05, color: q % 2 ? '#fff0a0' : '#ffffff', age: 0, life: 650 }); }
          view.camShake = Math.max(view.camShake || 0, 9);
          fx.vibrate?.([40, 30, 80]);
        }
        if (e.type === 'duo') {
          fx.sfx(`skill_${SKILL_SFX[state.members[e.slot]?.element] ?? 'heart'}`);
          setTimeout(() => fx.sfx(`skill_${SKILL_SFX[state.members[e.slot + 1]?.element] ?? 'heart'}`), 150);
          setTimeout(() => fx.sfx('skill2', 1.1), 320);
        } else fx.sfx(`skill_${SKILL_SFX[state.members[e.member]?.element] ?? 'heart'}`);
        for (const who of e.type === 'duo' ? [e.slot, e.slot + 1] : [e.member]) {
          const m = state.members[who];
          if (m) view.rings.push({ x: 12 + who * 104 + 49, y: 416, col: m.element, age: 0, life: 600 });
        }
        const wait = applyHits(e.hits);
        view.board = structuredClone(e.board);
        await sleep(Math.max(350, wait));
      } else if (e.type === 'enemyAttack') {
        view.shake = { enemy: e.enemy };
        view.lunge = { enemy: e.enemy, age: 0 }; // quái lao về phía đội khi tấn công
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
      } else if (e.type === 'effect') {
        if (e.applied) fx.sfx('debuff');
      } else if (e.type === 'reflect') {
        fx.sfx('reflect');
        if (e.to === 'enemy') {
          view.enemies[e.enemy].hp = Math.max(0, view.enemies[e.enemy].hp - e.amount);
          floater(`-${e.amount}`, enemyX(e.enemy), 150, '#ff9f6b');
        }
      } else if (e.type === 'revive') {
        fx.sfx('revive');
        view.whiteFlash = 0.6;
        view.hp = e.hp;
        floater(t('battle.revive'), W / 2, 300, '#ffd24a', 40, 'dmg', 1400);
        await sleep(700);
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
      if (view.hintKeep) view.hint = view.hintKeep;
      return;
    }
    view.tally = { shown: 0, target: 0, pulse: 0 };
    const hadStep = r.events.some((e) => e.type === 'step');
    if (action.type === 'move' && !hadStep && !(state.freeze > 0)) floater(t('battle.noCombo'), W / 2, 700, '#c8ccff', 30);
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
    else if (alive) onSettled?.(state, action);
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
    if (d.path.length >= 2 && moveGuard && !moveGuard({ type: 'move', path: d.path })) {
      view.board = structuredClone(state.board); // sai đường: trả bàn về như cũ, yêu cầu kéo lại
      if (view.hintKeep) view.hint = view.hintKeep;
      fx.sfx('error');
      fx.vibrate?.(30);
      onReject?.({ type: 'move', path: d.path });
    } else if (d.path.length >= 2) run({ type: 'move', path: d.path });
    else { view.board = structuredClone(state.board); if (view.hintKeep) view.hint = view.hintKeep; }
  }

  // Nhấn giữ tướng/quái: xem chi tiết. Chạm nhanh vào tướng: dùng kỹ năng.
  let press = null;
  const onTeamFx = (p) => !!state.team?.effects?.length && p.y >= 318 && p.y <= 358 && p.x >= 8 && p.x <= 20 + state.team.effects.length * 30;
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
    if (pr.kind === 'team') return;
    if (pr.kind === 'enemy') {
      if (state.enemies[pr.idx]?.hp > 0) {
        if (moveGuard && !moveGuard({ type: 'target', index: pr.idx })) { fx.sfx('error'); onReject?.({ type: 'target', index: pr.idx }); return; }
        const r = stepper(state, { type: 'target', index: pr.idx });
        if (r.events[0]?.type !== 'invalid') {
          state = r.state;
          sync();
          fx.sfx('pick');
          view.lockFlash = 1;
          onLock?.(state.focus);
        }
      }
      return;
    }
    if (moveGuard && !moveGuard({ type: 'skill', index: pr.idx })) { fx.sfx('error'); onReject?.({ type: 'skill', index: pr.idx }); return; }
    if (state.members[pr.idx]?.skillCd === 0) {
      const du = duoOf(pr.idx);
      const duoGo = du && duoReady(du) ? () => { if (!busy && state.status === 'playing' && duoReady(du)) run({ type: 'duo', index: du.slot }); } : null;
      if (onSkillAsk) onSkillAsk(pr.idx, () => { if (!busy && state.status === 'playing' && state.members[pr.idx]?.skillCd === 0) run({ type: 'skill', index: pr.idx }); }, duoGo, du);
      else run({ type: 'skill', index: pr.idx });
    }
  }

  function onDown(ev) {
    const p0 = pos(ev);
    if (view.intro) {
      view.intro.age = Math.max(view.intro.age, view.intro.dur - 650); // bỏ qua tới "Bắt đầu!"
      return;
    }
    if (state.status !== 'playing' || busy) {
      // đang bận: chỉ cho xem chi tiết
      if (onTeamFx(p0)) { startPress('team', 0, p0, ev); return; }
      if (p0.y >= 382 && p0.y <= 468) { const i = Math.floor((p0.x - 12) / 104); if (i >= 0 && i < state.members.length) startPress('member', i, p0, ev); }
      else if (p0.y >= 80 && p0.y <= 330 && state.enemies.length) startPress('enemy', Math.min(state.enemies.length - 1, Math.floor(p0.x / (W / state.enemies.length))), p0, ev);
      return;
    }
    const p = p0;
    if (view.freezeTurns > 0 && p.x >= 408 && p.x <= 528 && p.y >= 344 && p.y <= 380) { fx.sfx?.('confirm'); run({ type: 'clear' }); return; }
    if (onTeamFx(p)) { startPress('team', 0, p, ev); return; }
    for (const d of state.duos) {
      const cx = 12 + (d.slot + 1) * 104 - 3;
      if (Math.abs(p.x - cx) <= 30 && p.y >= 380 && p.y <= 406) {
        if (duoReady(d)) {
          const go = () => { if (!busy && state.status === 'playing' && duoReady(d)) run({ type: 'duo', index: d.slot }); };
          if (onSkillAsk) onSkillAsk(d.slot, () => { if (!busy && state.status === 'playing' && state.members[d.slot]?.skillCd === 0) run({ type: 'skill', index: d.slot }); }, go, d);
          else go();
        } else fx.sfx?.('error');
        return;
      }
    }
    if (p.y >= 382 && p.y <= 468) {
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
    view.hintKeep = view.hint;
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
    let c = cellAt(x, y);
    if (c < 0) return false;
    let last = drag.path[drag.path.length - 1];
    // Kéo chéo dễ hơn: ngón tay lệch đủ xa theo CẢ HAI trục so với tâm ô đang cầm (>= 38% ô) thì tính là đi chéo,
    // không cần tới tận ô chéo (đường chéo qua góc ô nên trước đây hay bị rơi vào ô ngang/dọc trước).
    let diagAssist = false;
    if (allowDiag) {
      const lc = cellCenter(last);
      const dx = x - lc.x;
      const dy = y - lc.y;
      const T = CELL * DIAG_ASSIST;
      if (Math.abs(dx) > T && Math.abs(dy) > T) {
        const [lr, lk] = cr(last);
        const nr = lr + Math.sign(dy);
        const nk = lk + Math.sign(dx);
        const n = nr * 6 + nk;
        if (nr >= 0 && nr < 5 && nk >= 0 && nk < 6 && !state.locked.includes(n)) { c = n; diagAssist = true; }
      }
    }
    if (c === last) return false;
    if (!diagAssist) {
      const dc = Math.hypot(x - cellCenter(c).x, y - cellCenter(c).y);
      const dl = Math.hypot(x - cellCenter(last).x, y - cellCenter(last).y);
      if (dc > dl - CELL * 0.06) return false; // trễ nhẹ chống rung ở biên ô
    }
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
    if (view.boardIn !== undefined && view.boardIn < 1) view.boardIn = Math.min(1, view.boardIn + real / 240);
    if (view.freeze > 0) { view.freeze -= real; dt = 0; } else dt = real * (view.slow ?? 1);
    if (drag && drag.t0 && !(state.freeze > 0)) {
      const k = 1 - (now - drag.t0) / dragMs;
      view.timer = Math.max(0, k);
      view.timerSec = (view.timer * dragMs) / 1000;
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
    if (view.healGlow > 0) view.healGlow = Math.max(0, view.healGlow - dt / 1100);
    if (view.hpPulse > 0) view.hpPulse = Math.max(0, view.hpPulse - dt / 500);
    if (view.enhPop?.length) view.enhPop = view.enhPop.filter((p) => (p.age += dt) < 700);
    view.pops = view.pops.filter((q) => (q.age += dt) < q.delay + q.hold + q.fly);
    view.floaters = view.floaters.filter((f) => f.age < f.life);
    for (const q of view.particles) {
      q.age += dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += (q.g ?? 0.0004) * dt;
      if (q.vr) q.rot += q.vr * dt;
    }
    if (view.tint && (view.tint.age += dt) > view.tint.life) view.tint = null;
    if (view.comboPop > 0) view.comboPop = Math.max(0, view.comboPop - dt / 260);
    view.particles = view.particles.filter((q) => q.age < q.life);
    view.hurt = Math.max(0, view.hurt - dt / 450);
    if (view.lunge) { view.lunge.age += dt; if (view.lunge.age > 520) view.lunge = null; }
    for (const b of view.blasts) b.age += dt;
    view.blasts = view.blasts.filter((b) => b.age < b.delay + b.life);
    if (view.blastFlash && (view.blastFlash.age += dt) > view.blastFlash.life) view.blastFlash = null;
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
    getView: () => view, // test/debug
    // Tính và hiện gợi ý đơn giản cho nước kế tiếp (dùng trong màn hướng dẫn). opts: { maxSteps, maxCombos }.
    requestHint(opts = hintOpts) {
      const s0 = state;
      findHintAsync(ctx, s0, undefined, 4, opts).then((hp) => { if (hp && alive && state === s0 && !busy && !(s0.freeze > 0)) view.hint = { path: hp.path, text: t('tut.hint', { n: hp.combos }) }; });
    },
    hideHint() { view.hint = null; view.hintKeep = null; },
    // Bài hướng dẫn: đặt bàn cố định, đường chỉ định và bộ lọc nước đi.
    setGuide({ board = null, path = null, text = '', allow = null, title = null, enemy = null }) {
      if (title !== null) view.titleText = title;
      view.guideEnemy = enemy;
      if (board) { const same = state.board.cells.every((c, i) => c === board[i]); state.board = { cells: board.slice(), enh: new Array(board.length).fill(0) }; sync(); if (!same) view.boardIn = 0; }
      moveGuard = allow;
      view.hint = path ? { path: path.slice(), text } : null;
      view.hintKeep = view.hint;
    },
    getHint: () => (view.hint ? view.hint.path.slice() : null),
    getDragPath: () => (drag ? drag.path.slice() : null),
    getState: () => state,
    fxCast: castFx, fxView: () => view, // dùng cho ảnh chụp kiểm tra hiệu ứng
    refresh: sync, // dùng cho test/debug: đồng bộ view từ state
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
