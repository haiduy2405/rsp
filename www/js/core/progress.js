import { newSummonState } from './summon.js';
import { newPlayer } from './onboarding.js';
import { mergeCounts } from './loot.js';
import { newCharacter, SKILL_KINDS } from './kit.js';
// Tiến trình người chơi (dữ liệu được lưu). Hàm thuần: nhận progress, trả progress mới.
export const SAVE_VERSION = 7;

export const DEFAULT_TEAM = ['thetis', 'bennu', 'atalanta', 'eos', 'eir'];

export function newProgress(ctx) {
  const stones = {};
  for (let e = 0; e < 6; e++) stones[e] = { normal: 0, rare: 0 };
  return {
    version: SAVE_VERSION,
    inventory: { gold: 0, essence: 0, spirit: 0, shards: 0, stones, fodder: {}, offerings: {} }, // essence = Bánh EXP; fodder = Tiểu Linh { 'hệ_sao': số }; offerings = Lễ Vật { 'tộc_bậc': số }
    unlocked: [ctx.zoneList[0].id],
    clears: {}, // { zoneId: { easy, normal, hard } } số lần thắng
    pity: {},
    stats: { runs: 0, wins: 0, losses: 0 },
    characters: Object.fromEntries(DEFAULT_TEAM.map((id) => [id, newCharacter()])),
    team: DEFAULT_TEAM.slice(),
    player: newPlayer(),
    onboarding: { done: false, tutorialDone: false },
    summon: newSummonState(),
    settings: { volume: 80 },
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
  if (!inv.fodder || Object.values(inv.fodder).some((n) => !Number.isInteger(n) || n < 0)) return false;
  if (!inv.offerings || Object.values(inv.offerings).some((n) => !Number.isInteger(n) || n < 0)) return false;
  if (!Array.isArray(p.unlocked) || p.unlocked.length === 0) return false;
  if (!p.clears || !p.pity || !p.stats) return false;
  if (!Array.isArray(p.team) || p.team.length !== 5) return false;
  const ids = p.team.filter((id) => id !== null);
  if (new Set(ids).size !== ids.length) return false;
  if (!p.characters || typeof p.characters !== 'object') return false;
  for (const c of Object.values(p.characters)) if (!Number.isInteger(c.level) || c.level < 1 || !Number.isInteger(c.exp) || c.exp < 0 || !Number.isInteger(c.awaken) || c.awaken < 0 || c.awaken > 5 || !c.skillLv || SKILL_KINDS.some((k) => !Number.isInteger(c.skillLv[k]) || c.skillLv[k] < 1)) return false;
  if (!ids.every((id) => p.characters[id])) return false;
  if (!p.player || typeof p.player.name !== 'string' || !p.onboarding || typeof p.onboarding.done !== 'boolean') return false;
  const sm = p.summon;
  if (!sm || !Number.isInteger(sm.pity5) || !Number.isInteger(sm.pity4) || !Number.isInteger(sm.pulls) || !Array.isArray(sm.history)) return false;
  if (!p.settings || typeof p.settings.volume !== 'number') return false;
  return true;
}

// Cộng kết quả một chuyến đã kết thúc vào tiến trình. Thắng Dễ mở khu kế tiếp, thắng độ khó nào thì mở độ khó sau của khu đó (xem core/stage.js).
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
  inv.fodder = mergeCounts(inv.fodder, run.loot.fodder);
  inv.offerings = mergeCounts(inv.offerings, run.loot.offerings);
  p.pity[run.zoneId] = run.rareMissed;
  p.stats.runs += 1;
  if (run.result === 'won') {
    p.stats.wins += 1;
    const c = (p.clears[run.zoneId] ??= {});
    c[run.diff] = (c[run.diff] || 0) + 1;
    const next = ctx.zoneList[zone.order + 1];
    if (run.diff === ctx.config.difficulty.order[0] && next && !p.unlocked.includes(next.id)) p.unlocked.push(next.id); // thắng Dễ mở khu kế
  } else {
    p.stats.losses += 1;
  }
  return p;
}
