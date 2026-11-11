import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, isValidProgress } from '../www/js/core/progress.js';
import { levelCost, levelUp, awakenCost, awaken, grantCharacter, setTeam, teamRoster } from '../www/js/core/upgrade.js';
import { migrate } from '../www/js/save/migrate.js';
import { createRun, playRun, newRunRecord, runStep } from '../www/js/core/run.js';
import { statsFor } from '../www/js/core/stats.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const rich = () => {
  const p = newProgress(ctx);
  p.inventory.essence = 100000;
  p.inventory.gold = 100000;
  p.inventory.shards = 500;
  for (let e = 0; e < 6; e++) p.inventory.stones[e] = { normal: 100, rare: 100 };
  return p;
};

test('Level: chi phí tăng theo cấp và độ hiếm, trần ở levelMax, trừ Tinh Hoa', () => {
  assert.ok(levelCost(ctx, 'thetis', 2) > levelCost(ctx, 'thetis', 1));
  assert.ok(levelCost(ctx, 'thuy_tinh', 1) > levelCost(ctx, 'thetis', 1));
  assert.equal(levelCost(ctx, 'thetis', ctx.config.progression.levelMax), null);
  const p = rich();
  const c = levelCost(ctx, 'thetis', 1);
  const r = levelUp(ctx, p, 'thetis');
  assert.equal(r.progress.characters.thetis.level, 2);
  assert.equal(r.progress.inventory.essence, p.inventory.essence - c);
  assert.equal(p.characters.thetis.level, 1); // không sửa progress gốc
  assert.equal(levelUp(ctx, newProgress(ctx), 'thetis').reason, 'not_enough_essence');
  assert.equal(levelUp(ctx, p, 'zeus').reason, 'not_owned');
  let q = p;
  for (let i = 1; i < ctx.config.progression.levelMax; i++) q = levelUp(ctx, q, 'thetis').progress;
  assert.equal(q.characters.thetis.level, ctx.config.progression.levelMax);
  assert.equal(levelUp(ctx, q, 'thetis').reason, 'max_level');
});

test('Thức tỉnh: bậc 1-3 dùng Tinh Thạch Thường, bậc 4-5 dùng Hiếm, đúng hệ, đủ 3 thứ phí', () => {
  const stages = [1, 2, 3, 4, 5].map((s) => awakenCost(ctx, 'thetis', s));
  assert.deepEqual(stages.map((c) => c.stone), ['normal', 'normal', 'normal', 'rare', 'rare']);
  assert.ok(stages.every((c) => c.element === 0));
  assert.equal(awakenCost(ctx, 'thetis', 6), null);
  assert.ok(awakenCost(ctx, 'thuy_tinh', 1).shards > awakenCost(ctx, 'thetis', 1).shards);
  let p = rich();
  const before = structuredClone(p.inventory);
  const r = awaken(ctx, p, 'thetis');
  assert.equal(r.progress.characters.thetis.awaken, 1);
  assert.equal(r.progress.inventory.shards, before.shards - r.cost.shards);
  assert.equal(r.progress.inventory.stones[0].normal, before.stones[0].normal - r.cost.stones);
  assert.equal(r.progress.inventory.stones[1].normal, before.stones[1].normal); // hệ khác không bị trừ
  assert.equal(r.progress.inventory.gold, before.gold - r.cost.gold);
  for (let i = 0; i < 5; i++) p = awaken(ctx, p, 'thetis').progress;
  assert.equal(p.characters.thetis.awaken, 5);
  assert.equal(awaken(ctx, p, 'thetis').reason, 'max_awaken');
});

test('Thức tỉnh: thiếu từng loại nguyên liệu đều bị từ chối và không đổi gì', () => {
  const p = rich();
  for (const [reason, mut] of [
    ['not_enough_shards', (q) => (q.inventory.shards = 0)],
    ['not_enough_stones', (q) => (q.inventory.stones[0].normal = 0)],
    ['not_enough_gold', (q) => (q.inventory.gold = 0)],
  ]) {
    const q = structuredClone(p);
    mut(q);
    const snap = JSON.stringify(q);
    assert.equal(awaken(ctx, q, 'thetis').reason, reason);
    assert.equal(JSON.stringify(q), snap);
  }
  const q = structuredClone(p);
  q.inventory.stones[0].normal = 100;
  q.characters.thetis.awaken = 3;
  q.inventory.stones[0].rare = 1;
  assert.equal(awaken(ctx, q, 'thetis').reason, 'not_enough_stones');
});

test('Thức tỉnh tăng chỉ số ở bậc 1, 2, 4 và giảm hồi chiêu ở bậc 3, 5', () => {
  const hp = [0, 1, 2, 3, 4, 5].map((a) => statsFor(ctx, 'thetis', 1, a).hp);
  assert.ok(hp[1] > hp[0] && hp[2] > hp[1] && hp[3] === hp[2] && hp[4] > hp[3] && hp[5] === hp[4]);
});

test('nhân vật trùng tự đổi thành Mảnh Linh Hồn theo độ hiếm; nhân vật mới được thêm', () => {
  const p = newProgress(ctx);
  const dup = grantCharacter(ctx, p, 'thetis');
  assert.deepEqual([dup.duplicate, dup.shards], [true, ctx.config.upgrade.duplicateShards[3]]);
  assert.equal(dup.progress.inventory.shards, ctx.config.upgrade.duplicateShards[3]);
  const fresh = grantCharacter(ctx, p, 'hel');
  assert.equal(fresh.duplicate, false);
  assert.deepEqual(fresh.progress.characters.hel, { level: 1, awaken: 0 });
  const dup5 = grantCharacter(ctx, fresh.progress, 'hel');
  assert.equal(dup5.shards, ctx.config.upgrade.duplicateShards[5]);
  assert.equal(grantCharacter(ctx, p, 'nobody').ok, false);
});

test('đội hình: 5 nhân vật khác nhau, đã sở hữu; thứ tự được giữ', () => {
  let p = grantCharacter(ctx, grantCharacter(ctx, newProgress(ctx), 'hel').progress, 'loki').progress;
  const t = ['hel', 'loki', 'thetis', 'bennu', 'eir'];
  p = setTeam(p, t).progress;
  assert.deepEqual(p.team, t);
  assert.ok(isValidProgress(p));
  assert.equal(setTeam(p, ['hel', 'hel', 'thetis', 'bennu', 'eir']).reason, 'bad_team');
  assert.equal(setTeam(p, ['zeus', 'loki', 'thetis', 'bennu', 'eir']).reason, 'not_owned');
  assert.equal(setTeam(p, t.slice(0, 4)).reason, 'bad_team');
  assert.deepEqual(teamRoster(p)[0], { id: 'hel', level: 1, awaken: 0 });
});

test('save: migrate v2 lên v3 chuyển đội mẫu cũ sang đội khởi đầu, giữ kho', () => {
  const p = newProgress(ctx);
  const v2 = { ...p, version: 2, team: ['demo_thuy', 'demo_hoa', 'demo_moc', 'demo_quang', 'demo_tim'] };
  delete v2.characters;
  v2.inventory.gold = 321;
  const out = migrate(v2, 2, ctx);
  assert.ok(isValidProgress(out));
  assert.equal(out.inventory.gold, 321);
  assert.deepEqual(out.team, newProgress(ctx).team);
});

test('chuyến leo tháp dùng chỉ số theo Level/Thức tỉnh và vẫn xác định theo replay', () => {
  let p = rich();
  for (let i = 0; i < 10; i++) p = levelUp(ctx, p, 'thetis').progress;
  p = awaken(ctx, p, 'thetis').progress;
  const team = teamRoster(p);
  const lowRun = createRun(ctx, { seed: 4, zoneId: 'zone_water', team: teamRoster(newProgress(ctx)) });
  const run = createRun(ctx, { seed: 4, zoneId: 'zone_water', team });
  assert.ok(run.maxHp > lowRun.maxHp);
  const rec = newRunRecord(4, 'zone_water', team);
  let r = createRun(ctx, rec);
  const a = { type: 'door', index: 0 };
  rec.actions.push(a);
  r = runStep(ctx, r, a).run;
  assert.deepEqual(playRun(ctx, rec), r);
});
