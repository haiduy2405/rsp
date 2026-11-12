// Thành tựu: mốc dài hạn, mỗi thành tựu nhiều bậc (config.achievements). Giá trị đo suy ra từ tiến trình sẵn có (trừ `battles` là bộ đếm riêng).
// Trạng thái lưu: progress.achv = { [id]: số bậc đã nhận } và progress.stats.battles. Cả hai tùy chọn (tự tạo), không đổi SAVE_VERSION.
const fail = (reason) => ({ ok: false, reason });
const ZONE_DONE = 7;

export function metric(ctx, p, key) {
  const chars = Object.entries(p.characters || {});
  switch (key) {
    case 'wins': return p.stats?.wins || 0;
    case 'battles': return p.stats?.battles || 0;
    case 'pulls': return p.summon?.pulls || 0;
    case 'heroes': return chars.length;
    case 'maxLevel': return chars.reduce((m, [, c]) => Math.max(m, c.level), 0);
    case 'awakened': return chars.filter(([, c]) => c.awaken > 0).length;
    case 'fiveStar': return chars.filter(([id]) => ctx.characters[id]?.rarity === 5).length;
    case 'zonesEasy': return Object.values(p.stages || {}).filter((s) => (s.easy || 0) >= ZONE_DONE).length;
    case 'zonesHard': return Object.values(p.stages || {}).filter((s) => (s.hard || 0) >= ZONE_DONE).length;
    default: return 0;
  }
}

// Cộng bộ đếm trận thắng (trả progress mới).
export function bumpBattles(progress, n = 1) {
  const p = structuredClone(progress);
  p.stats.battles = (p.stats.battles || 0) + n;
  return p;
}

// Danh sách thành tựu kèm trạng thái: bậc đã nhận, giá trị hiện tại, bậc kế (null nếu đã hết).
export function listAchievements(ctx, p) {
  return ctx.config.achievements.map((a) => {
    const claimed = Math.min(a.tiers.length, p.achv?.[a.id] || 0);
    const value = metric(ctx, p, a.metric);
    const next = a.tiers[claimed] || null;
    return { id: a.id, metric: a.metric, tiers: a.tiers, claimed, value, next, ready: !!next && value >= next.goal };
  });
}

export function claimAchievement(ctx, progress, id) {
  const a = listAchievements(ctx, progress).find((x) => x.id === id);
  if (!a) return fail('no_quest');
  if (!a.next) return fail('claimed');
  if (!a.ready) return fail('not_ready');
  const p = structuredClone(progress);
  p.achv = { ...(p.achv || {}), [id]: a.claimed + 1 };
  const r = a.next.reward;
  p.inventory.spirit += r.spirit || 0;
  p.inventory.gold += r.gold || 0;
  p.inventory.tickets += r.tickets || 0;
  return { ok: true, progress: p, reward: r, tier: a.claimed + 1 };
}

export const hasAchvClaimable = (ctx, p) => listAchievements(ctx, p).some((a) => a.ready);
