import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../www/js/core/rng.js';
import { createBattle, step } from '../www/js/core/battle.js';
import { findGroups } from '../www/js/core/match.js';
import { newRecord, play, replayHash } from '../www/js/core/replay.js';
import { hashState } from '../www/js/core/hash.js';
import { N } from '../www/js/core/board.js';
import { loadCtx, randomPath, TEAM, FOES } from './helpers.js';

const ctx = loadCtx();

test('battle: tạo trận xác định, step không sửa state cũ', () => {
  const a = createBattle(ctx, { seed: 11, team: TEAM, enemies: FOES });
  const b = createBattle(ctx, { seed: 11, team: TEAM, enemies: FOES });
  assert.deepEqual(a, b);
  const snap = JSON.stringify(a);
  step(ctx, a, { type: 'move', path: [0, 1, 2] });
  assert.equal(JSON.stringify(a), snap);
});

test('battle: đường kéo sai trả sự kiện invalid, state giữ nguyên', () => {
  const a = createBattle(ctx, { seed: 1, team: TEAM, enemies: FOES });
  const r = step(ctx, a, { type: 'move', path: [0, 5] });
  assert.equal(r.events[0].type, 'invalid');
  assert.equal(r.state, a);
});

test('battle: kỹ năng cần hết hồi chiêu; dùng xong vào hồi chiêu và giảm mỗi lượt', () => {
  const a = createBattle(ctx, { seed: 2, team: TEAM, enemies: FOES });
  const r = step(ctx, a, { type: 'skill', index: 0 }); // Thủy: sát thương toàn thể
  assert.equal(r.state.members[0].skillCd, 4);
  assert.ok(r.state.enemies.some((e) => e.hp < e.maxHp));
  const again = step(ctx, r.state, { type: 'skill', index: 0 });
  assert.equal(again.events[0].reason, 'skill_cooldown');
  const mv = step(ctx, r.state, { type: 'move', path: [0, 1] });
  assert.equal(mv.state.members[0].skillCd, 3);
});

test('battle: kỹ năng đổi ngọc đúng số lượng', () => {
  const a = createBattle(ctx, { seed: 3, team: TEAM, enemies: FOES });
  const before = a.board.cells.filter((x) => x === 3).length;
  const r = step(ctx, a, { type: 'skill', index: 3 }); // Quang: đổi 6 ngọc thành Quang
  const after = r.state.board.cells.filter((x) => x === 3).length;
  assert.equal(after - before, 6);
});

test('battle: hồi máu không vượt tối đa; Tim hồi theo chỉ số heal', () => {
  const a = createBattle(ctx, { seed: 4, team: TEAM, enemies: FOES });
  const r = step(ctx, a, { type: 'skill', index: 4 });
  assert.equal(r.state.hp, r.state.maxHp);
  const hurt = { ...a, hp: 1000 };
  const r2 = step(ctx, hurt, { type: 'skill', index: 4 });
  assert.equal(r2.state.hp, 1000 + Math.round(a.maxHp * 0.35));
});

test('battle: sát thương combo tăng theo n và nhóm 4 ngọc được nhân thêm', () => {
  // dựng bàn có sẵn 2 combo Hỏa (hàng 0 và hàng 4), lượt đi đổi nhẹ không phá chúng
  const cells = Array.from({ length: N }, (_, i) => (((i % 6) + ((i / 6) | 0)) % 2 === 0 ? 4 : 5));
  [0, 1, 2].forEach((i) => (cells[i] = 1)); // 3 Hỏa
  [24, 25, 26, 27].forEach((i) => (cells[i] = 1)); // 4 Hỏa
  const base = createBattle(ctx, { seed: 5, team: ['demo_hoa'], enemies: ['m_tide'] });
  base.board = { cells, enh: new Array(N).fill(0) };
  // đi một nước vô hại: đổi chỗ hai ngọc Hỏa (bàn không đổi)
  const r = step(ctx, base, { type: 'move', path: [0, 1] });
  const hits = r.events.filter((e) => e.type === 'step').flatMap((e) => e.hits);
  const dmg = hits.filter((h) => h.kind === 'damage');
  assert.ok(dmg.length >= 2);
  // Hỏa vs Thủy: bị khắc x0.5. Nhóm 3: 150*1*1*0.5=75
  assert.equal(dmg[0].raw, 75);
  // Nhóm 4 là combo thứ 2: size=1.25, four=1.5, combo=1.25 => 150*1.25*1.5*1.25*0.5
  assert.equal(dmg[1].raw, Math.round(150 * 1.25 * 1.5 * 1.25 * 0.5));
});

test('battle: quái đánh sau N lượt và có thể thua', () => {
  let s = createBattle(ctx, { seed: 6, team: ['demo_tim'], enemies: ['m_ember'] });
  s = { ...s, hp: 100 };
  let guard = 0;
  while (s.status === 'playing' && guard++ < 50) {
    const r = step(ctx, s, { type: 'move', path: [0, 6] });
    s = r.state;
  }
  assert.equal(s.status, 'lost');
});

test('replay: cùng record chạy hai lần ra cùng hash', () => {
  const rng = mulberry32(99);
  const rec = newRecord(123, TEAM, FOES);
  let st = createBattle(ctx, rec);
  for (let i = 0; i < 25 && st.status === 'playing'; i++) {
    const a = rng.next() < 0.1 ? { type: 'skill', index: rng.int(5) } : { type: 'move', path: randomPath(rng) };
    const r = step(ctx, st, a);
    if (r.events[0]?.type !== 'invalid') rec.actions.push(a);
    st = r.state;
  }
  assert.equal(replayHash(ctx, rec), replayHash(ctx, rec));
  assert.equal(hashState(play(ctx, rec)), hashState(st));
  // JSON round-trip của record vẫn ra cùng kết quả
  const copy = JSON.parse(JSON.stringify(rec));
  assert.equal(replayHash(ctx, copy), hashState(st));
});

test('fuzz: 1000 trận ngẫu nhiên không crash, bàn luôn hợp lệ, trận luôn kết thúc', () => {
  const rng = mulberry32(2024);
  let won = 0;
  let lost = 0;
  for (let g = 0; g < 1000; g++) {
    let st = createBattle(ctx, { seed: g, team: TEAM, enemies: FOES });
    let turns = 0;
    while (st.status === 'playing' && turns < 400) {
      const useSkill = rng.next() < 0.15;
      const a = useSkill ? { type: 'skill', index: rng.int(5) } : { type: 'move', path: randomPath(rng) };
      const r = step(ctx, st, a);
      st = r.state;
      assert.equal(st.board.cells.length, N);
      for (const x of st.board.cells) assert.ok(x >= 0 && x <= 5 && Number.isInteger(x));
      assert.ok(Number.isFinite(st.hp) && st.hp >= 0 && st.hp <= st.maxHp);
      for (const e of st.enemies) assert.ok(e.hp >= 0 && e.hp <= e.maxHp);
      if (a.type === 'move' && r.events[0]?.type === 'step') {
        assert.equal(findGroups(st.board).length, 0);
      }
      turns++;
    }
    assert.notEqual(st.status, 'playing', `trận ${g} không kết thúc`);
    st.status === 'won' ? won++ : lost++;
  }
  assert.equal(won + lost, 1000);
});

test('battle: khóa mục tiêu dồn sát thương/kỹ năng 1 mục tiêu vào quái đã khóa, chạm lại để bỏ', () => {
  const a = createBattle(ctx, { seed: 5, team: TEAM, enemies: ['water_n1', 'water_n1'] });
  assert.equal(a.focus, null);
  const bad = step(ctx, a, { type: 'target', index: 9 });
  assert.equal(bad.events[0].type, 'invalid');
  const r = step(ctx, a, { type: 'target', index: 1 });
  assert.equal(r.state.focus, 1);
  assert.equal(r.state.turn, a.turn, 'khóa không tốn lượt');
  assert.equal(a.focus, null, 'state cũ không bị sửa');
  // Mọi đòn đánh vào quái 1
  const rng = mulberry32(3);
  let s = r.state;
  for (let i = 0; i < 40 && s.status === 'playing'; i++) {
    const before0 = s.enemies[0].hp;
    const out = step(ctx, s, { type: 'move', path: randomPath(rng) });
    if (out.events[0]?.type === 'invalid') continue;
    if (s.enemies[1].hp > 0) assert.equal(out.state.enemies[0].hp, before0, 'quái không bị khóa không bị đánh');
    s = out.state;
  }
  assert.equal(step(ctx, r.state, { type: 'target', index: 1 }).state.focus, null);
  // quái khóa chết thì tự chuyển sang quái còn sống
  const dead = structuredClone(r.state);
  dead.enemies[1].hp = 0;
  const hit = step(ctx, dead, { type: 'skill', index: 2 });
  assert.notEqual(hit.events[0]?.type, 'invalid');
});
