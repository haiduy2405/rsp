// Logo tên game: tên chính (chữ vàng-kem có viền nâu, khối 3D nhẹ, đèn quét ngang) + dải ruy băng phụ đề + hàng ngọc 6 hệ.
// Dùng cùng ngôn ngữ thiết kế với phần còn lại của game: tranh vẽ tay ấm, khung vàng, nền nâu đất. Tên chính tự co để luôn vừa một hàng.
export function goldTitle(el, main, sub) {
  el.classList.add('lg');
  el.textContent = '';
  const m = document.createElement('div');
  m.className = 'lg-main';
  m.dataset.t = main;
  m.textContent = main;
  el.append(m);
  if (sub) {
    const r = document.createElement('div');
    r.className = 'lg-ribbon';
    const s = document.createElement('span');
    s.textContent = sub;
    r.append(s);
    el.append(r);
  }
  const gems = document.createElement('div');
  gems.className = 'lg-gems';
  for (let i = 0; i < 6; i++) {
    const im = document.createElement('img');
    im.src = `assets/orbs/orb${i}.webp`;
    im.alt = '';
    im.draggable = false;
    im.style.animationDelay = `${i * 0.18}s`;
    gems.append(im);
  }
  el.append(gems);
  const fit = () => {
    const box = el.parentElement;
    if (!box) return;
    const avail = Math.min(box.clientWidth || 340, 420) * 0.92;
    m.style.fontSize = '40px';
    const w = m.scrollWidth || 1;
    m.style.fontSize = `${Math.max(16, Math.min(40, (40 * avail) / w))}px`;
  };
  requestAnimationFrame(fit);
  document.fonts?.ready.then(fit);
  window.addEventListener('resize', fit);
}
