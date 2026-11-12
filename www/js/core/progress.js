import { newSummonState } from './summon.js';
import { newPlayer } from './onboarding.js';
import { mergeCounts } from './loot.js';
import { newCharacter, SKILL_KINDS } from './kit.js';
import { grantExp } from './upgrade.js';
import { newShopState } from './shop.js';
import { addFragments } from './fragments.js';
// Tiến trình người chơi (dữ liệu được lưu). Hàm thuần: nhận progress, trả progress mới.
export const SAVE_VERSION = 12;

// Linh Thạch thưởng lần clear đầu tiên của một độ khó trong khu (cả 7 ải): gốc theo độ khó, tăng theo khu (config.firstClear).
export function firstClearSpirit(ctx, zoneId, diff) {
  const f = ctx.config.firstClear;
  return Math.round(f.spirit[diff] * (1 + f.zoneGrowth * ctx.zones[zoneId].order));
}
// Phần Linh Thạch của từng ải nhỏ: chia theo stageReward (ải boss nhiều nhất), tổng 7 ải = firstClearSpirit.
export function firstClearStageSpirit(ctx, zoneId, diff, stage) {
  const w = ctx.config.run.stageReward;
  return Math.round((firstClearSpirit(ctx, zoneId, diff) * w[stage - 1]) / w.reduce((a, x) => a + x, 0));
}

export const DEFAULT_TEAM = ['thetis', 'bennu', 'atalanta', 'eos', 'eir'];

export function newProgress(ctx) {
  const stones = {};
  for (let e = 0; e < 6; e++) stones[e] = { normal: 0, rare: 0 };
  return {
    version: SAVE_VERSION,
    inventory: { gold: 0, elixir: { 1: 0, 2: 0, 3: 0 }, tickets: 0, soulTickets: 0, generic: { 3: 0, 4: 0, 5: 0 }, fragments: {}, spirit: 0, shards: 0, stones, fodder: {}, offerings: {} }, // elixir = Đan Tinh Hoa { bậc: số } (EXP cố định mỗi viên); tickets = Vé Triệu Hồi; spirit = Linh Thạch (đổi vé); fodder = Tiểu Linh { 'hệ_sao': số }; offerings = Lễ Vật { 'tộc_bậc': số }
    unlocked: [ctx.zoneList[0].id],
    clears: {}, // { zoneId: { easy, normal, hard } } số lần thắng
    stages: {}, // { zoneId: { easy, normal, hard } } ải cao nhất đã qua (0..7)
    pity: {},
    stats: { runs: 0, wins: 0, losses: 0 },
    characters: Object.fromEntries(DEFAULT_TEAM.map((id) => [id, newCharacter()])),
    team: DEFAULT_TEAM.slice(),
    player: newPlayer(),
    onboarding: { done: false, tutorialDone: false, starterDone: false },
    summon: newSummonState(),
    shop: newShopState(),
    settings: { volume: 80 },
  };
}

export function isValidProgress(p) {
  if (!p || typeof p !== 'object' || p.version !== SAVE_VERSION) return false;
  const inv = p.inventory;
  if (!inv || typeof inv.gold !== 'number' || !inv.elixir || Object.values(inv.elixir).some((n) => !Number.isInteger(n) || n < 0) || !Number.isInteger(inv.tickets) || inv.tickets < 0 || !Number.isInteger(inv.soulTickets) || inv.soulTickets < 0) return false;
  if (!inv.generic || [3, 4, 5].some((s) => !Number.isInteger(inv.generic[s]) || inv.generic[s] < 0)) return false;
  if (!inv.fragments || Object.values(inv.fragments).some((n) => !Number.isInteger(n) || n < 0)) return false;
  if (!p.shop || !Number.isInteger(p.shop.day) || !Array.isArray(p.shop.offers) || !p.shop.bought) return false;
  if (typeof inv.spirit !== 'number' || typeof inv.shards !== 'number' || !inv.stones) return false;
  for (let e = 0; e < 6; e++) {
    const s = inv.stones[e];
    if (!s || !Number.isInteger(s.normal) || !Number.isInteger(s.rare) || s.normal < 0 || s.rare < 0) return false;
  }
  if (!inv.fodder || Object.values(inv.fodder).some((n) => !Number.isInteger(n) || n < 0)) return false;
  if (!inv.offerings || Object.values(inv.offerings).some((n) => !Number.isInteger(n) || n < 0)) return false;
  if (!Array.isArray(p.unlocked) || p.unlocked.length === 0) return false;
  if (!p.clears || !p.stages || !p.pity || !p.stats) return false;
  if (!Array.isArray(p.team) || p.team.length !== 5) return false;
  const ids = p.team.filter((id) => id !== null);
  if (new Set(ids).size !== ids.length) return false;
  if (!p.characters || typeof p.characters !== 'object') return false;
  for (const c of Object.values(p.characters)) if (!Number.isInteger(c.level) || c.level < 1 || !Number.isInteger(c.exp) || c.exp < 0 || !Number.isInteger(c.awaken) || c.awaken < 0 || c.awaken > 1 || !c.skillLv || SKILL_KINDS.some((k) => !Number.isInteger(c.skillLv[k]) || c.skillLv[k] < 1)) return false;
  if (!ids.every((id) => p.characters[id])) return false;
  if (!p.player || typeof p.player.name !== 'string' || !p.onboarding || typeof p.onboarding.done !== 'boolean') return false;
  const sm = p.summon;
  if (!sm || !Number.isInteger(sm.pity5) || !Number.isInteger(sm.pity4) || !Number.isInteger(sm.pulls) || !Array.isArray(sm.history)) return false;
  if (!p.settings || typeof p.settings.volume !== 'number') return false;
  return true;
}

// Cộng kết quả một chuyến (một ải nhỏ) vào tiến trình. Qua ải n mở ải n+1; xong 7 ải Dễ mở khu kế, xong 7 ải của độ khó nào mở độ khó sau (xem core/stage.js).
export function applyRunResult(ctx, progress, run) {
  if (run.phase !== 'end') throw new Error('run chưa kết thúc');
  const p = structuredClone(progress);
  const zone = ctx.zones[run.zoneId];
  const inv = p.inventory;
  inv.gold += run.loot.gold;
  for (const t of [1, 2, 3]) inv.elixir[t] += run.loot.elixir[t];
  inv.shards += run.loot.shards;
  inv.stones[zone.element].normal += run.loot.stones.normal;
  inv.stones[zone.element].rare += run.loot.stones.rare;
  inv.fodder = mergeCounts(inv.fodder, run.loot.fodder);
  inv.offerings = mergeCounts(inv.offerings, run.loot.offerings);
  for (const [id, n] of Object.entries(run.loot.fragments || {})) addFragments(ctx, p, id, n);
  for (const id of p.team) if (id) grantExp(ctx, p.characters[id], id, run.heroExp); // EXP cố định sau trận, cả khi thua
  p.pity[run.zoneId] = run.rareMissed;
  p.stats.runs += 1;
  if (run.result === 'won') {
    p.stats.wins += 1;
    const c = (p.clears[run.zoneId] ??= {});
    c[run.diff] = (c[run.diff] || 0) + 1;
    const stage = run.stage ?? 1;
    const sg = (p.stages[run.zoneId] ??= {});
    if (stage > (sg[run.diff] || 0)) {
      inv.spirit += firstClearStageSpirit(ctx, run.zoneId, run.diff, stage); // Linh Thạch chỉ tặng lần qua ải đầu tiên (khu × độ khó × ải)
      sg[run.diff] = stage;
    }
    const next = ctx.zoneList[zone.order + 1];
    if (run.diff === ctx.config.difficulty.order[0] && sg[run.diff] >= ctx.config.run.stages && next && !p.unlocked.includes(next.id)) p.unlocked.push(next.id); // xong 7 ải Dễ mở khu kế
  } else {
    p.stats.losses += 1;
  }
  return p;
}
