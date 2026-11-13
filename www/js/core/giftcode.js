// Mã quà tặng: bảng mã nằm trong config.giftcodes { mã_thường: { once, gold, spirit, tickets } }.
// Đã dùng lưu ở progress.redeemed (mảng mã, tùy chọn, không đổi SAVE_VERSION). Chỉ kiểm tra phía máy khách, dùng cho thử nghiệm.
export function redeemGift(ctx, progress, input) {
  const code = String(input || '').trim().toLowerCase();
  const def = code && Object.hasOwn(ctx.config.giftcodes || {}, code) ? ctx.config.giftcodes[code] : null;
  if (!def) return { ok: false, reason: 'invalid' };
  const used = progress.redeemed || [];
  if (def.once !== false && used.includes(code)) return { ok: false, reason: 'used' };
  const p = structuredClone(progress);
  p.inventory.gold += def.gold || 0;
  p.inventory.spirit += def.spirit || 0;
  p.inventory.tickets += def.tickets || 0;
  p.redeemed = [...used, code];
  return { ok: true, progress: p, reward: { gold: def.gold || 0, spirit: def.spirit || 0, tickets: def.tickets || 0 } };
}
