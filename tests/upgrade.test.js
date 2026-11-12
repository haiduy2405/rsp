import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, isValidProgress } from '../www/js/core/progress.js';
import { levelCost, levelUp, awakenCost, awaken, grantCharacter, setTeam, teamRoster, selectPreset, makeLeader, presetsOf, placeInSlot, clearTeam, autoTeam, charPower } from '../www/js/core/upgrade.js';
import { migrate } from '../www/js/save/migrate.js';
import { createRun, playRun, newRunRecord, runStep } from '../www/js/core/run.js';
import { statsFor } from '../www/js/core/stats.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const rich = () => {
  const p = newProgress(ctx);
  p.inventory.essence = 100000;
  p.inventory.gold = 100000;
  p.inventory.shards = 500;
  for (let e = 0; e < 6; e++) p.inventory.stones[e] = { normal: 100, rare: 100 };
  return p;
};

test('Level: chi phí tăng theo cấp và độ hiếm, trần ở levelMax, trừ Tinh Hoa', () => {
  assert.ok(levelCost(ctx, 'thetis', 2) > levelCost(ctx, 'thetis', 1));
  assert.ok(levelCost(ctx, 'thuy_tinh', 1) > levelCost(ctx, 'thetis', 1));
  assert.equal(levelCost(ctx, 'thetis', ctx.config.progression.levelMax), null);
  const p = rich();
  const c = levelCost(ctx, 'thetis', 1);
  const r = levelUp(ctx, p, 'thetis');
  assert.equal(r.progress.characters.thetis.level, 2);
  assert.equal(r.progress.inventory.essence, p.inventory.essence - c);
  assert.equal(p.characters.thetis.level, 1); // không sửa progress gốc
  assert.equal(levelUp(ctx, newProgress(ctx), 'thetis').reason, 'not_enough_essence');
  assert.equal(levelUp(ctx, p, 'zeus').reason, 'not_owned');
  let q = p;
  for (let i = 1; i < ctx.config.progression.levelMax; i++) q = levelUp(ctx, q, 'thetis').progress;
  assert.equal(q.characters.thetis.level, ctx.config.progression.levelMax);
  assert.equal(levelUp(ctx, q, 'thetis').reason, 'max_level');
});

test('Thức tỉnh: bậc 1-3 dùng Tinh Thạch Thường, bậc 4-5 dùng Hiếm, đúng hệ, đủ 3 thứ phí', () => {
  const stages = [1, 2, 3, 4, 5].map((s) => awakenCost(ctx, 'thetis', s));
  assert.deepEqual(stages.map((c) => c.stone), ['normal', 'normal', 'normal', 'rare', 'rare']);
  assert.ok(stages.every((c) => c.element === 0));
  assert.equal(awakenCost(ctx, 'thetis', 6), null);
  assert.ok(awakenCost(ctx, 'thuy_tinh', 1).shards > awakenCost(ctx, 'thetis', 1).shards);
  let p = rich();
  const before = structuredClone(p.inventory);
  const r = awaken(ctx, p, 'thetis');
  assert.equal(r.progress.characters.thetis.awaken, 1);
  assert.equal(r.progress.inventory.shards, before.shards - r.cost.shards);
  assert.equal(r.progress.inventory.stones[0].normal, before.stones[0].normal - r.cost.stones);
  assert.equal(r.progress.inventory.stones[1].normal, before.stones[1].normal); // hệ khác không bị trừ
  assert.equal(r.progress.inventory.gold, before.gold - r.cost.gold);
  for (let i = 0; i < 5; i++) p = awaken(ctx, p, 'thetis').progress;
  assert.equal(p.characters.thetis.awaken, 5);
  assert.equal(awaken(ctx, p, 'thetis').reason, 'max_awaken');
});

test('Thức tỉnh: thiếu từng loại nguyên liệu đều bị từ chối và không đổi gì', () => {
  const p = rich();
  for (const [reason, mut] of [
    ['not_enough_shards', (q) => (q.inventory.shards = 0)],
    ['not_enough_stones', (q) => (q.inventory.stones[0].normal = 0)],
    ['not_enough_gold', (q) => (q.inventory.gold = 0)],
  ]) {
    const q = structuredClone(p);
    mut(q);
    const snap = JSON.stringify(q);
    assert.equal(awaken(ctx, q, 'thetis').reason, reason);
    assert.equal(JSON.stringify(q), snap);
  }
  const q = structuredClone(p);
  q.inventory.stones[0].normal = 100;
  q.characters.thetis.awaken = 3;
  q.inventory.stones[0].rare = 1;
  assert.equal(awaken(ctx, q, 'thetis').reason, 'not_enough_stones');
});

test('Thức tỉnh tăng chỉ số ở bậc 1, 2, 4 và giảm hồi chiêu ở bậc 3, 5', () => {
  const hp = [0, 1, 2, 3, 4, 5].map((a) => statsFor(ctx, 'thetis', 1, a).hp);
  assert.ok(hp[1] > hp[0] && hp[2] > hp[1] && hp[3] === hp[2] && hp[4] > hp[3] && hp[5] === hp[4]);
});

test('nhân vật trùng tự đổi thành Mảnh Linh Hồn theo độ hiếm; nhân vật mới được thêm', () => {
  const p = newProgress(ctx);
  const dup = grantCharacter(ctx, p, 'thetis');
  assert.deepEqual([dup.duplicate, dup.shards], [true, ctx.config.upgrade.duplicateShards[3]]);
  assert.equal(dup.progress.inventory.shards, ctx.config.upgrade.duplicateShards[3]);
  const fresh = grantCharacter(ctx, p, 'hel');
  assert.equal(fresh.duplicate, false);
  assert.deepEqual(fresh.progress.characters.hel, { level: 1, awaken: 0 });
  const dup5 = grantCharacter(ctx, fresh.progress, 'hel');
  assert.equal(dup5.shards, ctx.config.upgrade.duplicateShards[5]);
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
  assert.deepEqual(teamRoster(p)[0], { id: 'hel', level: 1, awaken: 0 });
});

test('save: migrate v2 lên v3 chuyển đội mẫu cũ sang đội khởi đầu, giữ kho', () => {
  const p = newProgress(ctx);
  const v2 = { ...p, version: 2, team: ['demo_thuy', 'demo_hoa', 'demo_moc', 'demo_quang', 'demo_tim'] };
  delete v2.characters;
  v2.inventory.gold = 321;
  const out = migrate(v2, 2, ctx);
  assert.ok(isValidProgress(out));
  assert.equal(out.inventory.gold, 321);
  assert.deepEqual(out.team, newProgress(ctx).team);
});

test('chuyến leo tháp dùng chỉ số theo Level/Thức tỉnh và vẫn xác định theo replay', () => {
  let p = rich();
  for (let i = 0; i < 10; i++) p = levelUp(ctx, p, 'thetis').progress;
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
