import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, characterSchema, duoSchema } from '../www/js/core/schema.js';
import { statsFor, skillCooldown } from '../www/js/core/stats.js';
import { createBattle, step } from '../www/js/core/battle.js';
import { buildCtx, DATA_FILES } from '../www/js/core/ctx.js';
import { DEFAULT_TEAM } from '../www/js/core/progress.js';
import { KEYS } from '../www/js/core/effects.js';
import { readJson } from './helpers.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const vi = JSON.parse(fs.readFileSync(path.join(root, 'www/js/i18n/vi.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'www/js/i18n/en.json'), 'utf8'));
const chars = readJson('characters.json');
const duos = readJson('duos.json');
const config = readJson('config.json');
const ctx = buildCtx(Object.fromEntries(DATA_FILES.map((k) => [k, readJson(`${k}.json`)])));

const ROSTER = {
  0: { 5: ['thuy_tinh'], 4: ['ran'], 3: ['thetis', 'coc_kien_troi'] },
  1: { 5: ['thanh_giong'], 4: ['hephaestus', 'surtr'], 3: ['bennu'] },
  2: { 5: ['son_tinh'], 4: ['mai_an_tiem', 'artemis'], 3: ['atalanta'] },
  3: { 5: ['apollo'], 4: ['ra'], 3: ['eos', 'heimdall'] },
  4: { 5: ['hel'], 4: ['loki'], 3: ['nyx', 'fenrir'] },
  5: { 5: ['co_tam'], 4: ['freyja'], 3: ['eir', 'orpheus'] },
};

test('roster: đúng 24 nhân vật theo bảng GDD (6 năm sao, 8 bốn sao, 10 ba sao)', () => {
  assert.equal(chars.length, 24);
  for (const [el, byR] of Object.entries(ROSTER))
    for (const [r, ids] of Object.entries(byR)) {
      const got = chars.filter((c) => c.element === Number(el) && c.rarity === Number(r)).map((c) => c.id).sort();
      assert.deepEqual(got, ids.slice().sort(), `hệ ${el} ${r}★`);
    }
  assert.deepEqual([5, 4, 3].map((r) => chars.filter((c) => c.rarity === r).length), [6, 8, 10]);
  for (const reserved of ['zeus', 'odin', 'thor', 'anubis', 'medusa', 'dracula']) assert.ok(!chars.some((c) => c.id === reserved));
});

test('roster: schema hợp lệ, tên và tên kỹ năng có đủ vi/en', () => {
  for (const c of chars) {
    assert.deepEqual(validate(c, characterSchema), [], c.id);
    for (const d of [vi, en]) {
      assert.ok(d[`char.${c.id}`], c.id);
      assert.ok(d[`skill.${c.id}`], c.id);
    }
  }
});

test('ngân sách chỉ số: không ai vượt trần của độ hiếm tại Level tối đa + Form 2', () => {
  const cap = { 3: 330, 4: 420, 5: 520 };
  for (const c of chars) {
    const s = statsFor(ctx, c.id, config.progression.levelMax, 1);
    const pts = s.hp * config.budgetWeights.hp + s.atk * config.budgetWeights.atk + s.heal * config.budgetWeights.heal;
    assert.ok(pts <= config.budget[c.rarity], `${c.id}: ${pts} > ${config.budget[c.rarity]}`);
    assert.equal(config.budget[c.rarity], cap[c.rarity]);
  }
});

test('kỹ năng: chỉ ghép từ đơn vị hợp lệ và 12 từ khóa; leader chỉ dùng 4 khuôn mẫu', () => {
  const templates = new Set(['atk_element', 'hp_element', 'heal_boost', 'start_cd']);
  for (const c of chars) {
    assert.ok(templates.has(c.leader.template), c.id);
    for (const u of c.skill.units) {
      if (u.type === 'applyEffect') assert.ok(u.key && u.turns >= 1 && u.target, c.id);
      if (u.type === 'damage') assert.ok(u.mult > 0, c.id);
    }
  }
  for (const d of duos) assert.deepEqual(validate(d, duoSchema), [], d.id);
});

test('Duo: 15 cặp, nhân vật tồn tại, mỗi người tối đa 3 Duo, dị bản có nguồn, có tên i18n', () => {
  assert.equal(duos.length, 15);
  const count = {};
  const pairs = new Set();
  for (const d of duos) {
    assert.ok(ctx.characters[d.a] && ctx.characters[d.b], d.id);
    count[d.a] = (count[d.a] || 0) + 1;
    count[d.b] = (count[d.b] || 0) + 1;
    pairs.add([d.a, d.b].sort().join('|'));
    assert.ok(vi[`duo.${d.id}`] && en[`duo.${d.id}`]);
  }
  assert.equal(pairs.size, 15);
  assert.ok(Object.values(count).every((n) => n <= 3), JSON.stringify(count));
  assert.ok(duos.find((d) => d.a === 'apollo' && d.b === 'orpheus').source);
  assert.ok(duos.find((d) => d.a === 'son_tinh' && d.b === 'thuy_tinh'));
});

test('Duo: chỉ kích hoạt khi liền ô (không phân biệt thứ tự), dùng riêng hồi chiêu', () => {
  const mk = (team) => createBattle(ctx, { seed: 5, team, enemies: ['water_n1'] });
  assert.equal(mk(['son_tinh', 'thuy_tinh', 'thetis', 'bennu', 'eir']).duos.length, 1);
  assert.equal(mk(['thuy_tinh', 'son_tinh', 'thetis', 'bennu', 'eir']).duos.length, 1);
  assert.equal(mk(['son_tinh', 'thetis', 'thuy_tinh', 'bennu', 'eir']).duos.length, 0);
  let s = mk(['son_tinh', 'thuy_tinh', 'thetis', 'bennu', 'eir']);
  assert.equal(step(ctx, s, { type: 'duo', index: 0 }).events[0].reason, 'skill_cooldown');
  s.duos[0].cd = 0;
  const r = step(ctx, s, { type: 'duo', index: 0 });
  assert.equal(r.events[0].type, 'duo');
  assert.equal(r.state.duos[0].cd, 7);
  assert.equal(step(ctx, r.state, { type: 'duo', index: 0 }).events[0].reason, 'skill_cooldown');
  assert.equal(step(ctx, s, { type: 'duo', index: 2 }).events[0].reason, 'no_duo');
});

test('leader: khuôn mẫu tác động đúng cho ô 1 và không cho ô khác', () => {
  const ref = createBattle(ctx, { seed: 1, team: ['bennu', 'thuy_tinh', 'eir'], enemies: ['water_n1'] });
  const lead = createBattle(ctx, { seed: 1, team: ['thuy_tinh', 'bennu', 'eir'], enemies: ['water_n1'] });
  const base = statsFor(ctx, 'thuy_tinh', 1, 0);
  assert.equal(lead.members[0].atk, Math.round(base.atk * 1.25));
  assert.equal(ref.members[1].atk, base.atk); // thuy_tinh không phải leader thì không có thưởng
  const hpEl = createBattle(ctx, { seed: 1, team: ['thetis', 'thuy_tinh'], enemies: ['water_n1'] });
  assert.equal(hpEl.members[1].hp, Math.round(statsFor(ctx, 'thuy_tinh').hp * 1.15));
  const cd = createBattle(ctx, { seed: 1, team: ['atalanta', 'bennu'], enemies: ['water_n1'] });
  assert.equal(cd.members[0].skillCd, ctx.characters.atalanta.skill.startCooldown - 1);
  assert.equal(cd.members[1].skillCd, ctx.characters.bennu.skill.startCooldown - 1);
});

test('Form 2: tăng chỉ số, kỹ năng thay thế có sàn hồi chiêu; Level tăng chỉ số', () => {
  assert.ok(statsFor(ctx, 'thetis', 30, 0).atk > statsFor(ctx, 'thetis', 1, 0).atk);
  assert.ok(statsFor(ctx, 'thetis', 1, 1).hp > statsFor(ctx, 'thetis', 1, 0).hp);
  for (const c of chars) {
    assert.ok(c.form2?.skill, `${c.id} thiếu Form 2`);
    assert.ok(skillCooldown(ctx, c.id, 1) >= config.progression.minCooldown, c.id);
    assert.ok(skillCooldown(ctx, c.id, 1) <= skillCooldown(ctx, c.id, 0), `${c.id}: Form 2 không chậm hơn`);
  }
});

test('Form 2: kỹ năng chỉ dùng đơn vị và từ khóa hợp lệ, mạnh hơn Form 1', () => {
  for (const c of chars) {
    const f = c.form2;
    assert.ok(f.skill.units.length >= c.skill.units.length, c.id);
    for (const u of f.skill.units) {
      assert.ok(['damage', 'heal', 'convert', 'applyEffect'].includes(u.type), c.id);
      if (u.type === 'applyEffect') assert.ok(KEYS.includes(u.key), `${c.id} ${u.key}`);
    }
    const power = (units) => units.reduce((a, u) => a + (u.mult || 0) + (u.pctMax || 0) * 5, 0);
    assert.ok(power(f.skill.units) >= power(c.skill.units), `${c.id}: Form 2 không yếu hơn`);
  }
});

test('đội khởi đầu là 5 nhân vật 3★ đủ 5 hệ khác nhau', () => {
  assert.equal(DEFAULT_TEAM.length, 5);
  for (const id of DEFAULT_TEAM) assert.equal(ctx.characters[id].rarity, 3);
  assert.equal(new Set(DEFAULT_TEAM.map((id) => ctx.characters[id].element)).size, 5);
});

test('Tộc: mọi tướng và quái có tộc hợp lệ, mỗi tộc có tên VI/EN, Tiểu Linh đủ 6 hệ x 2 sao', () => {
  const races = new Set(config.races);
  assert.equal(races.size, 5);
  for (const c of chars) assert.ok(races.has(c.race), c.id);
  for (const m of Object.values(ctx.monsters)) assert.ok(races.has(m.race), m.id);
  for (const r of races) assert.ok(chars.some((c) => c.race === r), `tộc ${r} chưa có tướng`);
  for (const [l, d] of Object.entries({ vi, en })) {
    for (const r of races) assert.ok(d[`race.${r}`], `${l} race.${r}`);
    for (const f of ctx.fodderList) assert.ok(d[`fodder.${f.element}.${f.star}`], `${l} fodder ${f.id}`);
  }
  assert.equal(ctx.fodderList.length, 12);
  for (const f of ctx.fodderList) assert.ok(f.exp > 0 && f.sell > 0 && f.star >= 1 && f.star <= 2, f.id);
});
