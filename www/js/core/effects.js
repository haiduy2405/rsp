// 12 từ khóa hiệu ứng (khóa cứng). Định nghĩa chi tiết: docs/EFFECTS.md. Hàm thuần trên chủ thể.
// Chủ thể (holder): { effects: [], recover: number, maxHp }. Hiệu ứng: { key, turns, value, pool?, stacks? }.
export const KEYS = ['burn', 'poison', 'stun', 'freeze', 'shield', 'regen', 'atkUp', 'atkDown', 'reflect', 'pierce', 'lock', 'immune'];
export const NEGATIVE = new Set(['burn', 'poison', 'stun', 'freeze', 'atkDown', 'lock']);
const POISON_MAX_STACKS = 5;
const SHIELD_CAP = 0.5;
const REFLECT_CAP = 0.1;
const ATK_FLOOR = 0.25;
const MAX_LOCKED = 8;

export const getEffect = (h, key) => h.effects.find((e) => e.key === key);
export const hasEffect = (h, key) => !!getEffect(h, key);

// Thêm hiệu ứng. Trả về { applied, reason? }. Một bản mỗi từ khóa; áp lại làm mới.
export function addEffect(h, eff) {
  const { key } = eff;
  if (!KEYS.includes(key)) throw new Error('unknown effect ' + key);
  if (NEGATIVE.has(key) && hasEffect(h, 'immune')) return { applied: false, reason: 'immune' };
  if ((key === 'stun' || key === 'freeze') && h.recover > 0) return { applied: false, reason: 'recover' };
  const value = eff.value ?? 0;
  const cur = getEffect(h, key);
  if (key === 'shield') {
    const add = Math.round(value * h.maxHp);
    const cap = Math.round(SHIELD_CAP * h.maxHp);
    if (cur) {
      cur.pool = Math.min(cap, cur.pool + add);
      cur.turns = Math.max(cur.turns, eff.turns);
    } else h.effects.push({ key, turns: eff.turns, value, pool: Math.min(cap, add) });
  } else if (key === 'poison') {
    if (cur) {
      cur.stacks = Math.min(POISON_MAX_STACKS, cur.stacks + 1);
      cur.turns = Math.max(cur.turns, eff.turns);
      cur.value = Math.max(cur.value, value);
    } else h.effects.push({ key, turns: eff.turns, value, stacks: 1 });
  } else if (cur) {
    cur.turns = Math.max(cur.turns, eff.turns);
    cur.value = Math.max(cur.value, value);
  } else h.effects.push({ key, turns: eff.turns, value });
  return { applied: true };
}

export function removeEffect(h, key) {
  h.effects = h.effects.filter((e) => e.key !== key);
}

// Hệ số công của chủ thể: (1 + Tăng công) × (1 − Giảm công), sàn 0.25.
export function atkMult(h) {
  const up = getEffect(h, 'atkUp')?.value ?? 0;
  const down = getEffect(h, 'atkDown')?.value ?? 0;
  return Math.max(ATK_FLOOR, (1 + up) * (1 - down));
}

// Chủ thể mất hành động (Choáng hoặc Đóng băng).
export const isDisabled = (h) => hasEffect(h, 'stun') || hasEffect(h, 'freeze');

export const shieldPool = (h) => getEffect(h, 'shield')?.pool ?? 0;

// Nhận sát thương trực tiếp. opts: { element, pierce, thawHeal? }.
// Trả về { hpLoss, absorbed, thawed, reflect } — chưa trừ máu; caller trừ hpLoss.
// Thứ tự: tan băng (+25% nếu Hỏa) -> Khiên (trừ khi Xuyên giáp) -> máu -> Phản đòn.
export function takeDamage(h, amount, opts = {}) {
  let dmg = amount;
  let thawed = false;
  if (opts.element === 1 && hasEffect(h, 'freeze')) {
    removeEffect(h, 'freeze');
    h.recover = Math.max(h.recover, 1);
    dmg = Math.round(dmg * 1.25);
    thawed = true;
  }
  let absorbed = 0;
  const sh = getEffect(h, 'shield');
  if (sh && !opts.pierce && sh.pool > 0) {
    absorbed = Math.min(sh.pool, dmg);
    sh.pool -= absorbed;
    dmg -= absorbed;
    if (sh.pool <= 0) removeEffect(h, 'shield');
  }
  let reflect = 0;
  const rf = getEffect(h, 'reflect');
  if (rf && dmg > 0 && !opts.noReflect) reflect = Math.round(dmg * rf.value);
  return { hpLoss: dmg, absorbed, thawed, reflect };
}

export const reflectCap = (attackerMaxHp) => Math.round(attackerMaxHp * REFLECT_CAP);

// Sát thương theo thời gian cuối lượt: Bỏng + Độc (không bị Khiên chặn).
export function dotDamage(h) {
  let d = 0;
  const b = getEffect(h, 'burn');
  if (b) d += Math.round(b.value * h.maxHp);
  const p = getEffect(h, 'poison');
  if (p) d += Math.round(p.value * h.maxHp * p.stacks);
  return d;
}

export function regenAmount(h) {
  const r = getEffect(h, 'regen');
  return r ? Math.round(r.value * h.maxHp) : 0;
}

// Giảm thời lượng, xóa hiệu ứng hết hạn, cập nhật bộ đếm hồi phục (miễn Choáng/Đóng băng 1 lượt sau khi hết).
export function expire(h) {
  if (h.recover > 0) h.recover -= 1;
  for (const e of h.effects) e.turns -= 1;
  const gone = h.effects.filter((e) => e.turns <= 0);
  if (gone.some((e) => e.key === 'stun' || e.key === 'freeze')) h.recover = Math.max(h.recover, 1);
  h.effects = h.effects.filter((e) => e.turns > 0);
  return gone.map((e) => e.key);
}

// Khóa ngọc: chọn thêm ô ngẫu nhiên (qua rng) cho tới đủ `count` ô, tối đa 8. locked là mảng chỉ số ô.
export function lockCells(locked, count, rng, N) {
  const want = Math.min(MAX_LOCKED, count);
  let guard = 0;
  while (locked.length < want && guard++ < 1000) {
    const i = rng.int(N);
    if (!locked.includes(i)) locked.push(i);
  }
  locked.sort((a, b) => a - b);
}
