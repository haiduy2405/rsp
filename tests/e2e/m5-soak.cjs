// Soak test: chơi tự động liên tục, ghi heap JS và FPS. Dùng: NODE_PATH=$(npm root -g) node tests/e2e/m5-soak.cjs [phút=30]
const { chromium } = require('playwright');
const minutes = Number(process.argv[2] || 30);
(async () => {
  const b = await chromium.launch({ args: ['--enable-precise-memory-info'] }); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Soak'); await p.fill('#ob-callsign', 'Bot'); await p.click('#ob-start'); await p.click('#ob-hub');
  const heap = async () => (await p.evaluate(() => performance.memory.usedJSHeapSize)) / 1048576;
  const fps = () => p.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); (function f() { n++; performance.now() - t < 1000 ? requestAnimationFrame(f) : r(n); })(); }));
  const end = Date.now() + minutes * 60000; let nextLog = 0; let moves = 0, runs = 0; const samples = [];
  const click = async (sel) => { if (await p.locator(sel).count()) { await p.click(sel, { timeout: 1500 }).catch(() => {}); return true; } return false; };
  while (Date.now() < end) {
    if (Date.now() >= nextLog) { const h = await heap(); samples.push(h); console.log(`${((Date.now() - (end - minutes * 60000)) / 60000).toFixed(1)}p heap=${h.toFixed(1)}MB fps=${await fps()} moves=${moves} runs=${runs}`); nextLog = Date.now() + 60000; }
    const inBattle = await p.evaluate(() => !!window.__game && !document.getElementById('screen').classList.contains('show'));
    if (inBattle) {
      const box = await p.locator('#cv').boundingBox();
      const c0 = Math.floor(Math.random() * 4), r = Math.floor(Math.random() * 5);
      const pt = (c, rr) => ({ x: box.x + (c + 0.5) * box.width / 6, y: box.y + (480 + (rr + 0.5) * 90) / 960 * box.height });
      const a = pt(c0, r), c = pt(c0 + 1 + Math.floor(Math.random() * 2), r);
      await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 6 }); await p.mouse.up(); moves++;
      await p.waitForTimeout(1400);
      continue;
    }
    if (await click('#tut-skip')) continue;
    if (await click('#continue')) continue;
    if (await click('#leave')) continue;
    if (await click('[data-choice="0"]')) continue;
    if (await click('[data-door="0"]')) continue;
    if (await click('#back')) continue;
    if (await click('#ob-hub')) continue;
    if (await click('[data-zone]')) { runs++; continue; }
    await p.waitForTimeout(300);
  }
  const growth = samples.length > 4 ? samples[samples.length - 1] - samples[Math.floor(samples.length / 3)] : 0;
  console.log('mẫu heap MB:', samples.map(x => x.toFixed(1)).join(' '), '| tăng (cuối - 1/3 đầu):', growth.toFixed(1), 'MB | lỗi:', errs.length ? errs.slice(0, 5) : 'không');
  await b.close();
})();
