import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, isValidProgress, applyRunResult } from '../www/js/core/progress.js';
import { addFragments, redeemFragments, redeemGeneric, useSoulTickets, heroFragCost } from '../www/js/core/fragments.js';
import { grantCharacter } from '../www/js/core/upgrade.js';
import { ensureShop, buyOffer, rollOffers, leftStock } from '../www/js/core/shop.js';
import { rollLoot } from '../www/js/core/loot.js';
import { mulberry32 } from '../www/js/core/rng.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const heroOf = (r, unowned = true, p = newProgress(ctx)) => ctx.characterList.find((c) => c.rarity === r && !c.reserve && (!unowned || !p.characters[c.id])).id;

test('mảnh riêng: 3/4/5 mảnh đổi đúng tướng đó; thiếu thì từ chối; dư chuyển thành mảnh chung', () => {
  for (const r of [3, 4, 5]) {
    const p = newProgress(ctx);
    const id = heroOf(r);
    assert.equal(heroFragCost(ctx, id), r);
    addFragments(ctx, p, id, r - 1);
    assert.equal(redeemFragments(ctx, p, id).reason, 'not_enough_fragments');
    addFragments(ctx, p, id, 2);
    const q = redeemFragments(ctx, p, id);
    assert.ok(q.ok && q.progress.characters[id]);
    assert.equal(q.progress.inventory.fragments[id], undefined);
    assert.equal(q.progress.inventory.generic[r], 1, 'mảnh dư thành mảnh chung');
    assert.ok(isValidProgress(q.progress));
    assert.equal(redeemFragments(ctx, q.progress, id).reason, 'already_owned');
  }
});

test('mảnh chung: 6/8/10 đổi tướng ngẫu nhiên cùng sao chưa có; không có mảnh 1–2★', () => {
  for (const [r, cost] of [[3, 6], [4, 8], [5, 10]]) {
    const p = newProgress(ctx);
    p.inventory.generic[r] = cost - 1;
    assert.equal(redeemGeneric(ctx, p, r, 1).reason, 'not_enough_generic');
    p.inventory.generic[r] = cost;
    const q = redeemGeneric(ctx, p, r, 7);
    assert.ok(q.ok);
    assert.equal(ctx.characters[q.id].rarity, r);
    assert.ok(!p.characters[q.id] && q.progress.characters[q.id]);
    assert.equal(q.progress.inventory.generic[r], 0);
    assert.deepEqual(redeemGeneric(ctx, p, r, 7).id, q.id, 'cùng seed cùng kết quả');
  }
  assert.equal(redeemGeneric(ctx, newProgress(ctx), 2, 1).reason, 'bad_star');
  const full = newProgress(ctx);
  for (const c of ctx.characterList) if (c.rarity === 5) full.characters[c.id] = { level: 1, awaken: 0, exp: 0, skillLv: { active: 1, leader: 1, passive: 1 } };
  full.inventory.generic[5] = 10;
  assert.equal(redeemGeneric(ctx, full, 5, 1).reason, 'all_owned');
  // không tạo mảnh cho tướng dưới 3★
  const p = newProgress(ctx);
  addFragments(ctx, p, 'nobody', 3);
  assert.deepEqual(p.inventory.fragments, {});
});

test('mảnh của tướng đã sở hữu tự thành mảnh chung; vào đội hình thì mảnh dư cũng đổi', () => {
  const p = newProgress(ctx);
  const own = Object.keys(p.characters).find((id) => ctx.characters[id].rarity === 3);
  addFragments(ctx, p, own, 2);
  assert.equal(p.inventory.generic[3], 2);
  const id = heroOf(3);
  addFragments(ctx, p, id, 2);
  const g = grantCharacter(ctx, p, id);
  assert.equal(g.progress.inventory.fragments[id], undefined);
  assert.equal(g.progress.inventory.generic[3], 4);
});

test('loot ải: chỉ rớt mảnh tướng 3★ theo hệ khu, 4–5★ không bao giờ rớt', () => {
  const seen = new Set();
  for (let i = 0; i < 3000; i++) {
    const l = rollLoot(ctx, 'boss', mulberry32(i), 'hard', 2);
    for (const id of Object.keys(l.fragments)) { seen.add(id); assert.equal(ctx.characters[id].rarity, 3); assert.equal(ctx.characters[id].element, 2); }
  }
  assert.ok(seen.size >= 1);
  const p = newProgress(ctx);
  const id = [...seen][0];
  const run = { phase: 'end', result: 'lost', zoneId: 'zone_water', diff: 'easy', loot: { gold: 0, elixir: { 1: 0, 2: 0, 3: 0 }, shards: 0, stones: { normal: 0, rare: 0 }, fodder: {}, offerings: {}, fragments: { [id]: 2 } }, rareMissed: false, heroExp: 0 };
  const out = applyRunResult(ctx, p, run);
  assert.equal(out.inventory.fragments[id] ?? out.inventory.generic[3], out.inventory.fragments[id] ?? 2);
});

test('Vé Triệu Linh: ra Tiểu Linh 1–2★, thiếu vé thì từ chối', () => {
  const p = newProgress(ctx);
  assert.equal(useSoulTickets(ctx, p, 1, 1).reason, 'not_enough_soul');
  p.inventory.soulTickets = 50;
  const r = useSoulTickets(ctx, p, 50, 9);
  assert.equal(r.results.length, 50);
  assert.ok(r.results.every((k) => /^[0-5]_[12]$/.test(k)));
  assert.ok(r.results.some((k) => k.endsWith('_1')));
  assert.equal(Object.values(r.progress.inventory.fodder).reduce((a, n) => a + n, 0), 50);
  assert.equal(r.progress.inventory.soulTickets, 0);
});

test('shop ngày: món xác định theo ngày, reset khi sang ngày, món đầu miễn phí 50 Linh Thạch, giới hạn số lượng', () => {
  const p0 = ensureShop(ctx, newProgress(ctx), 100);
  assert.deepEqual(rollOffers(ctx, 100, p0.characters), p0.shop.offers);
  assert.notDeepEqual(rollOffers(ctx, 101, p0.characters).map((o) => o.give.key), p0.shop.offers.map((o) => o.give.key));
  assert.equal(p0.shop.offers[0].id, 'free');
  const a = buyOffer(ctx, p0, 100, 'free');
  assert.equal(a.progress.inventory.spirit, 50);
  assert.equal(buyOffer(ctx, a.progress, 100, 'free').reason, 'sold_out');
  assert.equal(buyOffer(ctx, p0, 100, 'el1').reason, 'not_enough_gold');
  const rich = structuredClone(p0);
  rich.inventory.gold = 100000;
  let q = rich;
  for (let i = 0; i < 5; i++) q = buyOffer(ctx, q, 100, 'el1').progress;
  assert.equal(q.inventory.elixir[1], 5);
  assert.equal(buyOffer(ctx, q, 100, 'el1').reason, 'sold_out');
  assert.equal(buyOffer(ctx, q, 101, 'el1').reason, 'shop_stale');
  const next = ensureShop(ctx, q, 101);
  assert.equal(leftStock(next, next.shop.offers.find((o) => o.id === 'el1')), 5, 'sang ngày: hàng đầy lại');
  assert.equal(next.shop.bought.el1, undefined);
  // mảnh tướng bán ra: tướng đúng sao, ưu tiên tướng chưa có
  assert.equal(p0.shop.offers.some((o) => o.give.kind === 'fragment' && ctx.characters[o.give.key].rarity === 5), false, 'mảnh 5★ không bán ở shop');
  for (const [id, r] of [['frag3', 3], ['frag4', 4]]) {
    const o = p0.shop.offers.find((x) => x.id === id);
    assert.equal(ctx.characters[o.give.key].rarity, r);
    assert.ok(!p0.characters[o.give.key]);
  }
  const s = structuredClone(p0);
  s.inventory.spirit = 5000;
  const f = buyOffer(ctx, s, 100, 'frag4');
  assert.equal(f.progress.inventory.fragments[s.shop.offers.find((o) => o.id === 'frag4').give.key], 1);
  assert.equal(f.progress.inventory.spirit, 5000 - 400);
  assert.ok(isValidProgress(f.progress));
});
