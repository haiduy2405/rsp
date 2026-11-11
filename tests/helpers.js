import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { indexById, buildCtx } from '../www/js/core/ctx.js';

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www', 'js', 'data');
export const readJson = (f) => JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));

const demo = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'demo_characters.json'), 'utf8'));

export function loadCtx() {
  return buildCtx({
    config: readJson('config.json'),
    characters: [...demo, ...readJson('characters.json')],
    duos: readJson('duos.json'),
    banners: readJson('banners.json'),
    story: readJson('story.json'),
    monsters: readJson('monsters.json'),
    zones: readJson('zones.json'),
    events: readJson('events.json'),
  });
}
export { indexById };

export const TEAM = ['demo_thuy', 'demo_hoa', 'demo_moc', 'demo_quang', 'demo_tim'];
export const FOES = ['m_ember', 'm_tide', 'm_shade'];

// Đường kéo ngẫu nhiên (dùng rng của core) - không đi lại ô cũ.
export function randomPath(rng, allowDiagonal = false) {
  const start = rng.int(30);
  const path = [start];
  const len = 2 + rng.int(10);
  const seen = new Set(path);
  while (path.length < len) {
    const cur = path[path.length - 1];
    const r = (cur / 6) | 0;
    const c = cur % 6;
    const opts = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (!allowDiagonal && dr && dc) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= 5 || nc < 0 || nc >= 6) continue;
        const q = nr * 6 + nc;
        if (!seen.has(q)) opts.push(q);
      }
    if (!opts.length) break;
    const q = opts[rng.int(opts.length)];
    path.push(q);
    seen.add(q);
  }
  return path;
}
