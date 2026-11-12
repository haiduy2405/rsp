// Di Vật (relic): vật phẩm chỉ có hiệu lực trong một chuyến leo tháp. Dữ liệu ở data/relics.json, hằng số ở config.relic.
// Hàm thuần. relicMods gộp mọi Di Vật đang giữ thành một bảng hệ số mà trận và chuyến đọc.
const ZERO = () => ({
  atkPct: 0, hpPct: 0, healPct: 0, elAtk: {}, elHp: {},
  turnHeal: 0, dragMs: 0, goldPct: 0, dropPct: 0, restPct: 0,
  startShield: 0, startAtkUp: 0, startReflect: 0, startCdCut: 0,
  leech: 0, comboStep: 0, aoeCut: 0, revive: 0, bossDmg: 0, heartPct: 0, skillDmg: 0, firstTurn: 0,
});

export function relicMods(ctx, ids = []) {
  const m = ZERO();
  for (const id of ids) {
    const r = ctx.relics[id];
    if (!r) continue;
    for (const [k, v] of Object.entries(r.mods)) {
      if (r.element != null && (k === 'atkPct' || k === 'hpPct')) {
        const bag = k === 'atkPct' ? m.elAtk : m.elHp;
        bag[r.element] = (bag[r.element] || 0) + v;
      } else m[k] = (m[k] || 0) + v;
    }
  }
  return m;
}

// Chọn `count` Di Vật khác nhau, chưa có, theo trọng số độ hiếm (config.relic.weights[kind]).
export function rollRelics(ctx, rng, count, kind, owned = []) {
  const w = ctx.config.relic.weights[kind];
  const pool = ctx.relicList.filter((r) => !owned.includes(r.id));
  const out = [];
  while (out.length < count && pool.length) {
    const total = pool.reduce((a, r) => a + (w[r.rarity] || 0), 0);
    let x = rng.next() * total;
    let i = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      x -= w[pool[j].rarity] || 0;
      if (x < 0) {
        i = j;
        break;
      }
    }
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  return out;
}

export const relicPrice = (ctx, id) => ctx.config.relic.price[ctx.relics[id].rarity];
