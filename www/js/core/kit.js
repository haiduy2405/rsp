// Bộ kỹ năng của một tướng sau khi áp Form và cấp kỹ năng: kỹ năng chủ động, đội trưởng, bị động.
// Hàm thuần. Hằng số nằm trong config.skillUp; dữ liệu từng tướng nằm trong characters.json.
export const SKILL_KINDS = ['active', 'leader', 'passive'];

export const maxSkillLevel = (ctx, id) => ctx.config.skillUp.levels[ctx.characters[id].rarity];
export const newSkillLevels = () => ({ active: 1, leader: 1, passive: 1 });
// Hồ sơ một tướng mới nhận.
// Form của nhân vật theo bậc Thức tỉnh: chưa thức tỉnh = Form 1, đã thức tỉnh = Form 2.
export const formOf = (awaken) => (awaken >= 1 ? 2 : 1);
export const newCharacter = () => ({ level: 1, awaken: 0, exp: 0, skillLv: newSkillLevels() });

const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;

// k = hệ số tăng theo cấp (1 ở cấp 1).
function scaleUnit(u, k) {
  const o = { ...u };
  if (o.type === 'damage') o.mult = r2(o.mult * k);
  else if (o.type === 'heal') o.pctMax = r3(o.pctMax * k);
  else if (o.type === 'convert' || o.type === 'enhance') o.count = Math.max(o.count, Math.round(o.count * k));
  else if (o.type === 'applyEffect' && typeof o.value === 'number') o.value = r3(o.value * k);
  return o;
}

const lvK = (ctx, lv) => 1 + ctx.config.skillUp.perLevel * (lv - 1);

// Nguồn kỹ năng theo Form: Form 2 ghi đè các trường có trong `form2`.
function source(ctx, id, form) {
  const c = ctx.characters[id];
  return form >= 2 && c.form2 ? { ...c, ...c.form2 } : c;
}

export function resolveKit(ctx, id, skillLv = newSkillLevels(), form = 1) {
  const c = ctx.characters[id];
  const src = source(ctx, id, form);
  const max = maxSkillLevel(ctx, id);
  const kit = { skill: null, leader: null, passive: null };
  if (src.skill) {
    const lv = skillLv.active;
    const cut = lv >= max ? ctx.config.skillUp.maxCooldownCut : 0;
    kit.skill = {
      cooldown: Math.max(ctx.config.progression.minCooldown, src.skill.cooldown - cut),
      startCooldown: src.skill.startCooldown ?? 0,
      units: src.skill.units.map((u) => scaleUnit(u, lvK(ctx, lv))),
    };
  }
  if (src.leader) {
    const lv = skillLv.leader;
    const k = lvK(ctx, lv);
    const l = { ...src.leader };
    if (typeof l.pct === 'number') l.pct = r3(l.pct * k);
    if (typeof l.ms === 'number') l.ms = Math.round(l.ms * k);
    if (typeof l.mult === 'number') l.mult = r2(1 + (l.mult - 1) * k);
    kit.leader = l;
  }
  if (src.passive) {
    const lv = skillLv.passive;
    const k = lvK(ctx, lv);
    const p = { ...src.passive };
    if (p.kind === 'stat') p.pct = r3(p.pct * k);
    else p.units = p.units.map((u) => scaleUnit(u, k));
    kit.passive = p;
  }
  return kit;
}
