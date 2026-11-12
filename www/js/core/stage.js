// Ải = một khu vực x một độ khó (Dễ -> Vừa -> Khó). Đánh thắng độ khó trước thì mở độ khó sau.
// Thắng Dễ cũng mở khu kế tiếp. Sau khi mở hết, người chơi quay lại bất kỳ ải nào để farm.

export const diffOrder = (ctx) => ctx.config.difficulty.order;

export const clearsOf = (progress, zoneId, diff) => progress.clears[zoneId]?.[diff] ?? 0;

export function stageOpen(ctx, progress, zoneId, diff) {
  if (!progress.unlocked.includes(zoneId)) return false;
  const i = diffOrder(ctx).indexOf(diff);
  if (i < 0) return false;
  return i === 0 || clearsOf(progress, zoneId, diffOrder(ctx)[i - 1]) > 0;
}

// Tổng số lần thắng một khu, mọi độ khó.
export const zoneClears = (progress, zoneId) => Object.values(progress.clears[zoneId] ?? {}).reduce((a, n) => a + n, 0);
