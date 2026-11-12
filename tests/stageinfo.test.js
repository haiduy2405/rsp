import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCtx } from './helpers.js';
import { stageInfo } from '../www/js/core/stageinfo.js';

const ctx = loadCtx();

test('stageinfo: độ khó cao hơn thì quái mạnh hơn và rớt nhiều hơn', () => {
  for (const z of ctx.zoneList) {
    const e = stageInfo(ctx, z.id, 'easy');
    const h = stageInfo(ctx, z.id, 'hard');
    assert.ok(h.hp[0] > e.hp[0] && h.atk[1] > e.atk[1]);
    assert.ok(e.hp[1] > e.hp[0], 'tầng cuối mạnh hơn tầng đầu');
    const sum = (si) => si.sources.find((s) => s.kind === 'boss').gold[0];
    assert.ok(sum(h) > sum(e));
  }
});

test('stageinfo: tỉ lệ rớt trong [0,1], tỉ lệ bậc Lễ Vật cộng bằng 1, có đủ nguồn', () => {
  const si = stageInfo(ctx, 'zone_heart', 'normal');
  assert.deepEqual(si.sources.map((s) => s.kind), ['normal', 'swarm', 'elite', 'boss', 'chest', 'completion']);
  for (const s of si.sources) for (const d of s.drops) assert.ok(d.chance >= 0 && d.chance <= 1, `${s.kind} ${d.key}`);
  assert.ok(Math.abs(si.tiers.reduce((a, x) => a + x.pct, 0) - 1) < 1e-9);
  assert.ok(si.races.length > 0);
});
