import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress } from '../www/js/core/progress.js';
import { spinWish, wishUsed, wishAvailable, pickSlice } from '../www/js/core/wish.js';
import { mulberry32 } from '../www/js/core/rng.js';
import { loadCtx } from './helpers.js';

const ctx = await loadCtx();
const slices = ctx.config.wish.slices;

test('cầu nguyện: 1 lượt mỗi ngày, sang ngày mới quay lại được, không sửa bản gốc', () => {
  const p0 = newProgress(ctx);
  assert.equal(wishAvailable(p0, 900), true);
  const r = spinWish(ctx, p0, 900, 1);
  assert.equal(r.ok, true);
  assert.equal(wishUsed(r.progress, 900), true);
  assert.equal(p0.wish, undefined);
  assert.equal(spinWish(ctx, r.progress, 900, 2).reason, 'wish_used');
  assert.equal(spinWish(ctx, r.progress, 901, 2).ok, true);
});

test('cầu nguyện: kết quả xác định theo seed và phần thưởng được cộng đúng', () => {
  const p0 = newProgress(ctx);
  assert.deepEqual(spinWish(ctx, p0, 1, 77).prize, spinWish(ctx, p0, 1, 77).prize);
  for (let seed = 1; seed <= 300; seed++) {
    const r = spinWish(ctx, p0, 1, seed);
    const g = slices[r.slice].give;
    const a = p0.inventory, b = r.progress.inventory;
    if (g.kind === 'gold') assert.equal(b.gold - a.gold, g.count);
    if (g.kind === 'spirit') assert.equal(b.spirit - a.spirit, g.count);
    if (g.kind === 'ticket') assert.equal(b.tickets - a.tickets, g.count);
    if (g.kind === 'soulTicket') assert.equal(b.soulTickets - a.soulTickets, g.count);
    if (g.kind === 'generic') assert.equal(b.generic[g.star] - a.generic[g.star], g.count);
    if (g.kind === 'hero') {
      assert.equal(ctx.characters[r.prize.hero].rarity, g.star);
      const own = !!p0.characters[r.prize.hero];
      const got = own ? b.generic[g.star] - a.generic[g.star] : b.fragments[r.prize.hero];
      assert.equal(got, g.count);
    }
  }
});

test('cầu nguyện: tỉ lệ theo trọng số, quà hiếm ít hơn quà thường', () => {
  const rng = mulberry32(5);
  const n = 20000, hit = new Array(slices.length).fill(0);
  for (let i = 0; i < n; i++) hit[pickSlice(slices, rng)]++;
  const total = slices.reduce((a, s) => a + s.weight, 0);
  slices.forEach((s, i) => assert.ok(Math.abs(hit[i] / n - s.weight / total) < 0.012, `ô ${i}`));
  const w = (k, star) => slices.find((s) => s.give.kind === k && s.give.star === star).weight;
  assert.ok(w('generic', 3) > w('generic', 4) && w('generic', 4) > w('generic', 5));
  assert.ok(w('hero', 3) > w('hero', 4) && w('hero', 4) > w('hero', 5));
  for (const k of ['gold', 'spirit', 'generic', 'hero', 'ticket', 'soulTicket']) assert.ok(slices.some((s) => s.give.kind === k), k);
});
