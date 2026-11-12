// Mô phỏng loot: mỗi khu chạy N chuyến, người chơi chọn cửa ngẫu nhiên và coi như thắng mọi trận.
// Dùng: node tools/loot-sim.js [số chuyến, mặc định 10000]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCtx, DATA_FILES } from '../www/js/core/ctx.js';
import { mulberry32 } from '../www/js/core/rng.js';
import { createRun, runStep, debugWinBattle } from '../www/js/core/run.js';
import { DEFAULT_TEAM } from '../www/js/core/progress.js';
import { awakenCost } from '../www/js/core/upgrade.js';

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
    else if (run.phase === 'relic') run = runStep(ctx, run, { type: 'pickRelic', index: 0 }).run;
  }
  return run;
}

// Nhịp tiến triển: số chuyến (thắng hết) để đủ nguyên liệu Form 2 của một tướng 3★ / 5★, theo độ khó (mục tiêu: config.balance.pacing).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const N = Number(process.argv[2] || 3000);
  const cost = { 3: awakenCost(ctx, 'thetis', 1), 5: awakenCost(ctx, 'thuy_tinh', 1) };
  const target = ctx.config.balance.pacing.form2Runs;
  console.log(`Mô phỏng ${N} chuyến/độ khó (khu Thủy, thắng mọi trận). Form 2: 3★ ${JSON.stringify(cost[3])}, 5★ ${JSON.stringify(cost[5])}\n`);
  for (const diff of ctx.config.difficulty.order) {
    let seed = 1;
    let pity = false;
    const st = { normal: 0, rare: 0, withRare: 0, floors: 0, pityHits: 0, gold: 0, essence: 0, shards: 0 };
    for (let i = 0; i < N; i++) {
      const r = simulateRun(ctx, seed++, 'zone_water', pity, diff);
      pity = r.rareMissed;
      st.normal += r.loot.stones.normal; st.rare += r.loot.stones.rare;
      st.withRare += r.loot.stones.rare > 0 ? 1 : 0; st.floors += r.floors;
      st.pityHits += r.pityGranted ? 1 : 0; st.gold += r.loot.gold; st.essence += r.loot.essence; st.shards += r.loot.shards;
    }
    const a = (x) => x / N;
    const line = `${diff.padEnd(6)} Vàng ${a(st.gold).toFixed(0)} | Tinh Hoa ${a(st.essence).toFixed(0)} | Mảnh ${a(st.shards).toFixed(2)} | Hiếm ${a(st.rare).toFixed(2)} | có Hiếm ${(100 * st.withRare / N).toFixed(0)}% | bảo hiểm ${(100 * st.pityHits / N).toFixed(0)}%`;
    const runs = (r) => Math.max(r.shards / a(st.shards), r.stones / a(st.rare), r.gold / a(st.gold));
    const fmt = (rar) => { const n = runs(cost[rar]); const [lo, hi] = target[rar]; return `${rar}★ ${n.toFixed(1)} chuyến (mục tiêu ${lo}-${hi}) ${diff === 'hard' ? 'nhanh hơn có chủ đích' : n >= lo && n <= hi ? 'OK' : 'LỆCH'}`; };
    console.log(`${line}\n       Form 2: ${fmt(3)} | ${fmt(5)}`);
  }
}
