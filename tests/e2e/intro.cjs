// Luồng mở đầu mới: cốt truyện -> tên -> tutorial -> quà 10 vé -> triệu hồi -> cutscene -> màn chính.
const { chromium, devices } = require('playwright');
const D = '/home/claude/art-src/shots/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 2 }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('#ob-next'); await p.waitForTimeout(6500); await p.screenshot({ path: D + 'in1-story.png' });
  await p.tap('#ob-next'); await p.waitForSelector('#ob-name');
  await p.fill('#ob-name', 'Duy'); await p.tap('[data-avatar="3"]'); await p.tap('.ob-flag summary'); await p.tap('[data-flag="VN"]'); await p.waitForTimeout(500);
  await p.screenshot({ path: D + 'in2-id.png', fullPage: true });
  await p.tap('#ob-start'); await p.waitForFunction(() => !!window.__game); await p.waitForTimeout(900);
  await p.screenshot({ path: D + 'in3-tut1.png' });
  // chơi theo gợi ý đến khi thắng
  const shots = {};
  for (let i = 0; i < 12; i++) {
    const st = await p.evaluate(() => window.__game.getState().status);
    if (st !== 'playing') break;
    await p.waitForFunction(() => !window.__game.isBusy(), null, { timeout: 30000 });
    const hint = await p.evaluate(async () => { const g = window.__game.getHint(); if (g) return g; const m = await import('/js/ui/hint.js'); const r = m.findHint(window.__ctx, window.__game.getState()); return r && r.path; });
    const coach = await p.evaluate(() => document.getElementById('coach')?.textContent);
    console.log('move', i, 'hint', hint && hint.length, await p.evaluate(() => { const s = window.__game.getState(); return JSON.stringify({ st: s.status, hp: s.hp, foes: s.enemies.map((e) => e.hp) }); }));
    if (!shots[coach]) { shots[coach] = 1; await p.screenshot({ path: D + `in3-tut-m${i}.png` }); }
    if (!hint) { await p.waitForTimeout(500); continue; }
    const box = await p.locator('#cv').boundingBox();
    const pts = hint.map((c) => ({ x: box.x + box.width * ((c % 6) * 90 + 45) / 540, y: box.y + box.height * (480 + Math.floor(c / 6) * 90 + 45) / 960 }));
    await p.mouse.move(pts[0].x, pts[0].y); await p.mouse.down();
    for (const q of pts.slice(1)) await p.mouse.move(q.x, q.y, { steps: 6 });
    await p.mouse.up(); await p.waitForTimeout(400);
  }
  await p.waitForSelector('#st-pull', { timeout: 30000 }); await p.waitForTimeout(1200);
  await p.screenshot({ path: D + 'in4-reward.png' });
  await p.tap('#st-pull', { force: true }); await p.waitForSelector('#reveal-all'); await p.tap('#reveal-all', { force: true }); await p.waitForTimeout(900);
  await p.screenshot({ path: D + 'in5-result.png', fullPage: true });
  await p.tap('#sum-done'); await p.waitForSelector('#cut'); await p.waitForTimeout(1800);
  await p.screenshot({ path: D + 'in6-cut1.png' });
  await p.tap('#cut', { force: true }); await p.waitForTimeout(1500); await p.screenshot({ path: D + 'in6-cut2.png' });
  await p.tap('#cut', { force: true }); await p.tap('#cut', { force: true }); await p.waitForTimeout(700); await p.screenshot({ path: D + 'in7-hubin.png' });
  await p.waitForTimeout(1800); await p.screenshot({ path: D + 'in8-hub.png' });
  console.log('errs', errs, await p.evaluate(() => JSON.stringify(Object.keys(window.__ctx ? {} : {}))));
  await b.close();
})();
