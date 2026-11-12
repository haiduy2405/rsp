const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug'); await p.waitForSelector('#ob-skip');
  await p.click('#ob-skip');
  await p.fill('#ob-hometown','Mao Khê'); await p.click('#ob-next');
  await p.click('[data-culture=viet]'); await p.click('#ob-next');
  await p.click('[data-avatar="2"]'); await p.click('#ob-next');
  await p.click('#ob-start'); // empty name -> error
  console.log('err shown:', await p.locator('.notice').count());
  await p.fill('#ob-name','Duy'); await p.fill('#ob-callsign','Sao'); await p.click('#ob-start');
  await p.waitForSelector('[data-first]'); console.log('first:', await p.getAttribute('[data-first]','data-first'));
  await p.click('#ob-hub'); await p.waitForSelector('#b-summon');
  console.log('hub spirit:', await p.textContent('#spirit'));
  await p.click('#b-summon'); await p.waitForSelector('#rates');
  console.log('rates:', (await p.textContent('#rates')).replace(/\s+/g,' '));
  await p.click('#pull-10'); await p.waitForSelector('#confirm'); await p.click('#confirm-yes');
  await p.click('#reveal-all'); if ((await p.textContent('#screen')).includes('null')) throw new Error('kết quả triệu hồi chứa "null"'); console.log('cards:', await p.locator('.sumcard').count());
  await p.click('#sum-done'); console.log('spirit after:', await p.textContent('#spirit'));
  await p.click('#b-history'); console.log('hist rows:', await p.locator('.card').count()); await p.click('#back');
  await p.click('#b-redeem'); await p.click('#back'); await p.click('#back');
  await p.click('#b-set'); await p.click('#set-story'); console.log('story unlocked:', await p.locator('[data-story]').count()); await p.click('#back'); await p.click('#back');
  await p.reload(); await p.waitForSelector('#b-summon'); console.log('reload keeps hub');
  await p.click('#b-set'); await p.click('#delete'); await p.click('#confirm-yes'); await p.waitForSelector('#ob-skip'); console.log('delete -> onboarding');
  console.log('errors:', errs);
  await b.close();
})();
