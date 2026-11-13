// Tên game "THIÊN THÁP DỊ ĐIỂM" vẽ tay theo phác thảo của Duy: chữ hộp béo, graffiti, mỗi chữ lệch cao/nghiêng khác nhau,
// dấu mũ/dấu sắc/dấu hỏi là mảnh rời nổi phía trên. Dựng bằng SVG: độ dày hộp (nhiều lớp vàng tối), mặt trước vàng gold,
// đèn quét ngang CHỈ trên mặt trước, viền neon ở đáy chữ, sao lấp lánh. Mỗi chữ: { w, d: [path], eo: [path evenodd], acc: [path dấu] }.
const G = {
  T: { w: 98, d: ['M-8 0H90V32H64V100H30V32H-8Z'] },
  H: { w: 88, d: ['M0 -16H34V32H60Q88 32 88 58V100H54V64H34V100H0Z'] },
  I: { w: 44, d: ['M0 0H44V100H0Z'] },
  N: { w: 90, d: ['M0 100V0H32L58 44V-14H90V100H58L32 56V100Z'] },
  A: { w: 90, eo: ['M0 100V12Q0 0 12 0H78Q90 0 90 12V100H60V70H30V100Z M30 32H60V48H30Z'] },
  P: { w: 90, eo: ['M0 0H72Q92 0 92 20V46Q92 66 72 66H34V100H0Z M34 28H56V38H34Z'] },
  D: { w: 94, eo: ['M0 0H62Q94 0 94 32V68Q94 100 62 100H0Z M34 30H54V70H34Z'] },
  E: { w: 80, d: ['M0 0H80V30H34V36H70V64H34V70H80V100H0Z'] },
  M: { w: 100, d: ['M0 100V0H30L50 36L70 0H100V100H68V54L50 84L32 54V100Z'] },
};
const ACC = {
  circ: 'M4 -22Q38 -58 78 -34L74 -18Q40 -34 10 -6Z', // dấu mũ cong như trong phác thảo
  acute: 'M30 -18L74 -30L84 -12L40 0Z', // hình bình hành
  hook: 'M44 -62Q58 -82 76 -68Q84 -52 66 -44L60 -55Q70 -58 65 -63Q58 -68 52 -55Z', // móc dấu hỏi
  dot: 'M14 112H34V132H14Z',
  bar: 'M-12 40H48V58H-12Z', // gạch ngang chữ Đ
};
// [ký tự, glyph, dấu, dy, xoay°, tỉ lệ] — lệch nhịp kiểu graffiti
const WORDS = [
  [['T', 'T', null, 6, -2, 1.04], ['H', 'H', null, -2, 1, 1.0], ['I', 'I', null, 4, -1, 0.96], ['Ê', 'E', 'circ', -4, 2, 1.02], ['N', 'N', null, 2, -1, 1.04]],
  [['T', 'T', null, -2, 1, 1.0], ['H', 'H', null, 6, -2, 1.04], ['Á', 'A', 'acute', 0, 1, 1.0], ['P', 'P', null, -6, 2, 1.04]],
  [['D', 'D', null, 4, -1, 1.0], ['Ị', 'I', 'dot', -2, 2, 0.98]],
  [['Đ', 'D', 'bar', 2, -1, 1.02], ['I', 'I', null, -4, 1, 1.0], ['Ể', 'E', 'circ+hook', 4, -2, 1.0], ['M', 'M', null, -2, 1, 1.04]],
];
let uid = 0;
// Phong cách "luxury graffiti": mặt vàng nứt + hoa văn chạm, cạnh đen viền vàng, giọt vàng/đen chảy xuống, vương miện, mực bắn.
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
export function buildTitleSvg() {
  const id = `ts${++uid}`;
  const R = rng(7);
  let x = 0, body = '';
  const GAP = 14, WORD = 46;
  const centers = [];
  const accOf = (a) => (a || '').split('+').filter(Boolean);
  WORDS.forEach((word) => {
    word.forEach(([, key, acc, dy, rot, sc]) => {
      const g = G[key];
      const parts = [];
      for (const d of g.d || []) parts.push(`<path d="${d}"/>`);
      for (const d of g.eo || []) parts.push(`<path d="${d}" fill-rule="evenodd"/>`);
      for (const a of accOf(acc)) parts.push(`<path d="${ACC[a]}"/>`);
      body += `<g transform="translate(${x.toFixed(1)} ${dy}) rotate(${rot} ${g.w / 2} 50) translate(${(g.w * (1 - sc)) / 2} ${50 * (1 - sc)}) scale(${sc})">${parts.join('')}</g>`;
      centers.push([x + (g.w * sc) / 2, 100 + dy]);
      x += g.w * sc + GAP;
    });
    x += WORD - GAP;
  });
  const W = x - WORD + 24, VX = -30, VY = -162, VW = W + 60, VH = 336;
  const cx = (W - 24) / 2;
  const side = ['#3a2408', '#2f1c06', '#271707', '#1f1307', '#190f05', '#130c04', '#0d0803'];
  const layers = side.map((c, i) => `<use href="#${id}g" x="${(i + 1) * 1.7}" y="${(i + 1) * 1.7}" fill="${c}" stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`);
  // vành vàng mảnh ở cạnh hộp (như viền vàng quanh khối đen)
  const rim = `<use href="#${id}g" x="3" y="3" fill="none" stroke="#c8962a" stroke-width="10" stroke-linejoin="round" opacity=".9"/>`;
  // vết nứt: các đường gấp khúc mảnh ngẫu nhiên (cố định), cắt theo chữ
  let cracks = '';
  for (let i = 0; i < 46; i++) {
    let px = VX + R() * VW, py = -20 + R() * 130, d = `M${px.toFixed(0)} ${py.toFixed(0)}`;
    const n = 3 + ((R() * 4) | 0);
    for (let k = 0; k < n; k++) { px += (R() - 0.5) * 30; py += (R() - 0.3) * 22; d += `L${px.toFixed(0)} ${py.toFixed(0)}`; }
    cracks += `<path d="${d}"/>`;
  }
  // hoa văn chạm: pattern xoắn nhỏ
  const orn = `<pattern id="${id}p" width="26" height="22" patternUnits="userSpaceOnUse"><path d="M2 16C6 2 20 2 22 11S12 20 11 12 16 7 18 11" fill="none" stroke="#8a5a0c" stroke-width="1.4" stroke-linecap="round"/></pattern>`;
  // giọt chảy: vàng (trước) + đen (sau)
  const drips = centers.filter((_, i) => i % 2 === 0 || i % 5 === 1).map(([px, py], i) => {
    const len = 22 + ((i * 17) % 38), w = 6 + (i % 3) * 1.5, ox = px + ((i % 3) - 1) * 9;
    return `<g class="drip" style="animation-delay:${(i * 0.45).toFixed(2)}s"><path d="M${ox - w / 2} ${py - 6}V${py + len}a${w / 2} ${w / 2} 0 1 0 ${w} 0V${py - 6}Z" fill="url(#${id}f)" stroke="#6b410a" stroke-width="1.2"/></g>`;
  }).join('');
  const blackDrips = centers.filter((_, i) => i % 3 === 1).map(([px, py], i) =>
    `<path d="M${px + 14} ${py}V${py + 26 + ((i * 13) % 30)}a3 3 0 1 0 6 0V${py}Z" fill="#0d0803"/>`).join('');
  let splat = '';
  for (let i = 0; i < 38; i++) splat += `<circle cx="${(VX + R() * VW).toFixed(0)}" cy="${(-120 + R() * 280).toFixed(0)}" r="${(1.2 + R() * 4.2).toFixed(1)}"/>`;
  const crown = `<g transform="translate(${cx.toFixed(0)} -62)"><path d="M-74 0L-68 -62L-38 -34L0 -78L38 -34L68 -62L74 0Z" fill="url(#${id}f)" stroke="#2a1806" stroke-width="5" stroke-linejoin="round"/><path d="M-74 0H74V16H-74Z" fill="url(#${id}f)" stroke="#2a1806" stroke-width="5" stroke-linejoin="round"/><g fill="#fff6c8" stroke="#6b410a" stroke-width="2"><circle cx="-68" cy="-66" r="8"/><circle cx="0" cy="-82" r="9"/><circle cx="68" cy="-66" r="8"/></g></g>`;
  const sparkles = [[6, 30], [22, 78], [38, 24], [52, 84], [67, 20], [80, 74], [92, 28], [50, 8]].map(([px, py], i) =>
    `<path class="spk" style="animation-delay:${(i * 0.37).toFixed(2)}s" transform="translate(${(VX + (VW * px) / 100).toFixed(0)} ${(VY + 60 + (150 * py) / 100).toFixed(0)})" d="M0 -18L4 -4L18 0L4 4L0 18L-4 4L-18 0L-4 -4Z"/>`).join('');
  return `<svg class="gt-svg" viewBox="${VX} ${VY} ${VW} ${VH}" role="img" aria-label="Thiên Tháp Dị Điểm" xmlns="http://www.w3.org/2000/svg">
<defs>
<g id="${id}g" color="#fff" stroke-linejoin="round">${body}</g>
<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".25" stop-color="#ffd24a"/><stop offset=".5" stop-color="#e0a21f"/><stop offset=".62" stop-color="#9c6a10"/><stop offset=".82" stop-color="#ecb832"/><stop offset="1" stop-color="#ffe27a"/></linearGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
${orn}
<mask id="${id}m" maskUnits="userSpaceOnUse" x="${VX}" y="${VY}" width="${VW}" height="${VH}"><use href="#${id}g" fill="#fff" stroke="#fff" stroke-width="2"/></mask>
<filter id="${id}b" x="-10%" y="-10%" width="120%" height="150%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
<g fill="#0d0803" opacity=".8">${splat}</g>
${blackDrips}
<use href="#${id}g" x="9" y="18" fill="#ffb02a" stroke="#ffb02a" stroke-width="12" filter="url(#${id}b)" opacity=".55"/>
${layers.join('')}
${rim}
<use href="#${id}g" x="9" y="13" fill="none" stroke="#9DF1FF" stroke-width="2.5" opacity=".9"/>
<use href="#${id}g" fill="url(#${id}f)" stroke="#3a2408" stroke-width="3" paint-order="stroke"/>
<use href="#${id}g" fill="url(#${id}f)" stroke="url(#${id}f)" stroke-width="1"/>
<g mask="url(#${id}m)">
<rect x="${VX}" y="${VY}" width="${VW}" height="${VH}" fill="url(#${id}p)" opacity=".5"/>
<g fill="none" stroke="#3a2408" stroke-width="1.1" opacity=".55" stroke-linejoin="round">${cracks}</g>
<use href="#${id}g" x="-1.5" y="-1.5" fill="none" stroke="#fff6c8" stroke-width="2" opacity=".75"/>
<rect class="sweep" x="${VX - 160}" y="${VY}" width="150" height="${VH}" fill="url(#${id}s)" transform="skewX(-18)"/>
</g>
${drips}
${crown}
${sparkles}
</svg>`;
}
