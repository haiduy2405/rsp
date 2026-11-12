// Màn hình: Cửa hàng hằng ngày. Món sinh theo ngày (core/shop.js), món đầu miễn phí.
import { h, btn } from './dom.js';
import { itemIcon } from './icons.js';
import { ensureShop, buyOffer, leftStock } from '../core/shop.js';
import { COLORS } from './hero-ui.js';

export function install(app) {
  const { el, CUR_COL, ctx, offeringName, save, screen, showHub, t } = app;
  let msg = null;

  const RARITY_COL = ['#6b6f7d', '#6b6f7d', '#4fae7b', '#4f8fe0', '#a066e8', '#e0a64a'];
  const iconOf = (g) => ({
    spirit: ['spirit'], soulTicket: ['soul'], elixir: [`elixir${g.key}`], offering: ['offering'],
    stoneN: ['stoneN', COLORS[g.key]], stoneR: ['stoneR', COLORS[g.key]], fragment: ['fragment', g.kind === 'fragment' ? COLORS[ctx.characters[g.key].element] : null],
  })[g.kind];
  const rarityOf = (g) => (g.kind === 'fragment' ? ctx.characters[g.key].rarity : g.kind === 'elixir' ? Number(g.key) + 1 : g.kind === 'stoneR' ? 4 : g.kind === 'offering' ? Number(g.key.split('_')[1]) + 1 : g.kind === 'spirit' ? 4 : 3);
  function nameOf(g) {
    const n = g.count;
    if (g.kind === 'spirit') return t('shop.give.spirit', { n });
    if (g.kind === 'soulTicket') return t('shop.give.soulTicket', { n });
    if (g.kind === 'elixir') return t('shop.give.elixir', { name: t(`res.elixir.${g.key}`), n });
    if (g.kind === 'stoneN' || g.kind === 'stoneR') return t('shop.give.stone', { name: `${t('res.stone')} ${t(g.kind === 'stoneN' ? 'stone.normal' : 'stone.rare')} · ${el(Number(g.key))}`, n });
    if (g.kind === 'offering') return t('shop.give.offering', { name: offeringName(g.key), n });
    return t('shop.give.fragment', { name: t('res.fragment', { name: t(`char.${g.key}`) }), n });
  }

  function showShop() {
    app.progress = ensureShop(ctx, app.progress, app.dayKey());
    save();
    const p = app.progress;
    const fmt = (n) => new Intl.NumberFormat(app.lang).format(n);
    const cards = p.shop.offers.map((o) => {
      const left = leftStock(p, o);
      const [icon, tint] = iconOf(o.give);
      const free = o.price.cur === 'free';
      const label = left <= 0 ? t('shop.soldOut') : free ? t('shop.free') : `${t('shop.buy')} · ${fmt(o.price.amount)} ${t(`res.${o.price.cur}`)}`;
      const buy = () => {
        const r = buyOffer(ctx, app.progress, app.dayKey(), o.id);
        if (r.ok) { app.progress = r.progress; save(); app.audio.sfx('reveal'); msg = nameOf(o.give); } else msg = t(`err.${r.reason}`);
        showShop();
      };
      return h('div', { class: 'card shop-offer', 'data-offer': o.id, style: `--rc:${RARITY_COL[rarityOf(o.give)]}` },
        itemIcon(icon, 'lg', tint), h('div', { class: 'so-info' }, h('b', {}, nameOf(o.give)), h('small', { class: 'muted' }, t('shop.left', { n: Math.max(0, left) }))),
        btn(label, buy, !free || left <= 0 ? '' : 'primary', { id: `buy-${o.id}`, ...(left <= 0 ? { disabled: '' } : {}) }));
    });
    screen(
      h('h2', {}, t('shop.daily')),
      h('div', { class: 'row' }, h('div', { class: 'res', id: 'shop-gold' }, h('i', { class: 'dot', style: `background:${CUR_COL.gold}` }), t('res.gold'), h('b', {}, fmt(p.inventory.gold))), h('div', { class: 'res', id: 'shop-spirit' }, h('i', { class: 'dot', style: `background:${CUR_COL.spirit}` }), t('res.spirit'), h('b', {}, fmt(p.inventory.spirit)))),
      h('div', { class: 'muted' }, t('shop.resetNote')),
      msg ? h('div', { class: 'notice', id: 'shop-msg' }, msg) : null,
      cards,
      btn(t('hub.items'), () => app.showItems(), '', { id: 'shop-items' }),
      btn(t('back'), showHub, '', { id: 'back' }),
    );
    msg = null;
  }

  return { showShop };
}
