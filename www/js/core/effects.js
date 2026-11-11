// Khung hiệu ứng. M1 chỉ lưu danh sách hiệu ứng trên đơn vị và đếm lùi thời lượng.
// M3 sẽ đăng ký 12 từ khóa (xem docs/EFFECTS.md) vào effectHandlers.
// Dạng hiệu ứng: { key, turns, value }.
export const effectHandlers = {};

export function addEffect(unit, effect) {
  unit.effects.push({ key: effect.key, turns: effect.turns, value: effect.value ?? 0 });
}

// Gọi cuối lượt cho mỗi đơn vị; trả về các sự kiện do handler tạo ra.
export function tickEffects(unit, ctxInfo) {
  const events = [];
  for (const e of unit.effects) {
    const h = effectHandlers[e.key];
    if (h && h.onTurnEnd) events.push(...(h.onTurnEnd(unit, e, ctxInfo) || []));
    e.turns -= 1;
  }
  unit.effects = unit.effects.filter((e) => e.turns > 0);
  return events;
}
