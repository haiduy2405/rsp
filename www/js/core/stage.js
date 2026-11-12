// Ải = một khu vực x một độ khó (Dễ -> Vừa -> Khó) x 7 ải nhỏ. Ải 7 là boss.
// Thắng hết 7 ải Dễ thì mở 7 ải Vừa và mở khu kế tiếp; hết 7 ải Vừa thì mở Khó. Sau khi mở, quay lại ải nào cũng được để farm.

export const diffOrder = (ctx) => ctx.config.difficulty.order;
export const stageCount = (ctx) => ctx.config.run.stages;

// Số lần thắng (tổng các ải) của một khu x độ khó.
export const clearsOf = (progress, zoneId, diff) => progress.clears[zoneId]?.[diff] ?? 0;

// Ải cao nhất đã qua (0..7) của khu x độ khó.
export const stagesDone = (progress, zoneId, diff) => progress.stages?.[zoneId]?.[diff] ?? 0;

// Đã qua hết 7 ải của khu x độ khó chưa.
export const tierDone = (ctx, progress, zoneId, diff) => stagesDone(progress, zoneId, diff) >= stageCount(ctx);

// Độ khó đã mở (chưa nói tới ải): Dễ luôn mở nếu khu mở; Vừa/Khó cần xong 7 ải của độ khó trước.
export function tierOpen(ctx, progress, zoneId, diff) {
  if (!progress.unlocked.includes(zoneId)) return false;
  const i = diffOrder(ctx).indexOf(diff);
  if (i < 0) return false;
  return i === 0 || tierDone(ctx, progress, zoneId, diffOrder(ctx)[i - 1]);
}

// Ải n (1..7) mở khi độ khó mở và đã qua ải n-1.
export function stageOpen(ctx, progress, zoneId, diff, stage = 1) {
  if (!Number.isInteger(stage) || stage < 1 || stage > stageCount(ctx)) return false;
  return tierOpen(ctx, progress, zoneId, diff) && stage <= stagesDone(progress, zoneId, diff) + 1;
}

// Tổng số lần thắng một khu, mọi độ khó.
export const zoneClears = (progress, zoneId) => Object.values(progress.clears[zoneId] ?? {}).reduce((a, n) => a + n, 0);
