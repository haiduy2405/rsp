const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const D = '/home/claude/art-src/shots/';
  await p.goto('http://localhost:8080/?debug&slots'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('[data-slot="1"]'); await p.screenshot({ path: D + 'slots0.png' });
  console.log('slots shown', await p.locator('[data-slot]').count());
  // tạo ván ở ô 2
  await p.tap('[data-slot="2"]'); await p.waitForTimeout(500);
  await p.tap('#ob-skip'); await p.tap('[data-flag=VN]'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub'); await p.waitForTimeout(600);
  console.log('in hub', await p.locator('#b-battle').count());
  // về màn ván lưu qua cài đặt
  await p.tap('#b-set'); await p.waitForTimeout(400); await p.tap('#set-slots'); await p.waitForSelector('[data-slot="2"] [data-rename]');
  await p.waitForTimeout(900); await p.screenshot({ path: D + 'slots1.png' });
  await p.tap('[data-rename="2"]'); await p.fill('#slot-name', 'Ván chính'); await p.tap('#slot-save'); await p.waitForTimeout(300);
  console.log('renamed:', (await p.locator('[data-slot="2"] .sl-body b').innerText()));
  await p.tap('[data-del="2"]'); await p.waitForTimeout(900); await p.screenshot({ path: D + 'slots2.png' });
  await p.tap('#confirm-no'); await p.waitForTimeout(300);
  console.log('still used after cancel:', await p.locator('[data-slot="2"] [data-play]').count());
  await p.tap('[data-del="2"]'); await p.tap('#confirm-yes'); await p.waitForTimeout(300);
  console.log('after delete play btn:', await p.locator('[data-slot="2"] [data-play]').count(), 'empty card:', await p.locator('[data-slot="2"].empty').count());
  console.log('errors', errs); await b.close();
})();
