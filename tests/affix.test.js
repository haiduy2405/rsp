import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCtx } from './helpers.js';
import { mulberry32 } from '../www/js/core/rng.js';
import { rollAffixes } from '../www/js/core/affix.js';
import { createBattle } from '../www/js/core/battle.js';
import { DEFAULT_TEAM } from '../www/js/core/progress.js';
import { KEYS } from '../www/js/core/effects.js';

const ctx = loadCtx();
const L = () => ctx.config.affix.list;

test('affix: chỉ dùng từ khóa hiệu ứng có sẵn', () => {
  for (const a of Object.values(L())) for (const e of a.effects || []) assert.ok(KEYS.includes(e.key), e.key);
});

test('affix: khu đầu độ Dễ quái thường không có đặc tính; Boss luôn có', () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 50; i++) assert.deepEqual(rollAffixes(ctx, rng, 'normal', 0, 'easy', 2), [[], []]);
  for (let i = 0; i < 50; i++) assert.ok(rollAffixes(ctx, rng, 'boss', 0, 'easy', 2)[0].length >= 1);
});

test('affix: đặc tính chỉ rớt khi đủ khu (minZone), không trùng, không vượt trần', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 300; i++) {
    const order = i % 6;
    const [a, b] = rollAffixes(ctx, rng, 'boss', order, 'hard', 2);
    assert.ok(a.length <= ctx.config.affix.maxCount.boss);
    assert.equal(new Set(a).size, a.length);
    assert.equal(b.length, 0, 'đặc tính dồn vào quái chính');
    for (const id of a) assert.ok((L()[id].minZone ?? 0) <= order);
  }
});

test('affix: xác định theo seed', () => {
  const a = rollAffixes(ctx, mulberry32(5), 'elite', 3, 'normal', 2);
  const b = rollAffixes(ctx, mulberry32(5), 'elite', 3, 'normal', 2);
  assert.deepEqual(a, b);
});

test('affix: áp vào trận đổi chỉ số/hiệu ứng đúng', () => {
  const mk = (affixes) => createBattle(ctx, { seed: 1, team: DEFAULT_TEAM, enemies: ['fire_n1', 'fire_n2'], affixes, scale: { hp: 1, atk: 1 } });
  const base = mk(undefined).enemies[0];
  const t = mk([['tough', 'fury'], ['ward']]);
  assert.equal(t.enemies[0].maxHp, Math.round(base.maxHp * L().tough.hp));
  assert.equal(t.enemies[0].atk, Math.round(base.atk * L().fury.atk));
  assert.equal(t.enemies[1].effects[0].key, 'shield');
  assert.ok(t.enemies[1].effects[0].pool > 0);
  assert.deepEqual(t.enemies[0].affixes, ['tough', 'fury']);
});

test('affix: cửa xem trước có đặc tính và trận dùng đúng đặc tính đó', async () => {
  const { createRun, runStep } = await import('../www/js/core/run.js');
  const run = createRun(ctx, { seed: 3, zoneId: 'zone_heart', team: DEFAULT_TEAM, diff: 'hard' });
  const i = run.doors.findIndex((d) => run.preview[run.doors.indexOf(d)]);
  assert.equal(run.previewAffix.length, run.doors.length);
  const r = runStep(ctx, run, { type: 'door', index: i }).run;
  assert.deepEqual(r.battle.enemies.map((e) => e.affixes || []), run.previewAffix[i]);
});
