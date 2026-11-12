// Cửa hàng hằng ngày: nhận món free, mua đan; Hòm đồ: tab Mảnh. Dùng: OUT=thư_mục node tests/e2e/shop.cjs
const { chromium } = require('playwright');
const OUT = process.env.OUT || '/tmp';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Bot'); await p.fill('#ob-callsign', 'B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.evaluate(() => window.__cheat([]));
  await p.click('#b-shop');
  await p.waitForSelector('[data-offer="free"]');
  await p.click('#buy-free');
  await p.waitForSelector('#shop-msg');
  console.log('free msg:', await p.textContent('#shop-msg'), '| spirit:', await p.textContent('#shop-spirit'));
  await p.click('#buy-el1');
  await p.click('#buy-frag3');
  console.log('after buy:', await p.textContent('#shop-msg'));
  await p.screenshot({ path: `${OUT}/shop.png` });
  await p.click('#shop-items');
  await p.click('[data-tab="frag"]');
  await p.waitForSelector('[data-item^="frag_"]');
  await p.click('[data-item^="frag_"]');
  await p.screenshot({ path: `${OUT}/frag.png` });
  console.log('free again disabled:', await p.evaluate(() => { document.querySelector('#back-top')?.click(); return true; }));
  console.log('errors:', errs);
  await b.close();
})();
