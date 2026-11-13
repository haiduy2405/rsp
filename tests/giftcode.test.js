import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress } from '../www/js/core/progress.js';
import { redeemGift } from '../www/js/core/giftcode.js';
import { loadCtx } from './helpers.js';

const ctx = await loadCtx();

test('mã dluma: cộng vàng, Linh Thạch, vé; không phân biệt hoa thường; chỉ dùng một lần', () => {
  const p0 = newProgress(ctx);
  const r = redeemGift(ctx, p0, '  DLuma ');
  assert.ok(r.ok);
  assert.equal(r.progress.inventory.gold, p0.inventory.gold + 8500000);
  assert.equal(r.progress.inventory.spirit, p0.inventory.spirit + 30000);
  assert.equal(r.progress.inventory.tickets, p0.inventory.tickets + 1000);
  assert.equal(p0.inventory.gold, newProgress(ctx).inventory.gold, 'không sửa bản gốc');
  assert.deepEqual(redeemGift(ctx, r.progress, 'dluma'), { ok: false, reason: 'used' });
});

test('mã sai hoặc rỗng bị từ chối, kể cả tên thuộc tính hệ thống', () => {
  const p = newProgress(ctx);
  for (const c of ['', 'abc', 'constructor', '__proto__', null]) assert.equal(redeemGift(ctx, p, c).reason, 'invalid');
});
