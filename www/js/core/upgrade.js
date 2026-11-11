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
  return { ok: true, progress: p };
}

// Đội chuẩn bị vào trận: [{id, level, awaken}].
export const teamRoster = (progress) => progress.team.map((id) => ({ id, ...progress.characters[id] }));
