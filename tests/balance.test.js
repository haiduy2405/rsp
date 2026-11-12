import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playFullRun, ctx } from '../tools/balance-sim.js';
import { KEYS } from '../www/js/core/effects.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dict = (l) => JSON.parse(fs.readFileSync(path.join(root, `www/js/i18n/${l}.json`), 'utf8'));

test('balance-sim: máy chơi giả xác định theo seed và kết thúc trong giới hạn', () => {
  const team = ['thetis', 'bennu', 'atalanta', 'eos', 'eir'].map((id) => ({ id, level: 5, awaken: 1 }));
  const a = playFullRun(7, 'zone_water', team, 4);
  const b = playFullRun(7, 'zone_water', team, 4);
  assert.deepEqual(a, b);
  assert.ok(a.turns > 0 && a.turns < 5000);
});

test('i18n: đủ tên, viết tắt, mô tả cho 12 từ khóa; khuôn mẫu đội trưởng; mục tiêu kỹ năng', () => {
  for (const l of ['vi', 'en']) {
    const d = dict(l);
    for (const k of KEYS) for (const f of ['name', 'short', 'desc']) assert.ok(d[`effect.${k}.${f}`], `${l} effect.${k}.${f}`);
    for (const k of ['atk_element', 'hp_element', 'heal_boost', 'atk_all', 'hp_all', 'drag_time', 'combo_mult', 'rainbow']) assert.ok(d[`leader.${k}`], k);
    for (const k of ['one', 'all', 'team']) assert.ok(d[`target.${k}`], k);
  }
  assert.ok(ctx.characterList.length === 24);
});

test('độ khó tăng theo khu: quái khu sau mạnh hơn ở cùng ải', () => {
  const z = ctx.config.run.zoneScale;
  for (let i = 1; i < 6; i++) assert.ok(z.hp[i] >= z.hp[i - 1] && z.atk[i] >= z.atk[i - 1]);
});

test('config.balance.targets phủ đủ 6 khu với dải thắng hợp lệ', () => {
  const tg = ctx.config.balance.targets;
  for (const z of ctx.zoneList) {
    const b = tg[z.id];
    assert.ok(b, z.id);
    assert.ok(b.win[0] < b.win[1] && b.win[0] >= 0 && b.win[1] <= 1);
    assert.ok(b.level >= 1 && b.level <= ctx.config.progression.levelMax);
  }
});

test('đội thiếu người (1-4 tướng) vẫn chơi trọn một chuyến', () => {
  for (const n of [1, 2, 4]) {
    const team = ['thetis', 'bennu', 'atalanta', 'eos', 'eir'].slice(0, n).map((id) => ({ id, level: 5, awaken: 0 }));
    const r = playFullRun(3, 'zone_water', team, 4);
    assert.ok(r, `n=${n}`);
  }
});
