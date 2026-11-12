// Thông tin một ải (khu x độ khó) cho màn xem chi tiết: hệ số quái, quái trong khu, tỉ lệ đặc tính và bảng rớt.
// Tính cùng công thức với rollLoot/startBattle, không gọi rng.

const SOURCES = ['normal', 'swarm', 'elite', 'boss', 'chest', 'completion'];

export function stageInfo(ctx, zoneId, diff) {
  const cfg = ctx.config;
  const zone = ctx.zones[zoneId];
  const d = cfg.difficulty[diff];
  const rc = cfg.run;
  const last = rc.layout.length - 1;
  const mult = (key, floor) => (1 + rc.floorScale[key] * floor) * (rc.zoneScale[key][zone.order] ?? 1) * d[key];
  const pct = (c) => Math.min(1, c * d.drop);

  const sources = SOURCES.filter((k) => cfg.loot[k]).map((kind) => {
    const spec = cfg.loot[kind];
    const drops = [];
    const add = (key, chance, count) => drops.push({ key, chance: pct(chance), count });
    if (spec.stone) {
      add('stone.normal', spec.stone.normalChance, spec.stone.normalCount);
      add('stone.rare', spec.stone.rareChance, [1, 1]);
    }
    if (spec.shard) add('shard', spec.shard.chance, spec.shard.count);
    if (spec.spirit) add('spirit', spec.spirit.chance, spec.spirit.count);
    if (spec.fodder) add('fodder', spec.fodder.chance, spec.fodder.count);
    if (spec.offering) add('offering', spec.offering.chance, spec.offering.count);
    for (const [tier, e] of Object.entries(spec.elixir || {})) add(`elixir.${tier}`, e.chance, e.count);
    return { kind, gold: spec.gold.map((x) => Math.round(x * d.gold)), drops };
  });

  const ac = cfg.affix;
  const affix = {};
  for (const k of ['normal', 'swarm', 'elite', 'boss']) {
    const c = ac.chance[k];
    affix[k] = { chance: Math.min(1, c.base + c.perZone * zone.order + (ac.diffAdd[diff] ?? 0)), max: ac.maxCount[k] };
  }
  const tiers = Object.entries(cfg.offeringTier[diff]).map(([tier, w]) => ({ tier: Number(tier), pct: w }));
  const total = tiers.reduce((a, x) => a + x.pct, 0);
  tiers.forEach((x) => (x.pct /= total));

  return {
    floors: rc.layout.length,
    hp: [mult('hp', 0), mult('hp', last)],
    atk: [mult('atk', 0), mult('atk', last)],
    monsters: zone.monsters,
    races: [...new Set(zone.monsters.normal.map((m) => ctx.monsters[m].race))],
    affix,
    affixPool: Object.keys(ac.list).filter((id) => (ac.list[id].minZone ?? 0) <= zone.order),
    sources,
    tiers,
    gold: d.gold,
    drop: d.drop,
  };
}
