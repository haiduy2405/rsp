// Nhiệm vụ hằng ngày: chấm đỏ, tiến độ theo hành động thật (nhận quà shop), nhận thưởng, thưởng thêm. Dùng: node tests/e2e/quests.cjs <thư mục ảnh>
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2] || '.';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.waitForSelector('#ob-next'); await p.waitForTimeout(6500);
  await p.click('#ob-next'); await p.fill('#ob-name', 'D'); await p.click('#ob-start'); await p.waitForSelector('#cut');
  for (let k = 0; k < 4; k++) { await p.click('#cut', { force: true }).catch(() => {}); await p.waitForTimeout(250); }
  await p.waitForFunction(() => !!window.__game); await p.evaluate(() => { document.getElementById('coach')?.remove(); window.__cheat([]); });
  await p.waitForSelector('#b-quest'); await p.waitForTimeout(800);
  console.log('chấm đỏ khi mới vào (login xong):', await p.locator('#b-quest .red-dot').count());
  await p.click('#b-quest'); await p.waitForSelector('.quest'); await p.waitForTimeout(500);
  console.log('số nhiệm vụ:', await p.locator('.quest:not(.bonus)').count());
  await p.screenshot({ path: `${dir}/q1.png` });
  await p.click('#claim-login'); await p.waitForTimeout(400);
  console.log('thưởng:', await p.textContent('#quest-msg'), '| login đã nhận:', await p.locator('[data-quest=login].claimed').count());
  await p.click('#back'); await p.waitForTimeout(500);
  await p.click('#b-shop'); await p.waitForSelector('.shop-offer'); await p.click('.shop-offer button.primary'); await p.waitForTimeout(400);
  await p.click('#back, #back-top'); await p.waitForTimeout(500);
  await p.click('#b-quest'); await p.waitForSelector('.quest'); await p.waitForTimeout(400);
  const shopQ = await p.locator('[data-quest=shop_free]').count();
  console.log('có nhiệm vụ shop_free hôm nay:', shopQ, shopQ ? '| xong: ' + await p.locator('[data-quest=shop_free].done').count() : '');
  await p.screenshot({ path: `${dir}/q2.png` });
  await p.evaluate(() => { window.__progress().stats.wins = 12; });
  await p.click('#tab-achv'); await p.waitForSelector('[data-achv]'); await p.waitForTimeout(300);
  console.log('thành tựu:', await p.locator('[data-achv]').count(), '| sẵn nhận:', await p.locator('[data-achv].done').count());
  await p.screenshot({ path: `${dir}/q3.png` });
  if (await p.locator('#claim-achv-wins:not([disabled])').count()) { await p.click('#claim-achv-wins'); await p.waitForTimeout(300); console.log('nhận thành tựu:', await p.textContent('#quest-msg')); }
  console.log('errors:', errs); await b.close();
})();
