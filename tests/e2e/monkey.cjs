// Monkey test: bấm ngẫu nhiên mọi nút/thẻ, kéo ngọc ngẫu nhiên; bắt lỗi JS, chữ "null/undefined/NaN" trên màn hình, kẹt màn.
// Dùng: NODE_PATH=$(npm root -g) node tests/e2e/monkey.cjs [giây=120] [seed]
const { chromium } = require('playwright');
const secs = Number(process.argv[2] || 120);
let seed = Number(process.argv[3] || 1);
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const problems = new Set(); const log = (m) => { if (problems.size < 30) problems.add(m); };
  p.on('pageerror', e => log('PAGEERR ' + e.message)); p.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && log('CONSOLE ' + m.text()));
  p.on('dialog', d => d.dismiss());
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Monkey'); await p.fill('#ob-callsign', 'M'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.evaluate(() => window.__cheat && window.__cheat(['thuy_tinh','thanh_giong','son_tinh','apollo','hel','co_tam']));
  const end = Date.now() + secs * 1000; let actions = 0, lastSig = '', same = 0;
  while (Date.now() < end) {
    actions++;
    const text = await p.evaluate(() => document.getElementById('screen').classList.contains('show') ? document.getElementById('screen').innerText : '');
    if (/\bnull\b|\bundefined\b|NaN|\[object/.test(text)) log('BAD TEXT: ' + (text.match(/.{0,30}(\bnull\b|\bundefined\b|NaN|\[object).{0,30}/) || [''])[0].replace(/\s+/g, ' '));
    const inBattle = await p.evaluate(() => !!window.__game && !document.getElementById('screen').classList.contains('show') && !window.__game.isBusy());
    if (inBattle) {
      const box = await p.locator('#cv').boundingBox();
      const pt = (c, r) => ({ x: box.x + (c + 0.5) * box.width / 6, y: box.y + (480 + (r + 0.5) * 90) / 960 * box.height });
      const roll = rnd();
      if (roll < 0.15) { await p.mouse.click(box.x + (12 + Math.floor(rnd() * 5) * 104 + 49) / 540 * box.width, box.y + (388 + rnd() * 78) / 960 * box.height); }
      else { let c = Math.floor(rnd() * 6), r = Math.floor(rnd() * 5); const a = pt(c, r); await p.mouse.move(a.x, a.y); await p.mouse.down(); const n = 1 + Math.floor(rnd() * 5); for (let i = 0; i < n; i++) { c = Math.max(0, Math.min(5, c + Math.floor(rnd() * 3) - 1)); r = Math.max(0, Math.min(4, r + Math.floor(rnd() * 3) - 1)); const q = pt(c, r); await p.mouse.move(q.x, q.y, { steps: 3 }); } await p.mouse.up(); }
      await p.waitForTimeout(900); continue;
    }
    const els = await p.$$('#screen button:not([disabled]), #screen .card.btn, #screen [data-avatar], #screen [data-culture]');
    if (!els.length) { await p.waitForTimeout(300); continue; }
    const el = els[Math.floor(rnd() * els.length)];
    const id = await el.getAttribute('id');
    if (id === 'delete' || id === 'import') { continue; } // tránh xóa dữ liệu liên tục
    await el.click({ timeout: 1500 }).catch(() => {});
    if (rnd() < 0.3) { const inp = await p.$$('#screen input[type=text], #screen input:not([type]), #screen textarea:not([readonly])'); if (inp.length) await inp[0].fill(['Duy', '', 'x'.repeat(40), '<b>', '😀'][Math.floor(rnd() * 5)]).catch(() => {}); }
    await p.waitForTimeout(150);
    const sig = text.slice(0, 80); same = sig === lastSig ? same + 1 : 0; lastSig = sig;
    if (same > 40) { const bk = await p.$('#screen #back'); if (bk) { await bk.click().catch(() => {}); same = 0; continue; } log('KẸT màn: ' + sig.replace(/\s+/g, ' ')); same = 0; await p.reload(); }
  }
  console.log(`hành động: ${actions}`); console.log(problems.size ? 'VẤN ĐỀ:\n' + [...problems].join('\n') : 'Không phát hiện vấn đề.');
  await b.close();
})();
