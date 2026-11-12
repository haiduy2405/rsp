import { newCharacter } from './kit.js';
// Nghi Thức Triệu Hồi. Thuần, xác định theo seed. Số liệu ở config.summon và banners.json.
// Trạng thái summon: { pity5, pity4, pulls, firstDone, freeDay, history[] }
//   pity5 = số lượt liên tiếp chưa ra 5★; pity4 = số lượt liên tiếp chưa ra từ 4★ trở lên.
import { mulberry32 } from './rng.js';
import { grantCharacter } from './upgrade.js';

export const newSummonState = () => ({ pity5: 0, pity4: 0, pulls: 0, firstDone: false, freeDay: -1, history: [] });

const pickFrom = (rng, list) => list[rng.int(list.length)];

// Độ hiếm của một lượt thường. 5★ chắc chắn ở lượt thứ pity5; từ 4★ trở lên chắc chắn ở lượt thứ guarantee4Every.
export function rollRarity(cfg, st, rng) {
  const s = cfg.summon;
  const r5 = s.rates['5'];
  const r4 = s.rates['4'];
  const x = rng.next();
  if (st.pity5 + 1 >= s.pity5) return 5;
  if (st.pity4 + 1 >= s.guarantee4Every) return x < r5 / (r5 + r4) ? 5 : 4;
  if (x < r5) return 5;
  if (x < r5 + r4) return 4;
  return 3;
}

function pickCharacter(ctx, banner, rarity, rng) {
  const all = ctx.characterList.filter((c) => c.rarity === rarity && !c.reserve);
  if (banner?.culture && banner.rateUp > 0) {
    const pool = all.filter((c) => c.culture === banner.culture);
    if (pool.length && rng.next() < banner.rateUp) return pickFrom(rng, pool).id;
  }
  return pickFrom(rng, all).id;
}

// Một lượt, sửa trực tiếp st (dùng cho mô phỏng và cho summon()). Trả về { id, rarity, forced }.
export function rollPull(ctx, st, banner, rng, culture) {
  st.pulls += 1;
  // Tín Vật: lượt đầu tiên chắc chắn 4★ của nền văn hóa đã chọn, tách biệt với pity.
  if (!st.firstDone && culture) {
    st.firstDone = true;
    const pool = ctx.characterList.filter((c) => c.rarity === 4 && c.culture === culture && !c.reserve);
    if (pool.length) return { id: pickFrom(rng, pool).id, rarity: 4, forced: true };
  }
  const rarity = rollRarity(ctx.config, st, rng);
  if (rarity === 5) {
    st.pity5 = 0;
    st.pity4 = 0;
  } else if (rarity === 4) {
    st.pity5 += 1;
    st.pity4 = 0;
  } else {
    st.pity5 += 1;
    st.pity4 += 1;
  }
  return { id: pickCharacter(ctx, banner, rarity, rng), rarity, forced: false };
}

const fail = (reason) => ({ ok: false, reason });

// params: { bannerId, count, free, dayKey, seed }. Chi phí = Vé Triệu Hồi (inventory.tickets), 1 vé mỗi lượt.
export function summon(ctx, progress, { bannerId, count, free = false, dayKey, seed }) {
  const cfg = ctx.config.summon;
  const banner = ctx.banners[bannerId];
  if (!banner) return fail('unknown_banner');
  if (!(count === 1 || count === cfg.multiCount)) return fail('bad_count');
  const st0 = progress.summon;
  let cost = cfg.ticketsPerPull * count;
  if (free) {
    if (count !== 1) return fail('bad_count');
    if (st0.freeDay === dayKey) return fail('free_used');
    cost = 0;
  }
  if (progress.inventory.tickets < cost) return fail('not_enough_tickets');
  let p = structuredClone(progress);
  const st = p.summon;
  p.inventory.tickets -= cost;
  if (free) st.freeDay = dayKey;
  const rng = mulberry32(seed);
  const results = [];
  for (let i = 0; i < count; i++) {
    const pull = rollPull(ctx, st, banner, rng, p.player.culture);
    const g = grantCharacter(ctx, p, pull.id);
    p = g.progress;
    p.summon = st; // grantCharacter clone giữ nguyên state đã sửa
    results.push({ id: pull.id, rarity: pull.rarity, isNew: !g.duplicate, shards: g.shards, forced: pull.forced });
    st.history.push({ n: st.pulls, id: pull.id, rarity: pull.rarity, banner: bannerId, day: dayKey });
  }
  if (st.history.length > cfg.historyMax) st.history.splice(0, st.history.length - cfg.historyMax);
  return { ok: true, progress: p, results, cost, free };
}

// Mua Vé Triệu Hồi bằng Linh Thạch theo gói (config.summon.ticketPacks).
export function buyTickets(ctx, progress, pack) {
  const def = ctx.config.summon.ticketPacks[pack];
  if (!def) return fail('bad_pack');
  if (progress.inventory.spirit < def.spirit) return fail('not_enough_spirit');
  const p = structuredClone(progress);
  p.inventory.spirit -= def.spirit;
  p.inventory.tickets += def.tickets;
  return { ok: true, progress: p, tickets: def.tickets, spirit: def.spirit };
}

// Đổi Mảnh Linh Hồn lấy nhân vật tự chọn (chưa sở hữu, không phải nhân vật dự trữ).
export function redeemCharacter(ctx, progress, id) {
  const c = ctx.characters[id];
  if (!c || c.reserve) return fail('unknown_character');
  if (progress.characters[id]) return fail('already_owned');
  const cost = ctx.config.summon.redeemShards;
  if (progress.inventory.shards < cost) return fail('not_enough_shards');
  const p = structuredClone(progress);
  p.inventory.shards -= cost;
  p.characters[id] = newCharacter();
  return { ok: true, progress: p, cost };
}

// Tỉ lệ thực tế (đã tính bảo đảm) theo xích Markov trên (pity5, pity4), để hiển thị minh bạch. Không dùng ngẫu nhiên.
export function effectiveRates(cfg) {
  const s = cfg.summon;
  const r5 = s.rates['5'];
  const r4 = s.rates['4'];
  const A = s.pity5;
  const B = s.guarantee4Every;
  let dist = new Float64Array(A * B);
  dist[0] = 1;
  const out = { 5: 0, 4: 0, 3: 0 };
  for (let iter = 0; iter < 4000; iter++) {
    const next = new Float64Array(A * B);
    const got = { 5: 0, 4: 0, 3: 0 };
    for (let a = 0; a < A; a++)
      for (let b = 0; b < B; b++) {
        const m = dist[a * B + b];
        if (!m) continue;
        let p5;
        let p4;
        if (a + 1 >= A) {
          p5 = 1;
          p4 = 0;
        } else if (b + 1 >= B) {
          p5 = r5 / (r5 + r4);
          p4 = 1 - p5;
        } else {
          p5 = r5;
          p4 = r4;
        }
        const p3 = 1 - p5 - p4;
        got[5] += m * p5;
        got[4] += m * p4;
        got[3] += m * p3;
        next[0] += m * p5;
        if (p4) next[(a + 1) * B] += m * p4;
        if (p3 > 1e-12 && a + 1 < A && b + 1 < B) next[(a + 1) * B + (b + 1)] += m * p3;
      }
    dist = next;
    out[5] = got[5];
    out[4] = got[4];
    out[3] = got[3];
  }
  return out;
}
