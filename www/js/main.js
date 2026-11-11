import { buildCtx } from './core/ctx.js';
import { createRun, runStep, newRunRecord, debugWinBattle } from './core/run.js';
import { applyRunResult } from './core/progress.js';
import { createStorage, browserAdapter } from './save/storage.js';
import { createT, detectLang } from './i18n/index.js';
import { startGame } from './ui/game.js';

const $ = (id) => document.getElementById(id);
const load = (f) => fetch(`js/${f}`).then((r) => r.json());
const [config, characters, monsters, zones, events, vi, en] = await Promise.all([
  load('data/config.json'),
  load('data/characters.json'),
  load('data/monsters.json'),
  load('data/zones.json'),
  load('data/events.json'),
  load('i18n/vi.json'),
  load('i18n/en.json'),
]);
const ctx = buildCtx({ config, characters, monsters, zones, events });
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
const screen = (...kids) => {
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
      { class: 'card btn' + (open ? '' : ' locked'), 'data-zone': z.id, onclick: open ? () => startRun(z.id) : null },
      h('h3', {}, t(`zone.${z.id}`)),
      h('small', {}, open ? `${t(`zone.final.${z.final}`)} · ${t('zone.clears', { n: progress.clears[z.id] || 0 })}` : t('zone.locked')),
      open ? h('div', { class: 'muted' }, `${t('stone.normal')}: ${st.normal} · ${t('stone.rare')}: ${st.rare}`) : null,
    );
  });
  const exportBox = h('textarea', { readonly: '' });
  const importBox = h('textarea', { placeholder: '…' });
  screen(
    h('h1', {}, t('hub.title')),
    h('p', { class: 'sub' }, t('hub.sub')),
    notice ? h('div', { class: 'notice' }, t(notice)) : null,
    h(
      'div',
      { class: 'row' },
      h('span', { class: 'res' }, `${t('res.gold')}: ${inv.gold}`),
      h('span', { class: 'res' }, `${t('res.essence')}: ${inv.essence}`),
      h('span', { class: 'res' }, `${t('res.spirit')}: ${inv.spirit}`),
      h('span', { class: 'res' }, `${t('res.shard')}: ${inv.shards}`),
    ),
    h('h3', {}, t('hub.zones')),
    zoneCards,
    h(
      'details',
      {},
      h('summary', {}, t('hub.debug')),
      h('label', {}, t('hub.seed'), h('input', { id: 'seed', inputmode: 'numeric', value: seedText, oninput: (e) => (seedText = e.target.value) })),
      h('label', {}, t('hub.lang'), h('select', { id: 'lang', onchange: (e) => setLang(e.target.value) }, h('option', { value: 'vi' }, 'Tiếng Việt'), h('option', { value: 'en' }, 'English'))),
      btn(t('hub.export'), () => (exportBox.value = storage.exportText(progress)), '', { id: 'export' }),
      exportBox,
      importBox,
      btn(t('hub.import'), () => {
        try {
          progress = storage.importText(importBox.value.trim());
          save();
          notice = 'hub.import.ok';
        } catch {
          notice = 'hub.import.bad';
        }
        showHub();
      }, '', { id: 'import' }),
      h('p', { class: 'muted' }, t('hub.progress')),
    ),
  );
  $('lang').value = lang;
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
  showHub();
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
  run = createRun(ctx, { seed, zoneId, team: progress.team, pityMissed: pity });
  record = newRunRecord(seed, zoneId, progress.team, pity);
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
    shield: t('item.desc.shield', { n: rc.shield.charges }),
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
      pending = r.run;
      return { state: r.run.battle, events: r.events };
    },
    onEnd() {
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
  window.__debugWin = () => {
    if (run?.phase !== 'battle') return;
    run = debugWinBattle(ctx, run);
    render();
  };
}
document.title = t('game.title');
document.documentElement.lang = lang;
showHub();
