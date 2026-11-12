// Màn hình: items (tách khỏi main.js). Trạng thái dùng chung đi qua `app`.
import { h, btn } from './dom.js';
import { itemIcon } from './icons.js';
import { sellFodder } from '../core/upgrade.js';
import { KEYS } from '../core/effects.js';
import { COLORS } from '../ui/hero-ui.js';

export function install(app) {
  const { el, CUR_COL, ctx, fodderName, offeringName, save, screen, showHub, t } = app;

  // Hòm đồ: lưới ô icon (độ hiếm quyết định màu nền), chạm một ô để xem chi tiết.
  const RARITY_COL = ['#6b6f7d', '#6b6f7d', '#4fae7b', '#4f8fe0', '#a066e8', '#e0a64a'];

  let itemsTab = 'all';

  let itemsSel = null;

  function inventoryEntries() {
    const inv = app.progress.inventory;
    const list = [];
    const add = (e) => e.count > 0 && list.push(e);
    add({ key: 'ticket', tab: 'mats', name: t('res.ticket'), count: inv.tickets, rarity: 4, icon: 'ticket', desc: t('items.desc.ticket') });
    for (const tier of [1, 2, 3]) add({ key: `elixir${tier}`, tab: 'elixir', name: t(`res.elixir.${tier}`), count: inv.elixir[tier], rarity: tier + 1, icon: `elixir${tier}`, desc: t('elixir.desc', { n: ctx.config.elixir[tier].exp }) });
    add({ key: 'shard', tab: 'mats', name: t('res.shard'), count: inv.shards, rarity: 4, icon: 'shard', desc: t('items.desc.shard') });
    for (let e = 0; e < 6; e++) {
      add({ key: `stoneN${e}`, tab: 'mats', name: `${t('res.stone')} ${t('stone.normal')} · ${el(e)}`, count: inv.stones[e].normal, rarity: 3, icon: 'stoneN', tint: COLORS[e], desc: t('items.desc.stone') });
      add({ key: `stoneR${e}`, tab: 'mats', name: `${t('res.stone')} ${t('stone.rare')} · ${el(e)}`, count: inv.stones[e].rare, rarity: 4, icon: 'stoneR', tint: COLORS[e], desc: t('items.desc.stone') });
    }
    for (const k of Object.keys(inv.offerings).sort()) add({ key: `off_${k}`, tab: 'mats', name: offeringName(k), count: inv.offerings[k], rarity: Number(k.split('_')[1]) + 1, icon: 'offering', desc: t('items.desc.offering') });
    for (const k of Object.keys(inv.fodder).sort()) add({ key: `fod_${k}`, tab: 'fodder', name: fodderName(k), count: inv.fodder[k], rarity: ctx.fodder[k].star + 1, icon: 'fodder', desc: t('items.desc.fodder'), fodder: k });
    return list;
  }

  function showItems() {
    const inv = app.progress.inventory;
    const fmt = (n) => new Intl.NumberFormat(app.lang).format(n);
    const all = inventoryEntries();
    const shown = itemsTab === 'all' ? all : all.filter((e) => e.tab === itemsTab);
    const sel = shown.find((e) => e.key === itemsSel) || null;
    const tile = (e) => {
      const b = h('button', { class: `slot${sel?.key === e.key ? ' sel' : ''}`, 'data-item': e.key, style: `--rc:${RARITY_COL[e.rarity]}`, 'aria-label': e.name, onclick: () => { itemsSel = e.key; showItems(); } }, itemIcon(e.icon, 'lg', e.tint), h('b', {}, fmt(e.count)));
      return b;
    };
    const detail = sel
      ? h('div', { class: 'card item-detail', id: 'item-detail', style: `--rc:${RARITY_COL[sel.rarity]}` }, h('div', { class: 'row' }, itemIcon(sel.icon, 'lg', sel.tint), h('div', {}, h('b', {}, sel.name), h('div', { class: 'muted' }, t('items.owned', { n: fmt(sel.count) })))), h('div', { class: 'muted' }, sel.desc),
          sel.fodder ? h('div', { class: 'row' }, btn(`${t('fodder.sell')} (${ctx.fodder[sel.fodder].sell} ${t('res.gold')})`, () => sell(sel.fodder, 1)), btn(t('fodder.sellAll'), () => sell(sel.fodder, 999))) : null)
      : h('div', { class: 'muted', id: 'item-detail' }, t('items.pick'));
    function sell(k, n) {
      const r = sellFodder(ctx, app.progress, k, n);
      if (r.ok) { app.progress = r.progress; save(); showItems(); }
    }
    screen(
      h('h2', {}, t('hub.items')),
      h('div', { class: 'row' }, h('div', { class: 'res', id: 'inv-gold' }, h('i', { class: 'dot', style: `background:${CUR_COL.gold}` }), t('res.gold'), h('b', {}, fmt(inv.gold))), h('div', { class: 'res', id: 'inv-spirit' }, h('i', { class: 'dot', style: `background:${CUR_COL.spirit}` }), t('res.spirit'), h('b', {}, fmt(inv.spirit)))),
      h('div', { class: 'row tabs' }, ['all', 'elixir', 'mats', 'fodder'].map((k) => btn(t(k === 'all' ? 'items.all' : `items.tab.${k}`), () => { itemsTab = k; itemsSel = null; showItems(); }, k === itemsTab ? 'primary' : '', { 'data-tab': k }))),
      detail,
      shown.length ? h('div', { class: 'item-grid', id: 'item-grid' }, shown.map(tile)) : h('div', { class: 'muted' }, t('items.empty')),
      btn(t('back'), showHub, '', { id: 'back' }),
    );
  }

  function showGlossary() {
    screen(
      h('h2', {}, t('hub.help')),
      h('div', { class: 'card' }, h('b', {}, t('help.how')), [1, 2, 3, 4, 5].map((n) => h('p', { class: 'muted' }, t(`help.t${n}`), ' '))),
      h('h3', {}, t('hub.glossary')),
      KEYS.map((k) => h('div', { class: 'card' }, h('b', {}, t(`effect.${k}.name`), ' ', h('small', {}, t(`effect.${k}.short`))), h('div', { class: 'muted' }, t(`effect.${k}.desc`)))),
      btn(t('back'), showHub, '', { id: 'back' }),
    );
  }

  return { inventoryEntries, showGlossary, showItems };
}
