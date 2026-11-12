const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('#ob-skip'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub');
  await p.tap('[data-zone]'); await p.tap('#team-go');
  for (let n = 0; n < 12; n++) { // đi qua rương/nghỉ/sự kiện tới khi vào trận
    if (await p.evaluate(() => !!window.__game)) break;
    if (await p.locator('#tut-skip').isVisible().catch(() => false)) { await p.tap('#tut-skip'); await p.waitForTimeout(300); continue; }
    const m = p.locator('[data-door]').filter({ hasText: /Monsters|Quái thường/ });
    if (await m.count()) await m.first().tap().catch(() => {});
    else for (const id of ['#continue', '[data-choice="0"]', '#leave']) if (await p.locator(id).count()) { await p.tap(id).catch(() => {}); break; }
    await p.waitForTimeout(350);
  }
  for (const s2 of ['#tut-next', '#tut-next', '#tut-go']) { await p.waitForSelector(s2, { timeout: 800 }).catch(() => {}); if (await p.locator(s2).isVisible().catch(() => false)) await p.tap(s2); }
  await p.waitForTimeout(500);
  if (!(await p.evaluate(() => !!window.__game))) throw new Error('không vào được trận');
  const box = await p.locator('#cv').boundingBox();
  const at = (x, y) => ({ x: box.x + x / 540 * box.width, y: box.y + y / 960 * box.height });
  const hold = async (x, y, ms) => { const q = at(x, y); await p.mouse.move(q.x, q.y); await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); };
  // nhấn giữ tướng 2
  await hold(12 + 104 * 2 + 50, 430, 700);
  await p.waitForSelector('#info'); const t1 = (await p.textContent('#info')).replace(/\s+/g, ' ');
  console.log('member:', t1.slice(0, 220)); if (/null|undefined|NaN/.test(t1)) throw new Error('bảng tướng lỗi text');
  await p.click('#info-close'); if (await p.locator('#info').count()) throw new Error('không đóng');
  // nhấn giữ quái 0
  await hold(135, 160, 700);
  await p.waitForSelector('#info'); const t2 = (await p.textContent('#info')).replace(/\s+/g, ' ');
  console.log('enemy:', t2.slice(0, 220)); if (/null|undefined|NaN/.test(t2)) throw new Error('bảng quái lỗi text');
  await p.click('#info-close');
  // chạm nhanh không mở bảng
  await hold(12 + 104 * 2 + 50, 430, 80); await p.waitForTimeout(150);
  if (await p.locator('#info').count()) throw new Error('chạm nhanh mở bảng');
  console.log('errors:', errs); if (errs.length) process.exit(1);
  await b.close();
})();
