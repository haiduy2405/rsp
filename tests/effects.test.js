import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addEffect, atkMult, takeDamage, dotDamage, regenAmount, expire, isDisabled, hasEffect, getEffect, lockCells, KEYS, NEGATIVE,
} from '../www/js/core/effects.js';
import { mulberry32 } from '../www/js/core/rng.js';
import { createBattle, step } from '../www/js/core/battle.js';
import { N } from '../www/js/core/board.js';
import { loadCtx, TEAM } from './helpers.js';

const holder = (maxHp = 1000) => ({ effects: [], recover: 0, maxHp });
const base = loadCtx();
// Quái thử nghiệm: đánh mỗi lượt, áp Khóa ngọc / Bỏng lên đội khi đánh.
const ctx = {
  ...base,
  monsters: {
    ...base.monsters,
    t_dummy: { id: 't_dummy', element: 4, hp: 100000, atk: 100, attackEvery: 1 },
    t_miss: { id: 't_miss', element: 4, hp: 100000, atk: 100, attackEvery: 1, onAttack: [{ key: 'burn', turns: 2, value: 0.05, chance: 0 }] },
    t_half: { id: 't_half', element: 4, hp: 100000, atk: 100, attackEvery: 1, onAttack: [{ key: 'burn', turns: 1, value: 0.01 }] },
    t_locker: { id: 't_locker', element: 4, hp: 100000, atk: 100, attackEvery: 1, onAttack: [{ key: 'lock', turns: 2, value: 3, chance: 1 }, { key: 'burn', turns: 2, value: 0.05, chance: 1 }] },
  },
};
// Bàn cố định không có nhóm nào sau khi hoán đổi ô 0 và 1.
const flat = { cells: Array.from({ length: N }, (_, i) => (((i % 6) + ((i / 6) | 0)) % 2 === 0 ? 4 : 5)), enh: new Array(N).fill(0) };
const mv = { type: 'move', path: [0, 1] };
function mk(enemies = ['t_dummy'], extra = {}) {
  const s = createBattle(ctx, { seed: 3, team: TEAM, enemies, ...extra });
  s.board = structuredClone(flat);
  return s;
}

test('effects: đúng 12 từ khóa, 6 tiêu cực', () => {
  assert.equal(KEYS.length, 12);
  assert.deepEqual([...NEGATIVE].sort(), ['atkDown', 'burn', 'freeze', 'lock', 'poison', 'stun']);
  assert.throws(() => addEffect(holder(), { key: 'nope', turns: 1 }));
});

test('effects: một bản mỗi từ khóa, áp lại làm mới và lấy giá trị lớn hơn', () => {
  const h = holder();
  addEffect(h, { key: 'burn', turns: 2, value: 0.05 });
  addEffect(h, { key: 'burn', turns: 3, value: 0.03 });
  assert.equal(h.effects.length, 1);
  assert.deepEqual([getEffect(h, 'burn').turns, getEffect(h, 'burn').value], [3, 0.05]);
});

test('Độc: cộng dồn tối đa 5 tầng, sát thương theo tầng, không bị Khiên chặn', () => {
  const h = holder(1000);
  for (let i = 0; i < 8; i++) addEffect(h, { key: 'poison', turns: 4, value: 0.01 });
  assert.equal(getEffect(h, 'poison').stacks, 5);
  assert.equal(dotDamage(h), 50);
  addEffect(h, { key: 'burn', turns: 2, value: 0.05 });
  assert.equal(dotDamage(h), 100);
  addEffect(h, { key: 'shield', turns: 3, value: 0.3 });
  assert.equal(dotDamage(h), 100);
});

test('Khiên: bể chắn, cộng dồn có trần 50% máu, Xuyên giáp bỏ qua', () => {
  const h = holder(1000);
  addEffect(h, { key: 'shield', turns: 3, value: 0.3 });
  addEffect(h, { key: 'shield', turns: 3, value: 0.3 });
  assert.equal(getEffect(h, 'shield').pool, 500);
  let r = takeDamage(h, 200);
  assert.deepEqual([r.hpLoss, r.absorbed], [0, 200]);
  assert.equal(getEffect(h, 'shield').pool, 300);
  r = takeDamage(h, 200, { pierce: true });
  assert.deepEqual([r.hpLoss, r.absorbed], [200, 0]);
  r = takeDamage(h, 400);
  assert.deepEqual([r.hpLoss, r.absorbed], [100, 300]);
  assert.equal(hasEffect(h, 'shield'), false);
});

test('Tăng công và Giảm công nhân với nhau, có sàn 0.25', () => {
  const h = holder();
  assert.equal(atkMult(h), 1);
  addEffect(h, { key: 'atkUp', turns: 2, value: 0.5 });
  assert.equal(atkMult(h), 1.5);
  addEffect(h, { key: 'atkDown', turns: 2, value: 0.5 });
  assert.equal(atkMult(h), 0.75);
  const g = holder();
  addEffect(g, { key: 'atkDown', turns: 2, value: 0.95 });
  assert.equal(atkMult(g), 0.25);
});

test('Miễn nhiễm chặn hiệu ứng tiêu cực mới, không chặn tích cực, không xóa cái đã có', () => {
  const h = holder();
  addEffect(h, { key: 'burn', turns: 3, value: 0.05 });
  addEffect(h, { key: 'immune', turns: 2 });
  for (const key of NEGATIVE) if (key !== 'burn') assert.equal(addEffect(h, { key, turns: 2, value: 0.1 }).applied, false, key);
  assert.equal(addEffect(h, { key: 'regen', turns: 2, value: 0.1 }).applied, true);
  assert.equal(hasEffect(h, 'burn'), true);
});

test('Choáng/Đóng băng: hết hạn thì có 1 lượt hồi phục miễn khóa', () => {
  const h = holder();
  addEffect(h, { key: 'stun', turns: 1 });
  assert.equal(isDisabled(h), true);
  expire(h);
  assert.equal(isDisabled(h), false);
  assert.equal(addEffect(h, { key: 'stun', turns: 1 }).applied, false);
  assert.equal(addEffect(h, { key: 'freeze', turns: 2 }).applied, false);
  expire(h);
  assert.equal(addEffect(h, { key: 'freeze', turns: 2 }).applied, true);
});

test('Đóng băng tan khi nhận sát thương Hỏa và nhận +25%', () => {
  const h = holder();
  addEffect(h, { key: 'freeze', turns: 3 });
  let r = takeDamage(h, 100, { element: 0 });
  assert.equal(r.thawed, false);
  r = takeDamage(h, 100, { element: 1 });
  assert.deepEqual([r.thawed, r.hpLoss], [true, 125]);
  assert.equal(hasEffect(h, 'freeze'), false);
  assert.equal(h.recover, 1);
});

test('Phản đòn: phản tỉ lệ sát thương thực nhận (sau Khiên)', () => {
  const h = holder();
  addEffect(h, { key: 'reflect', turns: 2, value: 0.5 });
  addEffect(h, { key: 'shield', turns: 2, value: 0.1 });
  const r = takeDamage(h, 300);
  assert.deepEqual([r.hpLoss, r.reflect], [200, 100]);
});

test('Hồi máu: hồi theo % máu tối đa mỗi lượt; hết hạn thì mất', () => {
  const h = holder(1000);
  addEffect(h, { key: 'regen', turns: 2, value: 0.04 });
  assert.equal(regenAmount(h), 40);
  expire(h);
  expire(h);
  assert.equal(regenAmount(h), 0);
});

test('Khóa ngọc: chọn ô bằng RNG, tối đa 8, không trùng', () => {
  const locked = [];
  lockCells(locked, 20, mulberry32(1), N);
  assert.equal(locked.length, 8);
  assert.equal(new Set(locked).size, 8);
  const again = [];
  lockCells(again, 20, mulberry32(1), N);
  assert.deepEqual(locked, again);
});

// ---- trong trận
test('trận: Choáng quái bỏ qua lượt đánh và bộ đếm đứng yên', () => {
  const s = mk();
  s.enemies[0].cd = 1;
  s.enemies[0].effects.push({ key: 'stun', turns: 2, value: 0 });
  const r = step(ctx, s, mv);
  assert.equal(r.events.filter((e) => e.type === 'enemyAttack').length, 0);
  assert.equal(r.state.enemies[0].cd, 1);
  assert.equal(r.state.enemies[0].effects[0].turns, 1);
});

test('trận: Đóng băng quái cũng chặn đòn đánh', () => {
  const s = mk();
  s.enemies[0].effects.push({ key: 'freeze', turns: 2, value: 0 });
  assert.equal(step(ctx, s, mv).events.filter((e) => e.type === 'enemyAttack').length, 0);
});

test('trận: Bỏng/Độc cuối lượt xuyên Khiên của quái, Hồi máu chạy sau', () => {
  const s = mk();
  s.enemies[0].atk = 1;
  s.enemies[0].hp = 10000;
  s.enemies[0].maxHp = 10000;
  addEffect(s.enemies[0], { key: 'burn', turns: 2, value: 0.05 });
  addEffect(s.enemies[0], { key: 'shield', turns: 3, value: 0.5 });
  addEffect(s.enemies[0], { key: 'regen', turns: 2, value: 0.01 });
  const r = step(ctx, s, mv);
  const dot = r.events.find((e) => e.type === 'dot');
  assert.equal(dot.amount, 500);
  assert.equal(r.state.enemies[0].hp, 10000 - 500 + 100);
});

test('trận: Giảm công của quái giảm sát thương đánh vào đội', () => {
  const a = step(ctx, mk(), mv).events.find((e) => e.type === 'enemyAttack').amount;
  const s = mk();
  addEffect(s.enemies[0], { key: 'atkDown', turns: 2, value: 0.5 });
  const b = step(ctx, s, mv).events.find((e) => e.type === 'enemyAttack').amount;
  assert.equal(b, Math.round(a / 2));
});

test('trận: Khiên đội hấp thụ đòn quái; Xuyên giáp của quái bỏ qua', () => {
  const s = mk(['t_dummy'], { startEffects: [{ key: 'shield', turns: 9, value: 0.25 }] });
  let r = step(ctx, s, mv);
  const ev = r.events.find((e) => e.type === 'enemyAttack');
  assert.deepEqual([ev.amount, ev.blocked], [0, 100]);
  const t = mk(['t_dummy'], { startEffects: [{ key: 'shield', turns: 9, value: 0.25 }] });
  addEffect(t.enemies[0], { key: 'pierce', turns: 2 });
  r = step(ctx, t, mv);
  assert.equal(r.events.find((e) => e.type === 'enemyAttack').amount, 100);
});

test('trận: Phản đòn của đội gây sát thương ngược lên quái (có trần 10% máu quái)', () => {
  const s = mk(['t_dummy'], { startEffects: [{ key: 'reflect', turns: 9, value: 5 }] });
  s.enemies[0].maxHp = 1000;
  s.enemies[0].hp = 1000;
  const r = step(ctx, s, mv);
  const rf = r.events.find((e) => e.type === 'reflect');
  assert.equal(rf.amount, 100);
  assert.equal(r.state.enemies[0].hp, 900);
});

test('trận: quái áp Khóa ngọc lên đội; ô khóa chặn đường kéo; hết hạn thì mở', () => {
  let s = mk(['t_locker']);
  s.hp = s.maxHp = 100000;
  s.team.maxHp = 100000;
  let r = step(ctx, s, mv);
  s = r.state;
  assert.equal(s.locked.length, 3);
  assert.ok(hasEffect(s.team, 'lock'));
  assert.ok(hasEffect(s.team, 'burn'));
  const bad = step(ctx, s, { type: 'move', path: [s.locked[0], s.locked[0] % 6 < 5 ? s.locked[0] + 1 : s.locked[0] - 1] });
  assert.equal(bad.events[0].reason, 'cell_locked');
  // đủ lượt thì hết khóa
  s.enemies[0].effects.push({ key: 'stun', turns: 5, value: 0 });
  s.board = structuredClone(flat);
  s = step(ctx, s, mv).state;
  s = step(ctx, s, mv).state;
  assert.equal(s.locked.length, 0);
});

test('trận: Choáng/Đóng băng lên đội khóa nút kỹ năng', () => {
  const s = mk();
  s.members[0].skillCd = 0;
  addEffect(s.team, { key: 'stun', turns: 2 });
  assert.equal(step(ctx, s, { type: 'skill', index: 0 }).events[0].reason, 'skill_locked');
});

test('trận: thứ tự cuối lượt, Bỏng giết quái cuối trước khi Bỏng giết đội thì người chơi thắng', () => {
  const s = mk();
  s.enemies[0].atk = 1;
  s.enemies[0].hp = 40;
  s.enemies[0].maxHp = 1000;
  addEffect(s.enemies[0], { key: 'burn', turns: 2, value: 0.05 });
  s.hp = 30;
  addEffect(s.team, { key: 'burn', turns: 2, value: 0.5 });
  assert.equal(step(ctx, s, mv).state.status, 'won');
});

test('trận: Tăng công của đội tăng sát thương ngọc', () => {
  const run = (extra) => {
    let s = createBattle(ctx, { seed: 8, team: TEAM, enemies: ['m_tide'], ...extra });
    let total = 0;
    for (let i = 0; i < 6; i++) {
      const r = step(ctx, s, { type: 'skill', index: 1 });
      if (r.events[0].type === 'invalid') break;
      total += r.events[0].hits.reduce((a, h) => a + (h.amount || 0), 0);
      s = r.state;
    }
    return total;
  };
  const plain = run({});
  const buffed = run({ startEffects: [{ key: 'atkUp', turns: 9, value: 1 }] });
  assert.ok(buffed >= plain * 1.9, `${buffed} vs ${plain}`);
});

test('trận: debuff quái trúng theo xác suất — chance 0 luôn trượt, mặc định theo loại quái (creep 50%) lúc trúng lúc trượt, xác định theo seed', () => {
  let s = mk(['t_miss']);
  s.hp = s.maxHp = 1e6; s.team.maxHp = 1e6;
  const r = step(ctx, s, mv);
  assert.ok(!hasEffect(r.state.team, 'burn'));
  assert.ok(r.events.some((e) => e.type === 'effect' && e.missed));
  const run = () => {
    let st = mk(['t_half']);
    st.hp = st.maxHp = 1e6; st.team.maxHp = 1e6;
    const out = [];
    for (let i = 0; i < 30; i++) {
      st.board = structuredClone(flat);
      const q = step(ctx, st, mv);
      st = q.state;
      out.push(...q.events.filter((e) => e.type === 'effect').map((e) => !!e.applied));
    }
    return out;
  };
  const a = run();
  assert.ok(a.includes(true) && a.includes(false));
  assert.deepEqual(run(), a);
});
