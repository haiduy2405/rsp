const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 411, height: 732 } });
  p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>m.type()==='error'&&console.log('CONSOLEERR',m.text())); await p.goto('http://localhost:8080/?debug'); await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); await p.click('#ob-next');
  await p.fill('#ob-name','P'); await p.fill('#ob-callsign','P'); await p.click('#ob-start'); await p.click('#ob-hub'); await p.click('[data-zone]'); await p.click('[data-stage=easy]'); await p.click('#team-go');
  for (let i=0;i<6;i++){ if (await p.locator('[data-door]').count()) { await p.click('[data-door="0"]'); } for (const s of ['#tut-skip','#continue','#leave']) if (await p.locator(s).count()) await p.click(s).catch(()=>{}); if (await p.evaluate(()=>!!window.__game && !document.getElementById('screen').classList.contains('show'))) break; await p.waitForTimeout(300); }
  const box = await p.locator('#cv').boundingBox();
  const pt=(c,r)=>({x:box.x+(c+.5)*box.width/6,y:box.y+(480+(r+.5)*90)/960*box.height});
  console.log('elem', await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e?e.tagName+'#'+e.id+'.'+e.className:null},[box.x+100,box.y+box.height*0.7]), JSON.stringify(box));
  let last=null;
  for (let m=0;m<40;m++){
    const c0=Math.floor(Math.random()*4), r=Math.floor(Math.random()*5); const a=pt(c0,r), c=pt(c0+1+Math.floor(Math.random()*2),r);
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(c.x,c.y,{steps:6}); await p.mouse.up(); await p.waitForTimeout(1300);
    const st = await p.evaluate(()=>{const s=window.__game?.getState?.(); return s?{busy:window.__game.isBusy(),turn:s.turn,hp:Math.round(s.hp),en:s.enemies.map(e=>Math.round(e.hp)),status:s.status}:null});
    console.log(m, JSON.stringify(st));
    if (!st || st.status!=='playing') { console.log('end', JSON.stringify(st)); break; }
    last = st;
  }
  if (!last || last.turn < 10) { console.log('LỖI: lượt không tăng, trận không tiến triển', JSON.stringify(last)); process.exitCode = 1; } else console.log('OK: trận tiến triển, lượt =', last.turn);
  await b.close();
})();
