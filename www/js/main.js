import { buildCtx } from './core/ctx.js';
import { createRun, runStep, newRunRecord, debugWinBattle } from './core/run.js';
import { applyRunResult } from './core/progress.js';
import { createStorage, browserAdapter } from './save/storage.js';
import { grantCharacter, levelCost, levelUp, awakenCost, awaken, setTeam, teamRoster } from './core/upgrade.js';
import { statsFor, skillCooldown } from './core/stats.js';
import { KEYS } from './core/effects.js';
import { summon, redeemCharacter, effectiveRates } from './core/summon.js';
import { finishOnboarding, completeTutorial, storyUnlocked } from './core/onboarding.js';
import { newProgress } from './core/progress.js';
import { createT, detectLang } from './i18n/index.js';
import { startGame } from './ui/game.js';
import { preloadAssets, getImg } from './ui/assets.js';
import { createAudio } from './ui/audio.js';

const $ = (id) => document.getElementById(id);
const load = (f) => fetch(`js/${f}`).then((r) => r.json());
const [config, characters, monsters, zones, events, duos, banners, story, audioCfg, vi, en] = await Promise.all([
  load('data/config.json'),
  load('data/characters.json'),
  load('data/monsters.json'),
  load('data/zones.json'),
  load('data/events.json'),
  load('data/duos.json'),
  load('data/banners.json'),
  load('data/story.json'),
  load('data/audio.json'),
  load('i18n/vi.json'),
  load('i18n/en.json'),
]);
const ctx = buildCtx({ config, characters, monsters, zones, events, duos, banners, story });
const dicts = { vi, en };
const storage = createStorage(browserAdapter(), ctx);
const DEBUG = new URLSearchParams(location.search).has('debug');

let lang = (() => {
  try {
    return localStorage.getItem('rsp.lang') || detectLang(navigator.language);
  } catch {
    return detectLang(navigator.language);
  }
})();
let t = createT(dicts[lang], en);
const loaded = storage.load();
let progress = loaded.progress;
let notice = loaded.recovered ? 'hub.recovered' : null;
const audio = createAudio(audioCfg, {
  get volume() { return progress.settings.volume; },
  get music() { return progress.settings.music; },
  get sfx() { return progress.settings.sfx; },
  get haptic() { return progress.settings.haptic; },
});
document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
document.addEventListener('click', (e) => { if (e.target.closest?.('#screen button')) audio.sfx('ui'); }, { capture: true });
let run = null;
let record = null;
let game = null;
let seedText = '';

// ---- tiện ích DOM
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k);
  return el;
}
const btn = (label, onclick, cls = '', extra = {}) => h('button', { class: cls, onclick, ...extra }, label);
let atHub = false;
const screen = (...kids) => {
  atHub = false;
  audio.playMusic('hub');
  $('screen').style.backgroundImage = '';
  game?.destroy();
  game = null;
  const el = $('screen');
  el.replaceChildren(...kids.flat().filter(Boolean));
  el.classList.add('show');
  el.scrollTop = 0;
};
const save = () => {
  if (!storage.save(progress)) notice = 'hub.saveFail';
};
const lootLine = (l) => {
  const parts = [];
  if (l.gold) parts.push(`${t('res.gold')} ${l.gold >= 0 ? '+' : ''}${l.gold}`);
  if (l.essence) parts.push(`${t('res.essence')} +${l.essence}`);
  if (l.spirit) parts.push(`${t('res.spirit')} +${l.spirit}`);
  if (l.shards) parts.push(`${t('res.shard')} +${l.shards}`);
  if (l.stones?.normal) parts.push(`${t('res.stone')} ${t('stone.normal')} +${l.stones.normal}`);
  if (l.stones?.rare) parts.push(`${t('res.stone')} ${t('stone.rare')} +${l.stones.rare}`);
  return parts.length ? parts.join(' · ') : t('result.nothing');
};
const hpBar = () => [
  h('div', { class: 'muted' }, `${t('run.hp')}: ${Math.round(run.hp)} / ${run.maxHp}`),
  h('div', { class: 'hpbar' }, h('i', { style: `width:${Math.max(0, (run.hp / run.maxHp) * 100)}%` })),
];

// ---- Cupola (hub)
function showHub() {
  run = null;
  record = null;
  const inv = progress.inventory;
  const zoneCards = ctx.zoneList.map((z) => {
    const open = progress.unlocked.includes(z.id);
    const st = inv.stones[z.element];
    return h(
      'div',
      { class: 'card btn charrow' + (open ? '' : ' locked'), 'data-zone': z.id, style: `border-left:6px solid ${COLORS[z.element]}`, onclick: open ? () => startRun(z.id) : null },
      getImg(`orb:${z.element}`) ? h('img', { src: getImg(`orb:${z.element}`).src, alt: '', style: 'width:48px;height:48px;flex:none' }) : null,
      h(
        'div',
        { style: 'flex:1' },
        h('h3', {}, t(`zone.${z.id}`)),
        h('small', {}, open ? `${t(`zone.final.${z.final}`)} · ${t('zone.clears', { n: progress.clears[z.id] || 0 })}` : t('zone.locked')),
        open ? h('div', { class: 'muted' }, `${t('stone.normal')}: ${st.normal} · ${t('stone.rare')}: ${st.rare}`) : null,
      ),
    );
  });
  screen(
    h('h1', {}, t('hub.title')),
    h(
      'div',
      { class: 'card charrow', style: 'align-items:center' },
      h('div', { class: 'avatar', style: `background:${COLORS[progress.player.avatar % 6]};flex:none;cursor:default` }, (progress.player.name || '?')[0].toUpperCase()),
      h('div', { style: 'flex:1' }, h('b', {}, progress.player.name), h('div', { class: 'muted' }, `${progress.player.callsign} · ${t('hub.sub')}`)),
    ),
    notice ? h('div', { class: 'notice' }, t(notice)) : null,
    h(
      'div',
      { class: 'row' },
      h('span', { class: 'res' }, `${t('res.gold')}: ${inv.gold}`),
      h('span', { class: 'res' }, `${t('res.essence')}: ${inv.essence}`),
      h('span', { class: 'res', id: 'spirit' }, `${t('res.spirit')}: ${inv.spirit}`),
      h('span', { class: 'res' }, `${t('res.shard')}: ${inv.shards}`),
    ),
    h(
      'div',
      { class: 'row' },
      btn(t('hub.collection'), () => showCollection(), '', { id: 'b-col' }),
      btn(t('hub.team'), () => showTeam(0), '', { id: 'b-team' }),
      btn(t('hub.glossary'), () => showGlossary(), '', { id: 'b-glos' }),
    ),
    h(
      'div',
      { class: 'row' },
      btn(t('hub.summon'), () => showSummon('standard'), 'primary', { id: 'b-summon' }),
      btn(t('hub.story'), () => showStory(), '', { id: 'b-story' }),
      btn(t('hub.settings'), () => showSettings(), '', { id: 'b-set' }),
    ),
    h('h3', {}, t('hub.zones')),
    zoneCards,
    h(
      'details',
      {},
      h('summary', {}, t('hub.debug')),
      h('label', {}, t('hub.seed'), h('input', { id: 'seed', inputmode: 'numeric', value: seedText, oninput: (e) => (seedText = e.target.value) })),
      h('p', { class: 'muted' }, t('hub.progress')),
    ),
  );
  if (getImg('bg:hub')) $('screen').style.backgroundImage = `linear-gradient(rgba(8,9,22,.86),rgba(8,9,22,.86)),url(${getImg('bg:hub').src})`;
  if ($('screen')) $('screen').style.backgroundSize = 'cover';
  atHub = true;
  notice = null;
}

function setLang(l) {
  lang = l;
  try {
    localStorage.setItem('rsp.lang', l);
  } catch {
    /* bỏ qua */
  }
  t = createT(dicts[lang], en);
  document.documentElement.lang = lang;
  document.title = t('game.title');
  showSettings();
}

// ---- mô tả kỹ năng từ dữ liệu (không viết cứng từng nhân vật)
const pct = (v) => Math.round(v * 100);
const el = (n) => t(`element.${n}`);
const COLORS = ['#3b9cff', '#ff5a3c', '#4cc46a', '#ffd84a', '#9a5cff', '#ff7fb0'];
function unitText(u) {
  if (u.type === 'damage') {
    const target = t(`target.${u.target}`);
    return u.element != null ? t('unit.damage.el', { mult: u.mult, target, element: el(u.element) }) : t('unit.damage', { mult: u.mult, target });
  }
  if (u.type === 'heal') return t('unit.heal', { pct: pct(u.pctMax) });
  if (u.type === 'convert') return t('unit.convert', { count: u.count, element: el(u.to) });
  const val = u.value ? `, ${pct(u.value)}%` : '';
  return t('unit.apply', { effect: t(`effect.${u.key}.name`), target: t(`target.${u.target}`), turns: u.turns, value: val });
}
const leaderText = (l) => t(`leader.${l.template}`, { pct: pct(l.pct || 0), element: l.element != null ? el(l.element) : '', n: l.n });
const keysOf = (units) => [...new Set(units.filter((u) => u.type === 'applyEffect').map((u) => u.key))];
const chip = (id) => {
  const e = ctx.characters[id].element;
  const im = getImg(`icon:${id}`);
  const c = h('span', { class: 'chip', style: `background:${COLORS[e]}` }, el(e));
  return im ? h('span', {}, h('img', { src: im.src, alt: '', width: '36', height: '36', style: 'border-radius:8px;vertical-align:middle;margin-right:4px' }), c) : c;
};
// Ảnh chân dung vuông: icon nếu có, không thì ngọc hệ.
function portrait(id, size = 64) {
  const c = ctx.characters[id];
  const im = getImg(`icon:${id}`);
  const rar = c.rarity === 5 ? '#ffd84a' : c.rarity === 4 ? '#c58bff' : '#4a4f90';
  const box = `width:${size}px;height:${size}px;border-radius:12px;border:3px solid ${rar};flex:none;background:${COLORS[c.element]}33;display:flex;align-items:center;justify-content:center;overflow:hidden`;
  const inner = im ? h('img', { src: im.src, alt: '', width: String(size), height: String(size), style: 'width:100%;height:100%;object-fit:cover' }) : getImg(`orb:${c.element}`) ? h('img', { src: getImg(`orb:${c.element}`).src, alt: '', style: `width:${size * 0.7}px` }) : h('b', {}, el(c.element));
  return h('div', { style: box }, inner);
}

const stars = (id) => '★'.repeat(ctx.characters[id].rarity);
const owned = () => ctx.characterList.filter((c) => progress.characters[c.id]);

function charCard(id, onclick, extra) {
  const c = progress.characters[id];
  const def = ctx.characters[id];
  return h(
    'div',
    { class: 'card btn charrow' + (c ? '' : ' locked'), 'data-char': id, onclick: c ? onclick : null },
    c ? portrait(id, 64) : h('div', { style: 'width:64px;height:64px;border-radius:12px;border:3px solid #2a2f60;flex:none;display:flex;align-items:center;justify-content:center;font-size:24px' }, '?'),
    h(
      'div',
      { style: 'flex:1;min-width:0' },
      h('h3', {}, t(`char.${id}`), ' ', h('small', {}, '★'.repeat(def.rarity))),
      h('div', {}, h('span', { class: 'chip', style: `background:${COLORS[def.element]}` }, el(def.element)), ' ', h('small', {}, c ? `${t('char.level', { n: c.level, max: ctx.config.progression.levelMax })} · ${t('char.awaken', { n: c.awaken })}` : '???')),
      extra,
    ),
  );
}

function showCollection() {
  const list = ctx.characterList.slice().sort((a, b) => a.element - b.element || b.rarity - a.rarity);
  screen(
    h('h2', {}, `${t('hub.collection')} ${owned().length}/${list.length}`),
    list.map((c) => charCard(c.id, () => showChar(c.id))),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
}

function keywordBlock(keys) {
  return keys.map((k) => h('div', { class: 'muted' }, h('b', {}, t(`effect.${k}.name`)), ': ', t(`effect.${k}.desc`)));
}

function showChar(id, msg) {
  const c = ctx.characters[id];
  const pc = progress.characters[id];
  const st = statsFor(ctx, id, pc.level, pc.awaken);
  const lvCost = levelCost(ctx, id, pc.level);
  const aw = awakenCost(ctx, id, pc.awaken + 1);
  const duos = ctx.duoList.filter((d) => d.a === id || d.b === id);
  const keys = [...new Set([...keysOf(c.skill.units), ...duos.flatMap((d) => keysOf(d.skill.units))])];
  const act = (fn) => {
    const r = fn();
    if (r.ok) {
      progress = r.progress;
      save();
      showChar(id);
    } else showChar(id, `err.${r.reason}`);
  };
  screen(
    getImg(`card:${id}`) ? h('img', { src: getImg(`card:${id}`).src, alt: t(`char.${id}`), style: 'width:60%;max-width:240px;border-radius:14px' }) : null,
    h('h2', {}, t(`char.${id}`), ' ', chip(id), ' ', stars(id)),
    msg ? h('div', { class: 'notice' }, t(msg)) : null,
    h('div', { class: 'row' }, h('span', { class: 'res' }, t('char.level', { n: pc.level, max: ctx.config.progression.levelMax })), h('span', { class: 'res' }, t('char.awaken', { n: pc.awaken }))),
    h('div', { class: 'row' }, h('span', { class: 'res' }, `${t('stat.hp')} ${st.hp}`), h('span', { class: 'res' }, `${t('stat.atk')} ${st.atk}`), h('span', { class: 'res' }, `${t('stat.heal')} ${st.heal}`)),
    h('div', { class: 'card' }, h('b', {}, `${t('char.skill')}: ${t(`skill.${id}`)}`), h('div', { class: 'muted' }, t('char.cooldown', { n: skillCooldown(ctx, id, pc.awaken) })), c.skill.units.map((u) => h('div', {}, unitText(u)))),
    h('div', { class: 'card' }, h('b', {}, t('char.leader')), h('div', {}, leaderText(c.leader))),
    h('div', { class: 'card' }, h('b', {}, t('char.duo')), duos.length ? duos.map((d) => { const other = d.a === id ? d.b : d.a; return h('div', {}, h('b', {}, t(`duo.${d.id}`)), ` · ${t('char.duoWith', { name: t(`char.${other}`) })}`, d.skill.units.map((u) => h('div', { class: 'muted' }, unitText(u)))); }) : h('div', { class: 'muted' }, t('char.noDuo'))),
    keys.length ? h('div', { class: 'card' }, keywordBlock(keys)) : null,
    lvCost === null ? h('div', { class: 'muted' }, t('char.maxLevel')) : btn(t('char.levelUp', { cost: lvCost }), () => act(() => levelUp(ctx, progress, id)), '', { id: 'lvup' }),
    aw
      ? [h('div', { class: 'muted' }, t('char.awakenCost', { shards: aw.shards, stones: aw.stones, kind: t(`stone.${aw.stone}`), element: el(aw.element), gold: aw.gold })), btn(t('char.awakenBtn'), () => act(() => awaken(ctx, progress, id)), '', { id: 'awaken' })]
      : h('div', { class: 'muted' }, t('char.maxAwaken')),
    h('div', { class: 'muted' }, `${t('res.essence')} ${progress.inventory.essence} · ${t('res.shard')} ${progress.inventory.shards} · ${t('res.gold')} ${progress.inventory.gold} · ${t('res.stone')} ${el(c.element)}: ${progress.inventory.stones[c.element].normal}/${progress.inventory.stones[c.element].rare}`),
    btn(t('back'), showCollection, '', { id: 'back' }),
  );
}

function showTeam(slot, msg) {
  const team = progress.team;
  const duos = [];
  for (let i = 0; i + 1 < 5; i++) {
    const d = ctx.duoByPair[`${team[i]}|${team[i + 1]}`];
    if (d) duos.push(d);
  }
  const pick = (id) => {
    const t2 = team.slice();
    const at = t2.indexOf(id);
    if (at >= 0) [t2[at], t2[slot]] = [t2[slot], t2[at]];
    else t2[slot] = id;
    const r = setTeam(progress, t2);
    if (r.ok) {
      progress = r.progress;
      save();
    }
    showTeam(slot);
  };
  screen(
    h('h2', {}, t('hub.team')),
    h('p', { class: 'muted' }, t('team.hint')),
    h('div', { class: 'row' }, team.map((id, i) => h('div', { class: 'card btn', style: `width:88px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px;${i === slot ? 'border-color:#ffd84a;box-shadow:0 0 10px #ffd84a66;' : ''}`, 'data-slot': i, onclick: () => showTeam(i) }, h('small', {}, i === 0 ? t('team.leader') : t('team.slot', { n: i + 1 })), portrait(id, 64), h('small', {}, t(`char.${id}`))))),
    h('div', { class: 'muted' }, `${t('char.leader')}: ${leaderText(ctx.characters[team[0]].leader)}`),
    h('div', { class: 'muted' }, duos.length ? `${t('team.duoActive')}: ${duos.map((d) => t(`duo.${d.id}`)).join(', ')}` : t('team.noDuo')),
    h('h3', {}, t('team.pick')),
    owned().map((c) => charCard(c.id, () => pick(c.id))),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
}

function showGlossary() {
  screen(
    h('h2', {}, t('hub.glossary')),
    KEYS.map((k) => h('div', { class: 'card' }, h('b', {}, t(`effect.${k}.name`), ' ', h('small', {}, t(`effect.${k}.short`))), h('div', { class: 'muted' }, t(`effect.${k}.desc`)))),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
}


// ---- Triệu hồi, onboarding, nhật ký, cài đặt
const dayKey = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
const fmtPct = (v) => (v * 100).toFixed(2).replace(/\.?0+$/, '');
const rarityCls = (r) => `rar${r}`;
const confirmBox = (text, yes, no, yesLabel = t('summon.yes')) =>
  h('div', { class: 'card', id: 'confirm' }, h('p', {}, text), h('div', { class: 'row' }, btn(yesLabel, yes, 'primary', { id: 'confirm-yes' }), btn(t('summon.no'), no, '', { id: 'confirm-no' })));

function showSummon(bannerId, pending = null, msg = null) {
  const cfg = ctx.config.summon;
  const banner = ctx.banners[bannerId];
  const sm = progress.summon;
  const eff = effectiveRates(ctx.config);
  const freeAvail = sm.freeDay !== dayKey();
  const rateUp = banner.culture
    ? t('summon.rateUp', { culture: t(`culture.${banner.culture}`), pct: Math.round(banner.rateUp * 100) })
    : t('summon.noRateUp');
  const doSummon = (count, free) => {
    const r = summon(ctx, progress, { bannerId, count, free, dayKey: dayKey(), seed: (Math.random() * 4294967296) >>> 0 });
    if (!r.ok) return showSummon(bannerId, null, `err.${r.reason}`);
    progress = r.progress;
    save();
    audio.sfx('summon');
    showSummonResult(bannerId, r.results);
  };
  const ask = (count) => {
    const cost = cfg.costPerPull * count;
    showSummon(bannerId, { count, cost });
  };
  screen(
    h('h2', {}, t('summon.title')),
    h('div', { class: 'res', id: 'spirit' }, t('summon.spirit', { n: progress.inventory.spirit })),
    msg ? h('div', { class: 'notice' }, t(msg)) : null,
    h('div', { class: 'row' }, ctx.bannerList.map((b) => btn(t(`banner.${b.id}.name`), () => showSummon(b.id), b.id === bannerId ? 'primary' : '', { 'data-banner': b.id }))),
    h('div', { class: 'card' }, h('b', {}, t(`banner.${bannerId}.name`)), h('div', { class: 'muted' }, t(`banner.${bannerId}.desc`)), h('div', { class: 'muted' }, rateUp)),
    // Tỉ lệ và bảo đảm luôn hiện ngay, không cần mở thêm
    h(
      'div',
      { class: 'card', id: 'rates' },
      h('b', {}, t('summon.rates')),
      h('div', {}, t('summon.baseRates', { r5: fmtPct(cfg.rates['5']), r4: fmtPct(cfg.rates['4']), r3: fmtPct(cfg.rates['3']) })),
      h('div', {}, t('summon.effRates', { r5: fmtPct(eff[5]), r4: fmtPct(eff[4]), r3: fmtPct(eff[3]) })),
      h('div', { class: 'muted' }, t('summon.pity5', { max: cfg.pity5, n: sm.pity5 })),
      h('div', { class: 'muted' }, t('summon.pity4', { max: cfg.guarantee4Every, n: sm.pity4 })),
      sm.firstDone ? null : h('div', { class: 'muted' }, t('summon.tokenNote')),
    ),
    pending
      ? confirmBox(t('summon.confirm', { cost: pending.cost, count: pending.count, banner: t(`banner.${bannerId}.name`), left: progress.inventory.spirit - pending.cost }), () => doSummon(pending.count, false), () => showSummon(bannerId))
      : h(
          'div',
          { class: 'row' },
          freeAvail ? btn(t('summon.free'), () => doSummon(1, true), 'primary', { id: 'pull-free' }) : h('div', { class: 'muted' }, t('summon.freeUsed')),
          btn(t('summon.x1', { cost: cfg.costPerPull }), () => ask(1), '', { id: 'pull-1' }),
          btn(t('summon.x10', { cost: cfg.costPerPull * cfg.multiCount }), () => ask(cfg.multiCount), '', { id: 'pull-10' }),
        ),
    h('div', { class: 'row' }, btn(t('summon.history'), showHistory, '', { id: 'b-history' }), btn(t('summon.redeem'), () => showRedeem(), '', { id: 'b-redeem' })),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
}

function showSummonResult(bannerId, results) {
  const shown = new Set();
  const cards = results.map((r, i) =>
    h(
      'div',
      { class: 'card btn sumcard', 'data-i': i, onclick: (e) => reveal(i, e.currentTarget) },
      h('div', { class: 'muted' }, t('summon.tapReveal')),
    ),
  );
  const paint = (i, el) => {
    const r = results[i];
    shown.add(i);
    audio.sfx(r.rarity >= 4 ? 'rare' : 'reveal');
    el.className = `card sumcard flip ${rarityCls(r.rarity)}`;
    if (r.rarity >= 4) {
      const f = $('flash');
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
      audio.vibrate(r.rarity === 5 ? [60, 40, 90] : 40);
    }
    el.replaceChildren(
      ...[
        portrait(r.id, 96),
        h('h3', {}, t(`char.${r.id}`), ' ', h('small', {}, '★'.repeat(r.rarity))),
        h('small', {}, r.isNew ? t('summon.new') : t('summon.dup', { n: r.shards })),
        r.forced ? h('div', { class: 'muted' }, t('summon.forced')) : null,
      ].filter(Boolean),
    );
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'center';
    el.style.gap = '6px';
  };
  const reveal = (i, el) => {
    if (!shown.has(i)) paint(i, el);
  };
  screen(
    h('h2', {}, t('summon.title')),
    cards,
    h('div', { class: 'row' }, btn(t('summon.reveal'), () => cards.forEach((el, i) => reveal(i, el)), '', { id: 'reveal-all' }), btn(t('summon.done'), () => showSummon(bannerId), 'primary', { id: 'sum-done' })),
  );
}

function showHistory() {
  const hist = progress.summon.history.slice().reverse();
  screen(
    h('h2', {}, t('summon.history')),
    hist.length ? hist.map((x) => h('div', { class: 'card' }, t('summon.historyRow', { n: x.n, rarity: x.rarity, name: t(`char.${x.id}`), banner: t(`banner.${x.banner}.name`) }))) : h('div', { class: 'muted' }, t('summon.historyEmpty')),
    btn(t('back'), () => showSummon('standard'), '', { id: 'back' }),
  );
}

function showRedeem(pick = null, msg = null) {
  const cost = ctx.config.summon.redeemShards;
  const missing = ctx.characterList.filter((c) => !c.reserve && !progress.characters[c.id]).sort((a, b) => b.rarity - a.rarity);
  screen(
    h('h2', {}, t('summon.redeem')),
    h('p', { class: 'muted' }, t('summon.redeemInfo', { cost, n: progress.inventory.shards })),
    msg ? h('div', { class: 'notice' }, msg) : null,
    pick
      ? confirmBox(t('summon.redeemConfirm', { cost, name: t(`char.${pick}`) }), () => {
          const r = redeemCharacter(ctx, progress, pick);
          if (!r.ok) return showRedeem(null, t(`err.${r.reason === 'not_enough_shards' ? 'not_enough_shards' : r.reason}`));
          progress = r.progress;
          save();
          showRedeem(null, t('summon.redeemDone', { name: t(`char.${pick}`) }));
        }, () => showRedeem())
      : null,
    missing.length ? missing.map((c) => h('div', { class: 'card btn', 'data-char': c.id, onclick: () => showRedeem(c.id) }, h('h3', {}, t(`char.${c.id}`), ' ', chip(c.id), ' ', h('small', {}, '★'.repeat(c.rarity))))) : h('div', { class: 'muted' }, t('summon.redeemNone')),
    btn(t('back'), () => showSummon('standard'), '', { id: 'back' }),
  );
}

function showStory() {
  const open = new Set(storyUnlocked(ctx, progress));
  screen(
    h('h2', {}, t('story.title')),
    h('div', { class: 'muted' }, t('story.entries', { n: open.size, total: ctx.storyList.length })),
    ctx.storyList.map((s) =>
      open.has(s.id)
        ? h('div', { class: 'card', 'data-story': s.id }, h('b', {}, t(`story.${s.id}.title`)), h('p', {}, t(`story.${s.id}.body`)))
        : h('div', { class: 'card locked' }, h('b', {}, '???'), h('div', { class: 'muted' }, t('story.locked', { zone: t(`zone.${s.after}`) }))),
    ),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
}

function showSettings(msg = null, confirmDelete = false) {
  const exportBox = h('textarea', { readonly: '', id: 'export-box' });
  const importBox = h('textarea', { placeholder: '…', id: 'import-box' });
  screen(
    h('h2', {}, t('set.title')),
    msg ? h('div', { class: 'notice' }, msg) : null,
    h('label', {}, t('hub.lang'), h('select', { id: 'lang', onchange: (e) => setLang(e.target.value) }, h('option', { value: 'vi' }, 'Tiếng Việt'), h('option', { value: 'en' }, 'English'))),
    h('label', {}, h('span', { id: 'vol-l' }, t('set.volume', { n: progress.settings.volume })), h('input', { id: 'vol', type: 'range', min: '0', max: '100', value: String(progress.settings.volume), oninput: (e) => {
      progress.settings.volume = Number(e.target.value);
      $('vol-l').textContent = t('set.volume', { n: progress.settings.volume });
      audio.applyGains();
    }, onchange: () => save() })),
    ...[['music', 'set.music'], ['sfx', 'set.sfx'], ['haptic', 'set.haptic']].map(([k, label]) =>
      h('label', { style: 'flex-direction:row;gap:10px' }, h('input', { type: 'checkbox', id: `opt-${k}`, ...(progress.settings[k] !== false ? { checked: '' } : {}), onchange: (e) => {
        progress.settings[k] = e.target.checked;
        audio.applyGains();
        save();
        if (k === 'haptic' && e.target.checked) audio.vibrate(30);
      } }), t(label))),
    h('p', { class: 'muted' }, t('set.volumeNote')),
    btn(t('hub.export'), () => (exportBox.value = storage.exportText(progress)), '', { id: 'export' }),
    exportBox,
    importBox,
    btn(t('hub.import'), () => {
      try {
        progress = storage.importText(importBox.value.trim());
        save();
        showSettings(t('hub.import.ok'));
      } catch {
        showSettings(t('hub.import.bad'));
      }
    }, '', { id: 'import' }),
    confirmDelete
      ? confirmBox(t('set.deleteConfirm'), () => {
          storage.clear();
          progress = newProgress(ctx);
          showOnboarding();
        }, () => showSettings(), t('set.deleteYes'))
      : btn(t('set.delete'), () => showSettings(null, true), '', { id: 'delete' }),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
  $('lang').value = lang;
}

// Onboarding: mở đầu -> quê hương -> Tín Vật -> ngoại hình -> tên -> lượt triệu hồi đầu.
const ob = { hometown: '', culture: null, avatar: 0, name: '', callsign: '' };
let obTimers = [];
function showOnboarding(step = 1, err = null) {
  obTimers.forEach(clearTimeout);
  obTimers = [];
  const o = ctx.config.onboarding;
  const next = (n) => () => showOnboarding(n);
  if (step === 1) {
    const lines = ['ob.alarm1', 'ob.alarm2', 'ob.alarm3'].map((k) => h('p', { class: 'ob-line', style: 'opacity:0;transition:opacity 1s' }, t(k)));
    screen(h('h1', {}, t('game.title')), lines, btn(t('ob.next'), next(2), 'primary', { id: 'ob-next' }), btn(t('ob.skip'), next(2), '', { id: 'ob-skip' }));
    lines.forEach((l, i) => obTimers.push(setTimeout(() => (l.style.opacity = '1'), 300 + i * 2500)));
  } else if (step === 2) {
    screen(
      h('div', { class: 'card' }, h('p', {}, t('ob.aida'))),
      h('label', {}, t('ob.hometown'), h('input', { id: 'ob-hometown', maxlength: String(o.hometownMax), value: ob.hometown, oninput: (e) => (ob.hometown = e.target.value) })),
      h('p', { class: 'muted' }, t('ob.hometownHint')),
      btn(t('ob.next'), next(3), 'primary', { id: 'ob-next' }),
    );
  } else if (step === 3) {
    screen(
      h('div', { class: 'card' }, h('p', {}, t('ob.token'))),
      o && ctx.config.summon.cultures.map((c) => h('div', { class: 'card btn' + (ob.culture === c ? ' sel' : ''), 'data-culture': c, onclick: () => { ob.culture = c; showOnboarding(3); } }, h('b', {}, t(`ob.token.${c}`)))),
      btn(t('ob.next'), next(4), 'primary', { id: 'ob-next', ...(ob.culture ? {} : { disabled: '' }) }),
    );
  } else if (step === 4) {
    const av = Array.from({ length: o.avatars }, (_, i) => h('div', { class: 'avatar' + (ob.avatar === i ? ' sel' : ''), 'data-avatar': i, style: `background:${COLORS[i % 6]}`, onclick: () => { ob.avatar = i; showOnboarding(4); } }, String(i + 1)));
    screen(h('div', { class: 'card' }, h('p', {}, t('ob.avatar'))), h('div', { class: 'row' }, av), btn(t('ob.next'), next(5), 'primary', { id: 'ob-next' }));
  } else if (step === 5) {
    screen(
      err ? h('div', { class: 'notice' }, err) : null,
      h('label', {}, t('ob.name'), h('input', { id: 'ob-name', maxlength: String(o.nameMax), value: ob.name, oninput: (e) => (ob.name = e.target.value) })),
      h('label', {}, t('ob.callsign'), h('input', { id: 'ob-callsign', maxlength: String(o.callsignMax), value: ob.callsign, oninput: (e) => (ob.callsign = e.target.value) })),
      btn(t('ob.start'), () => {
        const r = finishOnboarding(ctx, progress, { name: ob.name, callsign: ob.callsign, hometown: ob.hometown, avatar: ob.avatar, culture: ob.culture });
        if (!r.ok) {
          const key = `ob.bad.${r.reason}`;
          return showOnboarding(5, dicts[lang][key] ? t(key, { max: r.reason === 'bad_name' ? o.nameMax : o.callsignMax }) : t('ob.bad.other'));
        }
        progress = r.progress;
        const s = summon(ctx, progress, { bannerId: 'standard', count: 1, free: true, dayKey: dayKey(), seed: (Math.random() * 4294967296) >>> 0 });
        progress = s.progress;
        save();
        showFirstSummon(s.results[0]);
      }, 'primary', { id: 'ob-start' }),
    );
  }
}

function showFirstSummon(r) {
  screen(
    h('div', { class: 'card' }, h('p', {}, t('ob.firstSummon'))),
    h('div', { class: `card sumcard ${rarityCls(r.rarity)}`, 'data-first': r.id }, h('h3', {}, t(`char.${r.id}`), ' ', chip(r.id), ' ', h('small', {}, '★'.repeat(r.rarity))), h('small', {}, t('summon.forced'))),
    h('p', { class: 'muted' }, t('ob.welcome', { n: ctx.config.summon.welcomeSpirit })),
    btn(t('ob.toHub'), showHub, 'primary', { id: 'ob-hub' }),
  );
}

// ---- chuyến leo tháp
function pickSeed() {
  const raw = seedText.trim();
  if (/^\d+$/.test(raw)) return Number(raw) >>> 0;
  return (Math.random() * 4294967296) >>> 0; // UI được phép dùng Math.random; core thì không
}

function startRun(zoneId) {
  const seed = pickSeed();
  const pity = !!progress.pity[zoneId];
  const team = teamRoster(progress);
  run = createRun(ctx, { seed, zoneId, team, pityMissed: pity });
  record = newRunRecord(seed, zoneId, team, pity);
  render();
}

function act(action) {
  const r = runStep(ctx, run, action);
  if (r.events[0]?.type === 'invalid') return;
  record.actions.push(action);
  run = r.run;
  render();
}

function render() {
  window.__run = run;
  if (run.phase === 'doors') return showDoors();
  if (run.phase === 'battle') return showBattle();
  if (run.phase === 'result') return showResult();
  if (run.phase === 'event') return showEvent();
  if (run.phase === 'shop') return showShop();
  return showEnd();
}

const floorTitle = () => h('h2', {}, `${t(`zone.${run.zoneId}`)} · ${t('run.floor', { n: run.floor + 1, total: run.floors })}`);

function showDoors() {
  const rc = ctx.config.run.items;
  const desc = {
    potion: t('item.desc.potion', { n: Math.round(rc.potion.healPct * 100) }),
    shield: t('item.desc.shield', { n: Math.round(rc.shield.pct * 100) }),
    time: t('item.desc.time', { n: rc.time.bonusMs / 1000 }),
  };
  const items = ['potion', 'shield', 'time'].map((it) =>
    h(
      'div',
      { class: 'card' },
      h('b', {}, `${t(`item.${it}`)} ×${run.items[it]}`),
      h('div', { class: 'muted' }, desc[it]),
      run.armed[it] ? h('div', { class: 'muted' }, t('run.armed')) : btn(t('run.use'), () => act({ type: 'useItem', item: it }), '', { 'data-item': it, ...(run.items[it] <= 0 || (it === 'potion' && run.hp >= run.maxHp) ? { disabled: '' } : {}) }),
    ),
  );
  screen(
    floorTitle(),
    hpBar(),
    h('p', { class: 'sub' }, run.doors.length > 1 ? t('run.chooseDoor') : t('run.finalDoor')),
    run.doors.map((d, i) =>
      h('div', { class: 'card btn', 'data-door': i, onclick: () => act({ type: 'door', index: i }) }, h('h3', {}, t(`door.${d}`)), h('small', {}, t(`door.desc.${d}`))),
    ),
    h('h3', {}, t('run.items')),
    items,
  );
}

function showBattle() {
  if (!progress.onboarding.tutorialDone) return showTutorial(1);
  startBattleUI();
}

function showTutorial(n) {
  const total = 3;
  const finish = () => {
    progress = completeTutorial(progress);
    save();
    showHint = true;
    startBattleUI();
  };
  screen(
    h('h2', {}, t('tut.title')),
    h('div', { class: 'card' }, h('small', {}, t('tut.step', { n, total })), h('p', {}, t(`tut.${n}`))),
    n < total ? btn(t('ob.next'), () => showTutorial(n + 1), 'primary', { id: 'tut-next' }) : btn(t('tut.go'), finish, 'primary', { id: 'tut-go' }),
    n < total ? btn(t('ob.skip'), finish, '', { id: 'tut-skip' }) : null,
  );
}

let showHint = false;
function startBattleUI() {
  const hint = showHint;
  showHint = false;
  audio.playMusic(run.node === 'boss' ? 'boss' : 'battle');
  $('screen').classList.remove('show');
  game?.destroy();
  game = startGame({
    canvas: $('cv'),
    ctx,
    t,
    state: run.battle,
    titleText: `${t('run.floor', { n: run.floor + 1, total: run.floors })}`,
    stepper(state, action) {
      const r = runStep(ctx, run, { type: 'battle', action });
      if (r.events[0]?.type === 'invalid') return { state, events: r.events };
      record.actions.push({ type: 'battle', action });
      run = r.run; // phải cập nhật ngay, nếu không mọi nước đi đều bắt đầu lại từ trạng thái đầu trận
      pending = r.run;
      return { state: r.run.battle, events: r.events };
    },
    fx: audio,
    hint,
    onEnd(st) {
      audio.sfx(st.status === 'won' ? 'win' : 'lose');
      run = pending;
      render();
    },
  });
  window.__game = game;
}
let pending = null;

function showResult() {
  const r = run.lastResult;
  let body;
  if (r.kind === 'event') {
    const key = `ev.${r.eventId}`;
    body = h('div', { class: 'card' }, h('b', {}, t(`${key}.title`)), h('p', {}, t(`${key}.o${r.choice}_${r.outcome}`)));
  } else if (r.kind === 'rest') body = h('div', { class: 'card' }, h('b', {}, t('result.rest', { n: r.heal })));
  else if (r.kind === 'chest') body = h('div', { class: 'card' }, h('b', {}, t('result.chest')), h('p', {}, `${t('result.gain')}: ${lootLine(r.loot)}`));
  else body = h('div', { class: 'card' }, h('b', {}, t('result.battle')), h('p', {}, `${t('result.gain')}: ${lootLine(r.loot)}`));
  screen(floorTitle(), hpBar(), body, h('div', { class: 'muted' }, `${t('end.loot')}: ${lootLine(run.loot)}`), btn(t('result.continue'), () => act({ type: 'continue' }), 'primary', { id: 'continue' }));
}

function showEvent() {
  const key = `ev.${run.event.id}`;
  const ev = ctx.events[run.event.id];
  screen(
    floorTitle(),
    hpBar(),
    h('div', { class: 'card' }, h('b', {}, t(`${key}.title`)), h('p', {}, t(`${key}.body`))),
    h('p', { class: 'sub' }, t('event.choose')),
    ev.choices.map((_, i) => btn(t(`${key}.c${i}`), () => act({ type: 'eventChoice', index: i }), '', { 'data-choice': i })),
  );
}

function showShop() {
  screen(
    h('h2', {}, t('shop.title')),
    h('div', { class: 'muted' }, t('shop.gold', { n: run.loot.gold })),
    run.shop.map((s, i) =>
      h(
        'div',
        { class: 'card' },
        h('b', {}, t(`item.${s.item}`)),
        s.sold ? h('div', { class: 'muted' }, t('shop.sold')) : btn(t('shop.buy', { price: s.price }), () => act({ type: 'buy', slot: i }), '', { 'data-slot': i, ...(run.loot.gold < s.price ? { disabled: '' } : {}) }),
      ),
    ),
    btn(t('shop.leave'), () => act({ type: 'leaveShop' }), 'primary', { id: 'leave' }),
  );
}

let savedThisRun = false;
function showEnd() {
  if (!savedThisRun) {
    progress = applyRunResult(ctx, progress, run);
    save();
    savedThisRun = true;
    window.__lastRecord = record;
  }
  const won = run.result === 'won';
  screen(
    h('h1', {}, t(won ? 'end.won' : 'end.lost')),
    floorTitle(),
    h('div', { class: 'card' }, h('b', {}, t('end.loot')), h('p', {}, lootLine(run.loot))),
    won ? h('div', { class: 'muted' }, t('end.completion')) : h('div', { class: 'notice' }, t('end.noCompletion')),
    run.pityGranted ? h('div', { class: 'notice' }, t('end.pity')) : null,
    btn(t('end.back'), () => {
      savedThisRun = false;
      showHub();
    }, 'primary', { id: 'back' }),
  );
}

if (DEBUG) {
  window.__ctx = ctx;
  window.__cheat = (ids = []) => {
    const p = structuredClone(progress);
    p.inventory.essence += 5000;
    p.inventory.gold += 20000;
    p.inventory.shards += 100;
    for (let e = 0; e < 6; e++) {
      p.inventory.stones[e].normal += 30;
      p.inventory.stones[e].rare += 10;
    }
    progress = p;
    for (const id of ids) progress = grantCharacter(ctx, progress, id).progress;
    save();
    showHub();
  };
  window.__debugWin = () => {
    if (run?.phase !== 'battle') return;
    run = debugWinBattle(ctx, run);
    render();
  };
}
// Nút Back (Android/trình duyệt): trong chuyến thì bỏ qua để khỏi mất tiến trình, màn khác thì về Hub.
history.pushState({ rsp: 1 }, '');
window.addEventListener('popstate', () => {
  history.pushState({ rsp: 1 }, '');
  if (run || atHub || !progress.onboarding.done) return;
  audio.sfx('back');
  showHub();
});
try {
  window.screen.orientation?.lock?.('portrait').catch(() => {});
} catch {
  /* bỏ qua */
}
document.title = t('game.title');
document.documentElement.lang = lang;
screen(h('h1', {}, t('game.title')), h('div', { class: 'hpbar', style: 'max-width:260px' }, h('i', { id: 'load-bar', style: 'width:0%;background:#6b79ff' })), h('p', { class: 'sub' }, t('load.text')));
await preloadAssets((d, n) => {
  const b = $('load-bar');
  if (b && n) b.style.width = `${(d / n) * 100}%`;
});
if (progress.onboarding.done) showHub();
else showOnboarding();
