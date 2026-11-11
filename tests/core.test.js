import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../www/js/core/rng.js';
import { createBoard, N, COLS, areAdjacent } from '../www/js/core/board.js';
import { validatePath, applyPath } from '../www/js/core/move.js';
import { findGroups, resolve } from '../www/js/core/match.js';
import { elementMultiplier, comboMultiplier } from '../www/js/core/damage.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const checker = () => Array.from({ length: N }, (_, i) => (((i % 6) + ((i / 6) | 0)) % 2 === 0 ? 4 : 5));
const mk = (cells, enh = new Array(N).fill(0)) => ({ cells, enh });

test('rng: cùng seed cùng chuỗi, khác seed khác chuỗi, khôi phục được trạng thái', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  const sa = Array.from({ length: 20 }, () => a.next());
  const sb = Array.from({ length: 20 }, () => b.next());
  const sc = Array.from({ length: 20 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  const r = mulberry32(7);
  r.next();
  r.next();
  const saved = r.state;
  const next3 = [r.next(), r.next(), r.next()];
  const restored = mulberry32(saved);
  assert.deepEqual([restored.next(), restored.next(), restored.next()], next3);
});

test('board: sinh bàn không có nhóm 3 sẵn, xác định theo seed', () => {
  for (let seed = 0; seed < 200; seed++) {
    const b = createBoard(mulberry32(seed));
    assert.equal(b.cells.length, N);
    assert.equal(findGroups(b).length, 0, `seed ${seed}`);
  }
  assert.deepEqual(createBoard(mulberry32(5)), createBoard(mulberry32(5)));
});

test('move: kiểm tra đường kéo và hoán đổi dọc đường', () => {
  assert.equal(validatePath([0]), 'path_too_short');
  assert.equal(validatePath([0, 2]), 'not_adjacent');
  assert.equal(validatePath([0, 1, 0]), 'cell_repeated');
  assert.equal(validatePath([0, 7]), 'not_adjacent');
  assert.equal(validatePath([0, 7], true), null);
  assert.equal(validatePath([0, 99]), 'cell_out_of_range');
  assert.equal(areAdjacent(5, 6), false);
  const cells = Array.from({ length: N }, (_, i) => i % 6);
  const b = applyPath(mk(cells), [0, 1, 2]);
  assert.deepEqual(b.cells.slice(0, 3), [1, 2, 0]); // ngọc cầm (0) đi tới ô 2
});

test('match: nhóm ngang, dọc, chữ L gộp một nhóm', () => {
  const base = checker(); // bàn cờ vua 4/5, không có nhóm
  const cells = base.slice();
  // hàng 0 cột 0-2 = loại 0; cột 0 hàng 0-2 = loại 0 => chữ L
  [0, 1, 2, 6, 12].forEach((i) => (cells[i] = 0));
  const g = findGroups(mk(cells));
  assert.equal(g.length, 1);
  assert.equal(g[0].size, 5);
  assert.deepEqual(g[0].cells, [0, 1, 2, 6, 12]);
});

test('match: hai dải cùng loại liền kề nhưng không chồng là hai combo', () => {
  const cells = checker();
  [0, 1, 2, 6, 7, 8].forEach((i) => (cells[i] = 0));
  // hàng 0 cột 0-2 và hàng 1 cột 0-2: các cột dọc chỉ dài 2 -> chỉ có 2 dải ngang
  const g = findGroups(mk(cells));
  // dải ngang kề nhau nhưng không chung ô => 2 nhóm riêng
  assert.equal(g.length, 2);
});

test('match: cascade ổn định, nhóm 5 để lại ngọc cường hóa', () => {
  const cells = checker();
  [12, 13, 14, 15, 16].forEach((i) => (cells[i] = 1)); // 5 ngọc hỏa ngang hàng 2
  const out = resolve(mk(cells), mulberry32(1));
  assert.ok(out.steps.length >= 1);
  assert.deepEqual(out.steps[0].spawnedEnhanced, [12]);
  assert.equal(findGroups(out.board).length, 0);
  assert.equal(out.board.cells.length, N);
});

test('resolve: xác định theo seed', () => {
  const b = createBoard(mulberry32(9));
  const p = [0, 1, 2, 3];
  const x = resolve(applyPath(b, p), mulberry32(3));
  const y = resolve(applyPath(b, p), mulberry32(3));
  assert.deepEqual(x, y);
});

test('damage: bảng khắc hệ và hệ số combo', () => {
  const c = ctx.config;
  assert.equal(elementMultiplier(0, 1, c), 1.5); // Thủy > Hỏa
  assert.equal(elementMultiplier(1, 2, c), 1.5); // Hỏa > Mộc
  assert.equal(elementMultiplier(2, 0, c), 1.5); // Mộc > Thủy
  assert.equal(elementMultiplier(1, 0, c), 0.5);
  assert.equal(elementMultiplier(3, 4, c), 1.5);
  assert.equal(elementMultiplier(4, 3, c), 1.5);
  assert.equal(elementMultiplier(0, 3, c), 1);
  assert.equal(comboMultiplier(1, c), 1);
  assert.equal(comboMultiplier(5, c), 2);
  assert.ok(COLS === 6);
});
