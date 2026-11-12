// Loot: số lượng và tỉ lệ nằm trong config.loot. Mọi ngẫu nhiên qua rng truyền vào.
export function emptyLoot() {
  return { gold: 0, elixir: { 1: 0, 2: 0, 3: 0 }, spirit: 0, shards: 0, stones: { normal: 0, rare: 0 }, fodder: {}, offerings: {} };
}

// Cộng hai bảng đếm { khóa: số } (không sửa đầu vào).
export function mergeCounts(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, n] of Object.entries(b)) out[k] = (out[k] || 0) + n;
  return out;
}

export function addLoot(a, b) {
  return {
    gold: a.gold + b.gold,
    elixir: { 1: a.elixir[1] + b.elixir[1], 2: a.elixir[2] + b.elixir[2], 3: a.elixir[3] + b.elixir[3] },
    spirit: a.spirit + b.spirit,
    shards: a.shards + b.shards,
    stones: { normal: a.stones.normal + b.stones.normal, rare: a.stones.rare + b.stones.rare },
    fodder: mergeCounts(a.fodder, b.fodder),
    offerings: mergeCounts(a.offerings, b.offerings),
  };
}

const between = (rng, [lo, hi]) => lo + rng.int(hi - lo + 1);

// races: các tộc của quái trong trận (rỗng = không rớt Lễ Vật).
// kind: 'normal' | 'elite' | 'boss' | 'chest' | 'completion'. Thứ tự gọi rng cố định.
// diff: độ khó. Khó hơn thì Vàng nhiều hơn (difficulty.gold) và mọi tỉ lệ rớt cao hơn (difficulty.drop, tối đa 100%).
export function rollLoot(ctx, kind, rng, diff = 'easy', element = 0, races = [], dropMult = 1) {
  const spec = ctx.config.loot[kind];
  const d = ctx.config.difficulty[diff];
  const chance = (c) => Math.min(1, c * d.drop * dropMult);
  const out = emptyLoot();
  out.gold = Math.round(between(rng, spec.gold) * d.gold);
  for (const [tier, e] of Object.entries(spec.elixir || {})) if (rng.next() < chance(e.chance)) out.elixir[tier] = between(rng, e.count);
  if (spec.stone) {
    if (rng.next() < chance(spec.stone.normalChance)) out.stones.normal = between(rng, spec.stone.normalCount);
    if (rng.next() < chance(spec.stone.rareChance)) out.stones.rare = 1;
  }
  if (spec.shard && rng.next() < chance(spec.shard.chance)) out.shards = between(rng, spec.shard.count);
  if (spec.spirit && rng.next() < chance(spec.spirit.chance)) out.spirit = between(rng, spec.spirit.count);
  // Tiểu Linh (quái cùi) của hệ khu vực: 1★ hay gặp, 2★ hiếm hơn và hiếm hơn nữa ở độ khó thấp.
  if (spec.fodder && rng.next() < chance(spec.fodder.chance)) {
    const n = between(rng, spec.fodder.count);
    const star = rng.next() < chance(spec.fodder.star2Chance) ? 2 : 1;
    out.fodder[`${element}_${star}`] = n;
  }
  // Lễ Vật theo tộc của quái trong trận; độ khó càng cao thì bậc càng cao (config.offeringTier).
  if (spec.offering && races.length && rng.next() < chance(spec.offering.chance)) {
    const n = between(rng, spec.offering.count);
    const race = races[rng.int(races.length)];
    const w = Object.entries(ctx.config.offeringTier[diff]);
    let x = rng.next() * w.reduce((a, [, v]) => a + v, 0);
    let tier = w[w.length - 1][0];
    for (const [t, v] of w) {
      if ((x -= v) < 0) {
        tier = t;
        break;
      }
    }
    out.offerings[`${race}_${tier}`] = n;
  }
  return out;
}
