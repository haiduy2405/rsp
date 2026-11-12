const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.tap('#ob-skip'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
  await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub');
  await p.tap('[data-zone]'); await p.tap('[data-stage="1"]'); await p.tap('#team-go');
  for (let n = 0; n < 12; n++) {
    if (await p.evaluate(() => !!window.__game)) break;
    if (await p.locator('#tut-skip').isVisible().catch(() => false)) { await p.tap('#tut-skip'); await p.waitForTimeout(300); continue; }
    const m = p.locator('[data-door]').filter({ hasText: /Monsters|Quái thường/ });
    if (await m.count()) await m.first().tap().catch(() => {});
    else for (const id of ['#continue', '[data-choice="0"]', '#leave']) if (await p.locator(id).count()) { await p.tap(id).catch(() => {}); break; }
    await p.waitForTimeout(350);
  }
  for (const s2 of ['#tut-next', '#tut-next', '#tut-go']) { await p.waitForSelector(s2, { timeout: 800 }).catch(() => {}); if (await p.locator(s2).isVisible().catch(() => false)) await p.tap(s2); }
  await p.waitForTimeout(500);
  const ok = await p.evaluate(() => {
    const st = window.__game.getState();
    const mk = (key, turns, extra = {}) => ({ key, turns, ...extra });
    st.enemies[0].effects = ['burn', 'poison', 'stun', 'freeze', 'atkDown'].map((k, i) => mk(k, 2 + i, k === 'poison' ? { stacks: 3 } : {}));
    if (st.enemies[1]) st.enemies[1].effects = ['shield', 'regen', 'atkUp', 'reflect', 'pierce', 'lock', 'immune'].map((k, i) => mk(k, i + 1));
    st.team.effects = ['shield', 'regen', 'atkUp', 'immune'].map((k, i) => mk(k, 3 + i));
    window.__game.refresh();
    return true;
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: process.argv[2] || '/home/claude/art-src/shots/fx1.png' });
  console.log('errors:', errs); await b.close();
})();
