// Chụp hiệu ứng hồi máu và Ngọc Nâng Cấp: dựng bàn có hàng 5 ngọc tim rồi kéo một nước. Dùng: node tests/e2e/healfx.cjs <thư mục ảnh>
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2] || '.';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Bot'); await p.fill('#ob-callsign', 'B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.click('[data-zone]'); await p.click('[data-stage="1"]'); await p.click('#team-go');
  await p.click('[data-door="0"]'); await p.click('#tut-skip').catch(() => {});
  await p.waitForSelector('#cv'); await p.waitForTimeout(2500);
  await p.evaluate(() => {
    const s = window.__game.getState();
    s.hp = Math.round(s.maxHp * 0.4);
    const cells = Array.from({ length: 30 }, (_, i) => (((i % 6) + ((i / 6) | 0)) % 2 === 0 ? 3 : 4));
    for (let c = 0; c < 5; c++) cells[24 + c] = 5; // hàng đáy: 5 ngọc tim
    s.board.cells = cells;
  });
  const box = await p.locator('#cv').boundingBox();
  const px = (x, y) => ({ x: box.x + x / 540 * box.width, y: box.y + y / 960 * box.height });
  const a = px(45 + 5 * 90, 480 + 45 + 0 * 90), c = px(45 + 4 * 90, 480 + 45 + 0 * 90);
  await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 6 }); await p.mouse.up();
  for (const [k, ms] of [[0, 700], [1, 450], [2, 300], [3, 350], [4, 500]]) { await p.waitForTimeout(ms); await p.screenshot({ path: `${dir}/heal${k}.png` }); }
  console.log('errors:', errs);
  await b.close();
})();
