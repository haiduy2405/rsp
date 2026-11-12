import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, step } from '../www/js/core/battle.js';
import { findGroups } from '../www/js/core/match.js';
import { N } from '../www/js/core/board.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const mk = (team, seed = 3) => createBattle(ctx, { seed, team, enemies: ['water_n1'] });
const ready = (s, i = 0) => { s.members[i].skillCd = 0; return s; };

test('enhance: nâng cấp đúng số ngọc màu của tướng, thiếu thì đổi thêm ngọc khác', () => {
  const s = ready(mk(['hephaestus', 'thetis', 'bennu', 'atalanta', 'eir'])); // Hỏa, nâng 6 ngọc
  const r = step(ctx, s, { type: 'skill', index: 0 });
  assert.equal(r.events[0].type, 'skill');
  const b = r.state.board;
  const enhFire = b.cells.filter((t, i) => b.enh[i] && t === 1).length;
  assert.equal(b.enh.filter(Boolean).length, 6);
  assert.equal(enhFire, 6);
  // bàn gần như không có ngọc Hỏa: vẫn đủ 6 ngọc Hỏa nâng cấp
  const s2 = ready(mk(['hephaestus', 'thetis', 'bennu', 'atalanta', 'eir']));
  s2.board.cells = s2.board.cells.map((t) => (t === 1 ? 0 : t));
  const r2 = step(ctx, s2, { type: 'skill', index: 0 });
  assert.equal(r2.state.board.enh.filter(Boolean).length, 6);
  assert.ok(r2.state.board.cells.every((t, i) => !r2.state.board.enh[i] || t === 1));
});

test('enhance: kỹ năng không tốn lượt và xác định theo seed', () => {
  const s = ready(mk(['freyja', 'thetis', 'bennu', 'atalanta', 'eir']));
  const a = step(ctx, s, { type: 'skill', index: 0 });
  const b = step(ctx, s, { type: 'skill', index: 0 });
  assert.deepEqual(a.state.board, b.state.board);
  assert.equal(a.state.turn, s.turn);
});

test('timeFreeze: kéo chỉ hoán đổi, ngọc chưa tiêu, không tốn lượt', () => {
  let s = ready(mk(['son_tinh', 'thetis', 'bennu', 'atalanta', 'eir']));
  s = step(ctx, s, { type: 'skill', index: 0 }).state;
  assert.equal(s.freeze, 1);
  // thử nhiều đường kéo: không đường nào được tiêu ngọc hay tăng lượt
  let swapped = 0;
  for (let a = 0; a < N - 1 && swapped < 5; a++) {
    const r = step(ctx, s, { type: 'move', path: [a, a + 1] });
    if (r.events[0].type !== 'swap') continue;
    assert.equal(r.state.turn, 0);
    assert.ok(!r.events.some((e) => e.type === 'step'));
    swapped++;
  }
  assert.ok(swapped > 0);
});

test('timeFreeze: nút Tiêu tính cụm, tốn đúng một lượt, rồi hết hiệu lực sau N lượt', () => {
  let s = ready(mk(['apollo', 'thetis', 'bennu', 'atalanta', 'nyx'])); // 2 lượt
  s = step(ctx, s, { type: 'skill', index: 0 }).state;
  assert.equal(s.freeze, 2);
  // dựng bàn có sẵn một cụm 3 ngọc cùng loại để chắc chắn có combo
  s.board.cells[0] = s.board.cells[1] = s.board.cells[2] = 3;
  assert.ok(findGroups(s.board).length >= 1);
  const r = step(ctx, s, { type: 'clear' });
  assert.ok(r.events.some((e) => e.type === 'step'));
  assert.equal(r.state.turn, 1);
  assert.equal(r.state.freeze, 1);
  const r2 = step(ctx, r.state, { type: 'clear' });
  assert.equal(r2.state.freeze, 0);
  assert.equal(step(ctx, r2.state, { type: 'clear' }).events[0].reason, 'not_frozen');
  // hết hiệu lực: kéo bình thường lại tiêu ngay
  const mv = step(ctx, r2.state, { type: 'move', path: [0, 1] });
  assert.notEqual(mv.events[0].type, 'swap');
});

test('timeFreeze: Tiêu khi chưa dừng thời gian bị từ chối', () => {
  assert.equal(step(ctx, mk(['thetis', 'bennu']), { type: 'clear' }).events[0].reason, 'not_frozen');
});

test('combo_mult: thêm hệ số nhân theo combo', () => {
  const dmg = (team) => {
    const s = mk(team, 11);
    s.board.cells[0] = s.board.cells[1] = s.board.cells[2] = 0;
    const r = step(ctx, s, { type: 'move', path: [3, 4] });
    return r;
  };
  assert.ok(dmg(['hel', 'thetis', 'bennu']).state.mods.comboStep > dmg(['thetis', 'hel', 'bennu']).state.mods.comboStep);
});
