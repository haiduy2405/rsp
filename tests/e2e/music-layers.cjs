const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const p = await b.newPage();
  await p.goto('http://localhost:8080/');
  console.log(await p.evaluate(async () => {
    let n = 0; const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...a) { if (this.loop) n++; return st.apply(this, a); };
    const { createAudio } = await import('/js/ui/audio.js');
    const cfg = await (await fetch('/js/data/audio.json')).json();
    const a = createAudio(cfg, {}); a.playMusic('tutorial');
    for (let i = 0; i < 8; i++) { await a.unlock(); await new Promise(r => setTimeout(r, 250)); }
    return 'nguồn lặp đang phát: ' + n;
  })); await b.close();
})();
