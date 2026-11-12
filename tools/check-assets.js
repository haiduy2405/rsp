// Liệt kê asset thiếu/thừa so với manifest. Dùng: node tools/check-assets.js [--write]
// --write: sinh lại www/assets/manifest.json từ characters.json + danh sách cố định.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const chars = JSON.parse(fs.readFileSync(path.join(root, 'js/data/characters.json'), 'utf8'));
const list = Array.isArray(chars) ? chars : Object.values(chars.characters ?? chars);

export function expected() {
  const m = {};
  for (const c of list) {
    if (c.reserve) continue;
    m[`card:${c.id}`] = `assets/characters/${c.id}_card.webp`;
    m[`icon:${c.id}`] = `assets/characters/${c.id}_icon.webp`;
  }
  for (const mo of JSON.parse(fs.readFileSync(path.join(root, 'js/data/monsters.json'), 'utf8'))) m[`monster:${mo.id}`] = `assets/monsters/${mo.id}.webp`;
  for (let i = 0; i < 6; i++) m[`orb:${i}`] = `assets/orbs/orb${i}.webp`;
  for (const k of ['burn', 'poison', 'stun', 'freeze', 'shield', 'regen', 'atkUp', 'atkDown', 'reflect', 'pierce', 'lock', 'immune']) m[`fx:${k}`] = `assets/ui/fx/${k}.webp`;
  m['bg:hub'] = 'assets/bg/hub.webp';
  m['bg:battle'] = 'assets/bg/battle.webp';
  m['ui:logo'] = 'assets/ui/logo.webp';
  return m;
}

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(webp|png|jpg|jpeg|svg|ogg|mp3)$/i.test(e.name)) out.push(path.relative(root, p).split(path.sep).join('/'));
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const exp = expected();
  const have = new Set(walk(path.join(root, 'assets')));
  if (process.argv.includes('--write')) {
    // Manifest chỉ liệt kê file đang có, để trình duyệt không bắn 404 cho file chưa vẽ.
    const present = Object.fromEntries(Object.entries(exp).filter(([, p]) => have.has(p)));
    fs.writeFileSync(path.join(root, 'assets/manifest.json'), JSON.stringify({ version: 1, images: present }, null, 2) + '\n');
    console.log(`manifest: ${Object.keys(present).length}/${Object.keys(exp).length} mục`);
  }
  const want = new Set(Object.values(exp));
  const missing = [...want].filter((p) => !have.has(p));
  const extra = [...have].filter((p) => !want.has(p));
  const bytes = [...have].reduce((s, p) => s + fs.statSync(path.join(root, p)).size, 0);
  console.log(`Có ${have.size}/${want.size} asset (${(bytes / 1048576).toFixed(1)} MB; ngân sách < 150 MB cho cả AAB)`);
  if (missing.length) console.log(`THIẾU (${missing.length}):\n  ` + missing.join('\n  '));
  if (extra.length) console.log(`THỪA, không có trong manifest (${extra.length}):\n  ` + extra.join('\n  '));
  const bad = [...have].filter((p) => /_card\.webp$/.test(p) && fs.statSync(path.join(root, p)).size > 600 * 1024);
  if (bad.length) console.log('Nặng > 600 KB:\n  ' + bad.join('\n  '));
}
