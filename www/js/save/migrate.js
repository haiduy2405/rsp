// Nâng cấp dữ liệu lưu qua các phiên bản. Hàm thuần, không đụng DOM hay lưu trữ.
// v1 (giả lập, dạng phẳng): { version:1, gold, essence, spirit, shards, stones:{0..5: số}, clears:{zoneId:n}, team }
// v2: Tinh Thạch tách Thường/Hiếm, có unlocked, pity, stats.
// v3: thêm characters (level, awaken); xem core/progress.js.
import { SAVE_VERSION, DEFAULT_TEAM } from '../core/progress.js';

const steps = {
  1(data, ctx) {
    const stones = {};
    for (let e = 0; e < 6; e++) stones[e] = { normal: Math.max(0, Math.floor(Number(data.stones?.[e]) || 0)), rare: 0 };
    const clears = data.clears || {};
    const unlocked = [ctx.zoneList[0].id];
    for (const z of ctx.zoneList) {
      if (clears[z.id] > 0 && ctx.zoneList[z.order + 1] && !unlocked.includes(ctx.zoneList[z.order + 1].id))
        unlocked.push(ctx.zoneList[z.order + 1].id);
    }
    const wins = Object.values(clears).reduce((a, n) => a + n, 0);
    return {
      version: 2,
      inventory: {
        gold: data.gold || 0,
        essence: data.essence || 0,
        spirit: data.spirit || 0,
        shards: data.shards || 0,
        stones,
      },
      unlocked,
      clears,
      pity: {},
      stats: { runs: wins, wins, losses: 0 },
      team: Array.isArray(data.team) && data.team.length === 5 ? data.team : ['demo_thuy', 'demo_hoa', 'demo_moc', 'demo_quang', 'demo_tim'],
    };
  },
  2(data) {
    // Đội cũ dùng nhân vật mẫu không còn trong roster: chuyển sang đội khởi đầu.
    const out = { ...data, version: 3 };
    out.characters = Object.fromEntries(DEFAULT_TEAM.map((id) => [id, { level: 1, awaken: 0 }]));
    out.team = DEFAULT_TEAM.slice();
    return out;
  },
};

export function migrate(data, fromVersion, ctx) {
  if (fromVersion > SAVE_VERSION) return null; // file từ bản game mới hơn
  let v = fromVersion;
  let cur = data;
  while (v < SAVE_VERSION) {
    if (!steps[v]) return null;
    cur = steps[v](cur, ctx);
    v += 1;
  }
  return cur;
}
