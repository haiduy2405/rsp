import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../www/js/core/rng.js';
import { createRun, runStep, playRun, newRunRecord } from '../www/js/core/run.js';
import { hashState } from '../www/js/core/hash.js';
import { newProgress, applyRunResult, isValidProgress, DEFAULT_TEAM } from '../www/js/core/progress.js';
import { N } from '../www/js/core/board.js';
import { loadCtx, randomPath } from './helpers.js';
import { simulateRun } from '../tools/loot-sim.js';

const ctx = loadCtx();
const TEAM = DEFAULT_TEAM;
const mk = (seed, zoneId = 'zone_water', pity = false) => createRun(ctx, { seed, zoneId, team: TEAM, pityMissed: pity });

// Đặt trận hiện tại về thế chắc thắng: quái còn 1 máu, bàn có sẵn 3 nhóm Thủy (nước kéo [0,1] không đổi bàn).
function rigWin(run) {
  const r = structuredClone(run);
  const cells = Array.from({ length: N }, (_, i) => (((i % 6) + ((i / 6) | 0)) % 2 === 0 ? 4 : 5));
  for (const row of [0, 2, 4]) for (const c of [0, 1, 2]) cells[row * 6 + c] = 0;
  r.battle.board = { cells, enh: new Array(N).fill(0) };
  r.battle.enemies.forEach((e) => (e.hp = 1));
  return r;
}
// Thế chắc thua: bàn không có nhóm nào, quái sắp đánh rất mạnh.
function rigLose(run) {
  const r = structuredClone(run);
  r.battle.board = { cells: Array.from({ length: N }, (_, i) => (((i % 6) + ((i / 6) | 0)) % 2 === 0 ? 4 : 5)), enh: new Array(N).fill(0) };
  r.battle.hp = 1;
  r.hp = 1;
  r.battle.enemies.forEach((e) => {
    e.cd = 1;
    e.atk = 999999;
    e.hp = 999999;
    e.maxHp = 999999;
  });
  return r;
}
const winMove = { type: 'battle', action: { type: 'move', path: [0, 1] } };
const noMatchMove = { type: 'battle', action: { type: 'move', path: [0, 1] } };

// Tìm chuyến có cửa thỏa pred ở tầng `floor` (mặc định tầng 0). Tầng tự do (xen kẽ) là nơi có rương/nghỉ/sự kiện/shop.
function findRun(pred, zoneId = 'zone_water', floor = 0) {
  for (let seed = 1; seed < 2000; seed++) {
    const run = mk(seed, zoneId);
    if (floor) { run.floor = floor; run.doors = freeDoors(seed); }
    const idx = pred(run);
    if (idx >= 0) return { run, idx };
  }
  throw new Error('không tìm được seed');
}
const freeDoors = (seed) => { const all = ['normal', 'chest', 'rest', 'event', 'shop']; const o = seed % all.length; return [all[o], all[(o + 1) % 5], all[(o + 2) % 5]]; };
const doorOf = (type) => (run) => run.doors.indexOf(type);

test('run: tạo chuyến xác định, mọi ải cùng số tầng, 3 cửa mỗi tầng trừ Boss cuối', () => {
  assert.deepEqual(mk(5), mk(5));
  const { layout } = ctx.config.run;
  for (let seed = 0; seed < 300; seed++) {
    const r = mk(seed);
    assert.equal(r.floors, layout.length);
    assert.equal(r.doors.length, layout[0].doors);
    assert.equal(r.doors.length, 3);
    assert.equal(r.hp, r.maxHp, 'chuyến mới hồi đầy máu');
  }
});

test('run: mọi đường đều qua trận thường, đúng 1 tầng Elite bắt buộc rồi Boss cuối ải (mọi khu)', () => {
  const { layout, pools } = ctx.config.run;
  assert.equal(layout.at(-1).pool, 'boss');
  assert.deepEqual(Object.keys(pools.boss), ['boss']);
  assert.deepEqual(Object.keys(pools.elite), ['elite']);
  assert.equal(layout.filter((l) => l.pool === 'elite').length, 1);
  assert.ok(layout.filter((l) => l.pool === 'fight').length >= 2, 'vài tầng toàn cửa đánh');
  assert.deepEqual(Object.keys(pools.fight).sort(), ['elite', 'normal']);
  for (const z of ctx.zoneList) {
    assert.ok(z.monsters.boss.length >= 1, z.id);
    // Đường nào cũng vậy: chọn lần lượt từng cửa (0, 1, 2) đi hết ải; mỗi tầng "fight/elite/boss" chỉ có cửa đánh.
    for (const pick of [0, 1, 2]) {
      let run = mk(3, z.id);
      let fights = 0;
      let elites = 0;
      let guard = 0;
      while (run.phase !== 'end' && guard++ < 300) {
        if (run.phase === 'doors') {
          const pool = layout[run.floor].pool;
          if (pool !== 'free') assert.ok(run.doors.every((d) => ['normal', 'elite', 'boss'].includes(d)), `${pool}: ${run.doors}`);
          if (pool === 'free') assert.equal(new Set(run.doors).size, run.doors.length, 'cửa tầng tự do khác nhau');
          if (pool === 'elite') assert.ok(run.doors.every((d) => d === 'elite'));
          if (pool === 'boss') assert.deepEqual(run.doors, ['boss']);
          const door = Math.min(pick, run.doors.length - 1);
          if (['normal', 'elite', 'boss'].includes(run.doors[door])) fights++;
          if (run.doors[door] === 'elite') elites++;
          run = runStep(ctx, run, { type: 'door', index: door }).run;
        } else if (run.phase === 'battle') run = runStep(ctx, rigWin(run), winMove).run;
        else if (run.phase === 'result') run = runStep(ctx, run, { type: 'continue' }).run;
        else if (run.phase === 'event') run = runStep(ctx, run, { type: 'eventChoice', index: 1 }).run;
        else if (run.phase === 'shop') run = runStep(ctx, run, { type: 'leaveShop' }).run;
      }
      assert.equal(run.result, 'won', z.id);
      assert.ok(fights >= 4, `${z.id} đường ${pick}: ${fights} trận`); // >= 2 thường + 1 elite + boss
      assert.ok(elites >= 1);
    }
  }
});

test('run: rương nhận loot, nghỉ hồi máu không quá tối đa, sau đó sang ải kế', () => {
  const { run, idx } = findRun(doorOf('chest'), 'zone_water', 1);
  const r1 = runStep(ctx, run, { type: 'door', index: idx }).run;
  assert.equal(r1.phase, 'result');
  assert.equal(r1.lastResult.kind, 'chest');
  assert.ok(r1.loot.gold > 0 && r1.loot.essence > 0);
  const r2 = runStep(ctx, r1, { type: 'continue' }).run;
  assert.equal(r2.phase, 'doors');
  assert.equal(r2.floor, 2);

  const f = findRun(doorOf('rest'), 'zone_water', 1);
  const hurt = { ...f.run, hp: 100 };
  const rr = runStep(ctx, hurt, { type: 'door', index: f.idx }).run;
  assert.equal(rr.hp, 100 + Math.round(rr.maxHp * ctx.config.run.restHealPct));
  const full = runStep(ctx, f.run, { type: 'door', index: f.idx }).run;
  assert.equal(full.hp, full.maxHp);
});

test('run: máu đội giữ qua các ải; ải sau bắt đầu với máu hiện tại', () => {
  const { run, idx } = findRun(doorOf('normal'));
  let r = runStep(ctx, run, { type: 'door', index: idx }).run;
  assert.equal(r.phase, 'battle');
  assert.equal(r.battle.enemies.length, 2);
  r = rigWin(r);
  r.battle.hp = 1500; // bị đánh còn 1500
  r = runStep(ctx, r, winMove).run;
  assert.equal(r.phase, 'result');
  assert.equal(r.battle.status, 'won');
  assert.equal(r.hp, r.battle.hp, 'máu run cập nhật theo trận');
  assert.ok(r.hp < r.maxHp, 'máu không tự đầy giữa các ải');
  const carried = r.hp;
  r = runStep(ctx, r, { type: 'continue' }).run;
  const nxt = r.doors.findIndex((d) => d === 'normal' || d === 'elite');
  if (nxt >= 0) {
    r = runStep(ctx, r, { type: 'door', index: nxt }).run;
    assert.equal(r.battle.hp, carried);
    assert.ok(r.battle.enemies[0].maxHp > 0);
  }
});

test('run: quái mạnh dần theo ải (floorScale)', () => {
  const { run, idx } = findRun(doorOf('normal'));
  const a = runStep(ctx, run, { type: 'door', index: idx }).run;
  const zs = ctx.config.run.zoneScale;
  const order = ctx.zones[run.zoneId].order;
  const base = Math.round(ctx.monsters[a.battle.enemies[0].id].hp * (zs.hp[order] ?? 1));
  assert.equal(a.battle.enemies[0].maxHp, base); // ải 0: chỉ nhân hệ số khu
  const later = { ...run, floor: 2 };
  later.doors = ['normal', 'chest', 'rest'];
  const b = runStep(ctx, later, { type: 'door', index: 0 }).run;
  assert.equal(b.battle.enemies[0].maxHp, Math.round(ctx.monsters[b.battle.enemies[0].id].hp * (1 + ctx.config.run.floorScale.hp * 2) * (zs.hp[order] ?? 1)));
});

test('run: thua giữ loot đã nhặt, mất thưởng hoàn thành', () => {
  const { run, idx } = findRun(doorOf('normal'));
  let r = runStep(ctx, run, { type: 'door', index: idx }).run;
  r = rigLose(r);
  r.loot.gold = 77;
  r = runStep(ctx, r, noMatchMove).run;
  assert.equal(r.phase, 'end');
  assert.equal(r.result, 'lost');
  assert.equal(r.completion, null);
  assert.equal(r.loot.gold, 77);
  assert.equal(runStep(ctx, r, { type: 'continue' }).events[0].type, 'invalid');
});

test('run: thắng ải cuối nhận thưởng hoàn thành', () => {
  let run = simulateRun(ctx, 11, 'zone_fire', false);
  assert.equal(run.phase, 'end');
  assert.equal(run.result, 'won');
  assert.ok(run.completion && run.completion.gold >= ctx.config.loot.completion.gold[0]);
  assert.ok(run.completion.stones.normal >= 2);
});

test('loot: bảo hiểm xui đảm bảo Tinh Thạch Hiếm khi chuyến trước hụt, và chỉ lúc đó', () => {
  let someZero = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const withPity = simulateRun(ctx, seed, 'zone_water', true);
    assert.ok(withPity.loot.stones.rare >= 1, `seed ${seed}`);
    const without = simulateRun(ctx, seed, 'zone_water', false);
    if (without.loot.stones.rare === 0) someZero++;
    assert.equal(without.pityGranted, false);
  }
  assert.ok(someZero > 0, 'không có bảo hiểm thì vẫn có chuyến hụt');
  const lost = (() => {
    const { run, idx } = findRun(doorOf('normal'));
    let r = runStep(ctx, mk(run.seed, 'zone_water', true), { type: 'door', index: idx }).run;
    r = runStep(ctx, rigLose(r), noMatchMove).run;
    return r;
  })();
  assert.equal(lost.rareMissed, lost.loot.stones.rare === 0);
});

test('items: bình hồi máu, bùa khiên và bùa thời gian chỉ dùng ở cửa, bùa có hiệu lực ở trận kế', () => {
  const { run, idx } = findRun(doorOf('normal'));
  const base = { ...run, items: { potion: 1, shield: 1, time: 1 }, hp: 500 };
  let r = runStep(ctx, base, { type: 'useItem', item: 'potion' }).run;
  assert.equal(r.hp, 500 + Math.round(r.maxHp * ctx.config.run.items.potion.healPct));
  assert.equal(r.items.potion, 0);
  assert.equal(runStep(ctx, r, { type: 'useItem', item: 'potion' }).events[0].reason, 'no_item');
  assert.equal(runStep(ctx, { ...base, hp: base.maxHp }, { type: 'useItem', item: 'potion' }).events[0].reason, 'hp_full');
  r = runStep(ctx, r, { type: 'useItem', item: 'shield' }).run;
  r = runStep(ctx, r, { type: 'useItem', item: 'time' }).run;
  assert.deepEqual(r.armed, { shield: true, time: true });
  r = runStep(ctx, r, { type: 'door', index: idx }).run;
  assert.equal(r.battle.team.effects[0].key, 'shield');
  assert.equal(r.battle.team.effects[0].pool, Math.round(r.battle.maxHp * ctx.config.run.items.shield.pct));
  assert.equal(r.battle.dragBonusMs, ctx.config.run.items.time.bonusMs);
  assert.deepEqual(r.armed, { shield: false, time: false });
  assert.equal(runStep(ctx, r, { type: 'useItem', item: 'potion' }).events[0].reason, 'items_only_at_doors');
});

test('items: Bùa Khiên chặn đòn đánh của quái', () => {
  const { run, idx } = findRun(doorOf('normal'));
  let r = runStep(ctx, { ...run, items: { potion: 0, shield: 1, time: 0 } }, { type: 'useItem', item: 'shield' }).run;
  r = runStep(ctx, r, { type: 'door', index: idx }).run;
  r = rigLose(r);
  r.battle.hp = 5000;
  r.hp = 5000;
  r.battle.maxHp = Math.max(r.battle.maxHp, 5000);
  r.battle.enemies.forEach((e) => (e.atk = 100));
  const out = runStep(ctx, r, noMatchMove);
  const attacks = out.events.filter((e) => e.type === 'enemyAttack');
  assert.equal(attacks.length, 2);
  assert.ok(attacks.every((e) => e.blocked > 0 && e.amount === 0));
  assert.ok(out.run.battle.team.effects[0].pool < Math.round(r.battle.maxHp * ctx.config.run.items.shield.pct));
  assert.equal(out.run.hp, 5000);
});

test('event: mọi lựa chọn của mọi sự kiện áp dụng được, máu không xuống dưới 1', () => {
  for (const ev of ctx.eventList) {
    ev.choices.forEach((_, ci) => {
      for (let seed = 0; seed < 60; seed++) {
        const base = mk(seed);
        base.phase = 'event';
        base.event = { id: ev.id };
        base.hp = 50;
        base.loot.gold = 10;
        const r = runStep(ctx, base, { type: 'eventChoice', index: ci }).run;
        assert.equal(r.phase, 'result');
        assert.ok(r.hp >= 1 && r.hp <= r.maxHp);
        assert.ok(r.loot.gold >= 0);
        assert.equal(r.lastResult.kind, 'event');
      }
    });
  }
});

test('shop: mua cần đủ Vàng, mỗi ô chỉ mua một lần, rời shop sang ải kế', () => {
  const { run, idx } = findRun(doorOf('shop'), 'zone_water', 1);
  let r = runStep(ctx, run, { type: 'door', index: idx }).run;
  assert.equal(r.phase, 'shop');
  assert.equal(r.shop.length, ctx.config.run.shopSlots);
  assert.equal(runStep(ctx, r, { type: 'buy', slot: 0 }).events[0].reason, 'not_enough_gold');
  r.loot.gold = 1000;
  const item = r.shop[0].item;
  const price = r.shop[0].price;
  r = runStep(ctx, r, { type: 'buy', slot: 0 }).run;
  assert.equal(r.loot.gold, 1000 - price);
  assert.equal(r.items[item], 1);
  assert.equal(runStep(ctx, r, { type: 'buy', slot: 0 }).events[0].reason, 'bad_slot');
  r = runStep(ctx, r, { type: 'leaveShop' }).run;
  assert.equal(r.phase, 'doors');
  assert.equal(r.floor, 2);
});

test('run: hành động sai pha bị từ chối, state không đổi', () => {
  const run = mk(1);
  for (const a of [{ type: 'continue' }, { type: 'buy', slot: 0 }, { type: 'eventChoice', index: 0 }, { type: 'door', index: 9 }, winMove]) {
    const out = runStep(ctx, run, a);
    assert.equal(out.events[0].type, 'invalid');
    assert.equal(out.run, run);
  }
});

// Bot chơi trọn một chuyến, ghi lại record để phát lại.
function botRun(seed, zoneId, rngSeed) {
  const rng = mulberry32(rngSeed);
  const rec = newRunRecord(seed, zoneId, TEAM, rng.next() < 0.3);
  let run = createRun(ctx, rec);
  let guard = 0;
  while (run.phase !== 'end' && guard++ < 4000) {
    let a;
    if (run.phase === 'doors') {
      if (run.items.potion && rng.next() < 0.5) a = { type: 'useItem', item: 'potion' };
      else if (run.items.shield && rng.next() < 0.5) a = { type: 'useItem', item: 'shield' };
      else a = { type: 'door', index: rng.int(run.doors.length) };
    } else if (run.phase === 'battle') {
      const skill = rng.next() < 0.12;
      a = { type: 'battle', action: skill ? { type: 'skill', index: rng.int(5) } : { type: 'move', path: randomPath(rng) } };
    } else if (run.phase === 'result') a = { type: 'continue' };
    else if (run.phase === 'event') a = { type: 'eventChoice', index: rng.int(2) };
    else if (run.phase === 'shop') a = rng.next() < 0.5 && run.shop.some((s) => !s.sold) ? { type: 'buy', slot: run.shop.findIndex((s) => !s.sold) } : { type: 'leaveShop' };
    const out = runStep(ctx, run, a);
    if (out.events[0]?.type !== 'invalid') rec.actions.push(a);
    run = out.run;
  }
  return { run, rec, guard };
}

test('run: replay (seed + hành động) ra đúng kết quả; JSON round-trip vẫn đúng', () => {
  for (let i = 0; i < 20; i++) {
    const { run, rec } = botRun(100 + i, ctx.zoneList[i % 6].id, 7 * i + 1);
    assert.equal(hashState(playRun(ctx, rec)), hashState(run));
    assert.equal(hashState(playRun(ctx, JSON.parse(JSON.stringify(rec)))), hashState(run));
  }
});

test('fuzz: 200 chuyến bot ngẫu nhiên luôn kết thúc, tài nguyên hợp lệ', () => {
  let won = 0;
  let lost = 0;
  for (let i = 0; i < 200; i++) {
    const { run, guard } = botRun(i, ctx.zoneList[i % 6].id, i * 13 + 5);
    assert.ok(guard < 4000, `chuyến ${i} không kết thúc`);
    assert.equal(run.phase, 'end');
    assert.ok(run.hp >= 0 && run.hp <= run.maxHp);
    const l = run.loot;
    for (const v of [l.gold, l.essence, l.spirit, l.shards, l.stones.normal, l.stones.rare]) assert.ok(Number.isInteger(v) && v >= 0);
    if (run.result === 'won') {
      won++;
      assert.ok(run.completion);
    } else {
      lost++;
      assert.equal(run.completion, null);
    }
  }
  assert.equal(won + lost, 200);
});

test('progress: kết quả chuyến cộng vào kho, thắng mở khu kế, thua không mở', () => {
  let p = newProgress(ctx);
  assert.ok(isValidProgress(p));
  assert.deepEqual(p.unlocked, ['zone_water']);
  const won = simulateRun(ctx, 21, 'zone_water', false);
  p = applyRunResult(ctx, p, won);
  assert.deepEqual(p.unlocked, ['zone_water', 'zone_fire']);
  assert.equal(p.inventory.gold, won.loot.gold);
  assert.equal(p.inventory.stones[0].normal, won.loot.stones.normal); // Thủy = hệ 0
  assert.equal(p.inventory.stones[1].normal, 0);
  assert.equal(p.clears.zone_water.easy, 1);
  assert.equal(p.stats.wins, 1);
  assert.equal(p.pity.zone_water, won.rareMissed);
  assert.ok(isValidProgress(p));

  const lostRun = { ...won, result: 'lost', completion: null };
  const q = applyRunResult(ctx, newProgress(ctx), lostRun);
  assert.deepEqual(q.unlocked, ['zone_water']);
  assert.equal(q.stats.losses, 1);
  // khu Tim cuối cùng thì không có khu kế
  const last = simulateRun(ctx, 5, 'zone_heart', false);
  const r = applyRunResult(ctx, newProgress(ctx), last);
  assert.equal(r.inventory.stones[5].normal, last.loot.stones.normal);
  assert.throws(() => applyRunResult(ctx, p, mk(1)));
});
