// Màn hình: items (tách khỏi main.js). Trạng thái dùng chung đi qua `app`.
import { h, btn } from './dom.js';
import { itemIcon } from './icons.js';
import { sellFodder } from '../core/upgrade.js';
import { redeemFragments, redeemGeneric, useSoulTickets, heroFragCost } from '../core/fragments.js';
import { KEYS } from '../core/effects.js';
import { COLORS } from '../ui/hero-ui.js';

export function install(app) {
  const { el, CUR_COL, ctx, fodderName, offeringName, save, screen, showHub, t } = app;

  // Hòm đồ: lưới ô icon (độ hiếm quyết định màu nền), chạm một ô để xem chi tiết.
  const RARITY_COL = ['#6b6f7d', '#6b6f7d', '#4fae7b', '#4f8fe0', '#a066e8', '#e0a64a'];

  let itemsTab = 'all';

  let itemsSel = null;
  let itemsMsg = null;

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
    add({ key: 'soul', tab: 'fodder', name: t('res.soulTicket'), count: inv.soulTickets, rarity: 3, icon: 'soul', desc: t('items.desc.soul'), soul: true });
    for (const s of [3, 4, 5]) add({ key: `gen${s}`, tab: 'frag', name: t('res.generic', { s }), count: inv.generic[s], rarity: s, icon: 'generic', desc: t('items.desc.generic', { c: ctx.config.fragments.genericCost[s], s }), generic: s });
    for (const id of Object.keys(inv.fragments).sort()) add({ key: `frag_${id}`, tab: 'frag', name: t('res.fragment', { name: t(`char.${id}`) }), count: inv.fragments[id], rarity: ctx.characters[id].rarity, icon: 'fragment', tint: COLORS[ctx.characters[id].element], desc: t('items.desc.fragment', { c: heroFragCost(ctx, id), name: t(`char.${id}`) }), frag: id });
    return list;
  }

  function sell(k, n) {
    const r = sellFodder(ctx, app.progress, k, n);
    if (r.ok) { app.progress = r.progress; save(); showItems(); }
  }

  const seed = () => (Math.random() * 4294967296) >>> 0;
  function afterAction(r, msg) {
    if (r.ok) {
      app.progress = r.progress;
      save();
      itemsMsg = msg;
      itemsSel = null;
    } else itemsMsg = t(`err.${r.reason}`);
    showItems();
  }
  function actionsFor(sel) {
    const inv = app.progress.inventory;
    if (sel.fodder) return h('div', { class: 'row' }, btn(`${t('fodder.sell')} (${ctx.fodder[sel.fodder].sell} ${t('res.gold')})`, () => sell(sel.fodder, 1)), btn(t('fodder.sellAll'), () => sell(sel.fodder, 999)));
    if (sel.soul) {
      const use = (n) => {
        const r = useSoulTickets(ctx, app.progress, n, seed());
        afterAction(r, r.ok ? t('soul.got', { list: [...new Set(r.results)].sort().map((k) => `${fodderName(k)} ×${r.results.filter((x) => x === k).length}`).join(', ') }) : null);
      };
      return h('div', { class: 'row' }, btn(t('soul.use1'), () => use(1), '', { id: 'soul-1' }), btn(t('soul.useAll'), () => use(inv.soulTickets), '', { id: 'soul-all' }));
    }
    if (sel.frag) {
      const c = heroFragCost(ctx, sel.frag);
      return h('div', { class: 'row' }, btn(t('frag.summon', { name: t(`char.${sel.frag}`), n: sel.count, c }), () => afterAction(redeemFragments(ctx, app.progress, sel.frag), t('frag.got', { name: t(`char.${sel.frag}`) })), sel.count >= c ? 'primary' : '', { id: 'frag-go', ...(sel.count >= c ? {} : { disabled: '' }) }));
    }
    if (sel.generic) {
      const c = ctx.config.fragments.genericCost[sel.generic];
      const r0 = () => redeemGeneric(ctx, app.progress, sel.generic, seed());
      return h('div', { class: 'row' }, btn(t('frag.summonRandom', { s: sel.generic, n: sel.count, c }), () => { const r = r0(); afterAction(r, r.ok ? t('frag.got', { name: t(`char.${r.id}`) }) : null); }, sel.count >= c ? 'primary' : '', { id: 'gen-go', ...(sel.count >= c ? {} : { disabled: '' }) }));
    }
    return null;
  }

  function showItems() {
    const msgNow = itemsMsg;
    setTimeout(() => { if (itemsMsg === msgNow) itemsMsg = null; }, 0);
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
          actionsFor(sel))
      : h('div', { class: 'muted', id: 'item-detail' }, t('items.pick'));
    screen(
      h('h2', {}, t('hub.items')),
      h('div', { class: 'row' }, h('div', { class: 'res', id: 'inv-gold' }, itemIcon('gold', 'sm'), t('res.gold'), h('b', {}, fmt(inv.gold))), h('div', { class: 'res', id: 'inv-spirit' }, itemIcon('spirit', 'sm'), t('res.spirit'), h('b', {}, fmt(inv.spirit)))),
      h('div', { class: 'row tabs' }, ['all', 'elixir', 'mats', 'frag', 'fodder'].map((k) => btn(t(k === 'all' ? 'items.all' : `items.tab.${k}`), () => { itemsTab = k; itemsSel = null; showItems(); }, k === itemsTab ? 'primary' : '', { 'data-tab': k }))),
      itemsMsg ? h('div', { class: 'notice', id: 'items-msg' }, itemsMsg) : null,
      detail,
      shown.length ? h('div', { class: 'item-grid', id: 'item-grid' }, shown.map(tile)) : h('div', { class: 'muted' }, t('items.empty')),
      btn(t('back'), showHub, '', { id: 'back' }),
    );
  }

  // Hướng dẫn chơi: các mục gập mở được (mục đầu mở sẵn), rồi bảng từ khóa hiệu ứng.
  const HELP = [["fight", 7], ["heroes", 6], ["tower", 6], ["grow", 5], ["summon", 4], ["daily", 3], ["tips", 3]];
  function showGlossary() {
    screen(
      h('h2', {}, t('hub.help')),
      HELP.map(([id, n], k) => h('details', { class: 'card help-sec', id: `help-${id}`, ...(k === 0 ? { open: '' } : {}) },
        h('summary', {}, t(`help.${id}.title`)),
        Array.from({ length: n }, (_, i) => h('p', { class: 'muted' }, t(`help.${id}.${i + 1}`))))),
      h('h3', {}, t('hub.glossary')),
      KEYS.map((k) => h('div', { class: 'card kw' }, h('img', { class: 'kw-ico', src: `assets/ui/fx/${k}.webp`, alt: '', width: 40, height: 40 }), h('div', { class: 'kw-tx' }, h('b', {}, t(`effect.${k}.name`)), h('div', { class: 'muted' }, t(`effect.${k}.desc`))))),
      btn(t('back'), showHub, '', { id: 'back' }),
    );
  }

  return { inventoryEntries, showGlossary, showItems };
}
