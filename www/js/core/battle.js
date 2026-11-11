import { mulberry32 } from './rng.js';
import { createBoard, N, ORB_TYPES, ORB_HEART } from './board.js';
import { validatePath, applyPath } from './move.js';
import { resolve } from './match.js';
import { elementMultiplier, comboMultiplier, groupFactor } from './damage.js';
import { addEffect, tickEffects } from './effects.js';

// ctx = { config, characters: {id: def}, monsters: {id: def} } (dữ liệu từ JSON, không đổi)
export { indexById } from './ctx.js';

// Tùy chọn cho chuyến leo tháp: scale {hp, atk} nhân chỉ số quái, hp (máu đội mang theo),
// shield (số đòn chặn), dragBonusMs (cộng thời gian kéo cho UI).
export function createBattle(ctx, { seed, team, enemies, scale, hp, shield, dragBonusMs }) {
  const rng = mulberry32(seed);
  const board = createBoard(rng);
  const members = team.map((id) => {
    const c = ctx.characters[id];
    if (!c) throw new Error('unknown character ' + id);
    return {
      id,
      element: c.element,
      hp: c.hp,
      atk: c.atk,
      heal: c.heal,
      skillCd: c.skill?.startCooldown ?? 0,
    };
  });
  const maxHp = members.reduce((a, m) => a + m.hp, 0);
  const foes = enemies.map((id) => {
    const m = ctx.monsters[id];
    if (!m) throw new Error('unknown monster ' + id);
    const mh = Math.round(m.hp * (scale?.hp ?? 1));
    return {
      id,
      element: m.element,
      hp: mh,
      maxHp: mh,
      atk: Math.round(m.atk * (scale?.atk ?? 1)),
      every: m.attackEvery,
      cd: m.attackEvery,
      effects: [],
    };
  });
  return {
    version: 1,
    turn: 0,
    status: 'playing',
    rng: rng.state,
    board,
    members,
    hp: Math.min(maxHp, hp ?? maxHp),
    maxHp,
    shield: shield ?? 0,
    dragBonusMs: dragBonusMs ?? 0,
    enemies: foes,
  };
}

function firstAlive(s) {
  return s.enemies.findIndex((e) => e.hp > 0);
}

function hitEnemy(s, idx, amount, hits, from) {
  const e = s.enemies[idx];
  const dealt = Math.min(e.hp, amount);
  e.hp -= dealt;
  hits.push({ kind: 'damage', enemy: idx, amount: dealt, raw: amount, from, killed: e.hp <= 0 });
}

function healTeam(s, amount, hits, from) {
  const before = s.hp;
  s.hp = Math.min(s.maxHp, s.hp + amount);
  hits.push({ kind: 'heal', amount: s.hp - before, from });
}

function checkEnd(s) {
  if (s.enemies.every((e) => e.hp <= 0)) s.status = 'won';
  else if (s.hp <= 0) s.status = 'lost';
}

function runSkill(ctx, s, rng, memberIdx) {
  const m = s.members[memberIdx];
  const def = ctx.characters[m.id].skill;
  const hits = [];
  for (const u of def.units) {
    if (u.type === 'damage') {
      const targets =
        u.target === 'all'
          ? s.enemies.map((_, i) => i).filter((i) => s.enemies[i].hp > 0)
          : [firstAlive(s)].filter((i) => i >= 0);
      const el = u.element ?? m.element;
      for (const i of targets) {
        const mult = elementMultiplier(el, s.enemies[i].element, ctx.config);
        hitEnemy(s, i, Math.round(m.atk * u.mult * mult), hits, m.id);
      }
    } else if (u.type === 'heal') {
      healTeam(s, Math.round(s.maxHp * u.pctMax), hits, m.id);
    } else if (u.type === 'convert') {
      let left = u.count;
      let guard = 0;
      while (left > 0 && guard++ < 1000) {
        const i = rng.int(N);
        if (s.board.cells[i] !== u.to) {
          s.board.cells[i] = u.to;
          s.board.enh[i] = 0;
          left--;
        }
      }
    } else if (u.type === 'applyEffect') {
      const targets =
        u.target === 'all'
          ? s.enemies.map((_, i) => i).filter((i) => s.enemies[i].hp > 0)
          : [firstAlive(s)].filter((i) => i >= 0);
      for (const i of targets) addEffect(s.enemies[i], u);
    }
  }
  return hits;
}

// action: { type: 'move', path: [cells] } | { type: 'skill', index }
// Trả về { state, events }. State đầu vào không bị sửa.
export function step(ctx, state, action) {
  if (state.status !== 'playing') return { state, events: [{ type: 'invalid', reason: 'battle_over' }] };
  const s = structuredClone(state);
  const rng = mulberry32(s.rng);
  const events = [];

  if (action.type === 'skill') {
    const m = s.members[action.index];
    if (!m || !ctx.characters[m.id].skill) return { state, events: [{ type: 'invalid', reason: 'no_skill' }] };
    if (m.skillCd > 0) return { state, events: [{ type: 'invalid', reason: 'skill_cooldown' }] };
    const hits = runSkill(ctx, s, rng, action.index);
    m.skillCd = ctx.characters[m.id].skill.cooldown;
    events.push({ type: 'skill', member: action.index, hits, board: structuredClone(s.board) });
    checkEnd(s);
    s.rng = rng.state;
    return { state: s, events };
  }

  if (action.type !== 'move') return { state, events: [{ type: 'invalid', reason: 'unknown_action' }] };
  const err = validatePath(action.path, ctx.config.board.allowDiagonal);
  if (err) return { state, events: [{ type: 'invalid', reason: err }] };

  s.board = applyPath(s.board, action.path);
  const { board, steps } = resolve(s.board, rng);
  s.board = board;

  let comboN = 0;
  for (const st of steps) {
    const hits = [];
    const comboStart = comboN + 1;
    for (const g of st.groups) {
      comboN++;
      const cm = comboMultiplier(comboN, ctx.config);
      const gf = groupFactor(g, ctx.config);
      if (g.type === ORB_HEART) {
        const total = s.members.reduce((a, m) => a + m.heal, 0);
        healTeam(s, Math.round(total * ctx.config.heal.base * gf * cm), hits, 'orb');
      } else {
        for (const m of s.members) {
          if (m.element !== g.type) continue;
          const idx = firstAlive(s);
          if (idx < 0) break;
          const mult = elementMultiplier(m.element, s.enemies[idx].element, ctx.config);
          hitEnemy(s, idx, Math.round(m.atk * gf * cm * mult), hits, m.id);
        }
      }
    }
    events.push({ type: 'step', step: st, comboStart, combos: comboN, hits });
  }
  s.combo = comboN;

  for (const m of s.members) m.skillCd = Math.max(0, m.skillCd - 1);
  checkEnd(s);

  if (s.status === 'playing') {
    for (let i = 0; i < s.enemies.length; i++) {
      const e = s.enemies[i];
      if (e.hp <= 0) continue;
      events.push(...tickEffects(e, { state: s }));
      e.cd -= 1;
      if (e.cd <= 0) {
        e.cd = e.every;
        if (s.shield > 0) {
          s.shield -= 1; // M3 sẽ chuyển Khiên sang hệ hiệu ứng
          events.push({ type: 'enemyAttack', enemy: i, amount: 0, absorbed: true });
        } else {
          s.hp = Math.max(0, s.hp - e.atk);
          events.push({ type: 'enemyAttack', enemy: i, amount: e.atk });
        }
      }
    }
    checkEnd(s);
  }
  s.turn += 1;
  s.rng = rng.state;
  return { state: s, events };
}
