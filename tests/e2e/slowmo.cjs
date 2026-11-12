const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (let attempt = 1; attempt <= 8; attempt++) {
  const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('#ob-skip'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub');
  await p.waitForTimeout(600); await p.tap('[data-zone]'); await p.waitForTimeout(400);
  await p.tap('[data-stage="1"]'); await p.waitForTimeout(300); await p.tap('#team-go');
  for (let n = 0; n < 12; n++) { if (await p.evaluate(() => !!window.__game)) break;
    if (await p.locator('#tut-skip').isVisible().catch(() => false)) { await p.tap('#tut-skip'); await p.waitForTimeout(300); continue; }
    const m = p.locator('[data-door]').filter({ hasText: /Monsters|Quái thường/ });
    if (await m.count()) await m.first().tap().catch(() => {}); else for (const id of ['#continue', '[data-choice="0"]', '#leave']) if (await p.locator(id).count()) { await p.tap(id).catch(() => {}); break; }
    await p.waitForTimeout(350); }
  await p.waitForTimeout(600);
  await p.evaluate(() => { const st = window.__game.getState(); st.enemies.forEach((e) => { e.hp = 1; }); window.__game.refresh(); window.__tl = []; const v = window.__game.getView(); const t0 = performance.now(); const iv = setInterval(() => { window.__tl.push([Math.round(performance.now() - t0), v.slow ?? 1, v.enemies.filter((e) => e.hp <= 0).length]); }, 25); window.__iv = iv; });
  const path = await p.evaluate(() => window.__game.getHint());
  const box = await p.locator('canvas').first().boundingBox();
  const cell = (c) => ({ x: box.x + box.width * ((c % 6) * 90 + 45) / 540, y: box.y + box.height * (480 + Math.floor(c / 6) * 90 + 45) / 960 });
  const pts = path.map(cell);
  await p.mouse.move(pts[0].x, pts[0].y); await p.mouse.down();
  for (const q of pts.slice(1)) await p.mouse.move(q.x, q.y, { steps: 4 });
  await p.mouse.up(); await p.waitForTimeout(16000);
  const tl = await p.evaluate(() => { clearInterval(window.__iv); return window.__tl; });
  let firstDead = null, firstSlow = null, secondDead = null;
  for (const [t, sl, d] of tl) { if (d >= 1 && firstDead === null) firstDead = t; if (d >= 2 && secondDead === null) secondDead = t; if (sl < 1 && firstSlow === null) firstSlow = t; }
  console.log('first enemy dead at', firstDead, 'last enemy dead at', secondDead, 'slow-mo starts at', firstSlow);
  console.log('slow before first death?', tl.some(([t, sl, d]) => sl < 1 && d < 1), '| slow while only some dead?', tl.some(([t, sl, d]) => sl < 1 && d < 2));
  console.log('timeline sample', JSON.stringify(tl.filter((_, i) => i % 40 === 0)), 'status', await p.evaluate(() => window.__game?.getState?.().status), 'hp', await p.evaluate(() => JSON.stringify(window.__game?.getView?.().enemies.map((e) => e.hp))));
  console.log('attempt', attempt, 'errors', errs);
  await ctx.close();
  if (secondDead !== null) break;
  }
  await b.close();
})();
