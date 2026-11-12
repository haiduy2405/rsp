const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('#ob-skip'); await p.waitForTimeout(500); await p.tap('[data-flag=JP]'); await p.waitForTimeout(300);
  await p.screenshot({ path: '/home/claude/art-src/shots/flags.png' });
  await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.waitForTimeout(500);
  console.log('hometown saved', await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /save/i.test(k))) || '{}').player?.hometown), errs); await b.close();
})();
