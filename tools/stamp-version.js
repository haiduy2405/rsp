// Ghi www/js/version.js: số phiên bản (package.json), số bản dựng (đếm commit + 1), ngày. Chạy trước mỗi commit: npm run stamp
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { genPrecache } from './gen-precache.js';
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
let build = 1;
try { build = Number(execSync('git rev-list --count HEAD', { cwd: new URL('..', import.meta.url).pathname }).toString().trim()) + 1; } catch { /* không có git */ }
const d = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
fs.writeFileSync(new URL('../www/js/version.js', import.meta.url), `// Tự sinh bởi tools/stamp-version.js, đừng sửa tay.\nexport const VERSION = '${pkg.version}';\nexport const BUILD = ${build};\nexport const BUILD_DATE = '${d}';\n`);
const swUrl = new URL('../www/sw.js', import.meta.url);
fs.writeFileSync(swUrl, fs.readFileSync(swUrl, 'utf8').replace(/^\/\/ build: .*$/m, `// build: ${pkg.version} #${build} (tools/stamp-version.js ghi đè dòng này mỗi bản dựng → sw.js đổi byte → trình duyệt cài SW mới)`));
console.log(`version ${pkg.version} build ${build} ${d}`);
const pc = genPrecache();
console.log(`precache ${pc.count} tệp, ${(pc.bytes / 1048576).toFixed(2)} MB`);
