// Chỉ số nhân vật theo Level và Thức tỉnh. Hằng số nằm trong config.progression.
export function levelMult(cfg, level) {
  return 1 + cfg.progression.levelGrowth * (level - 1);
}

export function awakenStatBonus(cfg, awaken) {
  let b = 0;
  cfg.progression.awaken.slice(0, awaken).forEach((a) => (b += a.stat || 0));
  return b;
}

export function awakenCooldownCut(cfg, awaken) {
  let c = 0;
  cfg.progression.awaken.slice(0, awaken).forEach((a) => (c += a.cd || 0));
  return c;
}

export function statsFor(ctx, id, level = 1, awaken = 0) {
  const c = ctx.characters[id];
  if (!c) throw new Error('unknown character ' + id);
  if (!ctx.config.progression) return { hp: c.hp, atk: c.atk, heal: c.heal };
  const k = levelMult(ctx.config, level) * (1 + awakenStatBonus(ctx.config, awaken));
  return { hp: Math.round(c.hp * k), atk: Math.round(c.atk * k), heal: Math.round(c.heal * k) };
}

export function skillCooldown(ctx, id, awaken = 0) {
  const base = ctx.characters[id].skill.cooldown;
  if (!ctx.config.progression) return base;
  return Math.max(ctx.config.progression.minCooldown, base - awakenCooldownCut(ctx.config, awaken));
}

export const normTeam = (team) => team.map((m) => (typeof m === 'string' ? { id: m, level: 1, awaken: 0 } : { level: 1, awaken: 0, ...m }));
