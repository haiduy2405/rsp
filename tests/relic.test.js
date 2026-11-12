import test from 'node:test';
import assert from 'node:assert/strict';
import { relicMods, rollRelics } from '../www/js/core/relic.js';
import { createBattle, step } from '../www/js/core/battle.js';
import { mulberry32 } from '../www/js/core/rng.js';
import { N } from '../www/js/core/board.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const TEAM = ['thetis', 'bennu', 'atalanta', 'eos', 'eir'];
const mods = (...ids) => relicMods(ctx, ids);
const battle = (m, extra = {}) => createBattle(ctx, { seed: 11, team: TEAM, enemies: ['water_b1'], mods: m, ...extra });
// Bàn chắc có nhóm 5 ngọc Thủy (hàng 0 và ô [6]) và không có nhóm khác; nước kéo [29, 28] không đổi bàn.
const rigBoard = (s, cells) => ({ ...s, board: { cells, enh: new Array(N).fill(0) } });
const checker = () => Array.from({ length: N }, (_, i) => (((i % 6) + ((i / 6) | 0)) % 2 === 0 ? 4 : 5));

test('relicMods: cộng dồn, Di Vật theo hệ vào bảng riêng', () => {
  const m = mods('whetstone', 'tide_pearl', 'dragon_heart');
  assert.ok(Math.abs(m.atkPct - 0.33) < 1e-9);
  assert.equal(m.hpPct, 0.15);
  assert.equal(m.elAtk[0], 0.2);
  assert.equal(mods().atkPct, 0);
});

test('rollRelics: không trùng, bỏ cái đã có, đúng số lượng, xác định theo seed', () => {
  const a = rollRelics(ctx, mulberry32(3), 3, 'shrine', ['prism']);
  assert.equal(new Set(a).size, 3);
  assert.ok(!a.includes('prism'));
  assert.deepEqual(a, rollRelics(ctx, mulberry32(3), 3, 'shrine', ['prism']));
  assert.equal(rollRelics(ctx, mulberry32(3), 999, 'shop', []).length, ctx.relicList.length);
});

test('Di Vật tăng chỉ số đội và khiên đầu trận (qua run) không phá trận cũ', () => {
  const base = battle(mods());
  const strong = battle(mods('dragon_heart'));
  assert.ok(strong.members[0].atk > base.members[0].atk && strong.maxHp > base.maxHp);
  assert.ok(battle(mods('wind_boots')).members.every((m, i) => m.skillCd <= base.members[i].skillCd));
  assert.equal(battle(mods('time_lord')).dragBonusMs, 3000);
});

test('Lăng Kính: nhóm 4 ngọc đã đánh toàn bộ quái', () => {
  const cells = checker();
  for (const c of [0, 1, 2, 3]) cells[c] = 0; // nhóm 4 ngọc Thủy
  const hitAll = (m) => {
    const s = rigBoard(createBattle(ctx, { seed: 11, team: TEAM, enemies: ['water_b1', 'water_b1'], mods: m }), cells);
    const r = step(ctx, s, { type: 'move', path: [29, 28] });
    return new Set(r.events.filter((e) => e.type === 'step').flatMap((e) => e.hits.filter((h) => h.kind === 'damage').map((h) => h.enemy))).size;
  };
  assert.equal(hitAll(mods()), 1);
  assert.equal(hitAll(mods('prism')), 2);
});

test('Hút máu và Hồi mỗi lượt hồi máu đội', () => {
  const cells = checker();
  for (const c of [0, 1, 2]) cells[c] = 0;
  const run = (m) => {
    const s = rigBoard(battle(m), cells);
    s.hp = Math.floor(s.maxHp / 2);
    const r = step(ctx, s, { type: 'move', path: [29, 28] });
    return r.state.hp - s.hp - 0;
  };
  const base = run(mods());
  assert.ok(run(mods('vampire_fang')) > base);
  assert.ok(run(mods('herb_pouch')) > base);
});

test('Lông Phượng: hồi sinh đúng một lần với máu theo phần trăm', () => {
  const s = battle(mods('phoenix_feather'));
  s.hp = 1;
  s.enemies[0].cd = 1;
  s.enemies[0].atk = 1e6;
  s.enemies[0].hp = s.enemies[0].maxHp = 1e9;
  const r1 = step(ctx, rigBoard(s, checker()), { type: 'move', path: [29, 28] });
  assert.equal(r1.state.status, 'playing');
  assert.ok(r1.events.some((e) => e.type === 'revive'));
  assert.equal(r1.state.reviveUsed, true);
  assert.equal(Math.round(r1.state.maxHp * 0.4) >= r1.state.hp - 1, true);
  const s2 = structuredClone(r1.state);
  s2.hp = 1;
  s2.enemies[0].cd = 1;
  const r2 = step(ctx, s2, { type: 'move', path: [29, 28] });
  assert.equal(r2.state.status, 'lost');
});

test('Rìu Diệt Khổng Lồ: chỉ tăng sát thương trong trận Elite/Boss; đòn đầu: Vòng Tràn Lực', () => {
  const cells = checker();
  for (const c of [0, 1, 2]) cells[c] = 0;
  const dmg = (m, big) => {
    const s = rigBoard(battle(m, { big }), cells);
    const r = step(ctx, s, { type: 'move', path: [29, 28] });
    return r.events.filter((e) => e.type === 'step').flatMap((e) => e.hits).filter((h) => h.kind === 'damage').reduce((a, h) => a + h.amount, 0);
  };
  const base = dmg(mods(), false);
  assert.ok(base > 0);
  assert.equal(dmg(mods('giant_bane'), false), base);
  assert.ok(dmg(mods('giant_bane'), true) > base);
  assert.ok(dmg(mods('overflow_ring'), false) > base * 1.5);
});

test('data: mọi Di Vật có tên và mọi hệ số có mô tả (vi, en)', async () => {
  const fs = await import('node:fs');
  for (const lang of ['vi', 'en']) {
    const t = JSON.parse(fs.readFileSync(new URL(`../www/js/i18n/${lang}.json`, import.meta.url), 'utf8'));
    for (const r of ctx.relicList) {
      assert.ok(t[`relic.${r.id}`], `${lang} ${r.id}`);
      assert.ok([1, 2, 3].includes(r.rarity));
      for (const k of Object.keys(r.mods)) assert.ok(t[`relic.mod.${k}${r.element != null && (k === 'atkPct' || k === 'hpPct') ? 'El' : ''}`], `${lang} ${k}`);
    }
  }
});
