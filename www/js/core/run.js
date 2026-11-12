import { mulberry32 } from './rng.js';
import { createBattle, step, buildMembers } from './battle.js';
import { rollLoot, emptyLoot, addLoot } from './loot.js';
import { relicMods, rollRelics, relicPrice } from './relic.js';

// Một chuyến leo tháp: máy trạng thái thuần, xác định theo seed.
// phase: 'doors' | 'battle' | 'result' | 'event' | 'shop' | 'relic' | 'end'
// Hành động: door{index} | battle{action} | continue | useItem{item} | eventChoice{index} | buy{slot} | leaveShop | pickRelic{index}

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

// Cửa của một tầng theo bố cục config.run.layout. Tầng đánh (toàn cửa chiến đấu) xen kẽ tầng sự kiện (toàn cửa phục vụ),
// nên mọi đường đều qua đủ trận thường, một tầng Elite rồi Boss cuối, mà các đường vẫn khác nhau.
// Cửa chiến đấu có sẵn danh sách quái (run.preview) để người chơi xem trước và chọn.
const COMBAT = ['normal', 'swarm', 'elite', 'boss'];
function rollDoors(ctx, run, rng) {
  const { layout, pools } = ctx.config.run;
  const slot = layout[run.floor];
  const doors = [];
  for (let i = 0; i < slot.doors; i++) doors.push(weighted(rng, pools[slot.pool], slot.distinct ? doors : []));
  run.doors = doors;
  run.preview = doors.map((d) => (COMBAT.includes(d) ? rollEnemies(ctx, run.zoneId, d, rng) : null));
}

// Quái của một trận theo loại cửa.
function rollEnemies(ctx, zoneId, kind, rng) {
  const zone = ctx.zones[zoneId];
  const normals = zone.monsters.normal;
  if (kind === 'normal') return [pick(rng, normals), pick(rng, normals)];
  if (kind === 'swarm') return [pick(rng, normals), pick(rng, normals), pick(rng, normals)];
  if (kind === 'elite') return [pick(rng, zone.monsters.elite), pick(rng, normals)];
  return [pick(rng, zone.monsters.boss), pick(rng, normals)];
}

// Hệ số Di Vật hiện có của chuyến (cộng cả thưởng máu từ sự kiện).
export function runMods(ctx, run) {
  const m = relicMods(ctx, run.relics);
  m.hpPct += run.hpBonus;
  return m;
}
// Tính lại máu tối đa của đội khi Di Vật hoặc sự kiện đổi chỉ số; phần máu tăng thêm được cộng luôn vào máu hiện tại.
function recalcMaxHp(ctx, run) {
  const { maxHp } = buildMembers(ctx, run.team, runMods(ctx, run));
  run.hp = Math.min(maxHp, run.hp + Math.max(0, maxHp - run.maxHp));
  run.maxHp = maxHp;
}

export function createRun(ctx, { seed, zoneId, team, pityMissed = false, diff = 'easy' }) {
  if (!ctx.config.difficulty[diff]) throw new Error('unknown difficulty ' + diff);
  const zone = ctx.zones[zoneId];
  if (!zone) throw new Error('unknown zone ' + zoneId);
  const rng = mulberry32(seed);
  const floors = ctx.config.run.layout.length; // mọi ải có số tầng bằng nhau
  const { maxHp } = buildMembers(ctx, team);
  const run = {
    version: 1,
    seed,
    zoneId,
    diff,
    team,
    floors,
    floor: 0,
    phase: 'doors',
    doors: [],
    hp: maxHp, // vào chuyến mới thì đội hồi đầy
    maxHp,
    loot: emptyLoot(),
    items: { potion: 0, shield: 0, time: 0 },
    relics: [], // Di Vật đang giữ
    relicChoices: [],
    pendingRelic: false, // thắng Elite thì được chọn Di Vật sau màn thưởng
    reviveUsed: false,
    hpBonus: 0,
    preview: [],
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
  rollDoors(ctx, run, rng);
  run.rng = rng.state;
  return run;
}

const pick = (rng, list) => list[rng.int(list.length)];
// Các tộc quái thường của khu (cho rương và thưởng hoàn thành).
const zoneRaces = (ctx, zoneId) => [...new Set(ctx.zones[zoneId].monsters.normal.map((m) => ctx.monsters[m].race))];

function startBattle(ctx, run, rng, kind, preset) {
  const zone = ctx.zones[run.zoneId];
  const enemies = preset || rollEnemies(ctx, run.zoneId, kind, rng);
  const rc = ctx.config.run;
  const zs = rc.zoneScale || { hp: [], atk: [] };
  const df = ctx.config.difficulty[run.diff];
  const kindScale = rc.kindScale?.[kind] || { hp: 1, atk: 1 };
  const scale = {
    hp: (1 + rc.floorScale.hp * run.floor) * (zs.hp[zone.order] ?? 1) * df.hp * kindScale.hp,
    atk: (1 + rc.floorScale.atk * run.floor) * (zs.atk[zone.order] ?? 1) * df.atk * kindScale.atk,
  };
  const mods = runMods(ctx, run);
  const startEffects = [];
  if (run.armed.shield) startEffects.push({ key: 'shield', turns: 999, value: rc.items.shield.pct });
  if (mods.startShield) startEffects.push({ key: 'shield', turns: 999, value: mods.startShield });
  if (mods.startAtkUp) startEffects.push({ key: 'atkUp', turns: 3, value: mods.startAtkUp });
  if (mods.startReflect) startEffects.push({ key: 'reflect', turns: 3, value: mods.startReflect });
  const seed = rng.int(4294967296);
  run.battle = createBattle(ctx, {
    seed,
    team: run.team,
    enemies,
    scale,
    hp: run.hp,
    startEffects,
    dragBonusMs: run.armed.time ? rc.items.time.bonusMs : 0,
    mods,
    big: kind === 'elite' || kind === 'boss',
    reviveUsed: run.reviveUsed,
  });
  run.armed = { shield: false, time: false };
  run.phase = 'battle';
}

// Cuộn loot của chuyến: Di Vật cộng Vàng và tỉ lệ rớt.
function lootRoll(ctx, run, kind, rng, races) {
  const m = runMods(ctx, run);
  const loot = rollLoot(ctx, kind, rng, run.diff, ctx.zones[run.zoneId].element, races, 1 + m.dropPct);
  loot.gold = Math.round(loot.gold * (1 + m.goldPct));
  return loot;
}

function gainRelic(ctx, run, id) {
  if (!run.relics.includes(id)) run.relics.push(id);
  recalcMaxHp(ctx, run);
}

function applyEffect(ctx, run, rng, ef, events) {
  if (ef.type === 'gold') run.loot.gold = Math.max(0, run.loot.gold + ef.amount);
  else if (ef.type === 'essence') run.loot.essence += ef.amount;
  else if (ef.type === 'item') run.items[ef.item] += ef.count;
  else if (ef.type === 'stone') run.loot.stones[ef.kind] += ef.count;
  else if (ef.type === 'hpPct') {
    const d = Math.round(run.maxHp * ef.amount);
    const before = run.hp;
    run.hp = Math.max(1, Math.min(run.maxHp, run.hp + d)); // sự kiện không giết người chơi
    events.push({ type: 'hpChange', amount: run.hp - before });
  } else if (ef.type === 'maxHpPct') {
    run.hpBonus += ef.amount;
    recalcMaxHp(ctx, run);
  } else if (ef.type === 'relic') {
    // Di Vật ngẫu nhiên (bậc tối thiểu ef.minRarity nếu có), không trùng cái đã có.
    const pool = rollRelics(ctx, rng, ctx.relicList.length, 'event', run.relics).filter((id) => ctx.relics[id].rarity >= (ef.minRarity || 1));
    if (pool.length) {
      gainRelic(ctx, run, pool[0]);
      events.push({ type: 'relic', id: pool[0] });
      run.lastRelic = pool[0];
    }
  }
}

function enterNode(ctx, run, rng, type, index) {
  run.node = type;
  const rc = ctx.config.run;
  run.lastRelic = null;
  if (COMBAT.includes(type)) {
    startBattle(ctx, run, rng, type, run.preview?.[index]);
  } else if (type === 'chest') {
    const loot = lootRoll(ctx, run, 'chest', rng, zoneRaces(ctx, run.zoneId));
    run.loot = addLoot(run.loot, loot);
    run.lastResult = { kind: 'chest', loot };
    run.phase = 'result';
  } else if (type === 'rest') {
    const before = run.hp;
    const heal = Math.round(run.maxHp * rc.restHealPct * (1 + runMods(ctx, run).restPct));
    run.hp = Math.min(run.maxHp, run.hp + heal);
    run.lastResult = { kind: 'rest', heal: run.hp - before };
    run.phase = 'result';
  } else if (type === 'event') {
    const ev = ctx.eventList[rng.int(ctx.eventList.length)];
    run.event = { id: ev.id };
    run.phase = 'event';
  } else if (type === 'shrine') {
    run.relicChoices = rollRelics(ctx, rng, ctx.config.relic.choices, 'shrine', run.relics);
    run.phase = run.relicChoices.length ? 'relic' : 'result';
    if (!run.relicChoices.length) run.lastResult = { kind: 'rest', heal: 0 };
  } else if (type === 'shop') {
    // Thương nhân: vài Di Vật (giá theo độ hiếm) và vài vật phẩm tiêu hao.
    const stock = rollRelics(ctx, rng, rc.shopRelics, 'shop', run.relics).map((id) => ({ relic: id, price: relicPrice(ctx, id), sold: false }));
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
  rollDoors(ctx, run, rng);
  run.lastResult = null;
  run.relicChoices = [];
  run.event = null;
  run.shop = null;
  run.node = null;
  run.battle = null;
  run.phase = 'doors';
}

function endRun(ctx, run, rng, won) {
  if (won) {
    const comp = lootRoll(ctx, run, 'completion', rng, zoneRaces(ctx, run.zoneId));
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
  const kind = run.node; // normal | swarm | elite | boss (mỗi loại có bảng loot riêng)
  const races = [...new Set(run.battle.enemies.map((e) => ctx.monsters[e.id].race))];
  const loot = lootRoll(ctx, run, kind, rng, races);
  run.reviveUsed = !!run.battle.reviveUsed;
  run.pendingRelic = kind === 'elite';
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
    nr.reviveUsed = !!r.state.reviveUsed;
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
    enterNode(ctx, nr, rng, type, action.index);
  } else if (action.type === 'continue') {
    if (run.phase !== 'result') return invalid(run, 'nothing_to_continue');
    if (nr.pendingRelic) {
      nr.pendingRelic = false;
      nr.relicChoices = rollRelics(ctx, rng, ctx.config.relic.choices, 'elite', nr.relics);
      if (nr.relicChoices.length) nr.phase = 'relic';
      else advanceFloor(ctx, nr, rng);
    } else advanceFloor(ctx, nr, rng);
  } else if (action.type === 'pickRelic') {
    if (run.phase !== 'relic') return invalid(run, 'not_choosing_relic');
    const id = run.relicChoices[action.index];
    if (!id) return invalid(run, 'bad_choice');
    gainRelic(ctx, nr, id);
    nr.lastRelic = id;
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
    for (const ef of choice.outcomes[oi].effects) applyEffect(ctx, nr, rng, ef, events);
    nr.lastResult = { kind: 'event', eventId: ev.id, choice: action.index, outcome: oi };
    nr.phase = 'result';
  } else if (action.type === 'buy') {
    if (run.phase !== 'shop') return invalid(run, 'not_in_shop');
    const slot = nr.shop[action.slot];
    if (!slot || slot.sold) return invalid(run, 'bad_slot');
    if (nr.loot.gold < slot.price) return invalid(run, 'not_enough_gold');
    nr.loot.gold -= slot.price;
    slot.sold = true;
    if (slot.relic) gainRelic(ctx, nr, slot.relic);
    else nr.items[slot.item] += 1;
  } else if (action.type === 'leaveShop') {
    if (run.phase !== 'shop') return invalid(run, 'not_in_shop');
    advanceFloor(ctx, nr, rng);
  } else {
    return invalid(run, 'unknown_action');
  }
  nr.rng = rng.state;
  return { run: nr, events };
}

// Record: { seed, zoneId, diff, team, pityMissed, actions } -> run cuối.
export function newRunRecord(seed, zoneId, team, pityMissed = false, diff = 'easy') {
  return { seed, zoneId, diff, team, pityMissed, actions: [] };
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
