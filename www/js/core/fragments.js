// Mảnh ghép: mảnh riêng của một tướng (3/4/5 mảnh đổi đúng tướng đó) và mảnh chung theo sao (6/8/10 mảnh đổi tướng ngẫu nhiên chưa có).
// Tướng trùng tự đổi thành mảnh chung. Không có mảnh 1–2★. Mọi hàm thuần, nhận progress và trả progress mới.
import { mulberry32 } from './rng.js';
import { newCharacter } from './kit.js';

const fail = (reason) => ({ ok: false, reason });
export const FRAG_STARS = [3, 4, 5];

export const emptyGeneric = () => ({ 3: 0, 4: 0, 5: 0 });

// Cộng `n` mảnh của tướng `id` vào `p` (sửa tại chỗ). Tướng đã sở hữu thì quy ra mảnh chung cùng sao, không giữ mảnh dư.
export function addFragments(ctx, p, id, n) {
  const c = ctx.characters[id];
  if (!c || c.rarity < FRAG_STARS[0]) return;
  if (p.characters[id]) p.inventory.generic[c.rarity] += n;
  else p.inventory.fragments[id] = (p.inventory.fragments[id] || 0) + n;
}

// Tướng vừa vào đội hình: mảnh riêng còn dư (nếu có) đổi thành mảnh chung.
export function settleFragments(ctx, p, id) {
  const left = p.inventory.fragments[id];
  if (!left) return;
  delete p.inventory.fragments[id];
  p.inventory.generic[ctx.characters[id].rarity] += left;
}

// Mảnh riêng cần để triệu hồi tướng `id` (theo sao).
export const heroFragCost = (ctx, id) => ctx.config.fragments.heroCost[ctx.characters[id].rarity];

export function redeemFragments(ctx, progress, id) {
  const c = ctx.characters[id];
  if (!c || c.rarity < FRAG_STARS[0]) return fail('unknown_character');
  if (progress.characters[id]) return fail('already_owned');
  const cost = heroFragCost(ctx, id);
  if ((progress.inventory.fragments[id] || 0) < cost) return fail('not_enough_fragments');
  const p = structuredClone(progress);
  p.inventory.fragments[id] -= cost;
  if (!p.inventory.fragments[id]) delete p.inventory.fragments[id];
  p.characters[id] = newCharacter();
  settleFragments(ctx, p, id);
  return { ok: true, progress: p, id, cost };
}

// Đổi mảnh chung `star` lấy một tướng ngẫu nhiên cùng sao mà người chơi chưa có.
export function redeemGeneric(ctx, progress, star, seed) {
  const cost = ctx.config.fragments.genericCost[star];
  if (!cost) return fail('bad_star');
  if (progress.inventory.generic[star] < cost) return fail('not_enough_generic');
  const pool = ctx.characterList.filter((c) => c.rarity === star && !c.reserve && !progress.characters[c.id]);
  if (!pool.length) return fail('all_owned');
  const id = pool[mulberry32(seed).int(pool.length)].id;
  const p = structuredClone(progress);
  p.inventory.generic[star] -= cost;
  p.characters[id] = newCharacter();
  settleFragments(ctx, p, id);
  return { ok: true, progress: p, id, cost };
}

// Vé Triệu Linh: mỗi vé ra một Tiểu Linh 1★ (hay gặp) hoặc 2★ (hiếm) của hệ ngẫu nhiên. Trả danh sách khóa Tiểu Linh.
export function useSoulTickets(ctx, progress, count, seed) {
  if (!Number.isInteger(count) || count < 1) return fail('bad_count');
  if (progress.inventory.soulTickets < count) return fail('not_enough_soul');
  const rng = mulberry32(seed);
  const p = structuredClone(progress);
  p.inventory.soulTickets -= count;
  const results = [];
  for (let i = 0; i < count; i++) {
    const element = rng.int(6);
    const star = rng.next() < ctx.config.soulTicket.star2Chance ? 2 : 1;
    const key = `${element}_${star}`;
    p.inventory.fodder[key] = (p.inventory.fodder[key] || 0) + 1;
    results.push(key);
  }
  return { ok: true, progress: p, results };
}
