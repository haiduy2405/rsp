import { mulberry32 } from './rng.js';
import { createBoard, N, ORB_HEART } from './board.js';
import { validatePath, applyPath } from './move.js';
import { resolve } from './match.js';
import { elementMultiplier, comboMultiplier, groupFactor } from './damage.js';
import {
  addEffect,
  hasEffect,
  atkMult,
  isDisabled,
  takeDamage,
  reflectCap,
  dotDamage,
  regenAmount,
  expire,
  lockCells,
  shieldPool,
} from './effects.js';
import { statsFor, skillCooldown, normTeam } from './stats.js';
import { resolveKit, formOf } from './kit.js';
import { relicMods } from './relic.js';

// ctx = { config, characters, monsters, duoByPair, ... } (dữ liệu từ JSON, không đổi)
export { indexById } from './ctx.js';

// Dựng 5 thành viên (chỉ số theo Level/Thức tỉnh, thưởng đội trưởng). Dùng chung cho trận và chuyến.
export function buildMembers(ctx, team, mods = relicMods(ctx, [])) {
  const roster = normTeam(team);
  const kits = [];
  const members = roster.map(({ id, level, awaken, skillLv }) => {
    const c = ctx.characters[id];
    if (!c) throw new Error('unknown character ' + id);
    const st = statsFor(ctx, id, level, awaken);
    const kit = resolveKit(ctx, id, skillLv, formOf(awaken));
    kits.push(kit);
    return {
      id,
      element: c.element,
      level,
      awaken,
      skillLv,
      hp: st.hp,
      atk: st.atk,
      heal: st.heal,
      skillCd: kit.skill ? kit.skill.startCooldown : 0,
      skillMax: kit.skill ? skillCooldown(ctx, id, awaken, skillLv) : 0,
    };
  });
  // Kỹ năng đội trưởng (khuôn mẫu cố định, tham số hóa trong JSON).
  const lead = kits[0].leader || null;
  if (lead) {
    for (const m of members) {
      if (lead.template === 'atk_element' && m.element === lead.element) m.atk = Math.round(m.atk * (1 + lead.pct));
      else if (lead.template === 'hp_element' && m.element === lead.element) m.hp = Math.round(m.hp * (1 + lead.pct));
      else if (lead.template === 'heal_boost') m.heal = Math.round(m.heal * (1 + lead.pct));
      else if (lead.template === 'atk_all') m.atk = Math.round(m.atk * (1 + lead.pct));
      else if (lead.template === 'hp_all') m.hp = Math.round(m.hp * (1 + lead.pct));
    }
    // Cầu Vồng: cả đội 5 hệ khác nhau thì tăng ATK toàn đội.
    if (lead.template === 'rainbow' && new Set(members.map((m) => m.element)).size === members.length) for (const m of members) m.atk = Math.round(m.atk * lead.mult);
  }
  // Bị động dạng chỉ số: có hiệu lực khi tướng có mặt trong đội (không cần là đội trưởng).
  members.forEach((src, i) => {
    const p = kits[i].passive;
    if (p?.kind !== 'stat') return;
    for (const m of members) {
      const hit = p.scope === 'all' || (p.scope === 'self' && m === src) || (p.scope === 'element' && m.element === p.element);
      if (hit) m[p.stat] = Math.round(m[p.stat] * (1 + p.pct));
    }
  });
  // Di Vật: tăng chỉ số toàn đội hoặc theo hệ, giảm hồi chiêu đầu trận.
  for (const m of members) {
    m.atk = Math.round(m.atk * (1 + mods.atkPct + (mods.elAtk[m.element] || 0)));
    m.hp = Math.round(m.hp * (1 + mods.hpPct + (mods.elHp[m.element] || 0)));
    m.heal = Math.round(m.heal * (1 + mods.healPct));
    m.skillCd = Math.max(0, m.skillCd - mods.startCdCut);
  }
  for (const m of members) m.skillCd = Math.min(m.skillCd, m.skillMax);
  return { members, lead, maxHp: members.reduce((a, m) => a + m.hp, 0) };
}

// Bị động dạng kích hoạt ('start' đầu trận, 'turn' cứ mỗi `every` lượt): trả các tướng có loại đó.
const triggerPassives = (ctx, s, trigger) =>
  s.members
    .map((m, i) => ({ i, m, p: resolveKit(ctx, m.id, m.skillLv).passive }))
    .filter(({ p }) => p?.kind === 'trigger' && p.trigger === trigger);

// team: danh sách id hoặc {id, level, awaken}. Ô đầu là đội trưởng.
// Tùy chọn cho chuyến leo tháp: scale {hp, atk} nhân chỉ số quái, hp (máu đội mang theo),
// startEffects (hiệu ứng đội có sẵn, vd Bùa Khiên), dragBonusMs (cộng thời gian kéo cho UI).
export function createBattle(ctx, { seed, team, enemies, scale, hp, startEffects, dragBonusMs, mods = relicMods(ctx, []), big = false, reviveUsed = false }) {
  const rng = mulberry32(seed);
  const board = createBoard(rng);
  const { members, lead, maxHp } = buildMembers(ctx, team, mods);
  // Duo: hai nhân vật đứng liền ô và thuộc một cặp định sẵn.
  const duos = [];
  for (let i = 0; i + 1 < members.length; i++) {
    const d = ctx.duoByPair?.[`${members[i].id}|${members[i + 1].id}`];
    if (d) duos.push({ id: d.id, slot: i }); // Duo không có hồi chiêu riêng: sẵn sàng khi cả hai skill đơn sẵn sàng
  }
  const foes = enemies.map((id, i) => {
    const m = ctx.monsters[id];
    if (!m) throw new Error('unknown monster ' + id);
    const mh = Math.round(m.hp * (scale?.hp ?? 1));
    const foe = {
      id,
      element: m.element,
      hp: mh,
      maxHp: mh,
      atk: Math.round(m.atk * (scale?.atk ?? 1)),
      every: m.attackEvery,
      cd: m.attackEvery,
      effects: [],
      recover: 0,
    };
    return foe;
  });
  const teamHolder = { effects: [], recover: 0, maxHp };
  for (const e of startEffects || []) addEffect(teamHolder, e);
  const state = {
    version: 2,
    turn: 0,
    status: 'playing',
    rng: rng.state,
    board,
    members,
    leader: lead || null,
    duos,
    team: teamHolder,
    locked: [],
    hp: Math.min(maxHp, hp ?? maxHp),
    maxHp,
    dragBonusMs: (dragBonusMs ?? 0) + mods.dragMs + (lead?.template === 'drag_time' ? lead.ms : 0),
    freeze: 0, // Dừng Thời Gian: số lượt còn lại
    mods: { aoeCut: mods.aoeCut, comboStep: mods.comboStep + (lead?.template === 'combo_mult' ? lead.pct : 0), heartPct: mods.heartPct, bossDmg: mods.bossDmg, leech: mods.leech, turnHeal: mods.turnHeal, revive: mods.revive, firstTurn: mods.firstTurn, skillDmg: mods.skillDmg },
    big,
    reviveUsed,
    enemies: foes,
    focus: null,
  };
  for (const { m, p } of triggerPassives(ctx, state, 'start')) runUnits(ctx, state, rng, p.units, { atk: m.atk, element: m.element, id: m.id });
  state.rng = rng.state;
  return state;
}

const firstAliveRaw = (s) => s.enemies.findIndex((e) => e.hp > 0);
// Mục tiêu khóa (nếu còn sống) được ưu tiên; không thì quái sống đầu tiên.
function firstAlive(s) {
  const f = s.focus;
  if (Number.isInteger(f) && s.enemies[f] && s.enemies[f].hp > 0) return f;
  return firstAliveRaw(s);
}
const aliveIdx = (s) => s.enemies.map((_, i) => i).filter((i) => s.enemies[i].hp > 0);

// Sát thương của đội lên quái (qua tan băng, Khiên, Phản đòn).
function hitEnemy(s, idx, amount, hits, from, element) {
  const e = s.enemies[idx];
  const r = takeDamage(e, amount, { element, pierce: hasEffect(s.team, 'pierce') });
  const dealt = Math.min(e.hp, r.hpLoss);
  e.hp -= dealt;
  hits.push({ kind: 'damage', enemy: idx, amount: dealt, raw: amount, absorbed: r.absorbed, thawed: r.thawed, from, killed: e.hp <= 0 });
  if (s.mods.leech > 0 && dealt > 0) healTeam(s, Math.round(dealt * s.mods.leech), hits, from);
  if (r.reflect > 0) {
    const back = Math.min(r.reflect, reflectCap(s.maxHp));
    s.hp = Math.max(0, s.hp - back);
    hits.push({ kind: 'reflect', to: 'team', amount: back });
  }
}

// Hệ số sát thương từ Di Vật: Elite/Boss, đòn đầu trận, kỹ năng.
const dmgBoost = (s, { skill = false, first = false } = {}) => (1 + (s.big ? s.mods.bossDmg : 0)) * (1 + (skill ? s.mods.skillDmg : 0)) * (1 + (first && s.turn === 0 ? s.mods.firstTurn : 0));

function healTeam(s, amount, hits, from) {
  const before = s.hp;
  s.hp = Math.min(s.maxHp, s.hp + amount);
  hits.push({ kind: 'heal', amount: s.hp - before, from });
}

function checkEnd(s) {
  if (s.enemies.every((e) => e.hp <= 0)) s.status = 'won';
  else if (s.hp <= 0) {
    if (s.mods.revive > 0 && !s.reviveUsed) {
      s.reviveUsed = true;
      s.hp = Math.max(1, Math.round(s.maxHp * s.mods.revive));
      s.revivedNow = true; // step đọc cờ này để phát sự kiện rồi xóa
    } else s.status = 'lost';
  }
}

// Áp hiệu ứng lên Đội (Khóa ngọc chọn ô bằng rng).
function applyToTeam(s, rng, u, extraTurns = 0) {
  const r = addEffect(s.team, { key: u.key, turns: u.turns + extraTurns, value: u.value });
  if (r.applied && u.key === 'lock') lockCells(s.locked, u.value, rng, N);
  return r;
}

// Chạy một danh sách đơn vị kỹ năng. caster: { atk, element, id }.
function runUnits(ctx, s, rng, units, caster, scale = 1) {
  const hits = [];
  const teamAtk = atkMult(s.team);
  for (const u of units) {
    if (u.type === 'damage') {
      const targets = u.target === 'all' ? aliveIdx(s) : [firstAlive(s)].filter((i) => i >= 0);
      const el = u.element ?? caster.element;
      for (const i of targets) {
        const mult = elementMultiplier(el, s.enemies[i].element, ctx.config);
        hitEnemy(s, i, Math.round(caster.atk * teamAtk * u.mult * scale * mult * dmgBoost(s, { skill: true })), hits, caster.id, el);
      }
    } else if (u.type === 'heal') {
      healTeam(s, Math.round(s.maxHp * u.pctMax * scale), hits, caster.id);
    } else if (u.type === 'convert') {
      let left = Math.round(u.count * scale);
      let guard = 0;
      while (left > 0 && guard++ < 1000) {
        const i = rng.int(N);
        if (s.board.cells[i] !== u.to) {
          s.board.cells[i] = u.to;
          s.board.enh[i] = 0;
          left--;
        }
      }
    } else if (u.type === 'enhance') {
      // Nâng cấp ngọc màu của tướng: ưu tiên ngọc cùng màu chưa nâng cấp; thiếu thì đổi thêm ngọc khác sang màu đó.
      const own = [];
      const other = [];
      for (let i = 0; i < N; i++) {
        if (s.board.cells[i] === caster.element && !s.board.enh[i]) own.push(i);
        else if (s.board.cells[i] !== caster.element) other.push(i);
      }
      let left = Math.round(u.count * scale);
      while (left > 0 && own.length) {
        const i = own.splice(rng.int(own.length), 1)[0];
        s.board.enh[i] = 1;
        left--;
      }
      while (left > 0 && other.length) {
        const i = other.splice(rng.int(other.length), 1)[0];
        s.board.cells[i] = caster.element;
        s.board.enh[i] = 1;
        left--;
      }
    } else if (u.type === 'timeFreeze') {
      s.freeze = Math.max(s.freeze || 0, u.turns);
    } else if (u.type === 'applyEffect') {
      if (u.target === 'team') applyToTeam(s, rng, u);
      else {
        const targets = u.target === 'all' ? aliveIdx(s) : [firstAlive(s)].filter((i) => i >= 0);
        for (const i of targets) if (u.key !== 'lock') addEffect(s.enemies[i], u);
      }
    }
  }
  return hits;
}

function enemyAttack(ctx, s, rng, i, events) {
  const e = s.enemies[i];
  const dmg = Math.round(e.atk * atkMult(e));
  const r = takeDamage(s.team, dmg, { element: e.element, pierce: hasEffect(e, 'pierce') });
  s.hp = Math.max(0, s.hp - r.hpLoss);
  events.push({ type: 'enemyAttack', enemy: i, amount: r.hpLoss, blocked: r.absorbed, thawed: r.thawed });
  if (r.reflect > 0) {
    const back = Math.min(r.reflect, reflectCap(e.maxHp));
    e.hp = Math.max(0, e.hp - back);
    events.push({ type: 'reflect', to: 'enemy', enemy: i, amount: back });
  }
  for (const u of ctx.monsters[e.id].onAttack || []) {
    if (s.hp <= 0) break;
    // Debuff của quái trúng theo xác suất (theo loại quái trong config.monsterPassive.chance, hoặc u.chance riêng); trượt thì không áp.
    const chance = u.chance ?? ctx.config.monsterPassive.chance[ctx.monsters[e.id].kind || 'normal'] ?? 1;
    if (chance < 1 && rng.next() >= chance) { events.push({ type: 'effect', target: 'team', key: u.key, applied: false, missed: true }); continue; }
    // Hiệu ứng do quái áp trong pha quái tính từ lượt sau (+1).
    const res = applyToTeam(s, rng, u, 1);
    events.push({ type: 'effect', target: 'team', key: u.key, applied: res.applied });
  }
}

// Cuối lượt: Bỏng/Độc quái -> thắng? -> Bỏng/Độc đội -> thua? -> Hồi máu quái, đội -> hết hạn.
function endOfTurn(s, events) {
  s.enemies.forEach((e, i) => {
    if (e.hp <= 0) return;
    const d = dotDamage(e);
    if (d > 0) {
      e.hp = Math.max(0, e.hp - d);
      events.push({ type: 'dot', target: 'enemy', enemy: i, amount: d });
    }
  });
  checkEnd(s);
  if (s.status !== 'playing') return;
  const td = dotDamage(s.team);
  if (td > 0) {
    s.hp = Math.max(0, s.hp - td);
    events.push({ type: 'dot', target: 'team', amount: td });
  }
  checkEnd(s);
  if (s.status !== 'playing') return;
  s.enemies.forEach((e, i) => {
    if (e.hp <= 0) return;
    const h = Math.min(regenAmount(e), e.maxHp - e.hp);
    if (h > 0) {
      e.hp += h;
      events.push({ type: 'regen', target: 'enemy', enemy: i, amount: h });
    }
  });
  const th = Math.min(regenAmount(s.team), s.maxHp - s.hp);
  if (th > 0) {
    s.hp += th;
    events.push({ type: 'regen', target: 'team', amount: th });
  }
  if (s.mods.turnHeal > 0) {
    const g = Math.min(Math.round(s.maxHp * s.mods.turnHeal), s.maxHp - s.hp);
    if (g > 0) {
      s.hp += g;
      events.push({ type: 'regen', target: 'team', amount: g });
    }
  }
  for (const e of s.enemies) if (e.hp > 0) expire(e);
  expire(s.team);
  if (!hasEffect(s.team, 'lock')) s.locked = [];
}

// action: { type: 'move', path } | { type: 'skill', index } | { type: 'duo', index } | { type: 'target', index } (khóa mục tiêu, không tốn lượt)
// Trả về { state, events }. State đầu vào không bị sửa.
export function step(ctx, state, action) {
  if (state.status !== 'playing') return { state, events: [{ type: 'invalid', reason: 'battle_over' }] };
  const s = structuredClone(state);
  const rng = mulberry32(s.rng);
  const events = [];
  const invalid = (reason) => ({ state, events: [{ type: 'invalid', reason }] });

  if (action.type === 'target') {
    const i = action.index;
    if (!Number.isInteger(i) || !s.enemies[i] || s.enemies[i].hp <= 0) return invalid('bad_target');
    s.focus = s.focus === i ? null : i; // chạm lại để bỏ khóa
    return { state: s, events: [{ type: 'target', enemy: s.focus }] };
  }

  if (action.type === 'skill') {
    const m = s.members[action.index];
    const kit = m && resolveKit(ctx, m.id, m.skillLv);
    if (!kit?.skill) return invalid('no_skill');
    if (m.skillCd > 0) return invalid('skill_cooldown');
    if (isDisabled(s.team)) return invalid('skill_locked');
    const hits = runUnits(ctx, s, rng, kit.skill.units, { atk: m.atk, element: m.element, id: m.id });
    m.skillCd = m.skillMax;
    events.push({ type: 'skill', member: action.index, hits, board: structuredClone(s.board) });
    checkEnd(s);
    s.rng = rng.state;
    return done(s, events);
  }

  if (action.type === 'duo') {
    // Skill Duo: cả hai skill đơn của cặp chạy cùng lúc, sức mạnh ×config.duo.mult, rồi thêm hiệu ứng riêng của cặp. Cả hai skill đơn vào hồi chiêu.
    const d = s.duos.find((x) => x.slot === action.index);
    if (!d) return invalid('no_duo');
    const a = s.members[d.slot];
    const b = s.members[d.slot + 1];
    const ka = resolveKit(ctx, a.id, a.skillLv);
    const kb = resolveKit(ctx, b.id, b.skillLv);
    if (!ka?.skill || !kb?.skill) return invalid('no_skill');
    if (a.skillCd > 0 || b.skillCd > 0) return invalid('skill_cooldown');
    if (isDisabled(s.team)) return invalid('skill_locked');
    const k = ctx.config.duo?.mult ?? 1.5;
    const hits = [
      ...runUnits(ctx, s, rng, ka.skill.units, { atk: a.atk, element: a.element, id: a.id }, k),
      ...runUnits(ctx, s, rng, kb.skill.units, { atk: b.atk, element: b.element, id: b.id }, k),
      ...runUnits(ctx, s, rng, ctx.duos[d.id].skill.units, { atk: a.atk + b.atk, element: a.element, id: d.id }),
    ];
    a.skillCd = a.skillMax;
    b.skillCd = b.skillMax;
    events.push({ type: 'duo', slot: d.slot, hits, board: structuredClone(s.board) });
    checkEnd(s);
    s.rng = rng.state;
    return done(s, events);
  }

  if (action.type === 'clear') {
    // Dừng Thời Gian: bấm Tiêu để tính các cụm trên bàn hiện tại và tốn một lượt.
    if (!(s.freeze > 0)) return invalid('not_frozen');
  } else if (action.type !== 'move') return invalid('unknown_action');
  else {
    const err = validatePath(action.path, ctx.config.board.allowDiagonal, s.locked);
    if (err) return invalid(err);
    s.board = applyPath(s.board, action.path);
    if (s.freeze > 0) {
      // Đang dừng thời gian: chỉ hoán đổi, ngọc chưa tiêu, chưa tốn lượt.
      return { state: s, events: [{ type: 'swap', board: structuredClone(s.board) }] };
    }
  }
  const { board, steps } = resolve(s.board, rng);
  s.board = board;

  const teamAtk = atkMult(s.team);
  let comboN = 0;
  for (const st of steps) {
    const hits = [];
    const comboStart = comboN + 1;
    st.groups.forEach((g, gi) => {
      const from = hits.length;
      comboN++;
      const cm = comboMultiplier(comboN, ctx.config) + s.mods.comboStep * (comboN - 1);
      const gf = groupFactor(g, ctx.config);
      if (g.type === ORB_HEART) {
        const total = s.members.reduce((a, m) => a + m.heal, 0);
        healTeam(s, Math.round(total * ctx.config.heal.base * gf * cm * (1 + s.mods.heartPct)), hits, 'orb');
      } else {
        // Nhóm từ aoeSize ngọc trở lên: tướng đánh toàn bộ quái còn sống (mỗi quái tính khắc hệ riêng), còn lại đánh mục tiêu hiện tại.
        const aoe = g.size >= ctx.config.group.aoeSize - s.mods.aoeCut;
        for (const m of s.members) {
          if (m.element !== g.type) continue;
          const targets = aoe ? aliveIdx(s) : [firstAlive(s)].filter((i) => i >= 0);
          for (const idx of targets) {
            const mult = elementMultiplier(m.element, s.enemies[idx].element, ctx.config);
            hitEnemy(s, idx, Math.round(m.atk * teamAtk * gf * cm * mult * dmgBoost(s, { first: true })), hits, m.id, m.element);
          }
        }
      }
      for (let k = from; k < hits.length; k++) hits[k].group = gi; // để UI gắn số sát thương vào đúng nhóm ngọc đang tan
    });
    // Ô bị khóa mà ngọc đã được tiêu thì mở khóa.
    if (s.locked.length) s.locked = s.locked.filter((c) => !st.cleared.includes(c));
    events.push({ type: 'step', step: st, comboStart, combos: comboN, hits });
  }
  s.combo = comboN;

  if (s.freeze > 0) s.freeze -= 1;
  for (const m of s.members) m.skillCd = Math.max(0, m.skillCd - 1);
  checkEnd(s);
  if (s.status === 'playing') {
    for (const { i, m, p } of triggerPassives(ctx, s, 'turn')) {
      if ((s.turn + 1) % p.every !== 0) continue;
      const hits = runUnits(ctx, s, rng, p.units, { atk: m.atk, element: m.element, id: m.id });
      events.push({ type: 'passive', member: i, hits, board: structuredClone(s.board) });
    }
    checkEnd(s);
  }

  if (s.status === 'playing') {
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i];
      if (e.hp <= 0) continue;
      if (isDisabled(e)) continue; // Choáng/Đóng băng: đứng yên, bộ đếm không giảm
      e.cd -= 1;
      if (e.cd <= 0) {
        e.cd = e.every;
        enemyAttack(ctx, s, rng, i, events);
        checkEnd(s);
        if (s.status !== 'playing') break;
      }
    }
  }
  if (s.status === 'playing') endOfTurn(s, events);
  s.turn += 1;
  s.rng = rng.state;
  return done(s, events);
}

// Kết thúc một bước: nếu Di Vật vừa hồi sinh đội thì phát sự kiện cho giao diện.
function done(s, events) {
  if (s.revivedNow) {
    delete s.revivedNow;
    events.push({ type: 'revive', hp: s.hp });
  }
  return { state: s, events };
}

export { shieldPool };
