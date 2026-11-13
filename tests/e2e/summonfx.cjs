// Nghi thức pháp trận triệu hồi: chụp các khung hình x10 và x1. Dùng: node tests/e2e/summonfx.cjs <thư mục ảnh>
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2] || '.';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.waitForSelector('#ob-next'); await p.waitForTimeout(6500);
  await p.click('#ob-next'); await p.waitForSelector('#ob-name'); await p.fill('#ob-name', 'Duy'); await p.click('#ob-start'); await p.waitForSelector('#cut');
  for (let k = 0; k < 4; k++) { await p.click('#cut', { force: true }).catch(() => {}); await p.waitForTimeout(250); }
  await p.waitForFunction(() => !!window.__game); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('coach')?.remove(); window.__cheat([]); });
  await p.waitForSelector('#b-summon'); await p.click('#b-summon'); await p.waitForSelector('#pull-10');
  for (const [id, tag] of [['#pull-10', 'x10'], ['#pull-1', 'x1']]) {
    await p.click(id); await p.waitForSelector('#confirm'); await p.click('#confirm-yes');
    await p.waitForSelector('#lp-orb'); await p.waitForTimeout(900); await p.screenshot({ path: `${dir}/rt-${tag}-0idle.png` });
    await p.click('#lp-orb', { force: true });
    let t = 0; for (const ms of [900, 1700, 2100, 2900, 4200, 6500]) { await p.waitForTimeout(ms - t); t = ms; await p.screenshot({ path: `${dir}/rt-${tag}-${ms}.png` }); }
    await p.waitForSelector('#reveal-all'); await p.waitForFunction(() => !document.querySelector('.sm-res.anim'), null, { timeout: 15000 });
    await p.screenshot({ path: `${dir}/rt-${tag}-end.png` });
    console.log(tag, 'cards flipped ok, canvas gone =', await p.locator('.rt-cv').count() === 0);
    await p.click('#reveal-all'); await p.click('#sum-done'); await p.waitForSelector('#pull-10');
  }
  console.log('errors:', JSON.stringify(errs)); await b.close();
})();
