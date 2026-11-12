// Màn hình: Cầu nguyện (ước). Mỗi ngày 1 lượt quay vòng xoay; kết quả tính ở core/wish.js (seed do UI cấp), vòng xoay chỉ là hiệu ứng.
import { h, btn } from './dom.js';
import { itemIcon } from './icons.js';
import { spinWish, wishUsed } from '../core/wish.js';

const TIER_COL = ['#7a6a52', '#4f8fe0', '#a066e8', '#e0a64a']; // phổ thông, hiếm, rất hiếm, cực hiếm
const ICON = { gold: 'gold', spirit: 'spirit', ticket: 'ticket', soulTicket: 'soul', generic: 'generic', hero: 'fragment' };

export function install(app) {
  const { ctx, save, screen, showHub, t } = app;
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
      const done = () => { app.audio.sfx('reveal'); showWish(t('wish.got', { x: full(r.prize.kind === 'hero' ? { ...slices[r.slice].give } : slices[r.slice].give, r.prize.hero) })); };
      if (reduced()) { done(); return; }
      wheel.style.transition = 'transform 4.2s cubic-bezier(.12,.7,.12,1)';
      requestAnimationFrame(() => { wheel.style.transform = `rotate(${target}deg)`; });
      setTimeout(done, 4400);
    }, used ? '' : 'primary', { id: 'wish-go', ...(used ? { disabled: '' } : {}) });
    const back = btn(t('back'), showHub, '', { id: 'back' });
    const legend = [...slices].sort((a, b) => b.weight - a.weight).map((s) => h('div', { class: 'wl-row' }, itemIcon(ICON[s.give.kind], 'sm'), h('span', {}, full(s.give)), h('b', {}, `${Math.round((1000 * s.weight) / total) / 10}%`)));
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
