// Nhiệm vụ hằng ngày: bộ nhiệm vụ sinh xác định theo ngày (config.quests), reset khi sang ngày mới.
// Trạng thái lưu: progress.quests = { day, list: [{ id, kind, goal, count, claimed, reward }], bonusClaimed }. Trường này tùy chọn (tự tạo khi cần), nên không đổi SAVE_VERSION.
import { mulberry32 } from './rng.js';

const fail = (reason) => ({ ok: false, reason });
const valid = (q, dayKey) => q && q.day === dayKey && Array.isArray(q.list) && q.list.length > 0;

export function rollDaily(ctx, dayKey) {
  const cfg = ctx.config.quests;
  const rng = mulberry32((Math.imul(dayKey, 2654435761) ^ 0x0e57) >>> 0);
  const byKind = Object.fromEntries(cfg.pool.map((q) => [q.kind, q]));
  const fixed = cfg.daily.fixed.map((k) => byKind[k]).filter(Boolean);
  const rest = cfg.pool.filter((q) => !cfg.daily.fixed.includes(q.kind));
  for (let i = rest.length - 1; i > 0; i--) { const j = rng.int(i + 1); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...fixed, ...rest.slice(0, cfg.daily.pick)].map((q) => ({ id: q.kind, kind: q.kind, goal: q.goal, count: 0, claimed: false, reward: { ...q.reward } }));
}

// Đảm bảo bộ nhiệm vụ đã sang ngày `dayKey`.
export function ensureQuests(ctx, progress, dayKey) {
  if (valid(progress.quests, dayKey)) return progress;
  const p = structuredClone(progress);
  p.quests = { day: dayKey, list: rollDaily(ctx, dayKey), bonusClaimed: false };
  return p;
}

// Cộng tiến độ cho mọi nhiệm vụ cùng loại (không vượt mục tiêu). Trả về progress mới (hoặc chính nó nếu không đổi).
export function trackQuest(ctx, progress, dayKey, kind, n = 1) {
  const p = ensureQuests(ctx, progress, dayKey);
  if (!p.quests.list.some((q) => q.kind === kind && q.count < q.goal)) return p;
  const out = structuredClone(p);
  for (const q of out.quests.list) if (q.kind === kind) q.count = Math.min(q.goal, q.count + n);
  return out;
}

export const isDone = (q) => q.count >= q.goal;
export const allClaimed = (p) => p.quests.list.every((q) => q.claimed);

function give(p, reward) {
  const inv = p.inventory;
  inv.spirit += reward.spirit || 0;
  inv.gold += reward.gold || 0;
  inv.tickets += reward.tickets || 0;
}

export function claimQuest(ctx, progress, dayKey, id) {
  const base = ensureQuests(ctx, progress, dayKey);
  const q0 = base.quests.list.find((q) => q.id === id);
  if (!q0) return fail('no_quest');
  if (q0.claimed) return fail('claimed');
  if (!isDone(q0)) return fail('not_ready');
  const p = structuredClone(base);
  const q = p.quests.list.find((x) => x.id === id);
  q.claimed = true;
  give(p, q.reward);
  return { ok: true, progress: p, reward: q.reward };
}

export function claimBonus(ctx, progress, dayKey) {
  const base = ensureQuests(ctx, progress, dayKey);
  if (base.quests.bonusClaimed) return fail('claimed');
  if (!allClaimed(base)) return fail('not_ready');
  const p = structuredClone(base);
  p.quests.bonusClaimed = true;
  give(p, ctx.config.quests.bonus);
  return { ok: true, progress: p, reward: ctx.config.quests.bonus };
}

// Còn gì để nhận? (chấm đỏ ở nút Nhiệm vụ)
export function hasClaimable(ctx, progress, dayKey) {
  const p = ensureQuests(ctx, progress, dayKey);
  return p.quests.list.some((q) => isDone(q) && !q.claimed) || (allClaimed(p) && !p.quests.bonusClaimed);
}
