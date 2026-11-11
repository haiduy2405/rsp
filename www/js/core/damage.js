import { ORB_HEART } from './board.js';

// Hệ số khắc: Thủy>Hỏa>Mộc>Thủy, Quang<->Ám. Bảng nằm trong config.advantage.
export function elementMultiplier(att, def, cfg) {
  const adv = cfg.advantage;
  if ((adv[att] || []).includes(def)) return cfg.elementMult.strong;
  if ((adv[def] || []).includes(att)) return cfg.elementMult.weak;
  return 1;
}

export function comboMultiplier(n, cfg) {
  return 1 + cfg.combo.step * (n - 1);
}

// Giá trị cơ sở của một nhóm ngọc (chưa tính chỉ số nhân vật).
export function groupFactor(group, cfg) {
  const size = 1 + cfg.group.sizeBonus * (group.size - 3);
  const enh = 1 + cfg.group.enhancedBonus * group.enhCount;
  const four = group.size >= 4 ? cfg.group.fourOrbBoost : 1;
  return size * enh * four;
}

export function isHeal(group) {
  return group.type === ORB_HEART;
}
