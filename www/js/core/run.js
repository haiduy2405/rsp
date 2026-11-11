import { mulberry32 } from './rng.js';
import { createBattle, step, buildMembers } from './battle.js';
import { rollLoot, emptyLoot, addLoot } from './loot.js';

// Một chuyến leo tháp: máy trạng thái thuần, xác định theo seed.
// phase: 'doors' | 'battle' | 'result' | 'event' | 'shop' | 'end'
// Hành động: door{index} | battle{action} | continue | useItem{item} | eventChoice{index} | buy{slot} | leaveShop

const ITEMS = ['potion', 'shield', 'time'];

function weighted(rng, weights, exclude = []) {
  const entries = Object.entries(weights).filter(([k]) => !exclude.includes(k));
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = rng.next() * total;
  for (const [k, w] of entries) {
    x -= w;
    if (x < 0) return k;
  }
  return entries[entries.length - 1][0];
}

function makeDoors(ctx, run, rng) {
  if (run.floor === run.floors - 1) return [ctx.zones[run.zoneId].final === 'boss' ? 'boss' : 'elite'];
  const a = weighted(rng, ctx.config.run.doorWeights);
  const b = weighted(rng, ctx.config.run.doorWeights, [a]);
  return [a, b];
}

export function createRun(ctx, { seed, zoneId, team, pityMissed = false }) {
  const zone = ctx.zones[zoneId];
  if (!zone) throw new Error('unknown zone ' + zoneId);
  const rng = mulberry32(seed);
  const { min, max } = ctx.config.run.floors;
  const floors = min + rng.int(max - min + 1);
  const { maxHp } = buildMembers(ctx, team);
  const run = {
    version: 1,
    seed,
    zoneId,
    team,
    floors,
    floor: 0,
    phase: 'doors',
    doors: [],
    hp: maxHp, // vào chuyến mới thì đội hồi đầy
    maxHp,
    loot: emptyLoot(),
    items: { potion: 0, shield: 0, time: 0 },
    armed: { shield: false, time: false },
    battle: null,
    node: null,
    event: null,
    shop: null,
    lastResult: null,
    result: null,
    completion: null,
    pityMissed,
    pityGranted: false,
    rareMissed: false,
    rng: 0,
  };
  run.doors = makeDoors(ctx, run, rng);
  run.rng = rng.state;
  return run;
}

const pick = (rng, list) => list[rng.int(list.length)];

function startBattle(ctx, run, rng, kind) {
  const zone = ctx.zones[run.zoneId];
  const normals = zone.monsters.normal;
  let enemies;
  if (kind === 'normal') enemies = [pick(rng, normals), pick(rng, normals)];
  else if (kind === 'elite') enemies = [pick(rng, zone.monsters.elite), pick(rng, normals)];
  else enemies = [pick(rng, zone.monsters.boss), pick(rng, normals)];
  const rc = ctx.config.run;
  const zs = rc.zoneScale || { hp: [], atk: [] };
  const scale = {
    hp: (1 + rc.floorScale.hp * run.floor) * (zs.hp[zone.order] ?? 1),
    atk: (1 + rc.floorScale.atk * run.floor) * (zs.atk[zone.order] ?? 1),
  };
  const seed = rng.int(4294967296);
  run.battle = createBattle(ctx, {
    seed,
    team: run.team,
    enemies,
    scale,
    hp: run.hp,
    startEffects: run.armed.shield ? [{ key: 'shield', turns: 999, value: rc.items.shield.pct }] : [],
    dragBonusMs: run.armed.time ? rc.items.time.bonusMs : 0,
  });
  run.armed = { shield: false, time: false };
  run.phase = 'battle';
}

function applyEffect(run, ef, events) {
  if (ef.type === 'gold') run.loot.gold = Math.max(0, run.loot.gold + ef.amount);
  else if (ef.type === 'essence') run.loot.essence += ef.amount;
  else if (ef.type === 'item') run.items[ef.item] += ef.count;
  else if (ef.type === 'stone') run.loot.stones[ef.kind] += ef.count;
  else if (ef.type === 'hpPct') {
    const d = Math.round(run.maxHp * ef.amount);
    const before = run.hp;
    run.hp = Math.max(1, Math.min(run.maxHp, run.hp + d)); // sự kiện không giết người chơi
    events.push({ type: 'hpChange', amount: run.hp - before });
  }
}

function enterNode(ctx, run, rng, type) {
  run.node = type;
  const rc = ctx.config.run;
  if (type === 'normal' || type === 'elite' || type === 'boss') {
    startBattle(ctx, run, rng, type);
  } else if (type === 'chest') {
    const loot = rollLoot(ctx, 'chest', rng);
    run.loot = addLoot(run.loot, loot);
    run.lastResult = { kind: 'chest', loot };
    run.phase = 'result';
  } else if (type === 'rest') {
    const before = run.hp;
    run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * rc.restHealPct));
    run.lastResult = { kind: 'rest', heal: run.hp - before };
    run.phase = 'result';
  } else if (type === 'event') {
    const ev = ctx.eventList[rng.int(ctx.eventList.length)];
    run.event = { id: ev.id };
    run.phase = 'event';
  } else if (type === 'shop') {
    const stock = [];
    for (let i = 0; i < rc.shopSlots; i++) {
      const item = pick(rng, ITEMS);
      stock.push({ item, price: rc.items[item].price, sold: false });
    }
    run.shop = stock;
    run.phase = 'shop';
  }
}

function advanceFloor(ctx, run, rng) {
  run.floor += 1;
  run.doors = makeDoors(ctx, run, rng);
  run.lastResult = null;
  run.event = null;
  run.shop = null;
  run.node = null;
  run.battle = null;
  run.phase = 'doors';
}

function endRun(ctx, run, rng, won) {
  if (won) {
    const comp = rollLoot(ctx, 'completion', rng);
    // Bảo hiểm xui: chuyến trước hụt Tinh Thạch Hiếm thì chuyến này chắc chắn có khi hoàn thành.
    if (run.pityMissed && comp.stones.rare + run.loot.stones.rare === 0) {
      comp.stones.rare = 1;
      run.pityGranted = true;
    }
    run.completion = comp;
    run.loot = addLoot(run.loot, comp);
    run.result = 'won';
  } else {
    run.result = 'lost';
  }
  run.rareMissed = run.loot.stones.rare === 0;
  run.phase = 'end';
}

function onBattleWon(ctx, run, rng) {
  const kind = run.node === 'boss' ? 'boss' : run.node === 'elite' ? 'elite' : 'normal';
  const loot = rollLoot(ctx, kind, rng);
  run.loot = addLoot(run.loot, loot);
  run.lastResult = { kind: 'battle', nodeType: run.node, loot };
  if (run.floor === run.floors - 1) endRun(ctx, run, rng, true);
  else run.phase = 'result';
}

const invalid = (run, reason) => ({ run, events: [{ type: 'invalid', reason }] });

// Trả về { run, events }. Run đầu vào không bị sửa.
export function runStep(ctx, run, action) {
  if (run.phase === 'end') return invalid(run, 'run_over');
  const rc = ctx.config.run;

  if (action.type === 'battle') {
    if (run.phase !== 'battle') return invalid(run, 'not_in_battle');
    const r = step(ctx, run.battle, action.action);
    if (r.events[0]?.type === 'invalid') return { run, events: r.events };
    const nr = structuredClone(run);
    const rng = mulberry32(nr.rng);
    nr.battle = r.state;
    nr.hp = r.state.hp;
    if (r.state.status === 'won') onBattleWon(ctx, nr, rng);
    else if (r.state.status === 'lost') endRun(ctx, nr, rng, false);
    nr.rng = rng.state;
    return { run: nr, events: r.events };
  }

  const nr = structuredClone(run);
  const rng = mulberry32(nr.rng);
  const events = [];

  if (action.type === 'door') {
    if (run.phase !== 'doors') return invalid(run, 'not_at_doors');
    const type = run.doors[action.index];
    if (!type) return invalid(run, 'bad_door');
    enterNode(ctx, nr, rng, type);
  } else if (action.type === 'continue') {
    if (run.phase !== 'result') return invalid(run, 'nothing_to_continue');
    advanceFloor(ctx, nr, rng);
  } else if (action.type === 'useItem') {
    if (run.phase !== 'doors') return invalid(run, 'items_only_at_doors');
    const it = action.item;
    if (!ITEMS.includes(it) || nr.items[it] <= 0) return invalid(run, 'no_item');
    if (it === 'potion') {
      if (nr.hp >= nr.maxHp) return invalid(run, 'hp_full');
      const before = nr.hp;
      nr.hp = Math.min(nr.maxHp, nr.hp + Math.round(nr.maxHp * rc.items.potion.healPct));
      events.push({ type: 'hpChange', amount: nr.hp - before });
    } else {
      if (nr.armed[it]) return invalid(run, 'already_armed');
      nr.armed[it] = true;
    }
    nr.items[it] -= 1;
  } else if (action.type === 'eventChoice') {
    if (run.phase !== 'event') return invalid(run, 'not_in_event');
    const ev = ctx.events[run.event.id];
    const choice = ev.choices[action.index];
    if (!choice) return invalid(run, 'bad_choice');
    const total = choice.outcomes.reduce((a, o) => a + o.weight, 0);
    let x = rng.next() * total;
    let oi = choice.outcomes.length - 1;
    for (let i = 0; i < choice.outcomes.length; i++) {
      x -= choice.outcomes[i].weight;
      if (x < 0) {
        oi = i;
        break;
      }
    }
    for (const ef of choice.outcomes[oi].effects) applyEffect(nr, ef, events);
    nr.lastResult = { kind: 'event', eventId: ev.id, choice: action.index, outcome: oi };
    nr.phase = 'result';
  } else if (action.type === 'buy') {
    if (run.phase !== 'shop') return invalid(run, 'not_in_shop');
    const slot = nr.shop[action.slot];
    if (!slot || slot.sold) return invalid(run, 'bad_slot');
    if (nr.loot.gold < slot.price) return invalid(run, 'not_enough_gold');
    nr.loot.gold -= slot.price;
    slot.sold = true;
    nr.items[slot.item] += 1;
  } else if (action.type === 'leaveShop') {
    if (run.phase !== 'shop') return invalid(run, 'not_in_shop');
    advanceFloor(ctx, nr, rng);
  } else {
    return invalid(run, 'unknown_action');
  }
  nr.rng = rng.state;
  return { run: nr, events };
}

// Record: { seed, zoneId, team, pityMissed, actions } -> run cuối.
export function newRunRecord(seed, zoneId, team, pityMissed = false) {
  return { seed, zoneId, team, pityMissed, actions: [] };
}

export function playRun(ctx, record) {
  let run = createRun(ctx, record);
  for (const a of record.actions) run = runStep(ctx, run, a).run;
  return run;
}

// Chỉ dành cho tools/test mô phỏng loot: coi như thắng trận hiện tại mà không đánh.
export function debugWinBattle(ctx, run) {
  const nr = structuredClone(run);
  const rng = mulberry32(nr.rng);
  nr.battle.status = 'won';
  onBattleWon(ctx, nr, rng);
  nr.rng = rng.state;
  return nr;
}

// Chỉ dành cho tools/balance-sim: đưa trạng thái trận đã chạy ngoài (b) vào chuyến, rồi xử lý thắng/thua như bình thường.
export function debugFinishBattle(ctx, run, b) {
  const nr = structuredClone(run);
  const rng = mulberry32(nr.rng);
  nr.battle = b;
  nr.hp = b.hp;
  if (b.status === 'won') onBattleWon(ctx, nr, rng);
  else endRun(ctx, nr, rng, false);
  nr.rng = rng.state;
  return nr;
}
