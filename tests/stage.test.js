import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCtx } from './helpers.js';
import { newProgress, applyRunResult, isValidProgress, SAVE_VERSION } from '../www/js/core/progress.js';
import { stageOpen, clearsOf, zoneClears } from '../www/js/core/stage.js';
import { createRun, runStep } from '../www/js/core/run.js';
import { simulateRun } from '../tools/loot-sim.js';
import { migrate } from '../www/js/save/migrate.js';
import { rollLoot } from '../www/js/core/loot.js';
import { mulberry32 } from '../www/js/core/rng.js';

const ctx = loadCtx();
const [EASY, NORMAL, HARD] = ctx.config.difficulty.order;

test('stage: Dễ -> Vừa -> Khó mở lần lượt; thắng Dễ mở khu kế, thắng Vừa/Khó thì không', () => {
  let p = newProgress(ctx);
  assert.ok(stageOpen(ctx, p, 'zone_water', EASY));
  assert.ok(!stageOpen(ctx, p, 'zone_water', NORMAL));
  assert.ok(!stageOpen(ctx, p, 'zone_fire', EASY), 'khu chưa mở');
  p = applyRunResult(ctx, p, simulateRun(ctx, 5, 'zone_water', false, EASY));
  assert.ok(stageOpen(ctx, p, 'zone_water', NORMAL));
  assert.ok(!stageOpen(ctx, p, 'zone_water', HARD));
  assert.ok(stageOpen(ctx, p, 'zone_fire', EASY));
  p = applyRunResult(ctx, p, simulateRun(ctx, 6, 'zone_water', false, NORMAL));
  assert.ok(stageOpen(ctx, p, 'zone_water', HARD));
  assert.ok(!stageOpen(ctx, p, 'zone_fire', NORMAL), 'Vừa của khu kế vẫn cần thắng Dễ khu đó');
  assert.equal(clearsOf(p, 'zone_water', EASY), 1);
  assert.equal(zoneClears(p, 'zone_water'), 2);
  assert.ok(isValidProgress(p));
});

test('stage: Khó của khu cũ không mở khu mới (khu mở chỉ nhờ thắng Dễ)', () => {
  let p = newProgress(ctx);
  p.clears.zone_water = { easy: 1, normal: 1 };
  p.unlocked = ['zone_water'];
  p = applyRunResult(ctx, p, simulateRun(ctx, 7, 'zone_water', false, HARD));
  assert.deepEqual(p.unlocked, ['zone_water']);
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
  assert.ok(isValidProgress(out));
});

test('Linh Thạch chỉ thưởng lần clear đầu của mỗi ải (khu × độ khó), loot thường không rớt Linh Thạch', async () => {
  const { newProgress, applyRunResult, firstClearSpirit } = await import('../www/js/core/progress.js');
  const p = newProgress(ctx);
  const mkEnd = (diff) => ({ phase: 'end', result: 'won', zoneId: 'zone_water', diff, loot: { gold: 0, elixir: { 1: 0, 2: 0, 3: 0 }, shards: 0, stones: { normal: 0, rare: 0 }, fodder: {}, offerings: {} }, rareMissed: false, heroExp: 0 });
  const a = applyRunResult(ctx, p, mkEnd('easy'));
  assert.equal(a.inventory.spirit, firstClearSpirit(ctx, 'zone_water', 'easy'));
  assert.ok(a.inventory.spirit > 0);
  const b = applyRunResult(ctx, a, mkEnd('easy'));
  assert.equal(b.inventory.spirit, a.inventory.spirit, 'clear lại không thêm');
  const c = applyRunResult(ctx, b, mkEnd('normal'));
  assert.ok(c.inventory.spirit > b.inventory.spirit, 'độ khó khác là ải mới');
  assert.ok(firstClearSpirit(ctx, 'zone_fire', 'easy') > firstClearSpirit(ctx, 'zone_water', 'easy'));
  for (const kind of Object.keys(ctx.config.loot)) assert.equal(ctx.config.loot[kind].spirit, undefined);
});
