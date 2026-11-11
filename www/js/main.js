import { buildCtx } from './core/ctx.js';
import { createRun, runStep, newRunRecord, debugWinBattle } from './core/run.js';
import { applyRunResult } from './core/progress.js';
import { createStorage, browserAdapter } from './save/storage.js';
import { grantCharacter, levelCost, levelUp, awakenCost, awaken, setTeam, teamRoster } from './core/upgrade.js';
import { statsFor, skillCooldown } from './core/stats.js';
import { KEYS } from './core/effects.js';
import { createT, detectLang } from './i18n/index.js';
import { startGame } from './ui/game.js';

const $ = (id) => document.getElementById(id);
const load = (f) => fetch(`js/${f}`).then((r) => r.json());
const [config, characters, monsters, zones, events, duos, vi, en] = await Promise.all([
  load('data/config.json'),
  load('data/characters.json'),
  load('data/monsters.json'),
  load('data/zones.json'),
  load('data/events.json'),
  load('data/duos.json'),
  load('i18n/vi.json'),
  load('i18n/en.json'),
]);
const ctx = buildCtx({ config, characters, monsters, zones, events, duos });
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
    h(
      'div',
      { class: 'row' },
      btn(t('hub.collection'), () => showCollection(), '', { id: 'b-col' }),
      btn(t('hub.team'), () => showTeam(0), '', { id: 'b-team' }),
      btn(t('hub.glossary'), () => showGlossary(), '', { id: 'b-glos' }),
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
const chip = (id) => h('span', { class: 'chip', style: `background:${COLORS[ctx.characters[id].element]}` }, el(ctx.characters[id].element));
const stars = (id) => '★'.repeat(ctx.characters[id].rarity);
const owned = () => ctx.characterList.filter((c) => progress.characters[c.id]);

function charCard(id, onclick, extra) {
  const c = progress.characters[id];
  return h(
    'div',
    { class: 'card btn' + (c ? '' : ' locked'), 'data-char': id, onclick: c ? onclick : null },
    h('h3', {}, t(`char.${id}`), ' ', chip(id), ' ', h('small', {}, stars(id))),
    h('small', {}, c ? `${t('char.level', { n: c.level, max: ctx.config.progression.levelMax })} · ${t('char.awaken', { n: c.awaken })}` : '???'),
    extra,
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
    h('div', { class: 'row' }, team.map((id, i) => h('div', { class: 'card btn', style: `width:88px;padding:6px;${i === slot ? 'border-color:#ffd84a;' : ''}`, 'data-slot': i, onclick: () => showTeam(i) }, h('small', {}, i === 0 ? t('team.leader') : t('team.slot', { n: i + 1 })), h('div', {}, t(`char.${id}`)), chip(id)))),
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
document.title = t('game.title');
document.documentElement.lang = lang;
showHub();
