// Logo tên game: tên chính (chữ vàng-kem có viền nâu, khối 3D nhẹ, đèn quét ngang) + dải ruy băng phụ đề + hàng ngọc 6 hệ.
// Dùng cùng ngôn ngữ thiết kế với phần còn lại của game: tranh vẽ tay ấm, khung vàng, nền nâu đất. Tên chính tự co để luôn vừa một hàng.
export function goldTitle(el, main, sub) {
  el.classList.add('lg');
  el.textContent = '';
  // Tên chính tách 2 dòng cân nhau; tên phụ (ngôn ngữ còn lại) cùng kiểu chữ vàng, nhỏ hơn, để nhìn là một cặp tên.
  const split = (str) => {
    const w = str.split(' ');
    if (w.length < 2) return [str];
    let best = 1, d = 1e9;
    for (let i = 1; i < w.length; i++) { const x = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (x < d) { d = x; best = i; } }
    return [w.slice(0, best).join(' '), w.slice(best).join(' ')];
  };
  const mk = (txt, cls) => { const m = document.createElement('div'); m.className = `lg-main ${cls}`; m.dataset.t = txt; m.textContent = txt; return m; };
  const mains = split(main).map((x) => mk(x, 'big'));
  const frame = document.createElement('div');
  frame.className = 'lg-frame';
  for (const c of ['tl', 'tr', 'bl', 'br']) { const i = document.createElement('i'); i.className = `lg-c lg-${c}`; frame.append(i); }
  const wrap = document.createElement('div');
  wrap.className = 'lg-name';
  wrap.append(...mains);
  frame.append(wrap);
  el.append(frame);
  let subEl = null;
  if (sub) {
    const d = document.createElement('div');
    d.className = 'lg-div';
    d.innerHTML = '<i></i><b></b><i></i>';
    frame.append(d);
    subEl = mk(sub, 'small');
    frame.append(subEl);
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
  frame.append(gems);
  const fit = () => {
    const box = frame.clientWidth || el.clientWidth || 300;
    const avail = (box - 6) * 0.98; // trừ phần đệm khung
    const size = (nodes, max) => {
      let k = max;
      nodes.forEach((n) => { n.style.fontSize = '40px'; k = Math.min(k, (40 * avail) / (n.scrollWidth || 1)); });
      nodes.forEach((n) => { n.style.fontSize = `${Math.max(14, k)}px`; });
      const over = Math.max(...nodes.map((n) => n.scrollWidth)) / avail; // đo lại sau khi đặt cỡ (font có thể vừa tải xong)
      if (over > 1) nodes.forEach((n) => { n.style.fontSize = `${Math.max(14, k / over)}px`; });
    };
    size(mains, 66);
    if (subEl) size([subEl], 30);
  };
  requestAnimationFrame(fit);
  document.fonts?.ready.then(fit);
  document.fonts?.load?.("900 40px Fraunces").then(fit).catch(() => {});
  setTimeout(fit, 600);
  window.addEventListener('resize', fit);
}
