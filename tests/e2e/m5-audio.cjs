const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug'); await p.click('#ob-skip');
  await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name','A'); await p.fill('#ob-callsign','B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.click('#b-set'); await p.click('#opt-music'); await p.click('#opt-music'); await p.click('#back');
  await p.click('[data-zone]'); await p.click('[data-stage=easy]'); await p.click('#team-go'); await p.click('[data-door="0"]').catch(()=>{});
  for (const s of ['#tut-next','#tut-next','#tut-go']) { await p.waitForSelector(s,{timeout:3000}).catch(()=>{}); if (await p.locator(s).count()) await p.click(s); }
  await p.waitForTimeout(1500);
  const box = await p.locator('#cv').boundingBox();
  await p.mouse.move(box.x+box.width*0.1, box.y+box.height*0.55); await p.mouse.down();
  await p.mouse.move(box.x+box.width*0.4, box.y+box.height*0.55,{steps:12}); await p.mouse.up();
  await p.waitForTimeout(2500);
  console.log('errors:', errs); await b.close();
})();
