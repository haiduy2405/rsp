import { stageFactor } from './run.js';
import { firstClearStageSpirit } from './progress.js';
// Thông tin một ải (khu x độ khó x ải 1..7) cho màn xem chi tiết: hệ số quái, quái trong khu, tỉ lệ đặc tính và bảng rớt.
// Tính cùng công thức với rollLoot/startBattle, không gọi rng.

const SOURCES = ['normal', 'swarm', 'elite', 'boss', 'chest', 'completion'];

export function stageInfo(ctx, zoneId, diff, stage = 1) {
  const cfg = ctx.config;
  const zone = ctx.zones[zoneId];
  const d = cfg.difficulty[diff];
  const rc = cfg.run;
  const layout = rc.layouts[stage >= rc.stages ? 'boss' : 'mini'];
  const last = layout.length - 1;
  const mult = (key, floor) => (1 + rc.floorScale[key] * floor) * stageFactor(rc, key, stage) * (rc.zoneScale[key][zone.order] ?? 1) * d[key];
  const rw = rc.stageReward[stage - 1] ?? 1;
  const pct = (c, kind) => Math.min(1, c * d.drop * (kind === 'completion' ? rw : 1));

  const sources = SOURCES.filter((k) => cfg.loot[k]).map((kind) => {
    const spec = cfg.loot[kind];
    const drops = [];
    const add = (key, chance, count) => drops.push({ key, chance: pct(chance, kind), count });
    if (spec.stone) {
      add('stone.normal', spec.stone.normalChance, spec.stone.normalCount);
      add('stone.rare', spec.stone.rareChance, [1, 1]);
    }
    if (spec.shard) add('shard', spec.shard.chance, spec.shard.count);
    if (spec.fodder) add('fodder', spec.fodder.chance, spec.fodder.count);
    if (spec.offering) add('offering', spec.offering.chance, spec.offering.count);
    if (spec.fragment) add('fragment', spec.fragment.chance, [1, 1]);
    for (const [tier, e] of Object.entries(spec.elixir || {})) add(`elixir.${tier}`, e.chance, e.count);
    return { kind, gold: spec.gold.map((x) => Math.round(x * d.gold * (kind === 'completion' ? rw : 1))), drops };
  });

  const tiers = Object.entries(cfg.offeringTier[diff]).map(([tier, w]) => ({ tier: Number(tier), pct: w }));
  const total = tiers.reduce((a, x) => a + x.pct, 0);
  tiers.forEach((x) => (x.pct /= total));

  return {
    floors: layout.length,
    stage,
    hp: [mult('hp', 0), mult('hp', last)],
    atk: [mult('atk', 0), mult('atk', last)],
    monsters: zone.monsters,
    races: [...new Set(zone.monsters.normal.map((m) => ctx.monsters[m].race))],
    firstClear: firstClearStageSpirit(ctx, zoneId, diff, stage),
    sources,
    tiers,
    gold: d.gold,
    drop: d.drop,
  };
}
