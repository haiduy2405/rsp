// Cầu nguyện (ước): mỗi ngày 1 lượt quay vòng xoay, ra một phần thưởng theo trọng số (config.wish.slices).
// Trạng thái: progress.wish = { day, slice } (tùy chọn, không đổi SAVE_VERSION). Ngẫu nhiên đi qua rng theo seed do UI cấp.
import { mulberry32 } from './rng.js';
import { addFragments } from './fragments.js';

const fail = (reason) => ({ ok: false, reason });

export const wishUsed = (progress, dayKey) => progress.wish?.day === dayKey;
export const wishAvailable = (progress, dayKey) => !wishUsed(progress, dayKey);

// Chọn ô theo trọng số.
export function pickSlice(slices, rng) {
  const total = slices.reduce((a, s) => a + s.weight, 0);
  let x = rng.next() * total;
  for (let i = 0; i < slices.length; i++) { x -= slices[i].weight; if (x < 0) return i; }
  return slices.length - 1;
}

// Trả { ok, progress, slice, prize } ; prize = { ...give, hero? } (hero: id tướng khi quà là mảnh riêng).
export function spinWish(ctx, progress, dayKey, seed) {
  if (wishUsed(progress, dayKey)) return fail('wish_used');
  const slices = ctx.config.wish.slices;
  const rng = mulberry32(seed);
  const slice = pickSlice(slices, rng);
  const give = slices[slice].give;
  const p = structuredClone(progress);
  const inv = p.inventory;
  const prize = { ...give };
  switch (give.kind) {
    case 'gold': inv.gold += give.count; break;
    case 'spirit': inv.spirit += give.count; break;
    case 'ticket': inv.tickets += give.count; break;
    case 'soulTicket': inv.soulTickets += give.count; break;
    case 'generic': inv.generic[give.star] += give.count; break;
    case 'hero': {
      const all = ctx.characterList.filter((c) => c.rarity === give.star && !c.reserve);
      const fresh = all.filter((c) => !p.characters[c.id]);
      const pool = fresh.length ? fresh : all;
      prize.hero = pool[rng.int(pool.length)].id;
      addFragments(ctx, p, prize.hero, give.count);
      break;
    }
    default: return fail('bad_prize');
  }
  p.wish = { day: dayKey, slice };
  return { ok: true, progress: p, slice, prize };
}
