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
export function rollLoot(ctx, kind, rng) {
  const spec = ctx.config.loot[kind];
  const out = emptyLoot();
  out.gold = between(rng, spec.gold);
  out.essence = between(rng, spec.essence);
  if (spec.stone) {
    if (rng.next() < spec.stone.normalChance) out.stones.normal = between(rng, spec.stone.normalCount);
    if (rng.next() < spec.stone.rareChance) out.stones.rare = 1;
  }
  if (spec.shard && rng.next() < spec.shard.chance) out.shards = between(rng, spec.shard.count);
  if (spec.spirit && rng.next() < spec.spirit.chance) out.spirit = between(rng, spec.spirit.count);
  return out;
}
