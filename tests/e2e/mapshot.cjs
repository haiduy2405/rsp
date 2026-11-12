const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('#ob-skip'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub');
  await p.waitForTimeout(600); await p.tap('[data-zone]'); await p.waitForTimeout(400);
  await p.tap('[data-stage="1"]'); await p.waitForTimeout(300); await p.tap('#team-go'); await p.waitForTimeout(900);
  await p.screenshot({ path: '/home/claude/art-src/shots/map.png' }); const bx = await p.locator('[data-door="1"]').boundingBox(); await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up(); await p.waitForTimeout(300);
  console.log('detail open', await p.locator('.doordetail').count(), 'still on map', await p.locator('.runmap').count()); await p.screenshot({ path: '/home/claude/art-src/shots/map2.png' }); console.log('errors', errs); await b.close();
})();
