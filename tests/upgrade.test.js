import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, isValidProgress, SAVE_VERSION } from '../www/js/core/progress.js';
import { expToNext, expToMax, useElixir, feedFodder, sellFodder, fodderExp, awakenCost, awaken, grantCharacter, setTeam, teamRoster, selectPreset, makeLeader, presetsOf, placeInSlot, clearTeam, autoTeam, charPower } from '../www/js/core/upgrade.js';
import { migrate } from '../www/js/save/migrate.js';
import { createRun, playRun, newRunRecord, runStep } from '../www/js/core/run.js';
import { statsFor } from '../www/js/core/stats.js';
import { resolveKit, formOf } from '../www/js/core/kit.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const rich = () => {
  const p = newProgress(ctx);
  p.inventory.elixir = { 1: 100000, 2: 100000, 3: 100000 };
  p.inventory.gold = 100000;
  p.inventory.shards = 500;
  for (let e = 0; e < 6; e++) p.inventory.stones[e] = { normal: 100, rare: 100 };
  return p;
};

test('EXP: cần nhiều hơn theo cấp và độ hiếm, trần ở levelMax, Bánh EXP không dùng thừa', () => {
  const max = ctx.config.progression.levelMax;
  assert.equal(max, 50);
  assert.ok(expToNext(ctx, 'thetis', 2) > expToNext(ctx, 'thetis', 1));
  assert.ok(expToNext(ctx, 'thuy_tinh', 1) > expToNext(ctx, 'thetis', 1));
  assert.equal(expToNext(ctx, 'thetis', max), null);
  const p = rich();
  const need = expToNext(ctx, 'thetis', 1);
  const unit = ctx.config.elixir[1].exp;
  const k = Math.ceil(need / unit);
  const r = useElixir(ctx, p, 'thetis', 1, k);
  assert.ok(r.progress.characters.thetis.level >= 2);
  assert.equal(r.progress.inventory.elixir[1], p.inventory.elixir[1] - k);
  assert.equal(r.exp, k * unit);
  assert.equal(p.characters.thetis.level, 1); // không sửa progress gốc
  assert.equal(useElixir(ctx, newProgress(ctx), 'thetis', 1, 10).reason, 'not_enough_elixir');
  assert.equal(useElixir(ctx, p, 'zeus', 1, 10).reason, 'not_owned');
  assert.equal(useElixir(ctx, p, 'thetis', 9, 1).reason, 'bad_item');
  // dùng vô hạn Bánh: dừng đúng ở cấp tối đa, không tốn thừa
  p.inventory.elixir = { 1: 10 ** 6, 2: 10 ** 6, 3: 10 ** 6 };
  const total = expToMax(ctx, 'thetis', p.characters.thetis);
  const q = useElixir(ctx, p, 'thetis', 1, 10 ** 9);
  const cap1 = ctx.config.progression.levelCapForm1;
  assert.equal(q.progress.characters.thetis.level, cap1, 'Form 1 bị chặn ở levelCapForm1');
  assert.equal(q.progress.characters.thetis.exp, 0);
  assert.equal(q.used, Math.ceil(total / unit));
  assert.equal(useElixir(ctx, q.progress, 'thetis', 1, 10).reason, 'max_level');
  // Thức tỉnh Form 2 mở trần tới levelMax
  const f2 = structuredClone(q.progress);
  f2.characters.thetis.awaken = 1;
  assert.equal(useElixir(ctx, f2, 'thetis', 3, 10 ** 9).progress.characters.thetis.level, max);
});

test('Tiểu Linh: cho ăn lấy EXP (cùng hệ được thêm), bán lấy Vàng, không ăn thừa', () => {
  const p = rich();
  p.inventory.fodder = { '0_1': 5, '1_2': 3 };
  const same = fodderExp(ctx, 'thetis', '0_1'); // Thetis hệ Thủy (0)
  const other = fodderExp(ctx, 'thetis', '1_2');
  assert.equal(same, Math.round(ctx.fodder['0_1'].exp * ctx.config.exp.fodderSameElement));
  assert.equal(other, ctx.fodder['1_2'].exp);
  const r = feedFodder(ctx, p, 'thetis', '0_1', 2);
  assert.equal(r.progress.inventory.fodder['0_1'], 3);
  assert.equal(r.gained, same * 2);
  assert.equal(feedFodder(ctx, p, 'thetis', '0_1', 99).used, 5, 'không ăn quá số đang có');
  assert.equal(feedFodder(ctx, p, 'thetis', '3_1', 1).reason, 'no_fodder');
  assert.equal(feedFodder(ctx, p, 'thetis', 'x', 1).reason, 'unknown_fodder');
  const sold = sellFodder(ctx, p, '1_2', 3);
  assert.equal(sold.gold, ctx.fodder['1_2'].sell * 3);
  assert.equal(sold.progress.inventory.gold, p.inventory.gold + sold.gold);
  assert.equal(sold.progress.inventory.fodder['1_2'], undefined, 'hết thì xóa khóa');
  assert.equal(sellFodder(ctx, p, '1_2', 4).sold, 3);
  // đã tối đa cấp thì không ăn nữa
  const m = structuredClone(p);
  m.characters.thetis = { level: ctx.config.progression.levelMax, awaken: 0, exp: 0 };
  assert.equal(feedFodder(ctx, m, 'thetis', '0_1', 1).reason, 'max_level');
});

test('Thức tỉnh Form 2: một bậc, tốn Tinh Thạch Hiếm đúng hệ, Mảnh và Vàng', () => {
  const c = awakenCost(ctx, 'thetis', 1);
  assert.equal(c.stone, 'rare');
  assert.equal(c.element, 0);
  assert.equal(awakenCost(ctx, 'thetis', 2), null);
  assert.ok(awakenCost(ctx, 'thuy_tinh', 1).shards > c.shards, 'hiếm hơn thì đắt hơn');
  const p = rich();
  const before = structuredClone(p.inventory);
  const r = awaken(ctx, p, 'thetis');
  assert.equal(r.progress.characters.thetis.awaken, 1);
  assert.equal(r.progress.inventory.shards, before.shards - r.cost.shards);
  assert.equal(r.progress.inventory.stones[0].rare, before.stones[0].rare - r.cost.stones);
  assert.equal(r.progress.inventory.stones[1].rare, before.stones[1].rare); // hệ khác không bị trừ
  assert.equal(r.progress.inventory.gold, before.gold - r.cost.gold);
  assert.equal(awaken(ctx, r.progress, 'thetis').reason, 'max_awaken');
});

test('Thức tỉnh: thiếu từng loại nguyên liệu đều bị từ chối và không đổi gì', () => {
  const p = rich();
  for (const [reason, mut] of [
    ['not_enough_shards', (q) => (q.inventory.shards = 0)],
    ['not_enough_stones', (q) => (q.inventory.stones[0].rare = 0)],
    ['not_enough_gold', (q) => (q.inventory.gold = 0)],
  ]) {
    const q = structuredClone(p);
    mut(q);
    const snap = JSON.stringify(q);
    assert.equal(awaken(ctx, q, 'thetis').reason, reason);
    assert.equal(JSON.stringify(q), snap);
  }
});

test('Form 2 tăng chỉ số và đổi kỹ năng', () => {
  assert.ok(statsFor(ctx, 'thetis', 1, 1).hp > statsFor(ctx, 'thetis', 1, 0).hp);
  const k1 = resolveKit(ctx, 'thetis', undefined, 1).skill;
  const k2 = resolveKit(ctx, 'thetis', undefined, formOf(1)).skill;
  assert.notDeepEqual(k1.units, k2.units);
});

test('nhân vật trùng tự đổi thành mảnh chung theo độ hiếm; nhân vật mới được thêm', () => {
  const p = newProgress(ctx);
  const dup = grantCharacter(ctx, p, 'thetis');
  assert.deepEqual([dup.duplicate, dup.generic], [true, 3]);
  assert.equal(dup.progress.inventory.generic[3], 3);
  const fresh = grantCharacter(ctx, p, 'hel');
  assert.equal(fresh.duplicate, false);
  assert.deepEqual(fresh.progress.characters.hel, { level: 1, awaken: 0, exp: 0, skillLv: { active: 1, leader: 1, passive: 1 } });
  const dup5 = grantCharacter(ctx, fresh.progress, 'hel');
  assert.equal(dup5.generic, 5);
  assert.equal(dup5.progress.inventory.generic[5], 5);
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
  assert.deepEqual(teamRoster(p)[0], { id: 'hel', level: 1, awaken: 0, skillLv: { active: 1, leader: 1, passive: 1 } });
});

test('save: migrate v2 lên v3 chuyển đội mẫu cũ sang đội khởi đầu, giữ kho', () => {
  const p = newProgress(ctx);
  const v2 = { ...p, version: 2, team: ['demo_thuy', 'demo_hoa', 'demo_moc', 'demo_quang', 'demo_tim'] };
  delete v2.characters;
  v2.inventory.gold = 321;
  const out = migrate(v2, 2, ctx);
  assert.ok(isValidProgress(out));
  assert.equal(out.inventory.gold, 3210);
  assert.deepEqual(out.team, newProgress(ctx).team);
});

test('chuyến leo tháp dùng chỉ số theo Level/Thức tỉnh và vẫn xác định theo replay', () => {
  let p = rich();
  p = useElixir(ctx, p, 'thetis', 2, 10).progress;
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

test('đội lưu sẵn: đội 2-3 trống, đội 1 giữ nguyên', () => {
  const p0 = newProgress(ctx);
  const l = makeLeader(p0, 2);
  assert.ok(l.ok);
  assert.equal(l.progress.team[0], p0.team[2]);
  assert.equal(l.progress.team[2], p0.team[0]);
  assert.ok(isValidProgress(l.progress));
  const a = selectPreset(l.progress, 1);
  assert.ok(a.ok && a.progress.preset === 1);
  assert.deepEqual(a.progress.team, [null, null, null, null, null]);
  assert.ok(isValidProgress(a.progress));
  assert.equal(teamRoster(a.progress).length, 0);
  const b = placeInSlot(a.progress, 0, p0.team[1]);
  assert.ok(b.ok);
  const c = selectPreset(b.progress, 0);
  assert.deepEqual(c.progress.team, l.progress.team);
  assert.deepEqual(presetsOf(c.progress)[1], b.progress.team);
  assert.equal(selectPreset(p0, 3).ok, false);
  assert.equal(makeLeader(p0, 9).ok, false);
});

test('đặt/bỏ tướng vào ô, đổi chỗ, bỏ hết', () => {
  const p0 = newProgress(ctx);
  const [a, b] = p0.team;
  const out = placeInSlot(p0, 1, null);
  assert.ok(out.ok);
  assert.equal(out.progress.team[1], null);
  assert.equal(teamRoster(out.progress).length, 4);
  const mv = placeInSlot(out.progress, 1, a); // a đang ở ô 0 → ô 0 nhận ô 1 (trống)
  assert.equal(mv.progress.team[1], a);
  assert.equal(mv.progress.team[0], null);
  const sw = placeInSlot(p0, 0, b); // đổi chỗ a, b
  assert.equal(sw.progress.team[0], b);
  assert.equal(sw.progress.team[1], a);
  assert.equal(placeInSlot(p0, 0, 'khong_co').ok, false);
  const none = clearTeam(p0);
  assert.ok(none.ok && none.progress.team.every((x) => x === null));
  assert.ok(isValidProgress(none.progress));
});

test('auto lập đội: chọn tướng mạnh, không trùng, đội trưởng mạnh nhất', () => {
  let p = newProgress(ctx);
  for (const c of ctx.characterList.slice(0, 12)) {
    const r = grantCharacter(ctx, p, c.id);
    if (r.ok) p = r.progress;
  }
  const r = autoTeam(ctx, p);
  assert.ok(r.ok);
  const t = r.progress.team;
  assert.equal(t.filter(Boolean).length, 5);
  assert.equal(new Set(t).size, 5);
  const pw = (id) => charPower(ctx, p, id);
  assert.ok(t.every((id) => pw(t[0]) >= pw(id)));
  assert.deepEqual(autoTeam(ctx, p).progress.team, t); // tất định
  assert.ok(isValidProgress(r.progress));
  // ít tướng hơn 5 thì để trống
  const q = autoTeam(ctx, newProgress(ctx));
  assert.ok(q.ok);
});

test('sửa hồ sơ: hợp lệ, giữ Tín Vật, từ chối dữ liệu xấu', async () => {
  const { updateProfile, finishOnboarding } = await import('../www/js/core/onboarding.js');
  const p0 = finishOnboarding(ctx, newProgress(ctx), { name: 'A', callsign: 'B', hometown: '', avatar: 0, culture: 'viet' }).progress;
  const r = updateProfile(ctx, p0, { name: '  Duy   Nguyễn ', callsign: 'Sao', hometown: 'Mạo Khê', avatar: 2 });
  assert.ok(r.ok);
  assert.equal(r.progress.player.name, 'Duy Nguyễn');
  assert.equal(r.progress.player.culture, 'viet');
  assert.equal(r.progress.player.avatar, 2);
  assert.ok(isValidProgress(r.progress));
  assert.equal(updateProfile(ctx, p0, { name: '', callsign: 'x', avatar: 0 }).ok, false);
  assert.equal(updateProfile(ctx, p0, { name: 'x', callsign: 'x', avatar: 99 }).ok, false);
  assert.equal(updateProfile(ctx, newProgress(ctx), { name: 'x', callsign: 'x', avatar: 0 }).ok, false);
});

test('migrate v7 → v8: Thức tỉnh thành Form 2; vượt cấp 30 cũng lên Form 2', () => {
  const p = newProgress(ctx);
  const old = { ...structuredClone(p), version: 7 };
  old.characters = {
    ...old.characters,
    a: { level: 10, awaken: 3, exp: 0, skillLv: { active: 1, leader: 1, passive: 1 } },
    b: { level: 40, awaken: 0, exp: 0, skillLv: { active: 1, leader: 1, passive: 1 } },
    c: { level: 5, awaken: 0, exp: 0, skillLv: { active: 1, leader: 1, passive: 1 } },
  };
  const out = migrate(old, 7, ctx);
  assert.deepEqual([out.characters.a.awaken, out.characters.b.awaken, out.characters.c.awaken], [1, 1, 0]);
  assert.equal(out.version, SAVE_VERSION);
});
