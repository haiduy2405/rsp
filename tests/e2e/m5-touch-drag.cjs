const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  let ok=false;
  for (let attempt=0; attempt<8 && !ok; attempt++) {
    await p.goto('http://localhost:8080/?debug'); await p.evaluate(()=>localStorage.clear()); await p.reload();
    await p.tap('#ob-skip'); await p.tap('#ob-next'); await p.tap('[data-culture=viet]'); await p.tap('#ob-next'); await p.tap('#ob-next');
    await p.fill('#ob-name','Duy'); await p.fill('#ob-callsign','Sao'); await p.tap('#ob-start'); await p.tap('#ob-hub');
    await p.tap('[data-zone]');
    for (const d of [0,1]) { if (await p.locator('[data-door]').count()===0) break; await p.tap(`[data-door="${d}"]`).catch(()=>{}); await p.waitForTimeout(300);
      for (const s2 of ['#tut-next','#tut-next','#tut-go']) { await p.waitForSelector(s2,{timeout:800}).catch(()=>{}); if (await p.locator(s2).count()) await p.tap(s2); }
      await p.waitForTimeout(400);
      if (await p.evaluate(()=>!!window.__game)) { ok=true; break; } }
  }
  console.log('battle', ok);
  const box = await p.locator('#cv').boundingBox(); console.log('canvas', box);
  const cdp = await ctx.newCDPSession(p);
  const pt = (c,r)=>({x: box.x + (c+0.5)*box.width/6, y: box.y + (480+ (r+0.5)*90)/960*box.height});
  const hp=()=>p.evaluate(()=>window.__game.getState().enemies.reduce((a,e)=>a+e.hp,0));
  const h0=await hp(); let shots=0;
  for (let t=0;t<70 && (await hp())===h0;t++){
    const r=3+((t*3)%2)*0; const c0=t%3; const rr=(t*2%5);
    const path=[pt(c0,rr),pt(c0+1,rr),pt(c0+2,rr),pt(c0+2,(rr+1)%5),pt(c0+3,(rr+1)%5)];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[path[0]]});
    for (let i=0;i<path.length-1;i++) for (let k=1;k<=2;k++){ const a=path[i],c=path[i+1]; await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(c.x-a.x)*k/2,y:a.y+(c.y-a.y)*k/2}]}); await p.waitForTimeout(8);} 
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    for (const ms of [420,260]) { await p.waitForTimeout(ms); if ((await hp())<h0 || shots<2) await p.screenshot({path:`/tmp/h${shots++}.png`}); }
    await p.waitForTimeout(2500);
    if (await p.locator('[data-door],#continue').count()) break;
  }
  console.log('hp', h0, await hp().catch(()=>'ended'), 'shots', shots, errs); await b.close();
})();
