// Đặc tính quái: buff riêng của từng con (nhân chỉ số hoặc có sẵn hiệu ứng). Dữ liệu ở config.affix.
import { addEffect } from './effects.js';
// Chỉ dùng 12 từ khóa hiệu ứng có sẵn, không thêm từ khóa mới.

// Quái thứ index của trận loại kind có mấy đặc tính. Trả về mảng id đặc tính cho từng quái.
// Elite/Boss: đặc tính dồn vào quái đầu (con chính). Quái thường: mỗi con tự cuộn.
export function rollAffixes(ctx, rng, kind, zoneOrder, diff, count) {
  const cfg = ctx.config.affix;
  const out = Array.from({ length: count }, () => []);
  const spec = cfg.chance[kind];
  if (!spec) return out;
  const pool = Object.entries(cfg.list).filter(([, a]) => (a.minZone ?? 0) <= zoneOrder).map(([id]) => id);
  const p = Math.min(1, spec.base + spec.perZone * zoneOrder + (cfg.diffAdd[diff] ?? 0));
  const cap = cfg.maxCount[kind] ?? 1;
  const targets = kind === 'elite' || kind === 'boss' ? [0] : out.map((_, i) => i);
  for (const i of targets) {
    let chance = p;
    while (out[i].length < cap && pool.length > out[i].length && rng.next() < chance) {
      const free = pool.filter((a) => !out[i].includes(a));
      out[i].push(free[rng.int(free.length)]);
      chance = cfg.extraChance;
    }
  }
  return out;
}

// Áp đặc tính lên quái đã dựng ({hp,maxHp,atk,every,effects}); sửa tại chỗ.
export function applyAffixes(ctx, foe, ids) {
  foe.affixes = ids;
  for (const id of ids) {
    const a = ctx.config.affix.list[id];
    if (a.hp) {
      foe.maxHp = Math.round(foe.maxHp * a.hp);
      foe.hp = foe.maxHp;
    }
    if (a.atk) foe.atk = Math.round(foe.atk * a.atk);
    if (a.every) {
      foe.every = Math.max(1, foe.every + a.every);
      foe.cd = foe.every;
    }
  }
  // Hiệu ứng có sẵn thêm sau cùng vì Khiên tính theo máu tối đa cuối cùng.
  for (const id of ids) for (const ef of ctx.config.affix.list[id].effects || []) addEffect(foe, ef);
}
