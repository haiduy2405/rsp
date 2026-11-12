// Nâng cấp dữ liệu lưu qua các phiên bản. Hàm thuần, không đụng DOM hay lưu trữ.
// v1 (giả lập, dạng phẳng): { version:1, gold, essence, spirit, shards, stones:{0..5: số}, clears:{zoneId:n}, team }
// v2: Tinh Thạch tách Thường/Hiếm, có unlocked, pity, stats.
// v3: thêm characters (level, awaken).
// v4: thêm player, onboarding, summon, settings; xem core/progress.js.
// v5: clears theo độ khó { zoneId: { easy, normal, hard } }.
// v6: EXP (characters[id].exp), Tiểu Linh (inventory.fodder).
// v7: skillLv, Lễ Vật. v8: Thức tỉnh một bậc (Form 2). v9: Đan Tinh Hoa 3 bậc, Vé Triệu Hồi, Vàng ×10. v10: mảnh ghép, Vé Triệu Linh, shop ngày.
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
  3(data) {
    // v4: người chơi, onboarding, triệu hồi, cài đặt. Ai đã chơi rồi thì coi như xong onboarding.
    const played = (data.stats?.runs || 0) > 0;
    return {
      ...data,
      version: 4,
      player: { name: '', callsign: '', hometown: '', avatar: 0, culture: null },
      onboarding: { done: played, tutorialDone: played },
      summon: { pity5: 0, pity4: 0, pulls: 0, firstDone: false, freeDay: -1, history: [] },
      settings: { volume: 80 },
    };
  },
  4(data) {
    // Các lần thắng cũ tính vào độ khó Dễ.
    const clears = {};
    for (const [zone, n] of Object.entries(data.clears || {})) clears[zone] = { easy: n };
    return { ...data, version: 5, clears };
  },
  5(data) {
    const characters = Object.fromEntries(Object.entries(data.characters).map(([id, c]) => [id, { ...c, exp: 0 }]));
    return { ...data, version: 6, characters, inventory: { ...data.inventory, fodder: {} } };
  },
  6(data) {
    // v7: cấp kỹ năng và Lễ Vật.
    const characters = Object.fromEntries(Object.entries(data.characters).map(([id, c]) => [id, { ...c, skillLv: { active: 1, leader: 1, passive: 1 } }]));
    return { ...data, version: 7, characters, inventory: { ...data.inventory, offerings: {} } };
  },
  7(data) {
    // v8: Thức tỉnh còn một bậc (Form 2). Ai đã thức tỉnh hoặc vượt cấp 30 thì lên thẳng Form 2.
    const characters = Object.fromEntries(Object.entries(data.characters).map(([id, c]) => [id, { ...c, awaken: c.awaken > 0 || c.level > 30 ? 1 : 0 }]));
    return { ...data, version: 8, characters };
  },
  8(data) {
    // v9: Bánh EXP cũ (1 = 1 EXP) đổi thành Đan bậc 1 (100 EXP/viên); Vàng nhân 10 theo thang mới; Linh Thạch giữ nguyên, chưa có Vé.
    const { essence = 0, ...inv } = data.inventory;
    return { ...data, version: 9, inventory: { ...inv, gold: (inv.gold || 0) * 10, elixir: { 1: Math.floor(essence / 100), 2: 0, 3: 0 }, tickets: 0 } };
  },
  9(data) {
    // v10: mảnh ghép (riêng/chung), Vé Triệu Linh, cửa hàng hằng ngày.
    return { ...data, version: 10, inventory: { ...data.inventory, soulTickets: 0, generic: { 3: 0, 4: 0, 5: 0 }, fragments: {} }, shop: { day: -1, offers: [], bought: {} } };
  },
  10(data, ctx) {
    // v11: 7 ải nhỏ mỗi độ khó. Đã thắng một độ khó (cũ) thì coi như xong cả 7 ải của độ khó đó.
    const n = ctx?.config?.run?.stages ?? 7;
    const stages = {};
    for (const [zone, byDiff] of Object.entries(data.clears || {})) stages[zone] = Object.fromEntries(Object.entries(byDiff).filter(([, c]) => c > 0).map(([d]) => [d, n]));
    return { ...data, version: 11, stages };
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
