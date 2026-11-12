// Đo thời gian mỗi callback rAF (update + draw) trong trận, giảm tốc CPU 4x để giả lập máy tầm trung.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
  await p.addInitScript(() => { window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ entryTypes: ['longtask'] }); } catch {} window.__ft = []; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf((t) => { const s = performance.now(); cb(t); window.__ft.push(performance.now() - s); }); });
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('#ob-next'); await p.tap('#ob-next'); await p.fill('#ob-name', 'Duy'); await p.tap('#ob-start');
  await p.waitForFunction(() => !!window.__game); await p.waitForTimeout(800);
  await p.evaluate(() => (window.__ft = []));
  const box = await p.locator('#cv').boundingBox();
  for (let i = 0; i < 5; i++) {
    if (await p.evaluate(() => window.__game.getState().status) !== 'playing') break;
    await p.waitForFunction(() => !window.__game.isBusy(), null, { timeout: 60000 });
    const path = await p.evaluate(async () => { const m = await import('/js/ui/hint.js'); const r = m.findHint(window.__ctx, window.__game.getState()); return r && r.path; });
    if (!path) break;
    const pts = path.map((c) => ({ x: box.x + box.width * ((c % 6) * 90 + 45) / 540, y: box.y + box.height * (480 + Math.floor(c / 6) * 90 + 45) / 960 }));
    await p.mouse.move(pts[0].x, pts[0].y); await p.mouse.down(); for (const q of pts.slice(1)) await p.mouse.move(q.x, q.y, { steps: 4 }); await p.mouse.up();
    await p.waitForTimeout(300);
  }
  const ft = await p.evaluate(() => window.__ft); ft.sort((a, b) => a - b);
  const q = (x) => ft[Math.floor(ft.length * x)] ?? 0;
  console.log('frames', ft.length, 'p50', q(.5).toFixed(1), 'p90', q(.9).toFixed(1), 'p99', q(.99).toFixed(1), 'max', ft.at(-1).toFixed(1), '>16.6ms:', ft.filter((x) => x > 16.6).length);
  console.log('longtasks ms', JSON.stringify(await p.evaluate(() => window.__lt)));
  console.log('findHint fresh ms', await p.evaluate(async () => { const m = await import('/js/ui/hint.js'); const b = await import('/js/core/battle.js'); const c = window.__ctx; const st = b.createBattle(c, { seed: 5, team: ['thetis','bennu','atalanta','eos','eir'].map((id) => ({ id, level: 1, awaken: 0, skillLv: { active: 1, leader: 1, passive: 1 } })), enemies: ['m_ember'] }); const t = performance.now(); m.findHint(c, st); return Math.round(performance.now() - t); }));
  console.log('now', await p.evaluate(() => Math.round(performance.now())));
  console.log('findHint ms', await p.evaluate(async () => { const m = await import('/js/ui/hint.js'); const t = performance.now(); m.findHint(window.__ctx, window.__game.getState()); return Math.round(performance.now() - t); }));
  await b.close();
})();
