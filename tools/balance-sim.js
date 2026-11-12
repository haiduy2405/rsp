// Máy chơi giả cho cân bằng: tham lam theo kết quả mô phỏng (thử K đường kéo ngẫu nhiên, chọn tốt nhất).
// Dùng: node tools/balance-sim.js [đội/khu=40] [lượt chơi/đội=2] [level=10] [thức tỉnh=2] [số đường thử=10] [seed=1]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCtx, DATA_FILES } from '../www/js/core/ctx.js';
import { mulberry32 } from '../www/js/core/rng.js';
import { step } from '../www/js/core/battle.js';
import { createRun, runStep } from '../www/js/core/run.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'www', 'js', 'data');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
export const ctx = buildCtx(Object.fromEntries(DATA_FILES.map((k) => [k, rd(`${k}.json`)])));

function randomPath(rng, locked) {
  for (let tries = 0; tries < 20; tries++) {
    const start = rng.int(30);
    if (locked.includes(start)) continue;
    const path = [start];
    const len = 3 + rng.int(9);
    const seen = new Set(path);
    while (path.length < len) {
      const cur = path[path.length - 1];
      const r = (cur / 6) | 0;
      const c = cur % 6;
      const opts = [];
      if (r > 0) opts.push(cur - 6);
      if (r < 4) opts.push(cur + 6);
      if (c > 0) opts.push(cur - 1);
      if (c < 5) opts.push(cur + 1);
      if (ctx.config.board.allowDiagonal) {
        if (r > 0 && c > 0) opts.push(cur - 7);
        if (r > 0 && c < 5) opts.push(cur - 5);
        if (r < 4 && c > 0) opts.push(cur + 5);
        if (r < 4 && c < 5) opts.push(cur + 7);
      }
      const ok = opts.filter((q) => !seen.has(q) && !locked.includes(q));
      if (!ok.length) break;
      const q = ok[rng.int(ok.length)];
      path.push(q);
      seen.add(q);
    }
    if (path.length >= 2) return path;
  }
  return null;
}

function score(events, before, after) {
  let s = 0;
  for (const e of events) {
    if (e.type === 'step') for (const h of e.hits) s += h.kind === 'damage' ? h.amount : h.amount * 0.6;
  }
  s -= (before.hp - after.hp) * 0.8;
  if (after.status === 'won') s += 1e6;
  if (after.status === 'lost') s -= 1e6;
  return s;
}

// Một lượt: dùng kỹ năng/Duo nếu sẵn sàng, rồi chọn đường kéo tốt nhất trong K đường.
function playTurn(state, rng, K) {
  let s = state;
  if (s.status === 'playing') {
    for (const d of s.duos) if (d.cd === 0) { const r = step(ctx, s, { type: 'duo', index: d.slot }); if (r.events[0].type !== 'invalid') s = r.state; }
    s.members.forEach((m, i) => {
      if (m.skillCd === 0 && s.status === 'playing') { const r = step(ctx, s, { type: 'skill', index: i }); if (r.events[0].type !== 'invalid') s = r.state; }
    });
  }
  if (s.status !== 'playing') return s;
  let best = null;
  for (let k = 0; k < K; k++) {
    const p = randomPath(rng, s.locked);
    if (!p) continue;
    const r = step(ctx, s, { type: 'move', path: p });
    if (r.events[0]?.type === 'invalid') continue;
    const sc = score(r.events, s, r.state);
    if (!best || sc > best.sc) best = { sc, state: r.state };
  }
  return best ? best.state : step(ctx, s, { type: 'move', path: [0, 1] }).state;
}

// Chọn cửa theo máu hiện tại.
function pickDoor(run) {
  const low = run.hp / run.maxHp < 0.6;
  const order = low ? ['rest', 'chest', 'event', 'shop', 'normal', 'elite', 'boss'] : ['chest', 'normal', 'shop', 'event', 'elite', 'rest', 'boss'];
  let best = 0;
  let rank = 99;
  run.doors.forEach((d, i) => { const r = order.indexOf(d); if (r < rank) { rank = r; best = i; } });
  return best;
}

export function playFullRun(seed, zoneId, team, K, diff = 'easy') {
  const rng = mulberry32(seed ^ 0xabcdef);
  let run = createRun(ctx, { seed, zoneId, team, pityMissed: false, diff });
  let turns = 0;
  for (let guard = 0; run.phase !== 'end' && guard < 2000; guard++) {
    if (run.phase === 'doors') {
      if (run.hp / run.maxHp < 0.5 && run.items.potion > 0) run = runStep(ctx, run, { type: 'useItem', item: 'potion' }).run;
      if (run.items.shield > 0 && !run.armed.shield) run = runStep(ctx, run, { type: 'useItem', item: 'shield' }).run;
      run = runStep(ctx, run, { type: 'door', index: pickDoor(run) }).run;
    } else if (run.phase === 'battle') {
      let b = run.battle;
      while (b.status === 'playing' && turns < 5000) { b = playTurn(b, rng, K); turns++; }
      // đồng bộ kết quả trận vào chuyến bằng cách phát lại hành động cuối: dùng debug cập nhật trạng thái
      run = finishBattle(run, b);
    } else if (run.phase === 'result') run = runStep(ctx, run, { type: 'continue' }).run;
    else if (run.phase === 'event') run = runStep(ctx, run, { type: 'eventChoice', index: 0 }).run;
    else if (run.phase === 'shop') {
      for (let i = 0; i < run.shop.length; i++) {
        const s = run.shop[i];
        if (!s.sold && s.item !== 'time' && run.loot.gold >= s.price) run = runStep(ctx, run, { type: 'buy', slot: i }).run;
      }
      run = runStep(ctx, run, { type: 'leaveShop' }).run;
    }
  }
  return { won: run.result === 'won', floors: run.floor + 1, total: run.floors, turns };
}

// Trận đã chạy ngoài run: đưa trạng thái cuối vào run bằng cách gọi runStep với battle đã kết thúc.
import { debugFinishBattle } from '../www/js/core/run.js';
const finishBattle = (run, b) => debugFinishBattle(ctx, run, b);

// Chế độ --targets: mỗi khu chạy ở Level/Thức tỉnh dự kiến và so với dải thắng trong config.balance.targets.
export function runTargets(teams = 60, runsPer = 2, K = 10, seed0 = 1, diff = 'easy') {
  const sim = ctx.config.difficulty[diff].sim;
  const bal = ctx.config.balance;
  const pr = mulberry32(seed0 * 7919);
  const chars = ctx.characterList;
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = pr.int(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const ids = Array.from({ length: teams }, () => shuffle(chars).slice(0, 5).map((c) => c.id));
  const out = [];
  for (const z of ctx.zoneList) {
    const base = bal.targets[z.id];
    // Độ khó cao hơn: đội mạnh hơn (Level/Thức tỉnh cộng thêm, tối đa 30/5), dải thắng dịch xuống.
    const tg = { level: Math.min(ctx.config.progression.levelMax, base.level + sim.levelBonus), awaken: Math.min(5, base.awaken + sim.awakenBonus), win: base.win.map((x) => x + sim.winShift) };
    let won = 0, runs = 0, turns = 0;
    ids.forEach((team, ti) => {
      for (let r = 0; r < runsPer; r++) {
        const res = playFullRun(seed0 * 1000 + ti * 10 + r, z.id, team.map((id) => ({ id, level: tg.level, awaken: tg.awaken })), K, diff);
        runs++; won += res.won ? 1 : 0; turns += res.turns;
      }
    });
    const win = won / runs;
    const minutes = (turns / runs) * bal.secondsPerTurn / 60;
    out.push({ zone: z.id, level: tg.level, awaken: tg.awaken, win, band: tg.win, minutes, okWin: win >= tg.win[0] && win <= tg.win[1], okTime: minutes >= bal.runMinutes[0] * 0.8 && minutes <= bal.runMinutes[1] });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === '--targets') {
  const [teams = 60, runsPer = 2, K = 10, seed0 = 1] = process.argv.slice(3).map(Number);
  const only = process.env.DIFF ? [process.env.DIFF] : ctx.config.difficulty.order;
  for (const diff of only) for (const r of runTargets(teams, runsPer, K, seed0, diff)) {
    console.log(`${diff.padEnd(6)} ${r.zone.padEnd(11)} Lv${String(r.level).padEnd(2)} A${r.awaken} thắng ${(100 * r.win).toFixed(0)}% (dải ${r.band.map((x) => x * 100).join('-')}%) ${r.okWin ? 'OK ' : 'LỆCH'} | ~${r.minutes.toFixed(1)} phút ${r.okTime ? 'OK' : 'LỆCH'}`);
  }
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [teams = 40, runsPer = 2, level = 10, awaken = 2, K = 10, seed0 = 1] = process.argv.slice(2).map(Number);
  const chars = ctx.characterList;
  const pr = mulberry32(seed0 * 7919);
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = pr.int(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const t0 = Date.now();
  console.log(`Balance-sim: ${teams} đội/khu x ${runsPer} lượt, Level ${level}, Thức tỉnh ${awaken}, ${K} đường thử/lượt\n`);
  const teamList = Array.from({ length: teams }, () => shuffle(chars).slice(0, 5).map((c) => ({ id: c.id, level, awaken })));
  const allResults = [];
  for (const z of ctx.zoneList) {
    let won = 0, runs = 0, floors = 0, turns = 0;
    teamList.forEach((team, ti) => {
      let w = 0;
      for (let r = 0; r < runsPer; r++) {
        const res = playFullRun(seed0 * 1000 + ti * 10 + r, z.id, team, K);
        runs++; w += res.won ? 1 : 0; floors += res.floors; turns += res.turns;
      }
      won += w;
      allResults.push({ zone: z.id, team, rate: w / runsPer });
    });
    console.log(`${z.id.padEnd(11)} thắng ${(100 * won / runs).toFixed(0)}% | ải trung bình ${(floors / runs).toFixed(2)} | lượt/chuyến ${(turns / runs).toFixed(0)} (~${((turns / runs) * 8 / 60).toFixed(1)} phút)`);
  }
  // Phân tích đội: đội thắng nhiều nhất (top 25% theo tỉ lệ thắng trung bình qua các khu)
  const byTeam = new Map();
  for (const r of allResults) { const k = r.team.map((m) => m.id).join(','); byTeam.set(k, [...(byTeam.get(k) || []), r.rate]); }
  const ranked = [...byTeam.entries()].map(([k, v]) => ({ ids: k.split(','), rate: v.reduce((a, b) => a + b, 0) / v.length })).sort((a, b) => b.rate - a.rate);
  const top = ranked.slice(0, Math.max(5, Math.round(ranked.length * 0.25)));
  const share = {};
  for (const c of chars) share[c.id] = top.filter((t) => t.ids.includes(c.id)).length / top.length;
  const elemShare = [0, 1, 2, 3, 4, 5].map((e) => chars.filter((c) => c.element === e).reduce((a, c) => a + share[c.id], 0) / chars.filter((c) => c.element === e).length);
  console.log(`\nTop ${top.length} đội (thắng trung bình ${(100 * top.reduce((a, b) => a + b.rate, 0) / top.length).toFixed(0)}% so với ${(100 * ranked.reduce((a, b) => a + b.rate, 0) / ranked.length).toFixed(0)}% chung)`);
  const sorted = Object.entries(share).sort((a, b) => b[1] - a[1]);
  console.log('Nhân vật xuất hiện nhiều nhất trong top: ' + sorted.slice(0, 6).map(([id, v]) => `${id} ${(100 * v).toFixed(0)}%`).join(', '));
  console.log('Nhân vật ít nhất: ' + sorted.slice(-6).map(([id, v]) => `${id} ${(100 * v).toFixed(0)}%`).join(', '));
  console.log('Mức hiện diện theo hệ (Thủy,Hỏa,Mộc,Quang,Ám,Tim): ' + elemShare.map((v) => (100 * v).toFixed(0) + '%').join(', '));
  const must = sorted.filter(([, v]) => v > 0.8);
  console.log(must.length ? `CẢNH BÁO nhân vật bắt buộc (>80%): ${must.map(([id]) => id).join(', ')}` : 'Không có nhân vật bắt buộc (>80% đội top).');
  console.log(`\nThời gian chạy ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
