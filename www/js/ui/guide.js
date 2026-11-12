// Chỉ tay hướng dẫn: vòng sáng + bàn tay + chú thích trên một phần tử. Không chặn chạm (pointer-events: none),
// tự đặt lại vị trí khi bố cục đổi và tự tắt khi phần tử biến mất.
export function createGuide(wrap) {
  let root = null;
  let timer = 0;
  let poll = 0;
  const clear = () => {
    clearTimeout(timer);
    clearInterval(poll);
    root?.remove();
    root = null;
  };
  function point(target, text, delay = 400, { dock = false } = {}) {
    clear();
    timer = setTimeout(() => {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el || !el.isConnected) return;
      el.scrollIntoView?.({ block: dock ? 'center' : 'nearest' });
      root = document.createElement('div');
      root.className = 'g-root';
      root.setAttribute('aria-hidden', 'true');
      const ring = document.createElement('div');
      ring.className = 'g-ring';
      const hand = document.createElement('div');
      hand.className = 'g-hand';
      const tip = document.createElement('div');
      tip.className = 'g-tip';
      tip.textContent = text || '';
      root.append(ring, hand, tip);
      wrap.appendChild(root);
      const layout = () => {
        if (!el.isConnected) return clear();
        const w = wrap.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        if (!w.width || !r.width) return;
        const pad = 6;
        const x = r.left - w.left - pad;
        const y = r.top - w.top - pad;
        Object.assign(ring.style, { left: `${x}px`, top: `${y}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
        const below = dock ? r.bottom + 60 < w.top + w.height - 120 : r.top + r.height / 2 < w.top + w.height * 0.6; // mục tiêu ở nửa trên: tay chỉ lên từ dưới; ở nửa dưới: tay chỉ xuống từ trên
        const cx = r.left - w.left + r.width / 2;
        hand.textContent = below ? '👆' : '👇';
        hand.classList.toggle('up', !below);
        Object.assign(hand.style, { left: `${cx}px`, top: below ? `${r.bottom - w.top + 2}px` : `${r.top - w.top - 50}px` });
        const half = Math.min(150, w.width / 2 - 12);
        tip.style.left = `${Math.max(half + 8, Math.min(w.width - half - 8, cx))}px`;
        if (dock) { tip.style.top = 'auto'; tip.style.bottom = '70px'; tip.style.left = `${w.width / 2}px`; tip.style.maxWidth = `${w.width - 40}px`; }
        else tip.style.top = below ? `${r.bottom - w.top + 52}px` : `${r.top - w.top - 96}px`;
        if (!dock) tip.style.maxWidth = `${half * 2}px`;
        tip.hidden = !text;
      };
      layout();
      root.classList.add('on');
      poll = setInterval(layout, 400);
    }, delay);
  }
  return { point, clear };
}
