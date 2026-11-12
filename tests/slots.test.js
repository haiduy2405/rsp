import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCtx } from './helpers.js';
import { createSlots, SLOT_COUNT, NAME_MAX } from '../www/js/save/slots.js';
import { newProgress } from '../www/js/core/progress.js';
import { KEY } from '../www/js/save/storage.js';

const ctx = loadCtx();
const memAdapter = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };

test('slots: 3 ô độc lập, ô trống ban đầu', () => {
  const a = memAdapter();
  const s = createSlots(a, ctx);
  assert.equal(SLOT_COUNT, 3);
  assert.deepEqual(s.list().map((x) => x.used), [false, false, false]);
  const p = newProgress(ctx); p.player.name = 'A';
  s.storage(2).save(p);
  const l = s.list();
  assert.deepEqual(l.map((x) => x.used), [false, true, false]);
  assert.equal(l[1].name, 'A');
  assert.equal(s.storage(1).load().source, 'new');
});

test('slots: ô 1 dùng khóa cũ rsp.save nên save cũ tự thành ván 1', () => {
  const a = memAdapter();
  const s0 = createSlots(a, ctx);
  const p = newProgress(ctx); p.player.name = 'Cũ';
  s0.storage(1).save(p);
  assert.ok(a.m.has(KEY));
  const l = createSlots(a, ctx).list();
  assert.equal(l[0].used, true);
  assert.equal(l[0].name, 'Cũ');
});

test('slots: đổi tên (cắt độ dài, rỗng = về tên người chơi), xóa chỉ xóa ô đó', () => {
  const a = memAdapter();
  const s = createSlots(a, ctx);
  for (const n of [1, 2]) { const p = newProgress(ctx); p.player.name = `P${n}`; s.storage(n).save(p); }
  s.rename(1, '   Ván   chính của tôi rất dài dòng   ');
  const lab = s.list()[0].label;
  assert.ok(lab.length <= NAME_MAX && !lab.includes('  '));
  s.rename(1, '');
  assert.equal(s.list()[0].name, 'P1');
  s.setLast(2); s.touch(2, 123);
  assert.equal(s.last(), 2);
  s.remove(2);
  const l = s.list();
  assert.deepEqual(l.map((x) => x.used), [true, false, false]);
  assert.equal(s.last(), null);
  assert.equal(l[1].at, null);
  assert.equal(s.storage(2).load().source, 'new');
  assert.equal(s.list()[0].used, true, 'ô 1 không bị ảnh hưởng');
});

test('slots: save hỏng ở một ô không làm hỏng ô khác', () => {
  const a = memAdapter();
  const s = createSlots(a, ctx);
  s.storage(1).save(newProgress(ctx));
  s.storage(3).save(newProgress(ctx));
  a.setItem('rsp.save.s3', '{bad');
  assert.deepEqual(s.list().map((x) => x.used), [true, false, false]);
});
