// Màn hình: summon (tách khỏi main.js). Trạng thái dùng chung đi qua `app`.
import { $, h, btn, openModal } from './dom.js';
import { itemIcon } from './icons.js';
import { getImg } from './assets.js';
import { COLORS } from './hero-ui.js';
import { createRitual, ritualSeen } from './portal.js';
import { summon, buyTickets, redeemCharacter, effectiveRates } from '../core/summon.js';

export function install(app) {
  const { chip, portrait, audio, ctx, music, pct, save, screen, showHub, t } = app;

  // ---- Triệu hồi, onboarding, nhật ký, cài đặt
  const dayKey = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);

  const fmtPct = (v) => (v * 100).toFixed(2).replace(/\.?0+$/, '');

  const rarityCls = (r) => `rar${r}`;

  // Hộp xác nhận nổi (không vẽ lại cả màn): trả về null, mở sau khi màn gọi đã dựng xong.
  const confirmBox = (text, yes, no, yesLabel = t('summon.yes')) => {
    let close = () => {};
    const card = h('div', { class: 'card', id: 'confirm' }, h('p', {}, text), h('div', { class: 'row' }, btn(yesLabel, (e) => { close(); yes(e); }, 'primary', { id: 'confirm-yes' }), btn(t('summon.no'), () => { close(); no(); }, '', { id: 'confirm-no' })));
    queueMicrotask(() => { close = openModal(card, { dismiss: false }); });
    return null;
  };

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
      app.trackQuest('summon', count);
      save();
      audio.sfx('summon');
      showSummonResult(bannerId, r.results);
    };
    // Giá quy đổi bằng Linh Thạch: gói vé cùng số lượng trong config (1 vé = 100, 10 vé = 900). Thiếu vé thì trả bằng Linh Thạch.
    const spiritFor = (count) => cfg.ticketPacks.find((pk) => pk.tickets === count);
    const bn = t(`banner.${bannerId}.name`);
    const ask = (count, free = false) => {
      if (free) return confirmBox(t('summon.confirmFree', { banner: bn }), () => doSummon(1, true), () => {});
      const cost = cfg.ticketsPerPull * count;
      const need = app.progress.inventory.tickets < cost ? spiritFor(count) : null;
      if (need && app.progress.inventory.spirit < need.spirit) return showSummon(bannerId, null, 'err.not_enough_tickets');
      const text = need ? t('summon.confirmSpirit', { spirit: need.spirit, count, banner: bn }) : t('summon.confirm', { cost, count, banner: bn, left: app.progress.inventory.tickets - cost });
      confirmBox(text, () => {
        if (need) {
          const b = buyTickets(ctx, app.progress, cfg.ticketPacks.indexOf(need));
          if (!b.ok) return showSummon(bannerId, null, `err.${b.reason}`);
          app.progress = b.progress;
          save();
        }
        doSummon(count, false);
      }, () => {});
    };
    // Tướng đại diện của banner: văn hóa của banner, hoặc mỗi văn hóa một tướng cao sao nhất cho banner thường.
    const pool = ctx.characterList.filter((c) => !c.reserve && (!banner.culture || c.culture === banner.culture));
    const seenCul = new Set();
    const stars = pool.slice().sort((x, y) => y.rarity - x.rarity || (x.id < y.id ? -1 : 1)).filter((c) => (banner.culture ? true : !seenCul.has(c.culture) && seenCul.add(c.culture))).slice(0, 3);
    const fan = [stars[1], stars[0], stars[2]].filter(Boolean);
    const fanCard = (c, i) => {
      const art = getImg(`card:${c.id}`);
      return h('div', { class: `fan-card r${c.rarity} pos${fan.length === 3 ? i : i + 1}`, style: `--el:${COLORS[c.element]}` }, art ? h('img', { src: art.src, alt: '', draggable: 'false' }) : portrait(c.id, 96), h('b', {}, '★'.repeat(c.rarity)));
    };
    // Giá: số vé, hoặc số Linh Thạch nếu thiếu vé (hai biểu tượng, không chữ).
    const costLine = (tickets, spirit) => h('span', { class: 'pl-cost' }, h('span', { class: 'pl-c' }, itemIcon('ticket', 'sm'), String(tickets)), h('span', { class: 'pl-c' }, itemIcon('spirit', 'sm'), String(spirit)));
    const pityPct = Math.min(100, (sm.pity5 / cfg.pity5) * 100);
    music('summon');
    screen(
      h('h2', { class: 'zones-title' }, t('summon.title')),
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
        if (app.progress.inventory.spirit < pk.spirit) return showSummon(bannerId, null, 'err.not_enough_spirit');
        confirmBox(t('summon.confirmBuy', { tickets: pk.tickets, spirit: pk.spirit }), (ev) => {
          const r = buyTickets(ctx, app.progress, i);
          if (r.ok) { app.progress = r.progress; save(); app.rewardPop([{ k: 'ticket', n: pk.tickets }], ev); showSummon(bannerId, null, null); } else showSummon(bannerId, null, `err.${r.reason}`);
        }, () => {}, t('summon.buyYes'));
      } }, itemIcon('ticket', 'sm'), h('b', {}, `×${pk.tickets}`), h('span', { class: 'pk-sp' }, '=', itemIcon('spirit', 'sm'), String(pk.spirit))))),
      h(
        'details',
        { class: 'card', id: 'rates' },
        h('summary', {}, t('summon.rates')),
        h('div', {}, t('summon.baseRates', { r5: fmtPct(cfg.rates['5']), r4: fmtPct(cfg.rates['4']), r3: fmtPct(cfg.rates['3']) })),
        h('div', {}, t('summon.effRates', { r5: fmtPct(eff[5]), r4: fmtPct(eff[4]), r3: fmtPct(eff[3]) })),
        h('div', { class: 'muted' }, t('summon.pity4', { max: cfg.guarantee4Every, n: sm.pity4 })),
      ),
      h('div', { class: 'row sm-links' }, btn(t('summon.history'), showHistory, '', { id: 'b-history' }), btn(t('summon.redeem'), () => showRedeem(), '', { id: 'b-redeem' })),
      btn(t('back'), showHub, '', { id: 'back', class: 'zones-back-hid' }),
      h(
            'div',
            { class: 'row pulls' },
            freeAvail ? (() => { const b = btn(t('summon.free'), () => ask(1, true), 'primary free', { id: 'pull-free' }); b.append(h('i', { class: 'red-dot', 'aria-hidden': 'true' })); return b; })() : h('div', { class: 'muted' }, t('summon.freeUsed')),
            h('button', { id: 'pull-1', class: 'pull', onclick: () => ask(1) }, h('b', {}, t('summon.x1')), costLine(cfg.ticketsPerPull, spiritFor(1)?.spirit ?? 0)),
            h('button', { class: 'primary pull', id: 'pull-10', onclick: () => ask(cfg.multiCount) }, h('b', {}, t('summon.x10')), costLine(cfg.ticketsPerPull * cfg.multiCount, spiritFor(cfg.multiCount)?.spirit ?? 0)),
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
    const paint = (i, el, quiet = false) => {
      const r = results[i];
      shown.add(i);
      if (!quiet) audio.sfx(r.rarity >= 4 ? 'rare' : 'reveal');
      el.className = `card sumcard flip ${rarityCls(r.rarity)}`;
      el.style.setProperty('--d', `${(i % 10) * 40}ms`);
      if (r.rarity >= 4 && !quiet) {
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
    const reveal = (i, el, quiet = false) => {
      if (!shown.has(i)) paint(i, el, quiet);
    };
    const wrap = h('div', { class: `sm-res anim${single ? ' one' : ''}` },
      h('h2', {}, t('summon.title')),
      h('div', { class: 'sumgrid' }, cards),
      h('div', { class: 'row' }, btn(t('summon.reveal'), () => cards.forEach((el, i) => reveal(i, el)), '', { id: 'reveal-all' }), btn(t('summon.done'), () => (onDone ? onDone() : showSummon(bannerId)), 'primary', { id: 'sum-done' })),
    );
    music('summon');
    screen(wrap);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Nghi thức: chạm pháp trận để kích hoạt; lần sau có nút Bỏ qua (5★ vẫn chiếu đủ nhịp).
    const rit = createRitual(wrap, results.map((r, i) => ({ rarity: r.rarity, el: cards[i] })), {
      big: single, reduced, seen: ritualSeen(),
      tip: results.length > 1 ? t('summon.ritual10', { n: results.length }) : t('summon.ritual'), skipLabel: t('summon.skip'),
      sfx: (n) => audio.sfx(n), vibrate: (v) => audio.vibrate?.(v),
      onPop: (i) => { cards[i].classList.remove('wait'); reveal(i, cards[i], true); }, // cổng nhả thẻ ra là lật luôn, không bắt chạm từng thẻ
      onDone: () => wrap.classList.remove('anim'),
    });
    void rit;
  }

  function showHistory() {
    const hist = app.progress.summon.history.slice().reverse();
    music('summon');
    screen(
      h('h2', {}, t('summon.history')),
      hist.length ? hist.map((x) => h('div', { class: 'card' }, t('summon.historyRow', { n: x.n, rarity: x.rarity, name: t(`char.${x.id}`), banner: t(`banner.${x.banner}.name`) }))) : h('div', { class: 'muted' }, t('summon.historyEmpty')),
      btn(t('back'), () => showSummon('standard'), '', { id: 'back' }),
    );
  }

  function showRedeem(pick = null, msg = null) {
    const cost = ctx.config.summon.redeemShards;
    const missing = ctx.characterList.filter((c) => !c.reserve && !app.progress.characters[c.id]).sort((a, b) => b.rarity - a.rarity);
    music('summon');
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
