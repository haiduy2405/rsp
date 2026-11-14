// Màn hình: Cửa hàng hằng ngày. Món sinh theo ngày (core/shop.js), món đầu miễn phí.
import { h, btn } from './dom.js';
import { itemIcon } from './icons.js';
import { ensureShop, buyOffer, leftStock } from '../core/shop.js';
import { COLORS } from './hero-ui.js';

export function install(app) {
  const { el, CUR_COL, ctx, music, offeringName, save, screen, showHub, t } = app;
  let msg = null, toastT = 0;

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

  function shortName(g) {
    if (g.kind === 'spirit') return t('res.spirit');
    if (g.kind === 'soulTicket') return t('res.soulTicket');
    if (g.kind === 'elixir') return t(`res.elixir.${g.key}`);
    if (g.kind === 'stoneN' || g.kind === 'stoneR') return `${t('res.stone')} ${t(g.kind === 'stoneN' ? 'stone.normal' : 'stone.rare')}`;
    if (g.kind === 'offering') return offeringName(g.key);
    return t('res.fragment', { name: t(`char.${g.key}`) });
  }
  const TABS = [
    { id: 'all', icon: 'gold', kinds: null },
    { id: 'currency', icon: 'spirit', kinds: ['spirit', 'soulTicket'] },
    { id: 'elixir', icon: 'elixir1', kinds: ['elixir'] },
    { id: 'material', icon: 'stoneR', kinds: ['stoneN', 'stoneR', 'offering'] },
    { id: 'fragment', icon: 'fragment', kinds: ['fragment'] },
  ];
  let tab = 'all', sel = null;

  function showShop() {
    app.progress = ensureShop(ctx, app.progress, app.dayKey());
    save();
    const p = app.progress;
    const fmt = (n) => new Intl.NumberFormat(app.lang).format(n);
    const offers = p.shop.offers;
    const inTab = (o) => { const k = TABS.find((x) => x.id === tab).kinds; return !k || k.includes(o.give.kind); };
    const freeId = offers.find((o) => o.price.cur === 'free')?.id;
    const shown = offers.filter((o) => inTab(o) && o.id !== freeId);
    if (!shown.find((o) => o.id === sel)) sel = (shown.find((o) => leftStock(p, o) > 0) || shown[0])?.id ?? null;
    const buyOf = (o) => (ev) => {
      const r = buyOffer(ctx, app.progress, app.dayKey(), o.id);
      if (r.ok) { app.progress = r.progress; if (o.price.cur === 'free') app.trackQuest('shop_free'); save(); app.rewardPop([{ k: iconOf(o.give)[0], n: o.give.count }], ev); msg = nameOf(o.give); } else msg = t(`err.${r.reason}`);
      showShop();
    };
    const askBuy = (o, ev) => {
      app.audio?.sfx?.('tick');
      const [icon, tint] = iconOf(o.give);
      const close = () => document.getElementById('info')?.remove();
      document.getElementById('info')?.remove();
      document.getElementById('wrap').appendChild(h('div', { id: 'info', onclick: (e) => e.target.id === 'info' && close() },
        h('div', { class: 'infobox buybox', id: 'buy-confirm', style: `--rc:${RARITY_COL[rarityOf(o.give)]}` },
          h('div', { class: 'bb-ic' }, itemIcon(icon, 'lg', tint), h('i', { class: 'sc-n' }, `×${o.give.count}`)),
          h('b', {}, nameOf(o.give)),
          h('div', { class: 'bb-price' }, t('shop.confirm'), ' ', itemIcon(o.price.cur, 'sm'), h('b', {}, `${fmt(o.price.amount)}`)),
          h('div', { class: 'row bb-btns' }, btn(t('shop.no'), close, '', { id: 'buy-no' }), btn(t('shop.yes'), (e2) => { close(); buyOf(o)(e2); }, 'primary', { id: 'buy-yes' })))));
    };
    const hasKind = (tb) => !tb.kinds || offers.some((o) => tb.kinds.includes(o.give.kind));
    const tabs = h('nav', { class: 'shop-tabs', role: 'tablist' }, TABS.filter(hasKind).map((tb) => h('button', { class: 'shop-tab' + (tb.id === tab ? ' on' : ''), role: 'tab', 'aria-selected': String(tb.id === tab), 'data-tab': tb.id, onclick: () => { tab = tb.id; sel = null; app.audio?.sfx?.('tick'); showShop(); } }, itemIcon(tb.icon, 'sm'), h('span', {}, t(`shop.tab.${tb.id}`)))));
    const afford = (o) => o.price.cur === 'free' || (p.inventory[o.price.cur] ?? 0) >= o.price.amount;
    const stars = (r) => h('span', { class: 'sc-stars', 'aria-label': t('rarity.n', { n: r }) }, '★'.repeat(Math.min(5, Math.max(1, r))));
    const press = (o, ev, node) => {
      if (leftStock(p, o) <= 0) return;
      sel = o.id;
      if (o.price.cur === 'free') return buyOf(o)(ev);
      if (!afford(o)) { node?.classList.remove('nope'); void node?.offsetWidth; node?.classList.add('nope'); app.audio?.sfx?.('error'); msg = t(`err.not_enough_${o.price.cur}`); const m = document.getElementById('shop-msg') || h('div', { class: 'notice', id: 'shop-msg' }, msg); m.textContent = msg; if (!m.isConnected) document.getElementById('screen').appendChild(m); clearTimeout(toastT); toastT = setTimeout(() => m.remove(), 2200); return; }
      askBuy(o, ev);
    };
    const cells = shown.map((o, i) => {
      const left = leftStock(p, o);
      const [icon, tint] = iconOf(o.give);
      const free = o.price.cur === 'free', r = rarityOf(o.give), ok = afford(o);
      const price = left <= 0 ? h('span', { class: 'sc-price out' }, t('shop.soldOut')) : free ? h('span', { class: 'sc-price free' }, t('shop.free')) : h('span', { class: 'sc-price' + (ok ? '' : ' poor') }, itemIcon(o.price.cur, 'sm'), fmt(o.price.amount));
      const node = h('button', { class: 'shop-cell r' + r + (left <= 0 ? ' out' : '') + (free && left > 0 ? ' isfree' : ''), 'data-offer': o.id, style: `--rc:${RARITY_COL[r]};--i:${i}`, onclick: (ev) => press(o, ev, node) },
        h('div', { class: 'sc-art' }, h('i', { class: 'sc-glow' }), itemIcon(icon, 'lg', tint), h('i', { class: 'sc-n' }, `×${o.give.count}`), stars(r)),
        h('b', { class: 'sc-name' }, shortName(o.give)),
        price);
      return node;
    });
    // Quà miễn phí hôm nay: thẻ lớn nổi bật ở đầu màn
    const freeO = offers.find((o) => o.price.cur === 'free');
    let hero = null;
    if (freeO) {
      const left = leftStock(p, freeO), [icon, tint] = iconOf(freeO.give), got = left <= 0;
      const hnode = h('button', { class: 'shop-hero' + (got ? ' got' : ''), id: 'shop-hero', 'data-offer': freeO.id, style: `--rc:${RARITY_COL[rarityOf(freeO.give)]}`, ...(got ? { disabled: 'true' } : {}), onclick: (ev) => press(freeO, ev, hnode) },
        h('i', { class: 'sh-rays' }),
        h('div', { class: 'sh-art' }, itemIcon(icon, 'lg', tint), h('i', { class: 'sc-n' }, `×${freeO.give.count}`)),
        h('div', { class: 'sh-info' }, h('small', {}, t('shop.todayGift')), h('b', {}, shortName(freeO.give)), h('span', { class: 'sh-cta' }, got ? t('shop.claimed') : t('shop.claim'))));
      hero = hnode;
    }
    music('shop');
    screen(
      h('h2', { class: 'shop-title' }, t('shop.daily')),
      h('div', { class: 'shop-wallet' }, h('div', { class: 'res', id: 'shop-gold' }, itemIcon('gold', 'sm'), h('b', {}, fmt(p.inventory.gold))), h('div', { class: 'res', id: 'shop-spirit' }, itemIcon('spirit', 'sm'), h('b', {}, fmt(p.inventory.spirit))), h('button', { class: 'shop-bag', id: 'shop-items', 'aria-label': t('hub.items'), onclick: () => app.showItems() }, itemIcon('offering', 'sm'), h('span', {}, t('hub.items')))),
      msg ? h('div', { class: 'notice', id: 'shop-msg' }, msg) : null,
      hero,
      tabs,
      h('div', { class: 'shop-grid' }, cells),
      h('div', { class: 'muted shop-note' }, t('shop.resetNote')),
      h('button', { id: 'back', class: 'shop-back-hid', onclick: () => { if (app.guideStep() === 'claim') app.guideSet('battle'); showHub(); } }, t('back')),
    );
    if (msg) { clearTimeout(toastT); toastT = setTimeout(() => document.getElementById('shop-msg')?.remove(), 2200); }
    msg = null;
    if (app.guideStep() === 'claim') {
      const freeO = offers.find((o) => o.price.cur === 'free' && leftStock(p, o) > 0);
      if (freeO && tab !== 'all') { tab = 'all'; showShop(); return; }
      if (freeO && sel !== freeO.id) { sel = freeO.id; showShop(); return; }
      const free = document.querySelector('#screen .shop-hero:not(.got)');
      app.guidePoint(free || '#back-top', free ? 'guide.claim' : 'guide.back');
    }
  }

  return { showShop };
}
