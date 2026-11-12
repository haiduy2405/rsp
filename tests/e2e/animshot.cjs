const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('#ob-skip'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub');
  await p.waitForTimeout(600); const D = '/home/claude/art-src/shots/';
  await p.screenshot({ path: D + 'z-hub.png' });
  await p.tap('[data-zone]'); await p.waitForTimeout(400); await p.screenshot({ path: D + 'z-stages.png' });
  await p.tap('[data-stage="1"]'); await p.waitForTimeout(300); await p.tap('#team-go');
  for (let n = 0; n < 12; n++) { if (await p.evaluate(() => !!window.__game)) break;
    if (await p.locator('#tut-skip').isVisible().catch(() => false)) { await p.tap('#tut-skip'); await p.waitForTimeout(300); continue; }
    const m = p.locator('[data-door]').filter({ hasText: /Monsters|Quái thường/ });
    if (await m.count()) await m.first().tap().catch(() => {}); else for (const id of ['#continue', '[data-choice="0"]', '#leave']) if (await p.locator(id).count()) { await p.tap(id).catch(() => {}); break; }
    await p.waitForTimeout(350); }
  await p.waitForTimeout(500);
if (await p.locator('#tut-skip').isVisible().catch(()=>false)) await p.tap('#tut-skip');
await p.evaluate(() => { const st = window.__game.getState(); st.members.forEach((m,i)=>{ if(i<3) m.skillCd=0; }); window.__game.refresh(); });
await p.waitForTimeout(300);
for (let k=0;k<4;k++){ await p.screenshot({path:D+'anim-ready'+k+'.png'}); await p.waitForTimeout(220);}
console.log('ok', errs); await b.close();
})();
