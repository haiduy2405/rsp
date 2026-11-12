// Màn hình: summon (tách khỏi main.js). Trạng thái dùng chung đi qua `app`.
import { $, h, btn } from './dom.js';
import { itemIcon } from './icons.js';
import { getImg } from './assets.js';
import { playFireworks } from './fireworks.js';
import { summon, buyTickets, redeemCharacter, effectiveRates } from '../core/summon.js';

export function install(app) {
  const { chip, portrait, audio, ctx, pct, save, screen, showHub, t } = app;

  // ---- Triệu hồi, onboarding, nhật ký, cài đặt
  const dayKey = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

  const fmtPct = (v) => (v * 100).toFixed(2).replace(/\.?0+$/, '');

  const rarityCls = (r) => `rar${r}`;

  const confirmBox = (text, yes, no, yesLabel = t('summon.yes')) =>
    h('div', { class: 'card', id: 'confirm' }, h('p', {}, text), h('div', { class: 'row' }, btn(yesLabel, yes, 'primary', { id: 'confirm-yes' }), btn(t('summon.no'), no, '', { id: 'confirm-no' })));

  function showSummon(bannerId, pending = null, msg = null) {
    const cfg = ctx.config.summon;
    const banner = ctx.banners[bannerId];
    const sm = app.progress.summon;
    const eff = effectiveRates(ctx.config);
    const freeAvail = sm.freeDay !== dayKey();
    const rateUp = banner.culture
      ? t('summon.rateUp', { culture: t(`culture.${banner.culture}`), pct: Math.round(banner.rateUp * 100) })
      : t('summon.noRateUp');
    const doSummon = (count, free) => {
      const r = summon(ctx, app.progress, { bannerId, count, free, dayKey: dayKey(), seed: (Math.random() * 4294967296) >>> 0 });
      if (!r.ok) return showSummon(bannerId, null, `err.${r.reason}`);
      app.progress = r.progress;
      save();
      audio.sfx('summon');
      showSummonResult(bannerId, r.results);
    };
    const ask = (count) => {
      const cost = cfg.ticketsPerPull * count;
      showSummon(bannerId, { count, cost });
    };
    // Tướng đại diện của banner: văn hóa của banner, hoặc mỗi văn hóa một tướng cao sao nhất cho banner thường.
    const pool = ctx.characterList.filter((c) => !c.reserve && (!banner.culture || c.culture === banner.culture));
    const seenCul = new Set();
    const stars = pool.slice().sort((x, y) => y.rarity - x.rarity || (x.id < y.id ? -1 : 1)).filter((c) => (banner.culture ? true : !seenCul.has(c.culture) && seenCul.add(c.culture))).slice(0, 3);
    const fan = [stars[1], stars[0], stars[2]].filter(Boolean);
    const fanCard = (c, i) => {
      const art = getImg(`card:${c.id}`);
      return h('div', { class: `fan-card r${c.rarity} pos${fan.length === 3 ? i : i + 1}` }, art ? h('img', { src: art.src, alt: '', draggable: 'false' }) : portrait(c.id, 96), h('b', {}, '★'.repeat(c.rarity)));
    };
    const pityPct = Math.min(100, (sm.pity5 / cfg.pity5) * 100);
    screen(
      h('h2', {}, t('summon.title')),
      h('div', { class: 'sm-wallet' },
        h('div', { class: 'sm-cur', id: 'tickets' }, itemIcon('ticket', 'sm'), h('span', {}, t('summon.tickets', { n: app.progress.inventory.tickets }))),
        h('div', { class: 'sm-cur', id: 'spirit' }, itemIcon('spirit', 'sm'), h('span', {}, t('summon.spirit', { n: app.progress.inventory.spirit })))),
      msg ? h('div', { class: 'notice' }, t(msg)) : null,
      h('div', { class: 'banner-tabs' }, ctx.bannerList.map((b) => btn(t(`banner.${b.id}.name`), () => showSummon(b.id), b.id === bannerId ? 'primary' : '', { 'data-banner': b.id }))),
      h('div', { class: 'sm-stage' },
        h('div', { class: 'sm-circle', 'aria-hidden': 'true' }),
        h('div', { class: 'sm-fan' }, fan.map(fanCard)),
        h('div', { class: 'sm-ribbon' }, t(`banner.${bannerId}.name`)),
        h('div', { class: 'sm-desc' }, t(`banner.${bannerId}.desc`)),
        h('div', { class: 'rateup' }, rateUp)),
      // Tiến độ bảo đảm 5★ một thanh; tỉ lệ đầy đủ nằm ngay dưới, mở một chạm
      h('div', { class: 'pity' }, h('div', { class: 'pity-row' }, h('div', { class: 'pity-bar' }, h('i', { style: `width:${pityPct}%` })), h('span', { class: 'pity-end' }, '5★')), h('small', {}, t('summon.pity5', { max: cfg.pity5, n: sm.pity5 }))),
      h('div', { class: 'row packs' }, cfg.ticketPacks.map((pk, i) => h('button', { class: 'pack', id: `buy-${i}`, onclick: () => {
        const r = buyTickets(ctx, app.progress, i);
        if (r.ok) { app.progress = r.progress; save(); audio.sfx('reveal'); showSummon(bannerId, null, null); } else showSummon(bannerId, null, `err.${r.reason}`);
      } }, itemIcon('ticket', 'sm'), h('span', {}, t('summon.buy', { t: pk.tickets, s: pk.spirit }))))),
      h(
        'details',
        { class: 'card', id: 'rates' },
        h('summary', {}, t('summon.rates')),
        h('div', {}, t('summon.baseRates', { r5: fmtPct(cfg.rates['5']), r4: fmtPct(cfg.rates['4']), r3: fmtPct(cfg.rates['3']) })),
        h('div', {}, t('summon.effRates', { r5: fmtPct(eff[5]), r4: fmtPct(eff[4]), r3: fmtPct(eff[3]) })),
        h('div', { class: 'muted' }, t('summon.pity4', { max: cfg.guarantee4Every, n: sm.pity4 })),
      ),
      h('div', { class: 'row' }, btn(t('summon.history'), showHistory, '', { id: 'b-history' }), btn(t('summon.redeem'), () => showRedeem(), '', { id: 'b-redeem' })),
      btn(t('back'), showHub, '', { id: 'back' }),
      pending
        ? confirmBox(t('summon.confirm', { cost: pending.cost, count: pending.count, banner: t(`banner.${bannerId}.name`), left: app.progress.inventory.tickets - pending.cost }), () => doSummon(pending.count, false), () => showSummon(bannerId))
        : h(
            'div',
            { class: 'row pulls' },
            freeAvail ? btn(t('summon.free'), () => doSummon(1, true), 'primary free', { id: 'pull-free' }) : h('div', { class: 'muted' }, t('summon.freeUsed')),
            h('button', { id: 'pull-1', onclick: () => ask(1) }, itemIcon('ticket', 'sm'), h('span', {}, t('summon.x1', { cost: cfg.ticketsPerPull }))),
            h('button', { class: 'primary', id: 'pull-10', onclick: () => ask(cfg.multiCount) }, itemIcon('ticket', 'sm'), h('span', {}, t('summon.x10', { cost: cfg.ticketsPerPull * cfg.multiCount }))),
          ),
    );
  }

  function showSummonResult(bannerId, results, onDone = null) {
    const shown = new Set();
    const single = results.length === 1;
    const cards = results.map((r, i) =>
      h(
        'div',
        { class: 'card btn sumcard back wait', 'data-i': i, onclick: (e) => reveal(i, e.currentTarget) },
        h('div', { class: 'sigil' }, '✦'),
        h('div', { class: 'muted' }, t('summon.tapReveal')),
      ),
    );
    const paint = (i, el) => {
      const r = results[i];
      shown.add(i);
      audio.sfx(r.rarity >= 4 ? 'rare' : 'reveal');
      el.className = `card sumcard flip ${rarityCls(r.rarity)}`;
      el.style.setProperty('--d', `${(i % 10) * 40}ms`);
      if (r.rarity >= 4) {
        const f = $('flash');
        f.classList.remove('go');
        void f.offsetWidth;
        f.classList.add('go');
        audio.vibrate(r.rarity === 5 ? [60, 40, 90] : 40);
      }
      el.replaceChildren(
        ...[
          portrait(r.id, single ? 90 : 44),
          h('h3', {}, t(`char.${r.id}`)),
          h('small', {}, '★'.repeat(r.rarity)),
          h('small', {}, r.isNew ? t('summon.new') : single ? t('summon.dup', { n: r.generic, s: r.rarity }) : `+${r.generic} ✦`),
        ].filter(Boolean),
      );
    };
    const reveal = (i, el) => {
      if (!shown.has(i)) paint(i, el);
    };
    const wrap = h('div', { class: `sm-res anim${single ? ' one' : ''}` },
      h('h2', {}, t('summon.title')),
      h('div', { class: 'sumgrid' }, cards),
      h('div', { class: 'row' }, btn(t('summon.reveal'), () => cards.forEach((el, i) => reveal(i, el)), '', { id: 'reveal-all' }), btn(t('summon.done'), () => (onDone ? onDone() : showSummon(bannerId)), 'primary', { id: 'sum-done' })),
    );
    screen(wrap);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fw = playFireworks(wrap, results.map((r, i) => ({ rarity: r.rarity, el: cards[i] })), {
      big: single,
      reduced,
      sfx: (n) => audio.sfx(n),
      onPop: (i) => cards[i].classList.remove('wait'),
      onDone: () => wrap.classList.remove('anim'),
    });
    wrap.addEventListener('pointerdown', () => { if (wrap.classList.contains('anim')) fw.skip(); });
  }

  function showHistory() {
    const hist = app.progress.summon.history.slice().reverse();
    screen(
      h('h2', {}, t('summon.history')),
      hist.length ? hist.map((x) => h('div', { class: 'card' }, t('summon.historyRow', { n: x.n, rarity: x.rarity, name: t(`char.${x.id}`), banner: t(`banner.${x.banner}.name`) }))) : h('div', { class: 'muted' }, t('summon.historyEmpty')),
      btn(t('back'), () => showSummon('standard'), '', { id: 'back' }),
    );
  }

  function showRedeem(pick = null, msg = null) {
    const cost = ctx.config.summon.redeemShards;
    const missing = ctx.characterList.filter((c) => !c.reserve && !app.progress.characters[c.id]).sort((a, b) => b.rarity - a.rarity);
    screen(
      h('h2', {}, t('summon.redeem')),
      h('p', { class: 'muted' }, t('summon.redeemInfo', { cost, n: app.progress.inventory.shards })),
      msg ? h('div', { class: 'notice' }, msg) : null,
      pick
        ? confirmBox(t('summon.redeemConfirm', { cost, name: t(`char.${pick}`) }), () => {
            const r = redeemCharacter(ctx, app.progress, pick);
            if (!r.ok) return showRedeem(null, t(`err.${r.reason === 'not_enough_shards' ? 'not_enough_shards' : r.reason}`));
            app.progress = r.progress;
            save();
            showRedeem(null, t('summon.redeemDone', { name: t(`char.${pick}`) }));
          }, () => showRedeem())
        : null,
      missing.length ? missing.map((c) => h('div', { class: 'card btn', 'data-char': c.id, onclick: () => showRedeem(c.id) }, h('h3', {}, t(`char.${c.id}`), ' ', chip(c.id), ' ', h('small', {}, '★'.repeat(c.rarity))))) : h('div', { class: 'muted' }, t('summon.redeemNone')),
      btn(t('back'), () => showSummon('standard'), '', { id: 'back' }),
    );
  }

  return { confirmBox, dayKey, showHistory, showRedeem, showSummon, showSummonResult };
}
