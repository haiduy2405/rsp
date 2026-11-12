const { chromium } = require('playwright');
const OUT = process.env.OUT || '/tmp';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8080/?debug');
  await p.click('#ob-skip'); await p.click('#ob-next'); await p.click('[data-culture=viet]'); await p.click('#ob-next'); 
  await p.waitForSelector('[data-avatar="11"]');
  await p.screenshot({ path: `${OUT}/avatars.png` });
  await p.click('[data-avatar="4"]'); await p.click('#ob-next');
  await p.fill('#ob-name', 'Bot'); await p.fill('#ob-callsign', 'B'); await p.click('#ob-start'); await p.click('#ob-hub');
  await p.click('#b-profile'); await p.waitForSelector('#pf-photo');
  // ảnh thử: png 300x200 qua file chooser
  const buf = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 200; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 300, 200); x.fillStyle = '#fc3'; x.fillRect(100, 50, 100, 100); return c.toDataURL('image/png').split(',')[1]; });
  await p.setInputFiles('#pf-photo-input', { name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(buf, 'base64') });
  await p.waitForSelector('.avatar.big img');
  await p.click('#pf-save').catch(() => {});
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/profile.png` });
  console.log('photo saved:', await p.evaluate(() => (window.__game?.getState?.().progress?.player?.photo || '').length > 100), 'errors', errs);
  await b.close();
})();
