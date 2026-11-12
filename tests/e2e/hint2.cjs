const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
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
  const has = () => p.evaluate(() => !!window.__game.getHint?.());
  console.log('hint before move:', await has());
  // thực hiện đúng đường gợi ý bằng chuột
  for (let m = 1; m <= 2; m++) {
    const path = await p.evaluate(() => window.__game.getHint?.());
    if (!path) { console.log('no hint at move', m); break; }
    const box = await p.locator('canvas').first().boundingBox();
    const cell = (c) => ({ x: box.x + box.width * ((c % 6) * 90 + 45) / 540, y: box.y + box.height * (480 + Math.floor(c / 6) * 90 + 45) / 960 });
    console.log('move', m, 'path len', path.length);
    const pts = path.map(cell);
    await p.mouse.move(pts[0].x, pts[0].y); await p.mouse.down();
    for (const q of pts.slice(1)) { await p.mouse.move(q.x, q.y, { steps: 4 }); }
    console.log('hint path', JSON.stringify(path), 'drag path', JSON.stringify(await p.evaluate(() => window.__game.getDragPath())));
    await p.mouse.up(); for (let w = 0; w < 40 && !(await has()); w++) await p.waitForTimeout(500);
    await p.screenshot({ path: '/home/claude/art-src/shots/hint2-' + m + '.png' });
    console.log('hint after move', m, await has(), 'turn', await p.evaluate(() => window.__game.getState().turn), 'drag', await p.evaluate(() => JSON.stringify(window.__game.getDragPath())), 'doors?', await p.locator('[data-door]').count());
    if (await p.locator('[data-door]').count()) { const mm = p.locator('[data-door]').first(); await mm.tap().catch(() => {}); await p.waitForTimeout(3500); }
  }
  console.log('errors', errs); await b.close();
})();
