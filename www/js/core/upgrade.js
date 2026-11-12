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

// Đổi đội: 5 nhân vật khác nhau, đều đã sở hữu. Thứ tự ô quyết định Duo và đội trưởng.
export function setTeam(progress, team) {
  if (!Array.isArray(team) || team.length !== 5 || new Set(team).size !== 5) return fail('bad_team');
  if (!team.every((id) => progress.characters[id])) return fail('not_owned');
  const p = structuredClone(progress);
  p.team = team.slice();
  const ps = presetsOf(p);
  ps[p.preset ?? 0] = team.slice();
  p.presets = ps;
  return { ok: true, progress: p };
}

export const PRESET_COUNT = 3;
const validTeam = (p, t) => Array.isArray(t) && t.length === 5 && new Set(t).size === 5 && t.every((id) => p.characters[id]);
// 3 đội lưu sẵn; ô thiếu/hỏng lấy đội đang dùng.
export function presetsOf(progress) {
  const cur = progress.preset ?? 0;
  return Array.from({ length: PRESET_COUNT }, (_, i) => {
    const t = progress.presets?.[i];
    return validTeam(progress, t) ? t.slice() : i === cur ? progress.team.slice() : progress.team.slice();
  });
}
export function selectPreset(progress, i) {
  if (!Number.isInteger(i) || i < 0 || i >= PRESET_COUNT) return fail('bad_preset');
  const p = structuredClone(progress);
  const ps = presetsOf(p);
  ps[p.preset ?? 0] = p.team.slice(); // lưu đội cũ
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

// Đội chuẩn bị vào trận: [{id, level, awaken}].
export const teamRoster = (progress) => progress.team.map((id) => ({ id, ...progress.characters[id] }));
