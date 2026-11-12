import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('www/js/data/audio.json', 'utf8'));
const main = readFileSync('www/js/main.js', 'utf8') + ['summon', 'shop', 'wish', 'profile'].map((n) => readFileSync(`www/js/ui/screen-${n}.js`, 'utf8')).join('\n');

test('mọi bài nhạc đủ trường và giai điệu đúng độ dài', () => {
  for (const [name, tr] of Object.entries(cfg.tracks)) {
    assert.ok(tr.bpm > 40 && tr.bpm < 200, name);
    assert.ok(tr.chords.length >= 4, name);
    for (const b of tr.lead.bars) assert.equal(b.length, 16, `${name} lead`);
    for (const k of ['arp', 'bass', 'drums', 'lead']) assert.ok(tr[k], `${name}.${k}`);
    assert.equal(tr.arp.pattern.length, 16, name);
    if (tr.form) for (const f of tr.form) assert.match(f, /^[palhbd]+$/, name);
    // nốt lead phải nằm trong thang âm 3 quãng tám
    for (const b of tr.lead.bars) for (const c of b) if (c !== '.') assert.ok(parseInt(c, 36) < 22, `${name} nốt quá cao`);
  }
});

test('mỗi vùng có đủ map/battle/boss và có bài cho các màn chính', () => {
  for (const z of ['water', 'fire', 'wood', 'light', 'dark', 'heart']) for (const k of ['map', 'battle', 'boss']) assert.ok(cfg.tracks[`${k}_${z}`], `${k}_${z}`);
  for (const n of ['hub', 'tutorial', 'title', 'summon', 'wish', 'shop', 'camp', 'mystery', 'victory', 'defeat', 'battle', 'boss']) assert.ok(cfg.tracks[n], n);
});

test('tên bài được gọi trong code đều tồn tại', () => {
  for (const m of main.matchAll(/music\('([a-z]+)'\)|playMusic\('([a-z]+)'\)/g)) assert.ok(cfg.tracks[m[1] || m[2]], m[1] || m[2]);
  for (const n of ['victory', 'defeat']) assert.ok(main.includes(`'${n}'`));
});

test('mọi mẫu âm thanh có file và âm kỹ năng đủ 6 hệ', () => {
  for (const [k, v] of Object.entries(cfg.samples)) assert.ok(existsSync(`www/${v.url}`), k);
  for (const e of ['water', 'fire', 'wood', 'light', 'dark', 'heart']) assert.ok(cfg.samples[`skill_${e}`], e);
  for (const k of ['levelup', 'bossIn', 'debuff', 'reflect', 'revive', 'enhance']) assert.ok(cfg.samples[k], k);
});
