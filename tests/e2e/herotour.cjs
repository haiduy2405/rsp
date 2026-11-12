// Lần đầu vào Đội hình: chỉ tay vào 1 tướng (nhấn giữ), mở chi tiết thì dẫn từng mục. Dùng: node tests/e2e/herotour.cjs <thư mục ảnh>
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
  await p.waitForSelector('#b-team'); await p.click('#b-team'); await p.waitForTimeout(1500);
  console.log('tile tip:', await p.textContent('.g-tip').catch(() => null)); await p.screenshot({ path: `${dir}/ht0.png` });
  const t = await p.locator('#screen .roster > *').first().boundingBox();
  await p.mouse.move(t.x + t.width / 2, t.y + t.height / 2); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
  await p.waitForSelector('#tour-next'); let n = 0;
  while (await p.$('#tour-next')) { await p.waitForTimeout(600); n++; console.log(n, await p.textContent('.g-tip').catch(() => null)); if (n === 1 || n === 4) await p.screenshot({ path: `${dir}/ht${n}.png` }); await p.click('#tour-next'); if (n > 15) break; }
  console.log('steps', n, 'tour left', !!(await p.$('#tour-ui')));
  // lần sau không còn hướng dẫn
  await p.click('#back'); await p.waitForTimeout(900); console.log('tile tip again:', !!(await p.$('.g-tip')));
  console.log('errors:', errs); await b.close();
})();
