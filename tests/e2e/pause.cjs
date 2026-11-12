// Tạm dừng giữa trận: thoát bỏ trận dở, giữ tiến trình cửa; nút Tiếp tục ở Hub. Dùng: node tests/e2e/pause.cjs [ảnh.png]
const { chromium } = require('playwright');
(async () => {
  let document_info = '';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Bot'); await p.fill('#ob-callsign', 'B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.click('[data-zone]'); await p.click('[data-stage=easy]'); await p.click('#team-go');
  await p.click('[data-door="0"]');
  await p.click('#tut-skip').catch(() => {});
  await p.waitForSelector('#pause-btn');
  await p.click('#pause-btn');
  await p.waitForSelector('#pause-resume', { timeout: 3000 }).catch(() => { console.log('no overlay; errors:', errs, 'info:', document_info); });
  await p.waitForTimeout(400);
  if (process.argv[2]) await p.screenshot({ path: process.argv[2] });
  await p.click('#pause-resume');
  console.log('overlay closed:', (await p.locator('#info').count()) === 0);
  await p.click('#pause-btn'); await p.click('#pause-quit');
  await p.click('#confirm-yes');
  await p.waitForTimeout(800);
  console.log('hub resume chip:', await p.locator('#b-resume').count());
  await p.click('#b-resume'); await p.waitForTimeout(500);
  console.log('back at doors:', await p.locator('[data-door="0"]').count() > 0, '| errors:', errs);
  await b.close();
})();
