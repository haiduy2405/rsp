const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/?debug'); await p.click('#ob-skip');
  await p.click('#ob-next'); await p.click('[data-culture=hylap]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name','A'); await p.fill('#ob-callsign','B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.click('[data-zone]'); await p.click('#team-go'); 
  await p.click('[data-door="0"]').catch(()=>{}); for (const s of ['#tut-next','#tut-next','#tut-go']) { await p.waitForSelector(s,{timeout:3000}).catch(()=>{}); if (await p.locator(s).count()) { console.log('tutorial',s); await p.click(s);} }
  await p.waitForTimeout(300);
  console.log('tutorialDone:', await p.evaluate(()=>JSON.parse(localStorage.getItem('rsp.save')).data?.onboarding ?? 'n/a'));
  console.log(errs); await b.close();
})();
