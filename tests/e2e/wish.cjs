// Cầu nguyện: nút ở màn chính có chấm đỏ, quay 1 lần, hết lượt. Dùng: node tests/e2e/wish.cjs <thư mục ảnh>
const { chromium } = require('playwright');
(async () => {
  const dir = process.argv[2] || '.';
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.waitForSelector('#ob-next'); await p.waitForTimeout(6500);
  await p.click('#ob-next'); await p.fill('#ob-name', 'D'); await p.click('#ob-start'); await p.waitForSelector('#cut');
  for (let k = 0; k < 4; k++) { await p.click('#cut', { force: true }).catch(() => {}); await p.waitForTimeout(250); }
  await p.waitForFunction(() => !!window.__game); await p.evaluate(() => { document.getElementById('coach')?.remove(); window.__cheat([]); });
  await p.waitForSelector('#b-wish'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${dir}/w0.png` });
  console.log('chấm đỏ:', await p.locator('#b-wish .red-dot').count());
  await p.click('#b-wish'); await p.waitForSelector('#wheel'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${dir}/w1.png` });
  await p.click('#wish-go'); await p.waitForTimeout(1500); await p.screenshot({ path: `${dir}/w2.png` });
  await p.waitForFunction(() => document.getElementById('wish-msg')?.textContent.startsWith('You got'), null, { timeout: 8000 });
  console.log('kết quả:', await p.textContent('#wish-msg'), '| nút quay khóa:', await p.locator('#wish-go[disabled]').count());
  await p.screenshot({ path: `${dir}/w3.png` });
  await p.click('#back'); await p.waitForTimeout(500);
  console.log('chấm đỏ sau khi ước:', await p.locator('#b-wish .red-dot').count());
  console.log('errors:', errs); await b.close();
})();
