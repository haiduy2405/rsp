// Kiểm tra nhạc nền: chạy từng bài vài giây, đo đỉnh âm lượng (tránh méo) và lỗi console. Dùng: node tests/e2e/music.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8080/?debug');
  const res = await p.evaluate(async () => {
    const { createAudio } = await import('/js/ui/audio.js');
    const cfg = await (await fetch('/js/data/audio.json')).json();
    const Real = window.AudioContext;
    let an;
    window.AudioContext = class extends Real {
      constructor() {
        super();
        an = this.createAnalyser();
        an.fftSize = 2048;
        const dest = this.destination;
        const gain = this.createGain();
        Object.defineProperty(this, 'destination', { value: gain });
        gain.connect(an);
        an.connect(dest);
      }
    };
    const out = {};
    for (const name of Object.keys(cfg.tracks)) {
      const a = createAudio(cfg, { volume: 100 });
      a.unlock();
      a.playMusic(name);
      let peak = 0, rms = 0, n = 0;
      const buf = new Float32Array(2048);
      for (let i = 0; i < 100; i++) {
        await new Promise((r) => setTimeout(r, 80));
        an.getFloatTimeDomainData(buf);
        for (const v of buf) { peak = Math.max(peak, Math.abs(v)); rms += v * v; n++; }
      }
      out[name] = { peak: +peak.toFixed(3), rms: +Math.sqrt(rms / n).toFixed(3) };
      a.playMusic(null);
    }
    return out;
  });
  console.log(JSON.stringify(res), 'errors:', errs);
  await b.close();
})();
