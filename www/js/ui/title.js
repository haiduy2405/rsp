// Tên game: chữ hộp 3D vàng gold lấp lánh, một hàng. Lớp: nền+độ dày (text-shadow trên chính thẻ), mặt trước (::before), đèn quét (::after),
// viền neon ở đáy chữ (lớp đổ bóng cuối) và vài ngôi sao lấp lánh. Chữ tự co để luôn vừa một hàng.
const STARS = [[6, 22, 0], [19, 70, 0.7], [33, 18, 1.4], [47, 76, 0.3], [61, 24, 1.1], [74, 68, 1.9], [88, 28, 0.5], [95, 74, 1.5]];
import { buildTitleSvg } from './title-svg.js';
const isVi = (t) => /^thiên tháp dị điểm$/i.test((t || '').normalize('NFC').trim());
export function goldTitle(el, text) {
  if (isVi(text)) {
    el.classList.add('gt-sketch');
    el.innerHTML = buildTitleSvg();
    // kim cương vàng trang trí dưới tên: to nhỏ xen kẽ, lơ lửng + lóe sáng
    const row = document.createElement('div');
    row.className = 'gt-gems';
    [[28, 0.2], [42, 0.9], [60, 0], [42, 0.5], [28, 1.2]].forEach(([sz, dl]) => {
      const im = document.createElement('img');
      im.src = 'assets/ui/diamond.webp';
      im.alt = '';
      im.draggable = false;
      im.style.cssText = `width:${sz}px;animation-delay:${dl}s`;
      row.append(im);
    });
    el.append(row);
    return;
  }
  el.classList.add('gt3d');
  el.dataset.t = text;
  el.textContent = text;
  for (const [x, y, d] of STARS) {
    const s = document.createElement('i');
    s.className = 'spk';
    s.style.cssText = `left:${x}%;top:${y}%;animation-delay:${d}s`;
    el.append(s);
  }
  const fit = () => {
    const box = el.parentElement;
    if (!box) return;
    const avail = Math.min(box.clientWidth || 340, 420) * 0.94;
    el.style.fontSize = '40px';
    const w = el.scrollWidth || 1;
    el.style.fontSize = `${Math.max(14, Math.min(40, (40 * avail) / w))}px`;
  };
  requestAnimationFrame(fit);
  document.fonts?.ready.then(fit);
  window.addEventListener('resize', fit);
}
