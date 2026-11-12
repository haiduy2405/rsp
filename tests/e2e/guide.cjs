// Chuỗi chỉ tay sau cutscene 4★: shop → nhận quà → quay lại → Chiến đấu → khu → ải 1 → Vào trận → luật → cửa (có xác nhận). Dùng: node tests/e2e/guide.cjs <thư mục ảnh>
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2] || '.';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.waitForSelector('#ob-next'); await p.waitForTimeout(6500);
  await p.click('#ob-next'); await p.waitForSelector('#ob-name'); await p.fill('#ob-name', 'Duy'); await p.click('#ob-start'); await p.waitForSelector('#cut');
  for (let k = 0; k < 4; k++) { await p.click('#cut', { force: true }).catch(() => {}); await p.waitForTimeout(250); }
  await p.waitForFunction(() => !!window.__game);
  await p.evaluate(() => document.getElementById('coach')?.remove());
  // bỏ qua tutorial: hoàn tất thẳng bằng cách thắng (chỉnh máu quái còn 1 sau bài 4 để bài kỹ năng/combo kết thúc trận)
  const cfg = JSON.parse(require('fs').readFileSync(__dirname + '/../../www/js/data/config.json', 'utf8')).tutorial.lessons;
  const box = await p.locator('#cv').boundingBox();
  const px = (i) => ({ x: box.x + ((45 + (i % 6) * 90) / 540) * box.width, y: box.y + ((525 + ((i / 6) | 0) * 90) / 960) * box.height });
  const drag = async (path) => { const a = px(path[0]); await p.mouse.move(a.x, a.y); await p.mouse.down(); for (const c of path.slice(1)) { const q = px(c); await p.mouse.move(q.x, q.y, { steps: 5 }); } await p.mouse.up(); };
  for (const L of cfg) {
    if (L.kind === 'skill') { const st = await p.evaluate(() => window.__game.getState().enemies.map(e => e.hp)); let lo = -1; st.forEach((h, k) => { if (h > 0 && (lo < 0 || h < st[lo])) lo = k; }); await p.mouse.click(box.x + (((540 / 3) * lo + 90) / 540) * box.width, box.y + (165 / 960) * box.height); await p.waitForTimeout(600); await p.mouse.click(box.x + (64 / 540) * box.width, box.y + (420 / 960) * box.height); await p.waitForTimeout(500); await p.locator('#skill-ok').click({ timeout: 1500 }).catch(() => {}); }
    else await drag(L.path);
    await p.waitForFunction(() => !window.__game.isBusy(), null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(900);
    if (L.id === 'skill') await p.evaluate(() => window.__game.getState().enemies.forEach(e => { if (e.hp > 0) e.hp = 1; }));
  }
  await p.waitForSelector('#st-pull', { timeout: 20000 }); await p.click('#st-pull', { force: true });
  await p.waitForSelector('#lp-orb').then(() => p.click('#lp-orb', { force: true })); await p.waitForSelector('#reveal-all', { timeout: 15000 }); await p.waitForTimeout(3000); await p.click('#reveal-all'); await p.waitForTimeout(900); await p.click('#sum-done');
  await p.waitForSelector('#cut');
  for (let k = 0; k < 4; k++) { await p.click('#cut', { force: true }).catch(() => {}); await p.waitForTimeout(150); }
  const shot = async (n) => { await p.waitForTimeout(1300); await p.screenshot({ path: `${dir}/g${n}.png` }); console.log(n, await p.evaluate(() => [document.querySelector('.g-tip')?.textContent, window.__progress?.()?.onboarding?.guide])); };
  await shot('1-hub-shop');
  await p.click('#b-shop'); await shot('2-shop-claim');
  await p.click('.shop-offer button.primary'); await shot('3-claimed-back');
  await p.click('#back-top'); await shot('4-hub-battle');
  await p.click('#b-battle', { force: true }); await shot('5-zone');
  await p.click('[data-zone-card]:not(.locked)'); await shot('6-stage1');
  await p.click('[data-stage="1"]'); await shot('7-team-go');
  await p.click('#team-go'); await p.waitForSelector('#rules-ok'); await shot('8-rules');
  await p.click('#rules-ok'); await shot('9-door');
  await p.click('[data-door]'); await shot('10-confirm');
  await p.click('#door-enter'); await p.waitForTimeout(800);
  console.log('guide step after', await p.evaluate(() => window.__game ? 'battle' : document.querySelector('.g-root') ? 'still' : 'clear'));
  console.log('errors:', errs);
  await b.close();
})();
