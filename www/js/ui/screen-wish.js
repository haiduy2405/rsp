// Màn hình: Cầu nguyện (ước). Mỗi ngày 1 lượt quay vòng xoay; kết quả tính ở core/wish.js (seed do UI cấp), vòng xoay chỉ là hiệu ứng.
import { h, btn } from './dom.js';
import { itemIcon } from './icons.js';
import { spinWish, wishUsed } from '../core/wish.js';

const TIER_COL = ['#7a6a52', '#4f8fe0', '#a066e8', '#e0a64a']; // phổ thông, hiếm, rất hiếm, cực hiếm
const ICON = { gold: 'gold', spirit: 'spirit', ticket: 'ticket', soulTicket: 'soul', generic: 'generic', hero: 'fragment' };

export function install(app) {
  const { ctx, music, save, screen, showHub, t } = app;
  const slices = ctx.config.wish.slices;
  const total = slices.reduce((a, s) => a + s.weight, 0);
  const tierOf = (s) => (s.weight >= 15 ? 0 : s.weight >= 7 ? 1 : s.weight >= 3.5 ? 2 : 3);
  const short = (g) => (g.kind === 'generic' || g.kind === 'hero' ? `${g.star}★${g.count > 1 ? `×${g.count}` : ''}` : `${g.count}`);
  const full = (g, hero) => {
    if (g.kind === 'hero' && hero) return `${t('res.fragment', { name: t(`char.${hero}`) })} ×${g.count}`;
    return t(`wish.give.${g.kind}`, { n: g.count, s: g.star });
  };
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function showWish(res) {
    const day = app.dayKey();
    const used = wishUsed(app.progress, day);
    const step = 360 / slices.length;
    const grad = slices.map((s, i) => `${TIER_COL[tierOf(s)]} ${i * step}deg ${(i + 1) * step}deg`).join(',');
    const wheel = h('div', { class: 'wheel', id: 'wheel', style: `background:conic-gradient(${grad})` },
      slices.map((s, i) => h('div', { class: 'wslice', style: `transform:rotate(${(i + 0.5) * step}deg)` }, h('div', { class: 'wlab' }, itemIcon(ICON[s.give.kind], 'sm'), h('small', {}, short(s.give))))),
      h('div', { class: 'whub' }));
    const pointer = h('div', { class: 'wptr', 'aria-hidden': 'true' });
    const last = used && app.progress.wish.slice !== undefined ? slices[app.progress.wish.slice] : null;
    const status = h('div', { class: 'notice', id: 'wish-msg' }, res ? res : used ? t('wish.used') : t('wish.ready'));
    const go = btn(t('wish.spin'), () => {
      const r = spinWish(ctx, app.progress, day, (Math.random() * 4294967296) >>> 0);
      if (!r.ok) { status.textContent = t(`err.${r.reason}`); return; }
      app.progress = r.progress; save(); go.disabled = true; back.disabled = true;
      const target = 360 * 5 - (r.slice + 0.5) * step;
      const done = () => { const g = slices[r.slice].give; app.rewardPop([{ k: ICON[g.kind] || 'generic', n: r.prize.count ?? g.count }], wheel, { big: tierOf(slices[r.slice]) >= 2 }); showWish(t('wish.got', { x: full(r.prize.kind === 'hero' ? { ...slices[r.slice].give } : slices[r.slice].give, r.prize.hero) })); };
      if (reduced()) { done(); return; }
      const wrap = wheel.parentElement;
      const sfx = (n, r) => app.audio?.sfx?.(n, r);
      wrap.classList.add('spinning');
      sfx('whoosh');
      wheel.style.transition = 'transform 4.2s cubic-bezier(.12,.7,.12,1)';
      requestAnimationFrame(() => { wheel.style.transform = `rotate(${target}deg)`; });
      // Mỗi lần kim lướt qua một múi: tiếng "tách" (cao độ theo tốc độ quay) và kim giật nhẹ.
      const angle = () => { const m = new DOMMatrix(getComputedStyle(wheel).transform); return (Math.atan2(m.b, m.a) * 180) / Math.PI; };
      let lastIdx = null, lastA = 0, lastT = 0, alive = true;
      const loop = (now) => {
        if (!alive || !wheel.isConnected) return;
        const a = ((angle() % 360) + 360) % 360;
        const idx = Math.floor((((360 - a) % 360)) / step);
        if (lastIdx !== null && idx !== lastIdx && now - lastT > 40) {
          const speed = Math.min(1, Math.abs(((a - lastA + 540) % 360) - 180) / 14); // độ/khung hình → 0..1
          sfx('tick', 0.85 + speed * 0.6);
          pointer.classList.remove('clack'); void pointer.offsetWidth; pointer.classList.add('clack');
          lastT = now;
        }
        lastIdx = idx; lastA = a;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      setTimeout(() => {
        alive = false;
        wrap.classList.remove('spinning');
        wrap.classList.add('landed');
        const tier = tierOf(slices[r.slice]);
        sfx(tier >= 2 ? 'rare' : 'win');
        if (tier >= 3) setTimeout(() => sfx('fanfare'), 250);
        const col = TIER_COL[tier] === TIER_COL[0] ? '#ffd24a' : TIER_COL[tier];
        wrap.style.setProperty('--wc', col);
        for (let i = 0; i < 16 + tier * 6; i++) { // tia lấp lánh bắn ra quanh vòng xoay
          const sp = document.createElement('i');
          sp.className = 'wspark';
          const a = (i / (16 + tier * 6)) * Math.PI * 2 + Math.random() * 0.3;
          const d = 120 + Math.random() * 60;
          sp.style.cssText = `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;animation-delay:${(Math.random() * 0.15).toFixed(2)}s`;
          wrap.append(sp);
        }
      }, 4250);
      setTimeout(done, 5400);
    }, used ? '' : 'primary', { id: 'wish-go', ...(used ? { disabled: '' } : {}) });
    const back = btn(t('back'), showHub, '', { id: 'back' });
    const legend = [...slices].sort((a, b) => b.weight - a.weight).map((s) => h('div', { class: 'wl-row' }, itemIcon(ICON[s.give.kind], 'sm'), h('span', {}, full(s.give)), h('b', {}, `${Math.round((1000 * s.weight) / total) / 10}%`)));
    music('wish');
    screen(
      h('h2', {}, t('hub.wish')),
      h('div', { class: 'wheel-wrap' }, wheel, pointer),
      status,
      go,
      h('details', { class: 'card wish-rates' }, h('summary', {}, t('wish.rates')), legend),
      back,
    );
    void last;
  }
  return { showWish };
}
