const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('#ob-skip'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub');
  const D='/home/claude/art-src/shots/';
  await p.tap('#b-team'); await p.waitForTimeout(400); await p.screenshot({ path: D + 'h1.png' });
  await p.getByRole('button', { name: /Collection/ }).tap(); await p.waitForTimeout(400);
  await p.locator('[data-char="thetis"]').tap(); await p.waitForTimeout(500);
  await p.screenshot({ path: D + 'h2.png' });
  await p.mouse.move(270, 600); await p.mouse.wheel(0, 700); await p.waitForTimeout(300); await p.screenshot({ path: D + 'h3.png' });
  await b.close();
})();
