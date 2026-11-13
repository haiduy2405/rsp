// Hiệu ứng nhận thưởng: bấm nhận -> pháo giấy tại điểm chạm, chip "+N <icon>" nổi lên, âm theo loại.
// Chỉ là UI (Math.random và DOM; không đụng core).
import { itemIcon } from './icons.js';

const KIND = {
  gold: { sfx: 'coinGet', cols: ['#ffe9ad', '#ffd24a', '#e2b75a', '#fff7d6'] },
  spirit: { sfx: 'gemGet', cols: ['#b8fff0', '#5ee6d0', '#7fd6ff', '#ffffff'] },
  ticket: { sfx: 'ticketGet', cols: ['#ffd9a0', '#ffb25a', '#ff8a4a', '#fff0d0'] },
};
const OTHER = { sfx: 'claim', cols: ['#ffe27a', '#ff9bd0', '#7fd6ff', '#9dffb0', '#ffffff'] };

// installRewardFx({ audio, fxLayer }) -> rewardPop(items, at, opts)
// items: [{ k: 'gold'|'spirit'|'ticket'|<khóa icon>, n: số, label?: chuỗi thay cho "+n" }]
// at: sự kiện chạm/chuột, phần tử DOM, hoặc { x, y } (tọa độ màn hình). big: thưởng lớn (thêm pháo hoa).
export function installRewardFx({ audio, fxLayer }) {
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let host = null;
  const layer = () => {
    const fx = document.getElementById('fx');
    if (!host || !host.isConnected) { host = document.createElement('div'); host.id = 'rw-layer'; fx.parentElement.append(host); }
    return host;
  };
  const point = (at) => {
    if (at && typeof at.clientX === 'number') return { x: at.clientX, y: at.clientY };
    if (at && at.getBoundingClientRect) { const r = at.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    if (at && typeof at.x === 'number') return at;
    return { x: innerWidth / 2, y: innerHeight * 0.45 };
  };
  const fmt = (n) => new Intl.NumberFormat(document.documentElement.lang || 'vi').format(n);

  return function rewardPop(items, at, { big = false } = {}) {
    const list = (items || []).filter((i) => i && (i.n > 0 || i.label));
    if (!list.length) return;
    const el = layer();
    const hostRect = el.getBoundingClientRect();
    const p = point(at);
    const x = p.x - hostRect.left; const y = p.y - hostRect.top;
    const main = KIND[list[0].k] || OTHER;
    audio.sfx(big ? 'bigClaim' : main.sfx);
    audio.vibrate?.(big ? [30, 30, 50] : 18);
    list.slice(1, 3).forEach((it, i) => setTimeout(() => audio.sfx((KIND[it.k] || OTHER).sfx), 140 * (i + 1)));
    const cols = [...new Set(list.flatMap((i) => (KIND[i.k] || OTHER).cols))];
    const fxl = fxLayer();
    if (!reduced()) {
      fxl.burst(x, y, cols, big ? 46 : 26);
      if (big) { fxl.firework(x - 90, y - 150, cols[0], 80); fxl.firework(x + 90, y - 190, cols[1] || cols[0], 260); fxl.firework(x, y - 240, cols[2] || cols[0], 440); }
    }
    list.forEach((it, i) => {
      const chip = document.createElement('div');
      chip.className = `rw-chip k-${it.k}`;
      const dx = (i - (list.length - 1) / 2) * 0; // xếp dọc, mỗi chip cao hơn chip trước
      chip.style.left = `${Math.max(70, Math.min(hostRect.width - 70, x + dx))}px`;
      chip.style.top = `${Math.max(40, y - 26 - i * 40)}px`;
      chip.style.animationDelay = `${i * 140}ms`;
      chip.append(itemIcon(it.k, 'sm'), document.createTextNode(it.label || `+${fmt(it.n)}`));
      el.append(chip);
      setTimeout(() => chip.remove(), 2200 + i * 140);
    });
  };
}
