import { statsFor } from './stats.js';
// Nâng cấp nhân vật: Level (Tinh Hoa), Thức tỉnh (Mảnh Linh Hồn + Tinh Thạch cùng hệ + Vàng), nhận nhân vật, đổi đội.
// Mọi hàm thuần: nhận progress, trả { ok, progress?, reason?, ... }. Số liệu ở config.upgrade.

const fail = (reason) => ({ ok: false, reason });

export function levelCost(ctx, id, level) {
  const c = ctx.characters[id];
  if (!c || level >= ctx.config.progression.levelMax) return null;
  const u = ctx.config.upgrade.level;
  return Math.round(u.baseEssence * (1 + u.growth * (level - 1)) * u.rarityMult[c.rarity]);
}

export function levelUp(ctx, progress, id) {
  const ch = progress.characters[id];
  if (!ch) return fail('not_owned');
  const cost = levelCost(ctx, id, ch.level);
  if (cost === null) return fail('max_level');
  if (progress.inventory.essence < cost) return fail('not_enough_essence');
  const p = structuredClone(progress);
  p.inventory.essence -= cost;
  p.characters[id].level += 1;
  return { ok: true, progress: p, cost };
}

// stage: 1..5 (bậc sắp đạt). Trả null nếu đã tối đa.
export function awakenCost(ctx, id, stage) {
  const c = ctx.characters[id];
  const def = ctx.config.upgrade.awaken.stages[stage - 1];
  if (!c || !def) return null;
  const m = ctx.config.upgrade.awaken.rarityMult[c.rarity];
  return { shards: Math.ceil(def.shards * m), stone: def.stone, stones: def.stones, gold: Math.round(def.gold * m), element: c.element };
}

export function awaken(ctx, progress, id) {
  const ch = progress.characters[id];
  if (!ch) return fail('not_owned');
  const cost = awakenCost(ctx, id, ch.awaken + 1);
  if (!cost) return fail('max_awaken');
  const inv = progress.inventory;
  if (inv.shards < cost.shards) return fail('not_enough_shards');
  if (inv.stones[cost.element][cost.stone] < cost.stones) return fail('not_enough_stones');
  if (inv.gold < cost.gold) return fail('not_enough_gold');
  const p = structuredClone(progress);
  p.inventory.shards -= cost.shards;
  p.inventory.stones[cost.element][cost.stone] -= cost.stones;
  p.inventory.gold -= cost.gold;
  p.characters[id].awaken += 1;
  return { ok: true, progress: p, cost };
}

// Nhận nhân vật (M4 Triệu hồi sẽ gọi). Trùng thì tự đổi thành Mảnh Linh Hồn.
export function grantCharacter(ctx, progress, id) {
  const c = ctx.characters[id];
  if (!c) return fail('unknown_character');
  const p = structuredClone(progress);
  if (p.characters[id]) {
    const shards = ctx.config.upgrade.duplicateShards[c.rarity];
    p.inventory.shards += shards;
    return { ok: true, progress: p, duplicate: true, shards };
  }
  p.characters[id] = { level: 1, awaken: 0 };
  return { ok: true, progress: p, duplicate: false, shards: 0 };
}

// Đội gồm 5 ô; mỗi ô là id hoặc null (trống). Không trùng, đều đã sở hữu. Ô 1 là đội trưởng.
const teamOk = (progress, team) => Array.isArray(team) && team.length === 5 && team.every((id) => id === null || (typeof id === 'string' && progress.characters[id])) && new Set(team.filter((id) => id !== null)).size === team.filter((id) => id !== null).length;
export function setTeam(progress, team) {
  if (!Array.isArray(team) || team.length !== 5) return fail('bad_team');
  const ids = team.filter((id) => id !== null);
  if (new Set(ids).size !== ids.length) return fail('bad_team');
  if (!ids.every((id) => progress.characters[id])) return fail('not_owned');
  const p = structuredClone(progress);
  p.team = team.slice();
  const ps = presetsOf(p);
  ps[p.preset ?? 0] = team.slice();
  p.presets = ps;
  return { ok: true, progress: p };
}

export const PRESET_COUNT = 3;
export const EMPTY_TEAM = () => [null, null, null, null, null];
// 3 đội lưu sẵn; đội 1 mặc định là đội khởi đầu, đội 2-3 mặc định trống.
export function presetsOf(progress) {
  const cur = progress.preset ?? 0;
  return Array.from({ length: PRESET_COUNT }, (_, i) => {
    if (i === cur) return progress.team.slice();
    const t = progress.presets?.[i];
    return teamOk(progress, t) ? t.slice() : EMPTY_TEAM();
  });
}
export function selectPreset(progress, i) {
  if (!Number.isInteger(i) || i < 0 || i >= PRESET_COUNT) return fail('bad_preset');
  const p = structuredClone(progress);
  const ps = presetsOf(p);
  p.presets = ps;
  p.preset = i;
  p.team = ps[i].slice();
  return { ok: true, progress: p };
}
// Đặt nhân vật ở ô `slot` làm đội trưởng (đổi chỗ với ô 1).
export function makeLeader(progress, slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 4) return fail('bad_slot');
  const t = progress.team.slice();
  [t[0], t[slot]] = [t[slot], t[0]];
  return setTeam(progress, t);
}
// Đặt `id` (hoặc null = bỏ ra) vào ô `slot`. Nếu `id` đang ở ô khác thì hai ô đổi chỗ.
export function placeInSlot(progress, slot, id) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 4) return fail('bad_slot');
  const t = progress.team.slice();
  if (id !== null) {
    const at = t.indexOf(id);
    if (at >= 0) t[at] = t[slot];
  }
  t[slot] = id;
  return setTeam(progress, t);
}
export const clearTeam = (progress) => setTeam(progress, EMPTY_TEAM());

// Điểm sức mạnh một nhân vật đang sở hữu (công là chính, máu và hồi phụ).
export function charPower(ctx, progress, id) {
  const c = progress.characters[id];
  const st = statsFor(ctx, id, c.level, c.awaken);
  return st.atk + st.hp * 0.2 + st.heal * 0.5;
}
// Tự lập đội mạnh nhất từ bộ sưu tập: chọn theo điểm, giảm điểm khi trùng hệ (đủ hệ thì đánh được nhiều ngọc hơn),
// đội trưởng là người mạnh nhất, các ô còn lại xếp để mở nhiều Duo nhất.
export function autoTeam(ctx, progress) {
  const ids = Object.keys(progress.characters).filter((id) => ctx.characters[id]);
  const score = Object.fromEntries(ids.map((id) => [id, charPower(ctx, progress, id)]));
  const picked = [];
  const perEl = {};
  while (picked.length < 5 && picked.length < ids.length) {
    let best = null;
    let bv = -1;
    for (const id of ids) {
      if (picked.includes(id)) continue;
      const v = score[id] * 0.8 ** (perEl[ctx.characters[id].element] || 0);
      if (v > bv || (v === bv && id < best)) {
        bv = v;
        best = id;
      }
    }
    picked.push(best);
    const e = ctx.characters[best].element;
    perEl[e] = (perEl[e] || 0) + 1;
  }
  const lead = picked.slice().sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1))[0];
  const rest = picked.filter((id) => id !== lead);
  let bestOrder = rest;
  let bestDuos = -1;
  const perm = (arr, cur = []) => {
    if (!arr.length) {
      const seq = [lead, ...cur];
      let d = 0;
      for (let i = 0; i + 1 < seq.length; i++) if (ctx.duoByPair[`${seq[i]}|${seq[i + 1]}`]) d++;
      if (d > bestDuos) {
        bestDuos = d;
        bestOrder = cur;
      }
      return;
    }
    arr.forEach((x, i) => perm([...arr.slice(0, i), ...arr.slice(i + 1)], [...cur, x]));
  };
  perm(rest);
  const team = [lead, ...bestOrder];
  while (team.length < 5) team.push(null);
  return setTeam(progress, team);
}

// Đội chuẩn bị vào trận: [{id, level, awaken}].
export const teamRoster = (progress) => progress.team.filter((id) => id !== null).map((id) => ({ id, ...progress.characters[id] }));
