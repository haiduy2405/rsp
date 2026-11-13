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
export function buildTitleSvg() {
  const id = `ts${++uid}`;
  let x = 0, body = '';
  const GAP = 14, WORD = 46;
  const accOf = (a) => (a || '').split('+').filter(Boolean);
  WORDS.forEach((word, wi) => {
    word.forEach(([, key, acc, dy, rot, sc]) => {
      const g = G[key];
      const parts = [];
      for (const d of g.d || []) parts.push(`<path d="${d}"/>`);
      for (const d of g.eo || []) parts.push(`<path d="${d}" fill-rule="evenodd"/>`);
      for (const a of accOf(acc)) {
        parts.push(`<path d="${ACC[a]}"/>`);
      }
      body += `<g transform="translate(${x.toFixed(1)} ${dy}) rotate(${rot} ${g.w / 2} 50) translate(${(g.w * (1 - sc)) / 2} ${50 * (1 - sc)}) scale(${sc})">${parts.join('')}</g>`;
      x += g.w * sc + GAP;
    });
    x += WORD - GAP;
  });
  const W = x - WORD + 24, VX = -16, VY = -86, VW = W + 24, VH = 240;
  const layers = [];
  const dark = ['#c48a18', '#b57c14', '#a66f10', '#97630e', '#88570c', '#794c0a', '#6a4108', '#5b3607'];
  dark.forEach((c, i) => layers.push(`<use href="#${id}g" x="${i + 1}" y="${i + 1}" fill="${c}" stroke="${c}" stroke-width="7" stroke-linejoin="round"/>`));
  const sparkles = [[6, 8], [22, 82], [38, 20], [52, 90], [67, 14], [80, 78], [92, 22]].map(([px, py], i) =>
    `<path class="spk" style="animation-delay:${(i * 0.37).toFixed(2)}s" transform="translate(${(VX + (VW * px) / 100).toFixed(0)} ${(VY + 40 + (110 * py) / 100).toFixed(0)})" d="M0 -16L4 -4L16 0L4 4L0 16L-4 4L-16 0L-4 -4Z"/>`).join('');
  return `<svg class="gt-svg" viewBox="${VX} ${VY} ${VW} ${VH}" role="img" aria-label="Thiên Tháp Dị Điểm" xmlns="http://www.w3.org/2000/svg">
<defs>
<g id="${id}g" color="#fff" stroke-linejoin="round">${body}</g>
<linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe2"/><stop offset=".28" stop-color="#ffe486"/><stop offset=".55" stop-color="#ffc531"/><stop offset=".62" stop-color="#d9941a"/><stop offset=".85" stop-color="#f6c545"/><stop offset="1" stop-color="#ffe27a"/></linearGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="${id}m" maskUnits="userSpaceOnUse" x="${VX}" y="${VY}" width="${VW}" height="${VH}"><use href="#${id}g" fill="#fff" stroke="#fff" stroke-width="2"/></mask>
<filter id="${id}b" x="-10%" y="-10%" width="120%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
<use href="#${id}g" x="9" y="16" fill="#1de2ff" stroke="#1de2ff" stroke-width="12" filter="url(#${id}b)" opacity=".9"/>
<use href="#${id}g" x="9" y="12" fill="#9DF1FF" stroke="#9DF1FF" stroke-width="7"/>
${layers.join('')}
<use href="#${id}g" fill="url(#${id}f)" stroke="#5a3606" stroke-width="3" paint-order="stroke"/>
<use href="#${id}g" fill="url(#${id}f)" stroke="url(#${id}f)" stroke-width="1"/>
<g mask="url(#${id}m)"><rect class="sweep" x="${VX - 160}" y="${VY}" width="150" height="${VH}" fill="url(#${id}s)" transform="skewX(-18)"/></g>
${sparkles}
</svg>`;
}
export const SKETCH_W = 1;
