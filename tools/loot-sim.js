// Mô phỏng loot: mỗi khu chạy N chuyến, người chơi chọn cửa ngẫu nhiên và coi như thắng mọi trận.
// Dùng: node tools/loot-sim.js [số chuyến, mặc định 10000]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCtx, DATA_FILES } from '../www/js/core/ctx.js';
import { mulberry32 } from '../www/js/core/rng.js';
import { createRun, runStep, debugWinBattle } from '../www/js/core/run.js';
import { DEFAULT_TEAM } from '../www/js/core/progress.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www', 'js', 'data');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const ctx = buildCtx(Object.fromEntries(DATA_FILES.map((k) => [k, rd(`${k}.json`)])));

export function simulateRun(ctx, seed, zoneId, pityMissed, diff = 'easy') {
  const pick = mulberry32(seed ^ 0x9e3779b9);
  let run = createRun(ctx, { seed, zoneId, team: DEFAULT_TEAM, pityMissed, diff });
  for (let guard = 0; run.phase !== 'end' && guard < 200; guard++) {
    if (run.phase === 'doors') run = runStep(ctx, run, { type: 'door', index: pick.int(run.doors.length) }).run;
    else if (run.phase === 'battle') run = debugWinBattle(ctx, run);
    else if (run.phase === 'result') run = runStep(ctx, run, { type: 'continue' }).run;
    else if (run.phase === 'event') run = runStep(ctx, run, { type: 'eventChoice', index: pick.int(2) }).run;
    else if (run.phase === 'shop') run = runStep(ctx, run, { type: 'leaveShop' }).run;
  }
  return run;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const N = Number(process.argv[2] || 10000);
  const needN = ctx.config.sim.awakenNormalStones;
  const needR = ctx.config.sim.awakenRareStones;
  console.log(`Mô phỏng ${N} chuyến/khu, thắng mọi trận. Mục tiêu 1 bậc Thức tỉnh: ${needN} Thường + ${needR} Hiếm\n`);
  for (const z of ctx.zoneList) {
    let seed = 1;
    let pity = false;
    const st = { normal: 0, rare: 0, withRare: 0, floors: 0, pityHits: 0, gold: 0, essence: 0, shards: 0 };
    for (let i = 0; i < N; i++) {
      const r = simulateRun(ctx, seed++, z.id, pity);
      pity = r.rareMissed;
      st.normal += r.loot.stones.normal; st.rare += r.loot.stones.rare;
      st.withRare += r.loot.stones.rare > 0 ? 1 : 0; st.floors += r.floors;
      st.pityHits += r.pityGranted ? 1 : 0; st.gold += r.loot.gold; st.essence += r.loot.essence; st.shards += r.loot.shards;
    }
    const f = (x) => (x / N).toFixed(2);
    console.log(
      `${z.id.padEnd(11)} ải ${f(st.floors)} | Vàng ${f(st.gold)} | Tinh Hoa ${f(st.essence)} | Mảnh ${f(st.shards)} | Thường ${f(st.normal)} | Hiếm ${f(st.rare)}` +
        ` | có Hiếm ${(100 * st.withRare / N).toFixed(0)}% | bảo hiểm ${(100 * st.pityHits / N).toFixed(0)}%` +
        ` | chuyến/bậc Thường ${(needN / (st.normal / N)).toFixed(2)}, Hiếm ${(needR / (st.rare / N)).toFixed(2)}`
    );
  }
}
