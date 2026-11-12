// Cửa hàng hằng ngày: danh sách món sinh xác định theo ngày (config.shop.offers), reset khi sang ngày mới.
// Trạng thái lưu: progress.shop = { day, offers[], bought{ id: số lần } }. Món 'free' đầu tiên tặng Linh Thạch.
import { mulberry32 } from './rng.js';
import { addFragments } from './fragments.js';

const fail = (reason) => ({ ok: false, reason });
export const newShopState = () => ({ day: -1, offers: [], bought: {} });

// Sinh danh sách món của một ngày. Tướng bán mảnh ưu tiên tướng chưa có.
export function rollOffers(ctx, dayKey, owned = {}) {
  const rng = mulberry32((Math.imul(dayKey, 2654435761) ^ 0x5eed) >>> 0);
  return ctx.config.shop.offers.map((o) => {
    const give = { ...o.give };
    if (give.pick === 'element') give.key = String(rng.int(6));
    else if (give.pick === 'race') give.key = `${ctx.config.races[rng.int(ctx.config.races.length)]}_${give.tier}`;
    else if (give.pick === 'hero') {
      const all = ctx.characterList.filter((c) => c.rarity === give.rarity && !c.reserve);
      const fresh = all.filter((c) => !owned[c.id]);
      const pool = fresh.length ? fresh : all;
      give.key = pool[rng.int(pool.length)].id;
    }
    delete give.pick;
    return { id: o.id, give, price: { ...o.price }, stock: o.stock };
  });
}

// Đảm bảo shop đã sang ngày `dayKey` (làm mới món và số lượng đã mua).
export function ensureShop(ctx, progress, dayKey) {
  if (progress.shop.day === dayKey) return progress;
  const p = structuredClone(progress);
  p.shop = { day: dayKey, offers: rollOffers(ctx, dayKey, p.characters), bought: {} };
  return p;
}

export const leftStock = (progress, offer) => offer.stock - (progress.shop.bought[offer.id] || 0);

function grant(ctx, p, g) {
  const inv = p.inventory;
  if (g.kind === 'spirit') inv.spirit += g.count;
  else if (g.kind === 'elixir') inv.elixir[g.key] += g.count;
  else if (g.kind === 'soulTicket') inv.soulTickets += g.count;
  else if (g.kind === 'stoneN') inv.stones[g.key].normal += g.count;
  else if (g.kind === 'stoneR') inv.stones[g.key].rare += g.count;
  else if (g.kind === 'offering') inv.offerings[g.key] = (inv.offerings[g.key] || 0) + g.count;
  else if (g.kind === 'fragment') addFragments(ctx, p, g.key, g.count);
}

export function buyOffer(ctx, progress, dayKey, offerId) {
  if (progress.shop.day !== dayKey) return fail('shop_stale');
  const offer = progress.shop.offers.find((o) => o.id === offerId);
  if (!offer) return fail('bad_offer');
  if (leftStock(progress, offer) <= 0) return fail('sold_out');
  const { cur, amount } = offer.price;
  if (cur === 'gold' && progress.inventory.gold < amount) return fail('not_enough_gold');
  if (cur === 'spirit' && progress.inventory.spirit < amount) return fail('not_enough_spirit');
  const p = structuredClone(progress);
  if (cur === 'gold') p.inventory.gold -= amount;
  if (cur === 'spirit') p.inventory.spirit -= amount;
  p.shop.bought[offerId] = (p.shop.bought[offerId] || 0) + 1;
  grant(ctx, p, offer.give);
  return { ok: true, progress: p, offer };
}
