// Hòm đồ, mua vé, dùng Tinh Hoa, vuốt mép (popstate) = nút quay lại.
const { chromium } = require('playwright');
const OUT = process.env.OUT || '/tmp';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Bot'); await p.fill('#ob-callsign', 'B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.waitForSelector('#b-profile', { timeout: 15000 });
  await p.evaluate(() => window.__cheat([]));
  await p.waitForTimeout(300);
  await p.click('#cur button >> nth=0');
  await p.waitForSelector('#item-grid');
  await p.screenshot({ path: `${OUT}/items.png` });
  await p.click('[data-item="elixir2"]');
  await p.screenshot({ path: `${OUT}/items-sel.png` });
  const n = await p.locator('.slot').count();
  console.log('slots', n);
  // edge swipe = back
  await p.evaluate(() => history.back());
  await p.waitForSelector('#b-profile', { timeout: 3000 });
  console.log('popstate → hub OK');
  await p.evaluate(() => history.back());
  await p.waitForTimeout(300);
  console.log('still in app at hub:', await p.locator('#b-profile').count());
  console.log('errors:', errs);
  await b.close();
})();
