// Kéo ngọc theo vòng tròn nhanh (thuận/ngược chiều kim đồng hồ): đường đi phải đủ ô, không đứt.
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('#ob-skip'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub');
  await p.tap('[data-zone]'); await p.tap('[data-stage="1"]'); await p.tap('#team-go');
  for (const d of [0, 1, 2]) { if (!(await p.locator('[data-door]').count())) break; await p.tap(`[data-door="${d}"]`).catch(() => {}); await p.waitForTimeout(300); if (await p.locator('#continue').count()) { await p.tap('#continue'); continue; } break; }
  for (const s2 of ['#tut-next', '#tut-next', '#tut-go']) { await p.waitForSelector(s2, { timeout: 800 }).catch(() => {}); if (await p.locator(s2).count()) await p.tap(s2); }
  await p.waitForTimeout(500);
  const box = await p.locator('#cv').boundingBox();
  const px = (x, y) => ({ x: box.x + x / 540 * box.width, y: box.y + y / 960 * box.height });
  const cx = (c) => 45 + c * 90, cy = (r) => 480 + 45 + r * 90; // tâm ô theo toạ độ canvas
  let fails = 0;
  for (const dir of [1, -1]) for (const steps of [6, 12, 24]) for (const R of [60, 90]) {
    // vòng quanh góc giữa 4 ô (c=2..3, r=1..2), bắt đầu từ tâm ô (2,1)
    const mx = 135 + 45 + 45, my = 480 + 135 + 0; // điểm giữa 4 ô
    if (!(await p.evaluate(() => !!window.__game && window.__game.getState().status === 'playing'))) { console.log('trận đã kết thúc, dừng'); break; }
    const mid = { x: 45 + 3 * 90, y: 480 + 2 * 90 };
    const a0 = px(cx(2), cy(1)); await p.mouse.move(a0.x, a0.y); await p.mouse.down();
    const ang0 = Math.atan2(cy(1) - mid.y, cx(2) - mid.x);
    for (let k = 1; k <= steps; k++) { const a = ang0 + dir * (k / steps) * Math.PI * 2; const q = px(mid.x + Math.cos(a) * 63, mid.y + Math.sin(a) * 63); await p.mouse.move(q.x, q.y); }
    const path = await p.evaluate(() => window.__game.getDragPath());
    await p.mouse.up(); await p.waitForTimeout(50);
    const uniq = new Set(path).size;
    console.log(`dir ${dir} steps ${steps}: path`, path.join(','), uniq >= 4 && path.length >= 5 ? 'OK' : 'LỖI');
    if (!(uniq >= 4 && path.length >= 5)) fails++;
    // chờ hết lượt xử lý
    await p.waitForFunction(() => !window.__game.isBusy(), null, { timeout: 15000 }).catch(() => {});
    if (await p.evaluate(() => window.__game.getState().status) !== 'playing') break;
  }
  console.log('errors:', errs, 'fails:', fails); if (errs.length || fails) process.exit(1);
  await b.close();
})();
