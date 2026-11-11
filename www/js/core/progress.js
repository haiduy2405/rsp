// Tiến trình người chơi (dữ liệu được lưu). Hàm thuần: nhận progress, trả progress mới.
export const SAVE_VERSION = 3;

export const DEFAULT_TEAM = ['thetis', 'bennu', 'atalanta', 'eos', 'eir'];

export function newProgress(ctx) {
  const stones = {};
  for (let e = 0; e < 6; e++) stones[e] = { normal: 0, rare: 0 };
  return {
    version: SAVE_VERSION,
    inventory: { gold: 0, essence: 0, spirit: 0, shards: 0, stones },
    unlocked: [ctx.zoneList[0].id],
    clears: {},
    pity: {},
    stats: { runs: 0, wins: 0, losses: 0 },
    characters: Object.fromEntries(DEFAULT_TEAM.map((id) => [id, { level: 1, awaken: 0 }])),
    team: DEFAULT_TEAM.slice(),
  };
}

export function isValidProgress(p) {
  if (!p || typeof p !== 'object' || p.version !== SAVE_VERSION) return false;
  const inv = p.inventory;
  if (!inv || typeof inv.gold !== 'number' || typeof inv.essence !== 'number') return false;
  if (typeof inv.spirit !== 'number' || typeof inv.shards !== 'number' || !inv.stones) return false;
  for (let e = 0; e < 6; e++) {
    const s = inv.stones[e];
    if (!s || !Number.isInteger(s.normal) || !Number.isInteger(s.rare) || s.normal < 0 || s.rare < 0) return false;
  }
  if (!Array.isArray(p.unlocked) || p.unlocked.length === 0) return false;
  if (!p.clears || !p.pity || !p.stats) return false;
  if (!Array.isArray(p.team) || p.team.length !== 5 || new Set(p.team).size !== 5) return false;
  if (!p.characters || typeof p.characters !== 'object') return false;
  for (const c of Object.values(p.characters)) if (!Number.isInteger(c.level) || c.level < 1 || !Number.isInteger(c.awaken) || c.awaken < 0 || c.awaken > 5) return false;
  if (!p.team.every((id) => p.characters[id])) return false;
  return true;
}

// Cộng kết quả một chuyến đã kết thúc vào tiến trình. Thắng mở khu kế tiếp.
export function applyRunResult(ctx, progress, run) {
  if (run.phase !== 'end') throw new Error('run chưa kết thúc');
  const p = structuredClone(progress);
  const zone = ctx.zones[run.zoneId];
  const inv = p.inventory;
  inv.gold += run.loot.gold;
  inv.essence += run.loot.essence;
  inv.spirit += run.loot.spirit;
  inv.shards += run.loot.shards;
  inv.stones[zone.element].normal += run.loot.stones.normal;
  inv.stones[zone.element].rare += run.loot.stones.rare;
  p.pity[run.zoneId] = run.rareMissed;
  p.stats.runs += 1;
  if (run.result === 'won') {
    p.stats.wins += 1;
    p.clears[run.zoneId] = (p.clears[run.zoneId] || 0) + 1;
    const next = ctx.zoneList[zone.order + 1];
    if (next && !p.unlocked.includes(next.id)) p.unlocked.push(next.id);
  } else {
    p.stats.losses += 1;
  }
  return p;
}
