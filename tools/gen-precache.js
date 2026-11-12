// Sinh www/precache.json: danh sách mọi tệp cần có để chơi offline (đường dẫn tương đối + kích thước).
// Chạy tự động trong `npm run stamp`. Nút "Tải dữ liệu offline" ở Cài đặt đọc danh sách này.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www');
const SKIP = new Set(['sw.js', 'precache.json']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

export function genPrecache() {
  const files = walk(root)
    .map((f) => ({ u: path.relative(root, f).split(path.sep).join('/'), s: fs.statSync(f).size }))
    .filter((f) => !SKIP.has(f.u));
  const bytes = files.reduce((a, f) => a + f.s, 0);
  fs.writeFileSync(path.join(root, 'precache.json'), JSON.stringify({ bytes, files }) + '\n');
  return { count: files.length, bytes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(genPrecache());
