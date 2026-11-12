// Loot: số lượng và tỉ lệ nằm trong config.loot. Mọi ngẫu nhiên qua rng truyền vào.
export function emptyLoot() {
  return { gold: 0, essence: 0, spirit: 0, shards: 0, stones: { normal: 0, rare: 0 } };
}

export function addLoot(a, b) {
  return {
    gold: a.gold + b.gold,
    essence: a.essence + b.essence,
    spirit: a.spirit + b.spirit,
    shards: a.shards + b.shards,
    stones: { normal: a.stones.normal + b.stones.normal, rare: a.stones.rare + b.stones.rare },
  };
}

const between = (rng, [lo, hi]) => lo + rng.int(hi - lo + 1);

// kind: 'normal' | 'elite' | 'boss' | 'chest' | 'completion'. Thứ tự gọi rng cố định.
// diff: độ khó. Khó hơn thì Vàng/Tinh Hoa nhiều hơn (difficulty.gold) và mọi tỉ lệ rớt cao hơn (difficulty.drop, tối đa 100%).
export function rollLoot(ctx, kind, rng, diff = 'easy') {
  const spec = ctx.config.loot[kind];
  const d = ctx.config.difficulty[diff];
  const chance = (c) => Math.min(1, c * d.drop);
  const out = emptyLoot();
  out.gold = Math.round(between(rng, spec.gold) * d.gold);
  out.essence = Math.round(between(rng, spec.essence) * d.gold);
  if (spec.stone) {
    if (rng.next() < chance(spec.stone.normalChance)) out.stones.normal = between(rng, spec.stone.normalCount);
    if (rng.next() < chance(spec.stone.rareChance)) out.stones.rare = 1;
  }
  if (spec.shard && rng.next() < chance(spec.shard.chance)) out.shards = between(rng, spec.shard.count);
  if (spec.spirit && rng.next() < chance(spec.spirit.chance)) out.spirit = between(rng, spec.spirit.count);
  return out;
}
