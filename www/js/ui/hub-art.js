// Cảnh màn chính vẽ bằng SVG (viewBox 400x800): trời nắng, cầu vồng, Tòa Tháp nhiều tầng giữa biển mây,
// sáu đảo khu vực đối xứng hai bên. Không dùng ảnh raster nên nét, nhẹ và có hoạt ảnh.
// Vùng an toàn (luôn hiện trên mọi màn hình 9:16 tới 9:20): x 25..375, y 50..750.

// Vị trí tâm đảo khu vực, theo thứ tự khu: dưới trái, dưới phải, giữa trái, giữa phải, trên trái, trên phải.
// Trái/phải lệch nhau một chút cho tự nhiên nhưng cân về trọng tâm.
export const ZONE_POS = [[68, 476], [332, 452], [58, 340], [342, 318], [72, 206], [328, 188]];

const cloud = (x, y, s, fill = '#fff', op = 1, cls = '') => `<g class="${cls}" opacity="${op}" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="8" rx="46" ry="11" fill="#cfe7fb" opacity=".7"/><g fill="${fill}"><ellipse cx="0" cy="2" rx="46" ry="12"/><circle cx="-20" cy="-6" r="14"/><circle cx="2" cy="-12" r="18"/><circle cx="24" cy="-4" r="13"/></g></g>`;

// Một tầng tháp: thân kem, mái cong, hàng cửa sổ vòm sáng đèn, ban công vàng, bụi cây.
function tier(i, cx, y, w, h, roof) {
  const x0 = cx - w / 2, x1 = cx + w / 2, bot = y + h;
  const n = Math.max(1, Math.round(w / 36));
  const ww = Math.min(13, w / (n + 1) * 0.5), wh = h * 0.46, ya = y + 24;
  let wins = '';
  for (let k = 1; k <= n; k++) {
    const wx = x0 + (w * k) / (n + 1);
    wins += `<path class="win" style="animation-delay:${((i * 3 + k) * 0.55).toFixed(2)}s" d="M${(wx - ww / 2).toFixed(1)} ${(ya + wh).toFixed(1)}V${(ya + ww / 2).toFixed(1)}a${(ww / 2).toFixed(1)} ${(ww / 2).toFixed(1)} 0 0 1 ${ww.toFixed(1)} 0V${(ya + wh).toFixed(1)}z" fill="url(#hbWin)" stroke="#b9783a" stroke-width="1.4"/>`;
  }
  const posts = Array.from({ length: Math.round(w / 10) + 1 }, (_, k) => `<path d="M${(x0 - 4 + (k * (w + 8)) / Math.round(w / 10)).toFixed(1)} ${bot - 11}v7" stroke="#e0a02a" stroke-width="1.6"/>`).join('');
  const bush = i % 2 === 0
    ? `<g fill="#6fd05f"><circle cx="${x0 - 2}" cy="${bot - 7}" r="6"/><circle cx="${x0 + 6}" cy="${bot - 9}" r="5"/></g><g fill="#ff8fb0"><circle cx="${x0 + 3}" cy="${bot - 12}" r="1.6"/></g>`
    : `<g fill="#6fd05f"><circle cx="${x1 + 2}" cy="${bot - 7}" r="6"/><circle cx="${x1 - 6}" cy="${bot - 9}" r="5"/></g><g fill="#ffd35a"><circle cx="${x1 - 2}" cy="${bot - 12}" r="1.6"/></g>`;
  return `<g>
<path d="M${x0} ${y + 14}H${x1}L${x1 + 4} ${bot}H${x0 - 4}Z" fill="url(#hbStone)"/>
<path d="M${(cx + w * 0.24).toFixed(1)} ${y + 14}H${x1}L${x1 + 4} ${bot}H${(cx + w * 0.26).toFixed(1)}Z" fill="#a8641c" opacity=".14"/>
<path d="M${x0} ${y + 16}H${x1}V${y + 30}H${x0}Z" fill="#b8742a" opacity=".16"/>
<path d="M${x0 - 4} ${bot - 16}H${x1 + 4}" stroke="#ffd35a" stroke-width="2.4" opacity=".9"/>
<path d="M${x1 - 8} ${y + 17}q3 10 -1 18t2 14" fill="none" stroke="#5cc84f" stroke-width="2.6" stroke-linecap="round"/><circle cx="${x1 - 7}" cy="${y + 34}" r="2" fill="#7ee06a"/><circle cx="${x1 - 5}" cy="${y + 49}" r="2" fill="#7ee06a"/>
<circle cx="${x0 + 4}" cy="${y + 24}" r="2.2" fill="#ff8a5c" opacity=".9"/>
${wins}
<rect x="${x0 - 7}" y="${bot - 6}" width="${w + 14}" height="6" rx="3" fill="#ffc93c" stroke="#e0951c" stroke-width="1"/>
${posts}${bush}
<path d="M${x0 - 14} ${y + 18}Q${x0 - 6} ${y + 4} ${(cx - w * 0.14).toFixed(1)} ${y - 9}H${(cx + w * 0.14).toFixed(1)}Q${x1 + 6} ${y + 4} ${x1 + 14} ${y + 18}Z" fill="url(#${roof})"/>
<path d="M${x0 - 14} ${y + 18}H${x1 + 14}" stroke="#ffd35a" stroke-width="3" stroke-linecap="round"/>
<path d="M${(cx - w * 0.14).toFixed(1)} ${y - 8}Q${x0 + 2} ${y + 3} ${x0 - 8} ${y + 14}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2" stroke-linecap="round"/>
<circle cx="${x0 - 14}" cy="${y + 18}" r="2.6" fill="#ffd35a"/><circle cx="${x1 + 14}" cy="${y + 18}" r="2.6" fill="#ffd35a"/>
</g>`;
}

function tower() {
  const cx = 200;
  // từ trên xuống: [y, chiều rộng thân, chiều cao, màu mái]
  const T = [[146, 52, 50, 'hbRoofC'], [200, 70, 56, 'hbRoofT'], [260, 90, 62, 'hbRoofC'], [328, 112, 70, 'hbRoofT'], [404, 136, 78, 'hbRoofC'], [488, 162, 88, 'hbRoofT']];
  const tiers = T.map((t, i) => tier(i, cx, t[0], t[1], t[2], t[3])).join('');
  return `<g class="tower" transform="translate(200 606) scale(.85) translate(-200 -600)">
<ellipse class="breathe" cx="${cx}" cy="150" rx="120" ry="120" fill="url(#hbSun)"/>
<g class="beam" opacity=".55"><path d="M${cx} 96L40 70L60 20Z M${cx} 96L360 70L340 20Z M${cx} 96L120 0H280Z" fill="#fff" opacity=".16"/></g>
<path d="M${cx} 108L${cx + 15} 150H${cx - 15}Z" fill="url(#hbGold)"/>
<path d="M${cx} 86V112" stroke="#e0951c" stroke-width="2.4"/>
<path class="flag" d="M${cx + 1} 90q14 -6 24 0t-24 8z" fill="#ff5e4d"/>
<g class="crystal"><path d="M${cx} 66l9 14l-9 18l-9 -18z" fill="#fff7c2" stroke="#ffc93c" stroke-width="1.6" stroke-linejoin="round"/><path d="M${cx} 66l9 14h-18z" fill="#fff" opacity=".85"/></g>
<circle cx="${cx}" cy="82" r="22" fill="url(#hbSun)" class="breathe"/>
${tiers}
<g><path d="M${cx - 17} 576V552a17 17 0 0 1 34 0V576z" fill="#6b3a1c" stroke="#ffd35a" stroke-width="2.4"/><path d="M${cx - 11} 576V553a11 11 0 0 1 22 0V576z" fill="#ffd978" opacity=".85"/></g>
<path d="M${cx - 30} 590L${cx - 20} 576H${cx + 20}L${cx + 30} 590Z" fill="#e8c28a"/><path d="M${cx - 42} 600L${cx - 30} 590H${cx + 30}L${cx + 42} 600Z" fill="#d6a86a"/>
</g>`;
}

function baseIsland() {
  return `<g class="isl main">
<path d="M78 596Q86 646 138 668L164 724L190 688L214 734L240 680Q312 652 322 596Z" fill="url(#hbRock)"/>
<path d="M104 622Q130 640 150 636M236 640Q262 646 290 624M176 664Q192 676 206 664" fill="none" stroke="#7a4524" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
<rect x="132" y="610" width="9" height="70" rx="4" fill="#bfe9ff" opacity=".85"/><rect x="258" y="606" width="7" height="58" rx="3.5" fill="#bfe9ff" opacity=".8"/>
<ellipse cx="200" cy="596" rx="124" ry="20" fill="url(#hbGrass)"/>
<ellipse cx="200" cy="592" rx="118" ry="15" fill="#9bec74" opacity=".55"/>
<g><rect x="96" y="568" width="5" height="22" rx="2" fill="#8a5a2c"/><circle cx="98" cy="562" r="15" fill="#4fbf5e"/><circle cx="90" cy="570" r="10" fill="#6fd05f"/><circle cx="108" cy="568" r="9" fill="#7ee06a"/></g>
<g><rect x="298" y="572" width="5" height="20" rx="2" fill="#8a5a2c"/><circle cx="300" cy="566" r="13" fill="#4fbf5e"/><circle cx="308" cy="573" r="9" fill="#6fd05f"/></g>
<g fill="#ff8fb0"><circle cx="126" cy="598" r="2.2"/><circle cx="276" cy="600" r="2.2"/></g><g fill="#fff2a0"><circle cx="152" cy="603" r="2"/><circle cx="252" cy="604" r="2"/></g>
</g>`;
}

// Đảo đá nhỏ lơ lửng trang trí
const islet = (x, y, s, o = 1, d = 0) => `<g class="isl" style="animation-delay:${d}s" opacity="${o}" transform="translate(${x} ${y}) scale(${s})"><path d="M-24 0Q-18 22 0 32Q18 22 24 0Z" fill="url(#hbRock)"/><ellipse cx="0" cy="0" rx="26" ry="7" fill="url(#hbGrass)"/><rect x="-1.5" y="-14" width="3" height="12" rx="1.4" fill="#8a5a2c"/><circle cx="0" cy="-18" r="9" fill="#4fbf5e"/><circle cx="-6" cy="-14" r="6" fill="#6fd05f"/></g>`;

const bird = (x, y, s = 1) => `<path d="M${x - 7 * s} ${y}q${3.5 * s} ${-5 * s} ${7 * s} 0q${3.5 * s} ${-5 * s} ${7 * s} 0" fill="none" stroke="#3a6aa0" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/>`;

// Đường mòn sao nối sáu khu theo thứ tự (nét đứt trắng, đi sau Tháp)
function trail() {
  const p = ZONE_POS;
  const d = `M${p[0][0]} ${p[0][1] + 18}Q200 640 ${p[1][0]} ${p[1][1] + 18}Q320 410 ${p[2][0] + 60} ${p[2][1] + 60}Q200 380 ${p[3][0] - 60} ${p[3][1] + 60}Q86 260 ${p[4][0] + 50} ${p[4][1] + 50}Q200 170 ${p[5][0] - 50} ${p[5][1] + 50}`;
  return `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round"/>`;
}

export function hubSky() {
  const rainbow = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'].map((c, k) => `<path d="M${200 - (186 - k * 9)} 330A${186 - k * 9} ${186 - k * 9} 0 0 1 ${200 + (186 - k * 9)} 330" fill="none" stroke="${c}" stroke-width="9.4" opacity=".42"/>`).join('');
  return `<defs>
<linearGradient id="hbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b97e6"/><stop offset=".34" stop-color="#7ac8f8"/><stop offset=".6" stop-color="#bfe8ff"/><stop offset=".82" stop-color="#fff0c4"/><stop offset="1" stop-color="#ffd7a0"/></linearGradient>
<radialGradient id="hbSun"><stop offset="0" stop-color="#fffbe0" stop-opacity=".95"/><stop offset=".45" stop-color="#fff2a8" stop-opacity=".45"/><stop offset="1" stop-color="#fff2a8" stop-opacity="0"/></radialGradient>
<linearGradient id="hbStone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff8e2"/><stop offset=".55" stop-color="#f6dfae"/><stop offset="1" stop-color="#dfb67e"/></linearGradient>
<linearGradient id="hbRoofC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9d86"/><stop offset="1" stop-color="#e5503f"/></linearGradient>
<linearGradient id="hbRoofT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fe8d6"/><stop offset="1" stop-color="#1fa39a"/></linearGradient>
<linearGradient id="hbGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset="1" stop-color="#f0a52a"/></linearGradient>
<linearGradient id="hbWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6b8"/><stop offset="1" stop-color="#ffb94a"/></linearGradient>
<linearGradient id="hbRock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9a06a"/><stop offset="1" stop-color="#8e5a38"/></linearGradient>
<linearGradient id="hbGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fe86e"/><stop offset="1" stop-color="#4fb858"/></linearGradient>
<filter id="zlock"><feColorMatrix type="saturate" values="0.15"/></filter>
</defs>
<rect x="-300" y="-300" width="1000" height="1500" fill="url(#hbSky)"/>
<circle cx="200" cy="170" r="200" fill="url(#hbSun)" class="breathe"/>
${rainbow}
${islet(46, 120, 0.7, 0.55, 0.4)}${islet(352, 96, 0.6, 0.5, 1.2)}${islet(176, 56, 0.45, 0.45, 2)}
${bird(118, 150)}${bird(290, 132, 0.8)}${bird(250, 92, 0.6)}
${cloud(70, 168, 0.8, '#fff', 0.9, 'cl1')}${cloud(336, 232, 0.9, '#fff', 0.92, 'cl2')}${cloud(40, 405, 0.8, '#fff', 0.85, 'cl2')}${cloud(366, 400, 0.75, '#fff', 0.85, 'cl1')}
${tower()}
${baseIsland()}
${islet(34, 560, 0.62, 0.95, 0.9)}${islet(372, 552, 0.55, 0.95, 1.6)}
${cloud(56, 640, 1.5, '#fff', 0.95, 'cl1')}${cloud(344, 650, 1.6, '#fff', 0.95, 'cl2')}${cloud(200, 700, 2.4, '#fffaf0', 1, 'cl1')}
${cloud(20, 740, 2.1, '#fff', 1, 'cl2')}${cloud(380, 748, 2.2, '#fff', 1, 'cl1')}${cloud(200, 790, 3, '#ffe9c4', 1, '')}`;
}
