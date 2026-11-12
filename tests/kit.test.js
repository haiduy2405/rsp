import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveKit, maxSkillLevel, newSkillLevels } from '../www/js/core/kit.js';
import { skillUp, skillUpCost } from '../www/js/core/upgrade.js';
import { newProgress, isValidProgress } from '../www/js/core/progress.js';
import { createBattle, buildMembers, step } from '../www/js/core/battle.js';
import { rollLoot } from '../www/js/core/loot.js';
import { mulberry32 } from '../www/js/core/rng.js';
import { migrate } from '../www/js/save/migrate.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const lv = (n) => ({ active: n, leader: n, passive: n });

test('kit: cấp kỹ năng tối đa theo độ hiếm 3/4/5', () => {
  assert.equal(maxSkillLevel(ctx, 'thetis'), 3);
  assert.equal(maxSkillLevel(ctx, 'ran'), 4);
  assert.equal(maxSkillLevel(ctx, 'thuy_tinh'), 5);
});

test('kit: cấp cao mạnh hơn cấp thấp; cấp tối đa giảm 1 hồi chiêu', () => {
  const base = resolveKit(ctx, 'thuy_tinh', lv(1));
  const mid = resolveKit(ctx, 'thuy_tinh', lv(3));
  const top = resolveKit(ctx, 'thuy_tinh', lv(5));
  assert.ok(base.skill.units[0].mult < mid.skill.units[0].mult && mid.skill.units[0].mult < top.skill.units[0].mult);
  assert.equal(base.skill.cooldown, ctx.characters.thuy_tinh.skill.cooldown);
  assert.equal(top.skill.cooldown, ctx.characters.thuy_tinh.skill.cooldown - 1);
  assert.ok(base.leader.pct < top.leader.pct);
  // dữ liệu gốc không bị sửa
  assert.equal(ctx.characters.thuy_tinh.skill.units[0].mult, 2.5);
});

test('kit: mọi tướng có đủ kỹ năng chủ động, đội trưởng, bị động hợp lệ', () => {
  for (const c of ctx.characterList.filter((x) => !x.id.startsWith('demo_'))) {
    const k = resolveKit(ctx, c.id, newSkillLevels());
    assert.ok(k.skill && k.leader && k.passive, c.id);
    if (k.passive.kind === 'stat') assert.ok(['hp', 'atk', 'heal'].includes(k.passive.stat) && k.passive.pct > 0, c.id);
    else assert.ok(['start', 'turn'].includes(k.passive.trigger) && (k.passive.trigger === 'start' || k.passive.every >= 1), c.id);
  }
});

test('skillUp: tốn Lễ Vật đúng tộc và Vàng, dừng ở cấp tối đa', () => {
  let p = newProgress(ctx);
  const cost = skillUpCost(ctx, 'thetis', 'active', 1);
  assert.equal(cost.offering, 'than_1');
  assert.equal(skillUp(ctx, p, 'thetis', 'active').reason, 'not_enough_offerings');
  p.inventory.offerings = { than_1: 50, than_2: 50, than_3: 50 };
  assert.equal(skillUp(ctx, p, 'thetis', 'active').reason, 'not_enough_gold');
  p.inventory.gold = 1e6;
  const r = skillUp(ctx, p, 'thetis', 'active');
  assert.equal(r.progress.characters.thetis.skillLv.active, 2);
  assert.equal(r.progress.inventory.offerings.than_1, 50 - cost.count);
  assert.equal(p.characters.thetis.skillLv.active, 1, 'không sửa đầu vào');
  p = r.progress;
  p = skillUp(ctx, p, 'thetis', 'active').progress;
  assert.equal(p.characters.thetis.skillLv.active, 3);
  assert.equal(skillUp(ctx, p, 'thetis', 'active').reason, 'max_skill');
  assert.equal(skillUp(ctx, p, 'thetis', 'zzz').reason, 'bad_kind');
  assert.ok(isValidProgress(p));
});

test('bị động dạng chỉ số tăng chỉ số trong trận', () => {
  const team = ['thanh_giong', 'thetis', 'bennu', 'eos', 'eir'];
  const withP = buildMembers(ctx, team).members[0];
  const noP = structuredClone(ctx);
  noP.characters.thanh_giong = { ...ctx.characters.thanh_giong, passive: { kind: 'stat', stat: 'atk', scope: 'self', pct: 0 } };
  assert.ok(withP.atk > buildMembers(noP, team).members[0].atk);
});

test('bị động kích hoạt: "start" áp hiệu ứng đầu trận, "turn" nổ đúng chu kỳ', () => {
  const c2 = structuredClone(ctx);
  c2.characters.heimdall = { ...c2.characters.heimdall, passive: { kind: 'trigger', trigger: 'start', units: [{ type: 'applyEffect', target: 'team', key: 'shield', turns: 3, value: 0.2 }] } };
  const team = ['heimdall', 'bennu', 'atalanta', 'eos', 'eir'];
  const s0 = createBattle(c2, { seed: 5, team, enemies: ['water_b1'] });
  assert.ok(s0.team.effects.some((e) => e.key === 'shield'));
  const c3 = structuredClone(ctx);
  c3.characters.thetis = { ...c3.characters.thetis, passive: { kind: 'trigger', trigger: 'turn', every: 2, units: [{ type: 'applyEffect', target: 'team', key: 'regen', turns: 2, value: 0.03 }] } };
  let s = createBattle(c3, { seed: 7, team: ['thetis', 'bennu', 'atalanta', 'eos', 'eir'], enemies: ['water_b1'] });
  const fired = [];
  for (let i = 0; i < 4 && s.status === 'playing'; i++) {
    let r = null;
    for (let a = 0; a < 29 && !r; a++) {
      const t = step(c3, s, { type: 'move', path: [a, a + 1] });
      if (t.events[0]?.type !== 'invalid') r = t;
    }
    fired.push(r.events.some((e) => e.type === 'passive' && e.member === 0));
    s = r.state;
  }
  assert.deepEqual(fired.slice(0, 4), [false, true, false, true].slice(0, fired.length));
});

test('loot: Lễ Vật theo tộc quái, bậc cao hơn ở độ khó cao; không tộc thì không rớt', () => {
  const none = rollLoot(ctx, 'boss', mulberry32(1), 'easy', 0, []);
  assert.deepEqual(none.offerings, {});
  const seen = { easy: new Set(), hard: new Set() };
  for (let i = 1; i <= 300; i++) {
    for (const d of ['easy', 'hard']) {
      const l = rollLoot(ctx, 'boss', mulberry32(i), d, 0, ['long']);
      for (const k of Object.keys(l.offerings)) {
        assert.ok(k.startsWith('long_'));
        seen[d].add(k);
      }
    }
  }
  assert.deepEqual([...seen.easy], ['long_1']);
  assert.ok(seen.hard.has('long_2') && seen.hard.has('long_3') && !seen.hard.has('long_1'));
});

test('migrate v6 -> v7: thêm cấp kỹ năng và Lễ Vật', () => {
  const p = newProgress(ctx);
  const old = structuredClone(p);
  old.version = 6;
  delete old.inventory.offerings;
  for (const c of Object.values(old.characters)) delete c.skillLv;
  const m = migrate(old, 6, ctx);
  assert.ok(isValidProgress(m));
  assert.deepEqual(m.characters.thetis.skillLv, { active: 1, leader: 1, passive: 1 });
});
