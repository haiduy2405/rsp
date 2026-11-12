// Dừng Thời Gian: ép state.freeze, kéo hoán đổi, bấm Tiêu. Dùng: node tests/e2e/freeze.cjs <thư mục ảnh>
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2] || '.';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.waitForSelector('#ob-next'); await p.waitForTimeout(6500);
  await p.click('#ob-next'); await p.waitForSelector('#ob-name');
  await p.fill('#ob-name', 'Duy'); await p.click('#ob-start'); await p.waitForSelector('#cut');
  for (let k = 0; k < 4; k++) { await p.click('#cut', { force: true }).catch(() => {}); await p.waitForTimeout(250); }
  await p.waitForFunction(() => !!window.__game); await p.waitForTimeout(2500);
  await p.evaluate(() => { const g = window.__game; g.getState().freeze = 3; g.refresh(); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${dir}/fz1.png` });
  const box = await p.locator('#cv').boundingBox();
  const px = (x, y) => ({ x: box.x + x / 540 * box.width, y: box.y + y / 960 * box.height });
  const a = px(45, 525), c = px(135, 525);
  const before = await p.evaluate(() => window.__game.getState().board.cells.slice(0, 2).join());
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 6 }); await p.waitForTimeout(1500);
  const timer = await p.evaluate(() => window.__game.getView().timer);
  await p.mouse.up(); await p.waitForTimeout(600);
  const mid = await p.evaluate(() => { const s = window.__game.getState(); return [s.board.cells.slice(0, 2).join(), s.freeze, s.turn]; });
  console.log('before', before, 'timer', timer, 'after swap', mid);
  await p.screenshot({ path: `${dir}/fz2.png` });
  const t = px(468, 362);
  await p.mouse.click(t.x, t.y); await p.waitForTimeout(2500);
  console.log('after clear', await p.evaluate(() => { const s = window.__game.getState(); return [s.freeze, s.turn]; }));
  await p.screenshot({ path: `${dir}/fz3.png` });
  console.log('errors:', errs);
  await b.close();
})();
