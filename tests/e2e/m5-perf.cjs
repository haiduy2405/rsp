const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const t0 = Date.now();
  await p.goto('http://localhost:8080/?debug'); await p.waitForSelector('#ob-skip');
  console.log('khởi động tới màn đầu (ms):', Date.now() - t0);
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name','A'); await p.fill('#ob-callsign','B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.evaluate(() => history.back()); await p.waitForTimeout(200);
  console.log('back ở hub giữ nguyên:', await p.locator('#b-summon').count());
  await p.click('#b-set'); await p.evaluate(() => history.back()); await p.waitForSelector('#b-summon'); console.log('back từ cài đặt về hub OK');
  await p.click('[data-zone]'); await p.click('[data-door="0"]').catch(()=>{});
  for (const s of ['#tut-next','#tut-next','#tut-go']) { await p.waitForSelector(s,{timeout:3000}).catch(()=>{}); if (await p.locator(s).count()) await p.click(s); }
  await p.waitForTimeout(500);
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); (function f(){ n++; if (performance.now()-t < 2000) requestAnimationFrame(f); else r(n/2); })(); }));
  console.log('FPS (headless, phần mềm):', fps);
  const box = await p.locator('#cv').boundingBox();
  const heap = async () => (await p.evaluate(() => performance.memory.usedJSHeapSize))/1048576;
  const h0 = await heap();
  for (let i=0;i<40;i++){ const y=box.y+box.height*(0.52+0.06*(i%5)); await p.mouse.move(box.x+box.width*0.1,y); await p.mouse.down(); await p.mouse.move(box.x+box.width*0.6,y,{steps:8}); await p.mouse.up(); await p.waitForTimeout(1200); if (await p.locator('#continue,#b-col,[data-door]').count()) break; }
  console.log('heap MB đầu/cuối:', h0.toFixed(1), (await heap()).toFixed(1));
  console.log('lỗi:', errs); await b.close();
})();
