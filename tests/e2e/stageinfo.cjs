// Giữ vào độ khó thì hiện thông tin ải; chạm nhanh thì vào chọn đội. Dùng: node tests/e2e/stageinfo.cjs [ảnh.png]
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Bot'); await p.fill('#ob-callsign', 'B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.click('[data-zone]');
  const box = await p.locator('[data-stage="1"]').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
  await p.waitForSelector('.stageinfo', { timeout: 2000 });
  console.log('info shown:', true, '| still on stages:', await p.locator('[data-stage="1"]').count() > 0);
  if (process.argv[2]) await p.screenshot({ path: process.argv[2] });
  await p.click('#info-close');
  await p.click('[data-stage="1"]');
  console.log('tap opens team prep:', await p.locator('#team-go').count() > 0, '| errors:', errs);
  await b.close();
})();
