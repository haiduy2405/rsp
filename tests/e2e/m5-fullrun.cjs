// Bot thông minh chơi qua giao diện thật: thử mọi nước đổi 2 ô bằng core, chọn nước tốt nhất, kéo bằng chuột.
// Kiểm tra cả vòng: Hub -> chuyến -> cửa -> trận -> kết quả/shop/sự kiện -> tổng kết -> lưu. Dùng: node tests/e2e/m5-fullrun.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Bot'); await p.fill('#ob-callsign', 'B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.evaluate(() => window.__cheat && window.__cheat([])); // mở dữ liệu debug nếu có
  await p.click('[data-zone]');
  const click = async (sel) => { if (await p.locator(sel).count()) { await p.click(sel, { timeout: 1500 }).catch(() => {}); return true; } return false; };
  let battles = 0, moves = 0, ended = false, guard = 0;
  while (!ended && guard++ < 1500) {
    const inBattle = await p.evaluate(() => !!window.__game && !document.getElementById('screen').classList.contains('show') && !window.__game.isBusy());
    if (inBattle) {
      const best = await p.evaluate(async () => {
        const { step } = await import('/js/core/battle.js');
        const s = window.__game.getState(); if (s.status !== 'playing') return null;
        let best = null;
        for (let a = 0; a < 30; a++) for (const d of [1, 6]) {
          const bb = a + d; if (bb >= 30 || (d === 1 && bb % 6 === 0) || s.locked.includes(a) || s.locked.includes(bb)) continue;
          const r = step(window.__ctx, s, { type: 'move', path: [a, bb] });
          let sc = 0; for (const e of r.events) if (e.type === 'step') for (const h of e.hits) sc += h.kind === 'damage' ? h.amount : h.amount * 0.5;
          if (!best || sc > best.sc) best = { sc, path: [a, bb] };
        }
        // dùng kỹ năng sẵn sàng
        const ready = s.members.findIndex(m => m.skillCd === 0);
        return { path: best?.path, skill: ready };
      });
      if (!best) { await p.waitForTimeout(500); continue; }
      const box = await p.locator('#cv').boundingBox();
      const pt = (c) => ({ x: box.x + ((c % 6) + 0.5) * box.width / 6, y: box.y + (480 + (Math.floor(c / 6) + 0.5) * 90) / 960 * box.height });
      if (best.skill >= 0) { const sx = box.x + (12 + best.skill * 104 + 49) / 540 * box.width, sy = box.y + 420 / 960 * box.height; await p.mouse.click(sx, sy); await p.waitForTimeout(1200); continue; }
      const a = pt(best.path[0]), c = pt(best.path[1]);
      await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up(); moves++;
      await p.waitForTimeout(1300);
      continue;
    }
    if (await click('#tut-skip')) continue;
    if (await click('#continue')) continue;
    if (await click('#leave')) continue;
    if (await click('[data-choice="0"]')) continue;
    if (await click('[data-door="0"]')) { battles++; continue; }
    if (await p.locator('#back').count() && await p.locator('text=/Gold|Vàng/').count()) { ended = true; break; }
    await p.waitForTimeout(300);
  }
  const txt = await p.textContent('#screen');
  console.log('kết thúc:', ended, '| nước đi:', moves, '| màn cuối:', txt.replace(/\s+/g, ' ').slice(0, 200));
  console.log('lỗi:', errs.length ? errs.slice(0, 5) : 'không');
  await b.close();
})();
