const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 480, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const bad = [];
  const chk = async (tag) => { const tx = await p.textContent('#screen'); if (/\b(err|char|res|set|hub|battle|summon|effect|stone|stat|story|skill|duo)\.[A-Za-z.]{2,}/.test(tx) || /null|undefined|NaN/.test(tx)) bad.push(tag + ': ' + tx.replace(/\s+/g, ' ').slice(0, 160)); };
  await p.goto('http://localhost:8080/?debug'); await p.waitForSelector('#ob-skip'); await p.click('#ob-skip');
  await p.fill('#ob-hometown', 'Mao Khê'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next');
  await p.click('[data-avatar="1"]'); await p.click('#ob-next'); await p.fill('#ob-name', 'Duy'); await p.fill('#ob-callsign', 'Sao'); await p.click('#ob-start');
  await p.waitForSelector('[data-first]'); await p.click('#ob-hub'); await p.waitForSelector('#b-col');
  for (const lang of ['vi', 'en', 'vi']) {
    await p.click('#b-set'); await p.selectOption('#lang', lang); await p.waitForTimeout(100); await chk('settings ' + lang);
    await p.click('#export'); const code = await p.inputValue('#export-box');
    await p.fill('#import-box', code); await p.click('#import'); await chk('import ' + lang);
    await p.fill('#import-box', 'rác{{'); await p.click('#import'); await chk('import-bad ' + lang);
    await p.click('#back'); await p.waitForSelector('#b-col');
    await p.click('#b-col'); await chk('collection ' + lang);
    const N = Math.min(6, await p.locator('#screen [data-char]:not(.locked)').count());
    for (let ci = 0; ci < N; ci++) {
      await p.locator('#screen [data-char]:not(.locked)').nth(ci).click(); await chk('char ' + lang);
      for (let i = 0; i < 3; i++) { for (const id of ['#lvup', '#awaken']) { const e = await p.$(id); if (e) { await e.click(); await chk(id + ' ' + lang); } } }
      if (!(await p.$('#back'))) { console.log('KHÔNG CÓ #back:', (await p.textContent('#screen')).replace(/\s+/g,' ').slice(0,200)); process.exit(1); }
      await p.click('#back');
    }
    await p.click('#back'); await p.waitForSelector('#b-col');
    for (const id of ['#b-glos', '#b-team', '#b-story', '#b-summon']) { await p.click(id); await chk(id + ' ' + lang); await p.click('#back'); await p.waitForSelector('#b-col'); }
  }
  console.log('bad:', bad); console.log('errors:', errs);
  await b.close(); if (bad.length || errs.length) process.exit(1);
})();
