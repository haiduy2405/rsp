// Pháo hoa triệu hồi: chụp các khung hình x10 và x1. Dùng: node tests/e2e/summonfx.cjs <thư mục ảnh>
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
    await p.waitForSelector('#lp-orb'); await p.waitForTimeout(1200); await p.screenshot({ path: `${dir}/lp-${tag}.png` }); if (tag === 'x1') { // x1: kéo thật (thả quá gần ống thì bắn; thả giữa chừng thì ngọc trở về)
      const ob = await p.locator('#lp-orb').boundingBox(); const mo = await p.locator('.lp-mortar').boundingBox();
      await p.mouse.move(ob.x + ob.width / 2, ob.y + ob.height / 2); await p.mouse.down(); await p.mouse.move(ob.x + ob.width / 2, ob.y - 60, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
      console.log('drag giữa chừng: ngọc còn đó =', await p.locator('#lp-orb').count() === 1);
      const ob2 = await p.locator('#lp-orb').boundingBox(); await p.mouse.move(ob2.x + ob2.width / 2, ob2.y + ob2.height / 2); await p.mouse.down(); await p.mouse.move(mo.x + mo.width / 2, mo.y + 30, { steps: 10 }); await p.mouse.up();
    } else await p.click('#lp-orb', { force: true });
    for (const ms of [500, 700, 700, 900]) { await p.waitForTimeout(ms); await p.screenshot({ path: `${dir}/fw-${tag}-${ms}-${Date.now() % 1000}.png` }); }
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${dir}/fw-${tag}-end.png` });
    await p.click('#reveal-all'); await p.waitForTimeout(900);
    console.log(tag, 'overflow', await p.evaluate(() => { const s = document.getElementById('screen'); return [s.scrollHeight, s.clientHeight]; }));
    await p.screenshot({ path: `${dir}/fw-${tag}-open.png` });
    await p.click('#sum-done'); await p.waitForSelector('#pull-1');
  }
  console.log('errors:', errs);
  await b.close();
})();
