import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, characterSchema, monsterSchema, configSchema } from '../www/js/core/schema.js';
import { createT, detectLang } from '../www/js/i18n/index.js';
import { readJson } from './helpers.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('core: không có Math.random, Date.now, hay DOM', () => {
  const dir = path.join(root, 'www', 'js', 'core');
  const banned = [/Math\.random/, /Date\.now/, /new Date\(/, /\bdocument\b/, /\bwindow\b/, /performance\.now/];
  for (const f of fs.readdirSync(dir)) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
    for (const re of banned) assert.ok(!re.test(src), `${f} chứa ${re}`);
  }
});

test('schema: dữ liệu mẫu hợp lệ', () => {
  assert.deepEqual(validate(readJson('config.json'), configSchema), []);
  for (const c of readJson('characters.json')) assert.deepEqual(validate(c, characterSchema), [], c.id);
  for (const m of readJson('monsters.json')) assert.deepEqual(validate(m, monsterSchema), [], m.id);
});

test('schema: phát hiện dữ liệu sai', () => {
  assert.ok(validate({ id: 'x' }, characterSchema).length > 0);
  assert.ok(validate({ id: 'x', element: 9, rarity: 3, hp: 1, atk: 1, heal: 1 }, characterSchema).length > 0);
});

test('i18n: vi và en có cùng bộ key, mọi tên dữ liệu đều có chuỗi', () => {
  const vi = JSON.parse(fs.readFileSync(path.join(root, 'www/js/i18n/vi.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(root, 'www/js/i18n/en.json'), 'utf8'));
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort());
  for (const c of readJson('characters.json')) assert.ok(vi['char.' + c.id], c.id);
  for (const m of readJson('monsters.json')) assert.ok(vi['monster.' + m.id], m.id);
});

test('i18n: t() thay tham số, dự phòng en rồi tới key; detectLang', () => {
  const t = createT({ a: 'Xin {n}' }, { a: 'Hi {n}', b: 'only en' });
  assert.equal(t('a', { n: 3 }), 'Xin 3');
  assert.equal(t('b'), 'only en');
  assert.equal(t('zzz'), 'zzz');
  assert.equal(detectLang('vi-VN'), 'vi');
  assert.equal(detectLang('fr-FR'), 'en');
  assert.equal(detectLang(undefined), 'en');
});

test('data: zones, monsters, events tham chiếu đúng và đủ chuỗi i18n', () => {
  const vi = JSON.parse(fs.readFileSync(path.join(root, 'www/js/i18n/vi.json'), 'utf8'));
  const monsters = Object.fromEntries(readJson('monsters.json').map((m) => [m.id, m]));
  const zones = readJson('zones.json');
  assert.equal(zones.length, 6);
  zones.forEach((z, i) => {
    assert.equal(z.order, i);
    assert.equal(z.element, i);
    assert.ok(vi['zone.' + z.id], z.id);
    assert.ok(z.monsters.normal.length >= 2 && z.monsters.elite.length >= 1);
    assert.ok(z.monsters.boss.length >= 1, z.id); // mọi khu đều có Boss cuối ải
    for (const kind of ['normal', 'elite', 'boss'])
      for (const id of z.monsters[kind]) {
        assert.ok(monsters[id], id);
        assert.equal(monsters[id].kind, kind);
      }
  });
  const events = readJson('events.json');
  assert.ok(events.length >= 16);
  for (const ev of events) {
    assert.ok(vi[`ev.${ev.id}.title`] && vi[`ev.${ev.id}.body`], ev.id);
    assert.equal(ev.choices.length, 2);
    ev.choices.forEach((c, ci) => {
      assert.ok(vi[`ev.${ev.id}.c${ci}`]);
      c.outcomes.forEach((o, oi) => {
        assert.ok(vi[`ev.${ev.id}.o${ci}_${oi}`]);
        assert.ok(o.weight > 0 && o.effects.length > 0);
      });
    });
  }
  const cfg = readJson('config.json');
  for (const k of ['normal', 'elite', 'boss', 'chest', 'completion']) assert.ok(cfg.loot[k], k);
  for (const it of ['potion', 'shield', 'time']) assert.ok(vi['item.' + it]);
});
