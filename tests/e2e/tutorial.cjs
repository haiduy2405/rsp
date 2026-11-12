// Tutorial có kịch bản: kéo sai một lần (bị trả bàn), rồi làm đúng từng bài tới khi thắng. Dùng: node tests/e2e/tutorial.cjs <thư mục ảnh>
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2] || '.';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.waitForSelector('#ob-next'); await p.waitForTimeout(6500);
  await p.click('#ob-next'); await p.waitForSelector('#ob-name'); await p.fill('#ob-name', 'Duy'); await p.click('#ob-start'); await p.waitForSelector('#cut');
  for (let k = 0; k < 4; k++) { await p.click('#cut', { force: true }).catch(() => {}); await p.waitForTimeout(250); }
  await p.waitForFunction(() => !!window.__game); await p.waitForTimeout(1200);
  const lessons = await p.evaluate(() => window.__ctx?.config.tutorial.lessons || null);
  const cfg = lessons || JSON.parse(require('fs').readFileSync(__dirname + '/../../www/js/data/config.json', 'utf8')).tutorial.lessons;
  const box = await p.locator('#cv').boundingBox();
  const px = (i) => ({ x: box.x + ((45 + (i % 6) * 90) / 540) * box.width, y: box.y + ((525 + ((i / 6) | 0) * 90) / 960) * box.height });
  const drag = async (path) => { const a = px(path[0]); await p.mouse.move(a.x, a.y); await p.mouse.down(); for (const c of path.slice(1)) { const q = px(c); await p.mouse.move(q.x, q.y, { steps: 5 }); } await p.mouse.up(); };
  const info = () => p.evaluate(() => { const s = window.__game.getState(); return [s.turn, s.enemies.map(e => e.hp).join('/'), window.__game.getView().titleText]; });
  await p.screenshot({ path: `${dir}/tu0.png` });
  // kéo sai ở bài 1
  await drag([0, 1]); await p.waitForTimeout(500);
  console.log('after wrong', await info(), await p.textContent('#coach'));
  await p.screenshot({ path: `${dir}/tu-wrong.png` });
  for (let i = 0; i < cfg.length; i++) {
    const L = cfg[i];
    if (L.kind === 'skill') { const st = await p.evaluate(() => window.__game.getState().enemies.map(e => e.hp)); let lo = -1; st.forEach((h, k) => { if (h > 0 && (lo < 0 || h < st[lo])) lo = k; }); await p.mouse.click(box.x + (((540 / 3) * lo + 90) / 540) * box.width, box.y + (165 / 960) * box.height); await p.waitForTimeout(600); const hx = box.x + ((12 + 52) / 540) * box.width; const hy = box.y + (420 / 960) * box.height; await p.mouse.click(hx, hy); await p.waitForTimeout(500); await p.locator('#skill-ok').click({ timeout: 1500 }).catch(() => {}); }
    else await drag(L.path);
    await p.waitForFunction(() => !window.__game.isBusy(), null, { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(900);
    console.log('lesson', i + 1, L.id, await info(), (await p.textContent('#coach') || '').slice(0, 40));
    await p.screenshot({ path: `${dir}/tu${i + 1}.png` });
  }
  console.log('errors:', errs);
  await b.close();
})();
