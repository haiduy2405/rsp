import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress } from '../www/js/core/progress.js';
import { ensureQuests, trackQuest, claimQuest, claimBonus, hasClaimable, rollDaily, allClaimed } from '../www/js/core/quests.js';
import { loadCtx } from './helpers.js';

const ctx = await loadCtx();

test('nhiệm vụ: bộ nhiệm vụ xác định theo ngày, có login cố định, không trùng loại', () => {
  const a = rollDaily(ctx, 500);
  const b = rollDaily(ctx, 500);
  assert.deepEqual(a, b);
  assert.equal(a.length, 1 + ctx.config.quests.daily.pick);
  assert.equal(a[0].kind, 'login');
  assert.equal(new Set(a.map((q) => q.kind)).size, a.length);
  assert.notDeepEqual(rollDaily(ctx, 501).map((q) => q.kind), a.map((q) => q.kind));
});

test('nhiệm vụ: tiến độ không vượt mục tiêu, chỉ nhận khi đủ, không nhận 2 lần, thưởng đúng', () => {
  let p = ensureQuests(ctx, newProgress(ctx), 700);
  assert.equal(claimQuest(ctx, p, 700, 'login').reason, 'not_ready');
  assert.equal(hasClaimable(ctx, p, 700), false);
  p = trackQuest(ctx, p, 700, 'login', 5);
  assert.equal(p.quests.list[0].count, 1);
  assert.equal(hasClaimable(ctx, p, 700), true);
  const before = p.inventory.spirit;
  const r = claimQuest(ctx, p, 700, 'login');
  assert.equal(r.ok, true);
  assert.equal(r.progress.inventory.spirit, before + p.quests.list[0].reward.spirit);
  assert.equal(claimQuest(ctx, r.progress, 700, 'login').reason, 'claimed');
  assert.equal(p.quests.list[0].claimed, false, 'hàm thuần: progress cũ không đổi');
});

test('nhiệm vụ: thưởng thêm khi xong hết, sang ngày mới làm mới', () => {
  let p = ensureQuests(ctx, newProgress(ctx), 800);
  assert.equal(claimBonus(ctx, p, 800).reason, 'not_ready');
  for (const q of p.quests.list) p = trackQuest(ctx, p, 800, q.kind, q.goal);
  for (const q of p.quests.list) p = claimQuest(ctx, p, 800, q.id).progress;
  assert.equal(allClaimed(p), true);
  assert.equal(hasClaimable(ctx, p, 800), true, 'còn thưởng thêm');
  const t0 = p.inventory.tickets;
  const b = claimBonus(ctx, p, 800);
  assert.equal(b.ok, true);
  assert.equal(b.progress.inventory.tickets, t0 + ctx.config.quests.bonus.tickets);
  assert.equal(hasClaimable(ctx, b.progress, 800), false);
  assert.equal(claimBonus(ctx, b.progress, 800).reason, 'claimed');
  const next = ensureQuests(ctx, b.progress, 801);
  assert.equal(next.quests.day, 801);
  assert.equal(next.quests.bonusClaimed, false);
});
