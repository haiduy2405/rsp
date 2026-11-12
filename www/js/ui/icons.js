// Icon vật phẩm / phần thưởng (SVG nội tuyến).
import { h } from './dom.js';

// ---- Cảnh thưởng: rương rung, mở nắp, đồ bay ra từng món có số đếm tăng và âm thanh
export const REWARD_ICON = {
  gold: '<circle cx="12" cy="12" r="9" fill="#e2b75a" stroke="#8a6a2a" stroke-width="1.5"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#fff0bd" stroke-width="1.5"/>',
  elixir1: '<path d="M12 3c3 3.800 5.600 6.600 5.600 9.800a5.600 5.600 0 0 1-11.200 0C6.400 9.600 9 6.800 12 3z" fill="#6bd5ff" stroke="#1f6f9a" stroke-width="1.4"/><ellipse cx="9.800" cy="12.500" rx="1.200" ry="2.200" fill="#fff" opacity=".6"/>',
  elixir2: '<path d="M9.500 3h5v4.500l4.200 8.300a2.800 2.800 0 0 1-2.500 4.200H7.800a2.800 2.800 0 0 1-2.500-4.200l4.200-8.300z" fill="#9a8cff" stroke="#443a9a" stroke-width="1.400" stroke-linejoin="round"/><path d="M7 15h10" stroke="#e8e4ff" stroke-width="1.400" opacity=".8"/><rect x="9" y="2" width="6" height="2.200" rx="1" fill="#d9b36a" stroke="#6f5320" stroke-width="1"/>',
  elixir3: '<circle cx="12" cy="14" r="7.500" fill="#ffd24a" stroke="#8a6a2a" stroke-width="1.500"/><rect x="9.500" y="2.500" width="5" height="4" rx="1" fill="#d9b36a" stroke="#6f5320" stroke-width="1.200"/><path d="M12 8.500l1.500 3.200 3.500.4-2.600 2.400.7 3.500L12 16.200 8.900 18l.7-3.500L7 12.100l3.500-.4z" fill="#fff7d6" stroke="#8a6a2a" stroke-width=".8" stroke-linejoin="round"/>',
  ticket: '<path d="M2.500 7h19v3.200a2 2 0 0 0 0 3.600V17h-19v-3.200a2 2 0 0 0 0-3.600z" fill="#ff9a4a" stroke="#8a3f10" stroke-width="1.400" stroke-linejoin="round"/><path d="M9 7.500v9" stroke="#ffe3c4" stroke-width="1.200" stroke-dasharray="1.600 1.600"/><path d="M15 9.200l.9 1.800 2 .3-1.450 1.400.35 2L15 13.700l-1.800.9.350-2L12.100 11.300l2-.3z" fill="#fff0d0"/>',
  spirit: '<path d="M12 2.500l7.500 6.500-7.500 12.500L4.500 9z" fill="#6bd5ff" stroke="#1f6f9a" stroke-width="1.4" stroke-linejoin="round"/><path d="M4.500 9h15M12 2.500L9 9l3 12.500L15 9z" fill="none" stroke="#e6f8ff" stroke-width="1" opacity=".8"/>',
  shard: '<path d="M7 3.500l8.500 2L19 14l-6.500 6.500L5 14z" fill="#ff7fb0" stroke="#a83a6a" stroke-width="1.400" stroke-linejoin="round"/><path d="M7 3.500L12.500 12 19 14" fill="none" stroke="#ffe0ee" stroke-width="1" opacity=".8"/>',
  fodder: '<ellipse cx="12" cy="13" rx="7.500" ry="6.500" fill="#8fd69a" stroke="#2f7a45" stroke-width="1.400"/><circle cx="9.500" cy="11.500" r="1.200" fill="#1c3a26"/><circle cx="14.500" cy="11.500" r="1.200" fill="#1c3a26"/>',
  offering: '<rect x="4.500" y="9" width="15" height="11" rx="1.500" fill="#ffb86b" stroke="#8a4a1a" stroke-width="1.400"/><path d="M4.500 13h15M12 9v11M12 9c-1-4-5-4-5-1.500S11 9 12 9zm0 0c1-4 5-4 5-1.500S13 9 12 9z" fill="none" stroke="#fff0d0" stroke-width="1.200"/>',
  fragment: '<path d="M4.500 4.500h5a2.200 2.200 0 1 1 4.400 0h5.600v5.600a2.200 2.200 0 1 0 0 4.400v5H4.500z" fill="#c0c0c0" stroke="#1b1b24" stroke-width="1.400" stroke-linejoin="round"/><path d="M7 7h4M7 10h2" stroke="#fff" stroke-width="1.200" opacity=".6" stroke-linecap="round"/>',
  generic: '<path d="M4.500 4.500h5a2.200 2.200 0 1 1 4.400 0h5.600v5.600a2.200 2.200 0 1 0 0 4.400v5H4.500z" fill="#e8e4d4" stroke="#6f6040" stroke-width="1.400" stroke-linejoin="round"/><path d="M12 8.500l1.200 2.500 2.700.3-2 1.800.6 2.700-2.500-1.400-2.500 1.400.6-2.700-2-1.800 2.700-.3z" fill="#d9ad55"/>',
  soul: '<path d="M2.500 7h19v3.200a2 2 0 0 0 0 3.600V17h-19v-3.200a2 2 0 0 0 0-3.600z" fill="#5ad49a" stroke="#176a45" stroke-width="1.400" stroke-linejoin="round"/><path d="M9 7.500v9" stroke="#d8ffee" stroke-width="1.200" stroke-dasharray="1.600 1.600"/><path d="M15.500 15.500c-2.500 0-3.500-2-3.500-3.500a3.500 3.500 0 0 1 7 0v3.500l-1-.8-1 .8-1-.8z" fill="#effff7"/>',
  stoneN: '<path d="M12 3l7.500 4.300v8.400L12 20l-7.500-4.300V7.300z" fill="#7d8fd8" stroke="#3a4690" stroke-width="1.400" stroke-linejoin="round"/>',
  stoneR: '<path d="M12 3l7.500 4.300v8.400L12 20l-7.500-4.300V7.300z" fill="#ffd24a" stroke="#8a6a2a" stroke-width="1.400" stroke-linejoin="round"/><path d="M12 3v17M4.500 7.300L19.500 15.700M19.500 7.300L4.500 15.700" stroke="#fff7d6" stroke-width=".8" opacity=".7"/>',
};

// Icon vật phẩm dùng chung (Hòm đồ, màn tướng, triệu hồi): size 'sm' | 'lg'.
export function itemIcon(k, size = 'sm', tint) {
  const e = h('span', { class: `ricon icon-${size}` });
  const body = tint && (k === 'stoneN' || k === 'stoneR' || k === 'fragment') ? REWARD_ICON[k].replace(/fill="#(7d8fd8|ffd24a|c0c0c0)"/, `fill="${tint}"`) : REWARD_ICON[k];
  e.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  return e;
}

export const rewardIcon = (k) => {
  const e = h('span', { class: 'ricon' });
  e.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${REWARD_ICON[k]}</svg>`;
  return e;
};
