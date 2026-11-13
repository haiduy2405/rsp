import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, characterSchema, duoSchema } from '../www/js/core/schema.js';
import { statsFor, skillCooldown } from '../www/js/core/stats.js';
import { resolveKit } from '../www/js/core/kit.js';
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

test('kỹ năng: chỉ ghép từ đơn vị hợp lệ và 12 từ khóa; leader chỉ dùng các mẫu đã định', () => {
  const templates = new Set(['atk_element', 'hp_element', 'heal_boost', 'atk_all', 'hp_all', 'drag_time', 'combo_mult', 'rainbow']);
  for (const c of chars) {
    if (c.leader) assert.ok(templates.has(c.leader.template), c.id);
    assert.equal(c.skill.units.length, 1, c.id);
    assert.equal(c.passive, undefined, c.id);
    assert.equal(c.form2, undefined, c.id);
    for (const u of c.skill.units) {
      assert.ok(['damage', 'heal', 'convert', 'applyEffect', 'enhance', 'timeFreeze'].includes(u.type), c.id);
      if (u.type === 'applyEffect') assert.ok(u.key && KEYS.includes(u.key) && u.turns >= 1 && u.target, c.id);
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

test('Duo: liền ô (không phân biệt thứ tự), cần cả hai skill đơn sẵn sàng, dùng xong cả hai vào hồi chiêu', () => {
  const mk = (team) => createBattle(ctx, { seed: 5, team, enemies: ['water_n1'] });
  assert.equal(mk(['son_tinh', 'thuy_tinh', 'thetis', 'bennu', 'eir']).duos.length, 1);
  assert.equal(mk(['thuy_tinh', 'son_tinh', 'thetis', 'bennu', 'eir']).duos.length, 1);
  assert.equal(mk(['son_tinh', 'thetis', 'thuy_tinh', 'bennu', 'eir']).duos.length, 0);
  const s = mk(['son_tinh', 'thuy_tinh', 'thetis', 'bennu', 'eir']);
  assert.equal(step(ctx, s, { type: 'duo', index: 0 }).events[0].reason, 'skill_cooldown'); // đầu trận skill chưa sẵn sàng
  s.members[0].skillCd = 0;
  assert.equal(step(ctx, s, { type: 'duo', index: 0 }).events[0].reason, 'skill_cooldown'); // chỉ một skill sẵn sàng vẫn chưa đủ
  s.members[1].skillCd = 0;
  const r = step(ctx, s, { type: 'duo', index: 0 });
  assert.equal(r.events[0].type, 'duo');
  assert.equal(r.state.members[0].skillCd, r.state.members[0].skillMax);
  assert.equal(r.state.members[1].skillCd, r.state.members[1].skillMax);
  assert.equal(step(ctx, r.state, { type: 'duo', index: 0 }).events[0].reason, 'skill_cooldown');
  assert.equal(step(ctx, s, { type: 'duo', index: 2 }).events[0].reason, 'no_duo');
});

test('Duo: sức mạnh = (skill A + skill B) × config.duo.mult, cộng hiệu ứng riêng của cặp', () => {
  const k = ctx.config.duo.mult;
  const mk = () => { const s = createBattle(ctx, { seed: 5, team: ['coc_kien_troi', 'mai_an_tiem', 'thetis', 'bennu', 'eir'], enemies: ['water_n1'] }); s.members.forEach((m) => (m.skillCd = 0)); return s; };
  const dmg = (ev) => ev.hits.filter((h) => h.kind === 'damage').reduce((a, h) => a + h.raw, 0);
  const single = dmg(step(ctx, mk(), { type: 'skill', index: 0 }).events[0]); // Cóc Kiện Trời: sát thương 4×
  const duo = step(ctx, mk(), { type: 'duo', index: 0 }).events[0];
  assert.ok(single > 0);
  assert.ok(Math.abs(dmg(duo) - single * k) <= 1, `sát thương Duo ${dmg(duo)} ≈ ${single} × ${k}`);
  assert.ok(duo.hits.every((h) => h.kind !== 'damage' || h.from === 'coc_kien_troi'), 'chỉ Cóc có sát thương; Mai An Tiêm và hiệu ứng cặp không thêm');
  const after = step(ctx, mk(), { type: 'duo', index: 0 }).state;
  assert.ok(after.team.effects.some((e) => e.key === 'regen'), 'hiệu ứng riêng của cặp (Hồi máu dần) được áp');
});

test('leader: khuôn mẫu tác động đúng cho ô 1 và không cho ô khác', () => {
  const ref = createBattle(ctx, { seed: 1, team: ['bennu', 'thuy_tinh', 'eir'], enemies: ['water_n1'] });
  const lead = createBattle(ctx, { seed: 1, team: ['thuy_tinh', 'bennu', 'eir'], enemies: ['water_n1'] });
  const base = statsFor(ctx, 'thuy_tinh', 1, 0);
  assert.equal(lead.members[0].atk, Math.round(base.atk * 1.25));
  assert.equal(ref.members[1].atk, base.atk); // không phải leader thì không có thưởng
  const hpEl = createBattle(ctx, { seed: 1, team: ['thetis', 'thuy_tinh'], enemies: ['water_n1'] });
  assert.equal(hpEl.members[1].hp, Math.round(statsFor(ctx, 'thuy_tinh').hp * 1.15));
  // atk_all / hp_all: mọi ô
  const all = createBattle(ctx, { seed: 1, team: ['thanh_giong', 'bennu', 'eir'], enemies: ['water_n1'] });
  assert.equal(all.members[1].atk, Math.round(statsFor(ctx, 'bennu').atk * 1.18));
  const hall = createBattle(ctx, { seed: 1, team: ['son_tinh', 'bennu'], enemies: ['water_n1'] });
  assert.equal(hall.members[1].hp, Math.round(statsFor(ctx, 'bennu').hp * 1.18));
  // drag_time: cộng thời gian kéo; combo_mult: cộng bước nhân combo
  const dt = createBattle(ctx, { seed: 1, team: ['ra', 'bennu'], enemies: ['water_n1'] });
  assert.equal(dt.dragBonusMs, 1500);
  assert.equal(createBattle(ctx, { seed: 1, team: ['bennu', 'ra'], enemies: ['water_n1'] }).dragBonusMs, 0);
  assert.equal(createBattle(ctx, { seed: 1, team: ['hel', 'bennu'], enemies: ['water_n1'] }).mods.comboStep, 0.2);
});

test('leader Cầu Vồng: chỉ khi cả đội khác hệ hoàn toàn', () => {
  const diff = createBattle(ctx, { seed: 1, team: ['apollo', 'thetis', 'bennu', 'atalanta', 'nyx'], enemies: ['water_n1'] });
  assert.equal(diff.members[1].atk, Math.round(statsFor(ctx, 'thetis').atk * 1.6));
  const dup = createBattle(ctx, { seed: 1, team: ['apollo', 'thetis', 'bennu', 'atalanta', 'eos'], enemies: ['water_n1'] }); // eos trùng hệ Quang với apollo
  assert.equal(dup.members[1].atk, statsFor(ctx, 'thetis').atk);
});

test('Thức tỉnh chỉ tăng chỉ số, không đổi kỹ năng (bị động sẽ thêm sau)', () => {
  assert.ok(statsFor(ctx, 'thetis', 30, 0).atk > statsFor(ctx, 'thetis', 1, 0).atk);
  assert.ok(statsFor(ctx, 'thetis', 1, 1).hp > statsFor(ctx, 'thetis', 1, 0).hp);
  for (const c of chars) assert.deepEqual(resolveKit(ctx, c.id, undefined, 1).skill, resolveKit(ctx, c.id, undefined, 2).skill, c.id);
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
