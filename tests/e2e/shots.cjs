// Chụp các màn chính để rà giao diện. Dùng: node tests/e2e/shots.cjs <thư mục ảnh> [lang]
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2] || '.';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.evaluate(() => window.__cheat(['thuy_tinh', 'thanh_giong', 'hel', 'co_tam']));
  await p.waitForTimeout(500);
  const shot = async (n) => { await p.waitForTimeout(350); await p.screenshot({ path: `${dir}/ui-${n}.png` }); };
  await shot('hub');
  for (const [id, n] of [['#b-battle', 'zones'], ['#b-heroes', 'heroes'], ['#b-summon', 'summon'], ['#b-team', 'team']]) {
    if (await p.locator(id).count()) { await p.click(id); await shot(n); if (await p.locator('#back').count()) await p.click('#back'); else await p.goBack().catch(() => {}); await p.waitForTimeout(200); }
  }
  console.log('errors', errs);
  await b.close();
})();
