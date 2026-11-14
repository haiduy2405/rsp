import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, step } from '../www/js/core/battle.js';
import { findHint } from '../www/js/ui/hint.js';
import { loadCtx, TEAM, FOES } from './helpers.js';

const ctx = loadCtx();

test('hint: đường gợi ý là nước hợp lệ, cho đúng số combo đã báo, không kém nước 1 ô', () => {
  let better = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const s = createBattle(ctx, { seed, team: TEAM, enemies: FOES });
    const h = findHint(ctx, s);
    assert.ok(h, `seed ${seed} có gợi ý`);
    const r = step(ctx, s, { type: 'move', path: h.path });
    assert.notEqual(r.events[0].type, 'invalid');
    const steps = r.events.filter((e) => e.type === 'step');
    assert.equal(steps[steps.length - 1].combos, h.combos);
    // so với nước đổi 2 ô tốt nhất
    let two = 0;
    for (let a = 0; a < 30; a++) for (const b of [a + 1, a + 6, a + 7, a + 5]) {
      if (b >= 30 || Math.abs((b % 6) - (a % 6)) > 1) continue;
      const q = step(ctx, s, { type: 'move', path: [a, b] }).events.filter((e) => e.type === 'step');
      if (q.length) two = Math.max(two, q[q.length - 1].combos);
    }
    const cap = ctx.config.hint.maxCombos;
    assert.ok(h.combos <= cap, `seed ${seed}: ${h.combos} <= ${cap}`);
    assert.ok(h.combos >= Math.min(two, cap), `seed ${seed}: ${h.combos} >= min(${two}, ${cap})`);
    if (h.combos > two) better++;
  }
  assert.ok(better >= 4, `nhiều trường hợp nhiều combo hơn nước 1 ô (${better}/12)`);
});

test('hint: tìm nhanh (dưới 1 giây mỗi lần)', () => {
  const s = createBattle(ctx, { seed: 5, team: TEAM, enemies: FOES });
  const t0 = Date.now();
  findHint(ctx, s);
  assert.ok(Date.now() - t0 < 1000, `${Date.now() - t0}ms`);
});

test('hint tối ưu (config.hint.auto): hợp lệ, không kém gợi ý đơn giản về combo và sát thương', () => {
  const auto = ctx.config.hint.auto;
  for (let seed = 1; seed <= 4; seed++) {
    const s = createBattle(ctx, { seed, team: TEAM, enemies: FOES });
    const a = findHint(ctx, s, undefined, auto);
    const b = findHint(ctx, s);
    assert.ok(a && a.combos >= b.combos, `seed ${seed}`);
    assert.notEqual(step(ctx, s, { type: 'move', path: a.path }).events[0].type, 'invalid');
  }
});
