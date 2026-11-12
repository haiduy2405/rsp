const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/?debug');
  await p.waitForSelector('#ob-next'); await p.waitForTimeout(6500);
  await p.click('#ob-next'); await p.fill('#ob-name', 'D'); await p.click('#ob-start'); await p.waitForSelector('#cut');
  for (let k = 0; k < 4; k++) { await p.click('#cut', { force: true }).catch(() => {}); await p.waitForTimeout(250); }
  await p.waitForFunction(() => !!window.__game); await p.waitForTimeout(3500);
  for (let el = 0; el < 6; el++) {
    await p.evaluate((el) => { document.getElementById('coach')?.remove(); window.__game.fxCast(el); }, el);
    await p.waitForTimeout(450);
    await p.screenshot({ path: `/tmp/castfx${el}.png` });
    await p.waitForTimeout(1800);
  }
  console.log(errs); await b.close();
})();
