// Sinh icon app: tháp ngọc 3D lấp lánh. Chạy: NODE_PATH=$(npm root -g) node tools/gen-icon.cjs
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, '..', 'www', 'icons');
const roofs = [['#ff8f7a', '#e8301f', '#8f0d10'], ['#ffe27a', '#f4b81c', '#a8680a'], ['#7cf2a0', '#22b85a', '#0b6a35'], ['#8fe3ff', '#2aa0f0', '#1049a8'], ['#e0a8ff', '#9a48e0', '#4a1a8e']];
const star = (x, y, r, o = 1) => `<path d="M${x} ${y - r}Q${x + r * 0.12} ${y - r * 0.12} ${x + r} ${y}Q${x + r * 0.12} ${y + r * 0.12} ${x} ${y + r}Q${x - r * 0.12} ${y + r * 0.12} ${x - r} ${y}Q${x - r * 0.12} ${y - r * 0.12} ${x} ${y - r}Z" fill="#fff" opacity="${o}" filter="url(#blur1)"/><path d="M${x} ${y - r}Q${x + r * 0.12} ${y - r * 0.12} ${x + r} ${y}Q${x + r * 0.12} ${y + r * 0.12} ${x} ${y + r}Q${x - r * 0.12} ${y + r * 0.12} ${x - r} ${y}Q${x - r * 0.12} ${y - r * 0.12} ${x} ${y - r}Z" fill="#fff" opacity="${o}"/>`;
let tiers = '';
for (let k = 0; k < 5; k++) {
  const yb = 424 - k * 60, hb = 104 - k * 17, hr = hb + 15, E = yb - 38, T = E - 22, ht = hb * 0.6, c = roofs[k];
  const cx = 256;
  const P = (pts) => pts.map(([x, y]) => `${cx + x},${y}`).join(' ');
  tiers += `
  <g>
    <polygon points="${P([[-hb, E], [0, E], [0, yb], [-hb, yb]])}" fill="url(#bodyL)"/>
    <polygon points="${P([[0, E], [hb, E], [hb, yb], [0, yb]])}" fill="url(#bodyR)"/>
    <polygon points="${P([[-hb, E], [-hb + 6, E], [-hb + 6, yb], [-hb, yb]])}" fill="#fff" opacity=".35"/>
    ${[-0.55, 0.55].map((f) => `<rect x="${cx + f * hb - 6}" y="${E + 9}" width="12" height="19" rx="6" fill="#ffd45a"/><rect x="${cx + f * hb - 3}" y="${E + 11}" width="4" height="9" rx="2" fill="#fff8d0"/>`).join('')}
    <polygon points="${P([[-hr, E], [-ht, T], [0, T - 7], [0, E]])}" fill="${c[0]}"/>
    <polygon points="${P([[0, E], [0, T - 7], [ht, T], [hr, E]])}" fill="${c[1]}"/>
    <polygon points="${P([[-hr, E], [-hr * 0.5, E + 6], [0, E + 3], [0, E]])}" fill="${c[2]}"/>
    <polygon points="${P([[0, E], [0, E + 3], [hr * 0.5, E + 6], [hr, E]])}" fill="${c[2]}" opacity=".85"/>
    <polygon points="${P([[-ht, T], [0, T - 7], [-ht * 0.45, T - 1]])}" fill="#fff" opacity=".7"/>
    <polyline points="${P([[-hr, E], [-ht, T], [0, T - 7], [ht, T], [hr, E]])}" fill="none" stroke="#fff6c8" stroke-width="2.4" stroke-linejoin="round"/>
    <line x1="${cx}" y1="${T - 7}" x2="${cx}" y2="${E}" stroke="#fff" stroke-opacity=".45" stroke-width="1.6"/>
    <line x1="${cx - hr}" y1="${E}" x2="${cx + hr}" y2="${E}" stroke="#c98a14" stroke-width="3"/>
  </g>`;
}
const svg = (maskable) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 512 512">
<defs>
  <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#8fe4ff"/><stop offset=".45" stop-color="#2f86e8"/><stop offset="1" stop-color="#14246e"/></radialGradient>
  <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6c0" stop-opacity=".95"/><stop offset="1" stop-color="#fff6c0" stop-opacity="0"/></radialGradient>
  <linearGradient id="bodyL" x1="0" x2="1"><stop offset="0" stop-color="#fff6dc"/><stop offset="1" stop-color="#f1d79a"/></linearGradient>
  <linearGradient id="bodyR" x1="0" x2="1"><stop offset="0" stop-color="#e2c07c"/><stop offset="1" stop-color="#b98a3c"/></linearGradient>
  <linearGradient id="cryL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#7fd8ff"/></linearGradient>
  <linearGradient id="cryR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fdcff"/><stop offset="1" stop-color="#1a6fd8"/></linearGradient>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe28a"/><stop offset="1" stop-color="#b97a14"/></linearGradient>
  <filter id="blur1" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3.5"/></filter>
  <filter id="blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="drop" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#0a1450" flood-opacity=".55"/></filter>
</defs>
<rect width="512" height="512" fill="url(#bg)"/>
<g opacity=".16" transform="translate(256 210)">${Array.from({ length: 12 }, (_, i) => `<polygon points="0,0 ${-26},-420 ${26},-420" fill="#fff" transform="rotate(${i * 30})"/>`).join('')}</g>
<circle cx="256" cy="215" r="190" fill="url(#halo)" opacity=".55"/>
<g filter="url(#drop)">
  <ellipse cx="256" cy="434" rx="150" ry="22" fill="url(#ground)"/>
  <ellipse cx="256" cy="428" rx="150" ry="20" fill="none" stroke="#fff3b0" stroke-width="2.5" opacity=".8"/>
  ${tiers}
  <path d="M232 424v-26a24 24 0 0 1 48 0v26z" fill="#5a2c10"/><path d="M240 424v-24a16 16 0 0 1 32 0v24z" fill="#ffcf5a" opacity=".85"/>
  <g>
    <polygon points="256,40 226,92 256,124" fill="url(#cryL)"/>
    <polygon points="256,40 286,92 256,124" fill="url(#cryR)"/>
    <polygon points="226,92 256,84 286,92 256,124" fill="#d8f4ff" opacity=".55"/>
    <polygon points="256,40 238,70 256,66" fill="#fff"/>
    <polygon points="256,40 226,92 256,124 286,92" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
    <line x1="226" y1="92" x2="286" y2="92" stroke="#fff" stroke-opacity=".8" stroke-width="1.8"/>
  </g>
</g>
<ellipse cx="256" cy="80" rx="46" ry="46" fill="url(#halo)" filter="url(#blur2)"/>
${star(256, 78, 26)}${star(138, 150, 14, .95)}${star(384, 176, 17, .95)}${star(112, 300, 11, .85)}${star(410, 318, 13, .85)}${star(176, 60, 9, .8)}${star(338, 54, 9, .8)}${star(300, 262, 8, .8)}
</svg>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1024 } });
  const shot = async (maskable, file, size) => {
    let s = svg(maskable);
    if (maskable) s = s.replace('<g filter="url(#drop)">', '<g filter="url(#drop)" transform="translate(256 256) scale(.84) translate(-256 -256)">');
    await p.setContent(`<body style="margin:0;background:#000">${s.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body>`);
    await p.setViewportSize({ width: size, height: size });
    await p.screenshot({ path: path.join(out, file), clip: { x: 0, y: 0, width: size, height: size } });
  };
  await shot(false, 'icon-512.png', 512); await shot(false, 'icon-192.png', 192); await shot(false, 'apple-touch-icon.png', 180); await shot(true, 'icon-maskable-512.png', 512);
  await b.close();
})();
