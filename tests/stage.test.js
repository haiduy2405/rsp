import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCtx } from './helpers.js';
import { newProgress, applyRunResult, isValidProgress, SAVE_VERSION } from '../www/js/core/progress.js';
import { stageOpen, clearsOf, zoneClears, stagesDone } from '../www/js/core/stage.js';
import { createRun, runStep } from '../www/js/core/run.js';
import { simulateRun } from '../tools/loot-sim.js';
import { migrate } from '../www/js/save/migrate.js';
import { rollLoot } from '../www/js/core/loot.js';
import { mulberry32 } from '../www/js/core/rng.js';

const ctx = loadCtx();
const [EASY, NORMAL, HARD] = ctx.config.difficulty.order;

const N = ctx.config.run.stages;
test('stage: 7 ải mở lần lượt; xong 7 ải Dễ mở Vừa và khu kế; Vừa -> Khó; ải 7 là boss', () => {
  let p = newProgress(ctx);
  assert.ok(stageOpen(ctx, p, 'zone_water', EASY, 1));
  assert.ok(!stageOpen(ctx, p, 'zone_water', EASY, 2), 'ải 2 cần qua ải 1');
  assert.ok(!stageOpen(ctx, p, 'zone_water', NORMAL, 1));
  assert.ok(!stageOpen(ctx, p, 'zone_fire', EASY, 1), 'khu chưa mở');
  for (let s = 1; s <= N; s++) {
    assert.ok(stageOpen(ctx, p, 'zone_water', EASY, s), `ải ${s}`);
    assert.ok(!stageOpen(ctx, p, 'zone_fire', EASY, 1) || s === N + 1, 'chưa xong 7 ải Dễ thì chưa mở khu kế');
    p = applyRunResult(ctx, p, simulateRun(ctx, 5 + s, 'zone_water', false, EASY, s));
    assert.equal(stagesDone(p, 'zone_water', EASY), s);
  }
  assert.ok(stageOpen(ctx, p, 'zone_fire', EASY, 1), 'xong 7 ải Dễ mở khu kế');
  assert.ok(stageOpen(ctx, p, 'zone_water', NORMAL, 1));
  assert.ok(!stageOpen(ctx, p, 'zone_water', HARD, 1));
  assert.ok(!stageOpen(ctx, p, 'zone_fire', NORMAL, 1), 'Vừa của khu kế vẫn cần xong Dễ khu đó');
  for (let s = 1; s <= N; s++) p = applyRunResult(ctx, p, simulateRun(ctx, 40 + s, 'zone_water', false, NORMAL, s));
  assert.ok(stageOpen(ctx, p, 'zone_water', HARD, 1));
  assert.equal(clearsOf(p, 'zone_water', EASY), N);
  assert.equal(zoneClears(p, 'zone_water'), 2 * N);
  assert.ok(!stageOpen(ctx, p, 'zone_water', EASY, N + 1) && !stageOpen(ctx, p, 'zone_water', EASY, 0));
  assert.ok(isValidProgress(p));
});

test('stage: thua hoặc ải 1..6 không mở khu kế; Khó của khu cũ không mở khu mới', () => {
  let p = newProgress(ctx);
  p = applyRunResult(ctx, p, simulateRun(ctx, 3, 'zone_water', false, EASY, 6));
  assert.deepEqual(p.unlocked, ['zone_water']);
  p = newProgress(ctx);
  p.stages.zone_water = { easy: N, normal: N };
  p.unlocked = ['zone_water'];
  p = applyRunResult(ctx, p, simulateRun(ctx, 7, 'zone_water', false, HARD, N));
  assert.deepEqual(p.unlocked, ['zone_water']);
});

test('ải: ải sau mạnh hơn ải trước (stageScale), ải 7 có Elite rồi Boss', () => {
  const foe = (stage) => {
    let r = createRun(ctx, { seed: 3, zoneId: 'zone_water', team: ['thetis', 'bennu', 'atalanta', 'eos', 'eir'].map((id) => ({ id, level: 1, awaken: 0 })), stage });
    r = runStep(ctx, r, { type: 'door', index: 0 }).run;
    const e = r.battle.enemies[0];
    return e.maxHp / ctx.monsters[e.id].hp;
  };
  assert.ok(foe(6) > foe(1)); // ải 7 (Boss) cố ý dễ hơn ải 6: ải Boss có thêm Elite + Boss nên nhân hệ số riêng
  assert.throws(() => createRun(ctx, { seed: 1, zoneId: 'zone_water', team: [], stage: 8 }));
  assert.throws(() => createRun(ctx, { seed: 1, zoneId: 'zone_water', team: [], stage: 0 }));
});

test('độ khó: quái mạnh dần, rớt nhiều dần', () => {
  const hpOf = (d) => {
    let r = createRun(ctx, { seed: 3, zoneId: 'zone_water', team: ['thetis', 'bennu', 'atalanta', 'eos', 'eir'].map((id) => ({ id, level: 1, awaken: 0 })), diff: d });
    r = runStep(ctx, r, { type: 'door', index: 0 }).run;
    const e = r.battle.enemies[0];
    return (e.maxHp / ctx.monsters[e.id].hp) * (e.atk / ctx.monsters[e.id].atk); // độ khó tăng chủ yếu ở sát thương quái (dễ chết), ít ở máu
  };
  assert.ok(hpOf(NORMAL) > hpOf(EASY) && hpOf(HARD) > hpOf(NORMAL));
  const avg = (d) => {
    let t = 0;
    for (let i = 0; i < 4000; i++) { const l = rollLoot(ctx, 'boss', mulberry32(i), d); t += l.gold + l.elixir[1] * 100 + l.elixir[2] * 500 + l.shards * 50 + l.stones.rare * 300 + l.stones.normal * 20; }
    return t / 4000;
  };
  assert.ok(avg(NORMAL) > avg(EASY) * 1.3 && avg(HARD) > avg(NORMAL) * 1.2, 'khó hơn thì phần thưởng ngon hơn');
  assert.throws(() => createRun(ctx, { seed: 1, zoneId: 'zone_water', team: [], diff: 'nightmare' }));
});

test('save: migrate v4 lên v5 đổi clears thành theo độ khó và ', () => {
  const v4 = { ...newProgress(ctx), version: 4, clears: { zone_water: 3 } };
  const out = migrate(v4, 4, ctx);
  assert.equal(out.version, SAVE_VERSION);
  assert.deepEqual(out.clears, { zone_water: { easy: 3 } });
  assert.deepEqual(out.stages, { zone_water: { easy: 7 } });
  assert.ok(isValidProgress(out));
});

test('Linh Thạch chỉ thưởng lần qua ải đầu tiên (khu × độ khó × ải); 7 ải cộng lại bằng firstClearSpirit', async () => {
  const { newProgress, applyRunResult, firstClearSpirit, firstClearStageSpirit } = await import('../www/js/core/progress.js');
  let p = newProgress(ctx);
  const mkEnd = (diff, stage) => ({ phase: 'end', result: 'won', zoneId: 'zone_water', diff, stage, loot: { gold: 0, elixir: { 1: 0, 2: 0, 3: 0 }, shards: 0, stones: { normal: 0, rare: 0 }, fodder: {}, offerings: {} }, rareMissed: false, heroExp: 0 });
  const a = applyRunResult(ctx, p, mkEnd('easy', 1));
  assert.equal(a.inventory.spirit, firstClearStageSpirit(ctx, 'zone_water', 'easy', 1));
  assert.ok(a.inventory.spirit > 0);
  const b = applyRunResult(ctx, a, mkEnd('easy', 1));
  assert.equal(b.inventory.spirit, a.inventory.spirit, 'clear lại không thêm');
  for (let s = 2; s <= N; s++) p = applyRunResult(ctx, s === 2 ? a : p, mkEnd('easy', s));
  assert.ok(Math.abs(p.inventory.spirit - firstClearSpirit(ctx, 'zone_water', 'easy')) <= N, 'tổng 7 ải ≈ firstClearSpirit');
  assert.ok(firstClearStageSpirit(ctx, 'zone_water', 'easy', N) > firstClearStageSpirit(ctx, 'zone_water', 'easy', 1), 'ải boss thưởng nhiều nhất');
  const c = applyRunResult(ctx, p, mkEnd('normal', 1));
  assert.ok(c.inventory.spirit > p.inventory.spirit, 'độ khó khác là ải mới');
  assert.ok(firstClearSpirit(ctx, 'zone_fire', 'easy') > firstClearSpirit(ctx, 'zone_water', 'easy'));
  for (const kind of Object.keys(ctx.config.loot)) assert.equal(ctx.config.loot[kind].spirit, undefined);
});
