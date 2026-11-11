import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../www/js/core/rng.js';
import { newProgress, isValidProgress } from '../www/js/core/progress.js';
import { newSummonState, rollPull, summon, redeemCharacter, effectiveRates } from '../www/js/core/summon.js';
import { finishOnboarding, completeTutorial, storyUnlocked } from '../www/js/core/onboarding.js';
import { migrate } from '../www/js/save/migrate.js';
import { loadCtx } from './helpers.js';

const ctx = loadCtx();
const cfg = ctx.config.summon;
const input = (o = {}) => ({ name: 'An', callsign: 'Kite', hometown: 'Mạo Khê', avatar: 2, culture: 'viet', ...o });
const onboarded = (o) => finishOnboarding(ctx, newProgress(ctx), input(o)).progress;
const rich = (o) => {
  const p = onboarded(o);
  p.inventory.spirit = 1_000_000;
  return p;
};

test('mô phỏng 1.000.000 lượt: tỉ lệ cơ bản sát công bố, tỉ lệ thực tế sát phép tính Markov', () => {
  const st = newSummonState();
  st.firstDone = true;
  const rng = mulberry32(2024);
  const banner = ctx.banners.standard;
  const N = 1_000_000;
  const got = { 5: 0, 4: 0, 3: 0 };
  let max5 = 0;
  let since5 = 0;
  let max4 = 0;
  let since4 = 0;
  let natural = { 5: 0, 4: 0, 3: 0, n: 0 };
  for (let i = 0; i < N; i++) {
    const guaranteed5 = st.pity5 + 1 >= cfg.pity5;
    const guaranteed4 = st.pity4 + 1 >= cfg.guarantee4Every;
    const r = rollPull(ctx, st, banner, rng, null);
    got[r.rarity]++;
    if (!guaranteed5 && !guaranteed4) {
      natural[r.rarity]++;
      natural.n++;
    }
    since5 = r.rarity === 5 ? 0 : since5 + 1;
    since4 = r.rarity >= 4 ? 0 : since4 + 1;
    max5 = Math.max(max5, since5);
    max4 = Math.max(max4, since4);
  }
  // pity không bao giờ vượt: tối đa 59 lượt hụt liên tiếp rồi lượt 60 chắc chắn 5★; tối đa 9 lượt không có 4★ trở lên
  assert.ok(max5 <= cfg.pity5 - 1, `max5=${max5}`);
  assert.ok(max4 <= cfg.guarantee4Every - 1, `max4=${max4}`);
  // lượt không bị bảo đảm chi phối: đúng tỉ lệ công bố (sai số nhỏ). Lượt bị bảo đảm chỉ loại bớt, nên so với tỉ lệ có điều kiện.
  assert.ok(natural.n > N * 0.7);
  const eff = effectiveRates(ctx.config);
  assert.ok(Math.abs(eff[5] + eff[4] + eff[3] - 1) < 1e-9);
  for (const r of [5, 4, 3]) assert.ok(Math.abs(got[r] / N - eff[r]) < 0.002, `${r}★ ${got[r] / N} vs ${eff[r]}`);
  // 5★ thực tế cao hơn 2% nhờ pity nhưng vẫn gần: dưới 3.2%
  assert.ok(eff[5] > 0.02 && eff[5] < 0.032, String(eff[5]));
});

test('lượt thường không bị bảo đảm đúng 2% / 13% / 85% (kiểm trên 200.000 lượt đầu mỗi chu kỳ)', () => {
  const rng = mulberry32(99);
  const st = newSummonState();
  st.firstDone = true;
  const c = { 5: 0, 4: 0, 3: 0 };
  let n = 0;
  for (let i = 0; i < 400000; i++) {
    st.pity5 = 0; // luôn ở đầu chu kỳ: không bảo đảm nào can thiệp
    st.pity4 = 0;
    c[rollPull(ctx, st, ctx.banners.standard, rng, null).rarity]++;
    n++;
  }
  assert.ok(Math.abs(c[5] / n - 0.02) < 0.002);
  assert.ok(Math.abs(c[4] / n - 0.13) < 0.004);
  assert.ok(Math.abs(c[3] / n - 0.85) < 0.004);
});

test('xác định theo seed; seed khác cho kết quả khác; x10 luôn có ít nhất 1 nhân vật từ 4★', () => {
  const p = rich();
  const a = summon(ctx, p, { bannerId: 'standard', count: 10, dayKey: 1, seed: 5 });
  const b = summon(ctx, p, { bannerId: 'standard', count: 10, dayKey: 1, seed: 5 });
  assert.deepEqual(a, b);
  const c = summon(ctx, p, { bannerId: 'standard', count: 10, dayKey: 1, seed: 6 });
  assert.notDeepEqual(a.results, c.results);
  for (let seed = 1; seed <= 300; seed++) {
    const r = summon(ctx, { ...p, summon: { ...p.summon, firstDone: true } }, { bannerId: 'standard', count: 10, dayKey: 1, seed });
    assert.ok(r.results.some((x) => x.rarity >= 4), `seed ${seed}`);
  }
});

test('Tín Vật: lượt đầu tiên chắc chắn 4★ của nền văn hóa đã chọn và không tính vào pity', () => {
  for (const culture of ctx.config.summon.cultures) {
    for (let seed = 1; seed <= 20; seed++) {
      const p = rich({ culture });
      const r = summon(ctx, p, { bannerId: 'standard', count: 1, dayKey: 1, seed });
      const res = r.results[0];
      assert.equal(res.rarity, 4);
      assert.equal(ctx.characters[res.id].culture, culture);
      assert.equal(res.forced, true);
      assert.deepEqual([r.progress.summon.pity5, r.progress.summon.pity4], [0, 0]);
      assert.equal(r.progress.summon.firstDone, true);
      const r2 = summon(ctx, r.progress, { bannerId: 'standard', count: 1, dayKey: 1, seed });
      assert.equal(r2.results[0].forced, false);
    }
  }
});

test('chi phí: 100 Linh Thạch mỗi lượt, x10 = 1000, thiếu thì từ chối và không đổi gì', () => {
  const p = onboarded();
  p.inventory.spirit = 150;
  assert.equal(summon(ctx, p, { bannerId: 'standard', count: 10, dayKey: 1, seed: 1 }).reason, 'not_enough_spirit');
  const r = summon(ctx, p, { bannerId: 'standard', count: 1, dayKey: 1, seed: 1 });
  assert.equal(r.progress.inventory.spirit, 50);
  assert.equal(summon(ctx, p, { bannerId: 'standard', count: 3, dayKey: 1, seed: 1 }).reason, 'bad_count');
  assert.equal(summon(ctx, p, { bannerId: 'nope', count: 1, dayKey: 1, seed: 1 }).reason, 'unknown_banner');
  assert.equal(p.inventory.spirit, 150);
});

test('lượt miễn phí: 1 lần mỗi ngày, chỉ đơn lẻ, không tốn Linh Thạch', () => {
  const p = onboarded();
  p.inventory.spirit = 0;
  let r = summon(ctx, p, { bannerId: 'standard', count: 1, free: true, dayKey: 100, seed: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.progress.inventory.spirit, 0);
  assert.equal(summon(ctx, r.progress, { bannerId: 'standard', count: 1, free: true, dayKey: 100, seed: 2 }).reason, 'free_used');
  assert.equal(summon(ctx, r.progress, { bannerId: 'standard', count: 1, free: true, dayKey: 101, seed: 2 }).ok, true);
  assert.equal(summon(ctx, p, { bannerId: 'standard', count: 10, free: true, dayKey: 100, seed: 1 }).reason, 'bad_count');
});

test('nhân vật trùng thành Mảnh Linh Hồn; kết quả báo mới/trùng; progress luôn hợp lệ', () => {
  let p = rich();
  p.summon.firstDone = true;
  let shards = 0;
  for (let i = 0; i < 20; i++) {
    const r = summon(ctx, p, { bannerId: 'standard', count: 10, dayKey: 1, seed: 100 + i });
    p = r.progress;
    shards += r.results.reduce((a, x) => a + x.shards, 0);
    assert.ok(isValidProgress(p));
  }
  assert.ok(shards > 0);
  assert.equal(p.inventory.shards, shards);
  assert.ok(Object.keys(p.characters).length <= 24);
});

test('banner văn hóa tăng tỉ lệ nhân vật cùng nhóm; banner thường không thiên vị', () => {
  const share = (bannerId, culture) => {
    const st = newSummonState();
    st.firstDone = true;
    const rng = mulberry32(31);
    let hit = 0;
    let n = 0;
    for (let i = 0; i < 60000; i++) {
      const r = rollPull(ctx, st, ctx.banners[bannerId], rng, null);
      if (r.rarity === 3) {
        n++;
        if (ctx.characters[r.id].culture === culture) hit++;
      }
    }
    return hit / n;
  };
  assert.ok(share('hylap', 'hylap') > share('standard', 'hylap') + 0.2);
  assert.ok(share('viet', 'viet') > share('standard', 'viet') + 0.2);
});

test('đổi 200 Mảnh lấy nhân vật tự chọn: chưa sở hữu, đủ mảnh', () => {
  const p = onboarded();
  p.inventory.shards = 250;
  const r = redeemCharacter(ctx, p, 'hel');
  assert.equal(r.progress.inventory.shards, 50);
  assert.ok(r.progress.characters.hel);
  assert.equal(redeemCharacter(ctx, r.progress, 'hel').reason, 'already_owned');
  p.inventory.shards = 10;
  assert.equal(redeemCharacter(ctx, p, 'hel').reason, 'not_enough_shards');
  assert.equal(redeemCharacter(ctx, p, 'zeus').reason, 'unknown_character');
});

test('lịch sử triệu hồi giữ tối đa historyMax bản ghi mới nhất', () => {
  let p = rich();
  for (let i = 0; i < 14; i++) p = summon(ctx, p, { bannerId: 'standard', count: 10, dayKey: 1, seed: i }).progress;
  assert.equal(p.summon.history.length, cfg.historyMax);
  assert.equal(p.summon.history.at(-1).n, p.summon.pulls);
});

test('onboarding: kiểm tra dữ liệu, tặng Linh Thạch chào mừng, chỉ làm một lần', () => {
  const p0 = newProgress(ctx);
  assert.equal(p0.onboarding.done, false);
  for (const bad of [{ name: '' }, { name: 'x'.repeat(40) }, { callsign: '' }, { avatar: 99 }, { avatar: 1.5 }, { culture: 'la_ma' }, { hometown: 'y'.repeat(60) }])
    assert.equal(finishOnboarding(ctx, p0, input(bad)).ok, false, JSON.stringify(bad));
  const r = finishOnboarding(ctx, p0, input({ name: '  An   Nguyễn ' }));
  assert.equal(r.progress.player.name, 'An Nguyễn');
  assert.equal(r.progress.inventory.spirit, cfg.welcomeSpirit);
  assert.equal(r.progress.onboarding.done, true);
  assert.equal(finishOnboarding(ctx, r.progress, input()).reason, 'already_done');
  assert.ok(isValidProgress(r.progress));
  assert.equal(completeTutorial(r.progress).onboarding.tutorialDone, true);
  assert.equal(finishOnboarding(ctx, p0, input({ hometown: '' })).ok, true); // quê hương tùy chọn
});

test('nhật ký cốt truyện: mở đầu sau onboarding, mỗi khu vượt mở thêm một đoạn', () => {
  assert.deepEqual(storyUnlocked(ctx, newProgress(ctx)), []);
  const p = onboarded();
  assert.deepEqual(storyUnlocked(ctx, p), ['s0']);
  p.clears = { zone_water: 1, zone_wood: 2 };
  assert.deepEqual(storyUnlocked(ctx, p), ['s0', 's1', 's3']);
});

test('save: migrate v3 lên v4 giữ dữ liệu; người đã chơi bỏ qua onboarding', () => {
  const base = newProgress(ctx);
  const v3 = JSON.parse(JSON.stringify(base));
  for (const k of ['player', 'onboarding', 'summon', 'settings']) delete v3[k];
  v3.version = 3;
  v3.inventory.gold = 777;
  v3.stats.runs = 4;
  const out = migrate(v3, 3, ctx);
  assert.ok(isValidProgress(out));
  assert.equal(out.inventory.gold, 777);
  assert.equal(out.onboarding.done, true);
  v3.stats.runs = 0;
  assert.equal(migrate(v3, 3, ctx).onboarding.done, false);
  const v2 = { ...v3, version: 2 };
  delete v2.characters;
  assert.ok(isValidProgress(migrate(v2, 2, ctx)));
});
