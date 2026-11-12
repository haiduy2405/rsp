const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const D = '/home/claude/art-src/shots/';
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('#ob-skip'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub');
  // chi tiết tướng, cuối trang (Thức tỉnh)
  await p.tap('#b-team'); await p.getByRole('button', { name: /Collection/ }).tap(); await p.locator('[data-char="thetis"]').tap(); await p.waitForTimeout(400);
  await p.mouse.move(270, 600); await p.mouse.wheel(0, 3000); await p.waitForTimeout(400); await p.screenshot({ path: D + 'aw1.png' });
  await p.goto('http://localhost:8080/?debug'); await p.waitForTimeout(500);
  await p.tap('[data-zone]'); await p.tap('[data-stage="1"]'); await p.tap('#team-go');
  for (let n = 0; n < 120; n++) {
    if (await p.locator('.end-title').count()) break;
    if (await p.locator('#tut-skip').isVisible().catch(() => false)) { await p.tap('#tut-skip'); await p.waitForTimeout(300); continue; }
    if (await p.evaluate(() => !!window.__game && window.__game.getState().status === 'playing')) { await p.evaluate(() => window.__debugWin()); await p.waitForTimeout(500); continue; }
    const m = p.locator('[data-door]').filter({ hasText: /Monsters|Quái thường/ });
    if (await m.count()) await m.first().tap().catch(() => {});
    else for (const id of ['#continue', '[data-choice="0"]', '#leave']) if (await p.locator(id).count()) { await p.tap(id).catch(() => {}); break; }
    await p.waitForTimeout(400);
  }
  await p.waitForTimeout(3500); await p.screenshot({ path: D + 'end1.png' }); await p.mouse.move(270, 700); await p.mouse.wheel(0, 900); await p.waitForTimeout(300); await p.screenshot({ path: D + 'end2.png' });
  console.log('errors', errs); await b.close();
})();
