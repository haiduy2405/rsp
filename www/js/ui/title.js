// Tên game: chữ hộp 3D vàng gold lấp lánh, một hàng. Lớp: nền+độ dày (text-shadow trên chính thẻ), mặt trước (::before), đèn quét (::after),
// viền neon ở đáy chữ (lớp đổ bóng cuối) và vài ngôi sao lấp lánh. Chữ tự co để luôn vừa một hàng.
const STARS = [[6, 22, 0], [19, 70, 0.7], [33, 18, 1.4], [47, 76, 0.3], [61, 24, 1.1], [74, 68, 1.9], [88, 28, 0.5], [95, 74, 1.5]];
export function goldTitle(el, text) {
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
