import { buildCtx, loadRaw } from './core/ctx.js';
import { createRun, runStep, newRunRecord, debugWinBattle } from './core/run.js';
import { stageOpen, clearsOf, zoneClears } from './core/stage.js';
import { applyRunResult } from './core/progress.js';
import { createStorage, browserAdapter } from './save/storage.js';
import { grantCharacter, expToMax, skillUp, skillUpCost, useCakes, feedFodder, sellFodder, fodderExp, awakenCost, awaken, setTeam, teamRoster, selectPreset, makeLeader, presetsOf, PRESET_COUNT, placeInSlot, clearTeam, autoTeam } from './core/upgrade.js';
import { statsFor, skillCooldown } from './core/stats.js';
import { KEYS } from './core/effects.js';
import { summon, redeemCharacter, effectiveRates } from './core/summon.js';
import { finishOnboarding, completeTutorial, storyUnlocked, updateProfile } from './core/onboarding.js';
import { newProgress } from './core/progress.js';
import { createT, detectLang } from './i18n/index.js';
import { startGame } from './ui/game.js';
import { preloadAssets, getImg } from './ui/assets.js';
import { createLoading } from './ui/loading.js';
import { createHeroUI, COLORS } from './ui/hero-ui.js';
import { resolveKit, maxSkillLevel, SKILL_KINDS } from './core/kit.js';
import * as offline from './ui/offline.js';
import { VERSION, BUILD, BUILD_DATE } from './version.js';
import { createFxLayer } from './ui/fxlayer.js';
import { createAudio } from './ui/audio.js';

const $ = (id) => document.getElementById(id);
let fxl = null;
const celebrate = () => (fxl ||= createFxLayer($('fx'))).celebrate();
const load = (f) => fetch(`js/${f}`).then((r) => r.json());
const [raw, audioCfg, vi, en] = await Promise.all([loadRaw(load), load('data/audio.json'), load('i18n/vi.json'), load('i18n/en.json')]);
const ctx = buildCtx(raw);
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
  $('info')?.remove();
  $('pause-btn')?.remove();
  $('screen').onpointerdown = null;
  atHub = false;
  audio.playMusic('hub');
  $('screen').style.backgroundImage = '';
  game?.destroy();
  game = null;
  const el = $('screen');
  const list = kids.flat().filter(Boolean);
  el.replaceChildren(...list);
  // Nút quay lại cố định góc trái trên: cùng hành động với nút "Quay lại" ở cuối trang.
  const bottom = el.querySelector('#back:not(.primary)');
  if (bottom) {
    const b = h('button', { class: 'back-top', id: 'back-top', 'aria-label': t('back'), onclick: () => bottom.click() });
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6L3 12l6 6"/><path d="M3 12h11a6 6 0 0 1 6 6v1"/></svg>';
    el.prepend(h('div', { class: 'back-wrap' }, b));
  }
  el.classList.remove('hub', 'mapscreen');
  el.classList.add('show');
  el.scrollTop = 0;
};
const save = () => {
  if (!storage.save(progress)) notice = 'hub.saveFail';
};
const fodderName = (key) => `${t('fodder.' + key.replace('_', '.'))} ${'★'.repeat(ctx.fodder[key].star)}`;
const offeringName = (key) => `${t('offering.' + key.replace('_', '.'))} ${'★'.repeat(Number(key.split('_')[1]))}`;
const offeringsLine = (o, race) => {
  const parts = Object.keys(o).filter((k) => k.startsWith(`${race}_`)).sort().map((k) => `${offeringName(k)} ×${o[k]}`);
  return parts.length ? parts.join(', ') : '—';
};
const lootLine = (l) => {
  const parts = [];
  if (l.gold) parts.push(`${t('res.gold')} ${l.gold >= 0 ? '+' : ''}${l.gold}`);
  if (l.essence) parts.push(`${t('res.essence')} +${l.essence}`);
  if (l.spirit) parts.push(`${t('res.spirit')} +${l.spirit}`);
  if (l.shards) parts.push(`${t('res.shard')} +${l.shards}`);
  for (const [k, n] of Object.entries(l.fodder || {})) parts.push(`${fodderName(k)} +${n}`);
  for (const [k, n] of Object.entries(l.offerings || {})) parts.push(`${offeringName(k)} +${n}`);
  if (l.stones?.normal) parts.push(`${t('res.stone')} ${t('stone.normal')} +${l.stones.normal}`);
  if (l.stones?.rare) parts.push(`${t('res.stone')} ${t('stone.rare')} +${l.stones.rare}`);
  return parts.length ? parts.join(' · ') : t('result.nothing');
};
const hpBar = () => [
  h('div', { class: 'muted' }, `${t('run.hp')}: ${Math.round(run.hp)} / ${run.maxHp}`),
  h('div', { class: 'hpbar' }, h('i', { style: `width:${Math.max(0, (run.hp / run.maxHp) * 100)}%` })),
];

// ---- Cupola (hub)
const ICONS = {
  collection: '<rect x="5" y="4" width="11" height="15" rx="2"/><path d="M9 21h8a2 2 0 0 0 2-2V8"/>',
  team: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.5 19c.5-3.2 2.7-5 5.5-5s5 1.8 5.5 5"/><path d="M15.5 14.2c2.6-.3 4.5 1.2 5 4.3"/>',
  glossary: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  summon: '<path d="M12 3l2.2 6.2L21 12l-6.8 2.8L12 21l-2.2-6.2L3 12l6.8-2.8z"/>',
  story: '<path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z"/><path d="M6 3v18"/><path d="M10 8h5M10 12h4"/>',
  items: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>',
  shop: '<path d="M4 9h16l-1.2-4.2a1 1 0 0 0-1-.8H6.2a1 1 0 0 0-1 .8z"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M10 20v-5h4v5"/>',
  quests: '<path d="M8 4h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M9.5 3h5v3h-5z"/><path d="M9 13l2 2 4-4.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5l1.6 2.3 2.8-.5.9 2.7 2.7.9-.5 2.8L21.8 12l-2.3 1.6.5 2.8-2.7.9-.9 2.7-2.8-.5L12 21.5l-1.6-2.3-2.8.5-.9-2.7-2.7-.9.5-2.8L2.2 12l2.3-1.6-.5-2.8 2.7-.9.9-2.7 2.8.5z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6.9c0 1.9-2.8 2.3-2.8 4"/><path d="M12 17.6v.2"/>',
  clues: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
};
function dockBtn(icon, label, onclick, id, cls = '') {
  const b = h('button', { onclick, id, class: cls, 'aria-label': label, title: label });
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>`;
  return b;
}
const CUR_COL = { gold: '#ffd24a', spirit: '#b58bff', essence: '#6bd5ff', shard: '#ff9acb' };
const curPill = (k, v, id) => h('button', { class: 'cur-pill', ...(id ? { id } : {}), onclick: () => showItems(), 'aria-label': t(`res.${k}`) }, h('i', { style: `background:${CUR_COL[k]}` }), h('b', {}, new Intl.NumberFormat(lang).format(v)));
const resPill = (label, value, id) => h('span', { class: 'res', ...(id ? { id } : {}) }, label, h('b', {}, String(value)));

// Cảnh chính: Tòa Tháp giữa các đảo nổi. Mỗi khu mở là một viên ngọc phát sáng trên đảo (chạm để vào khu).
function hubScene() {
  const zones = ctx.zoneList;
  const pos = [[62, 300], [92, 430], [60, 560], [338, 290], [310, 420], [340, 550]];
  const NS = 'http://www.w3.org/2000/svg';
  let tiers = '';
  for (let i = 0; i < 7; i++) {
    const y1 = 575 - i * 50;
    const y0 = y1 - 50;
    const w1 = 66 - i * 6;
    const w0 = 66 - (i + 1) * 6;
    tiers += `<path d="M${200 - w1} ${y1} L${200 - w0} ${y0} L${200 + w0} ${y0} L${200 + w1} ${y1}Z" fill="url(#tw)" stroke="#07081c" stroke-width="1.5"/>`;
    tiers += `<ellipse cx="200" cy="${y0}" rx="${w0 + 9}" ry="5" fill="#2a2f6a" stroke="#e2b75a" stroke-width="1.4"/>`;
    for (const dx of [-0.45, 0, 0.45]) tiers += `<rect x="${200 + dx * w0 - 3}" y="${y0 + 14}" width="6" height="14" rx="3" fill="#ffd98a" class="win" style="animation-delay:${(i * 0.37 + dx).toFixed(2)}s"/>`;
  }
  let isl = '';
  const orbs = zones.map((z, i) => {
    const [x, y] = pos[i % pos.length];
    const open = progress.unlocked.includes(z.id);
    const col = COLORS[z.element];
    isl += `<g class="isl" style="animation-delay:${(i * 0.7).toFixed(1)}s"><ellipse cx="${x}" cy="${y + 34}" rx="38" ry="9" fill="#3b4aa0"/><path d="M${x - 38} ${y + 34} Q${x} ${y + 92} ${x + 38} ${y + 34}Z" fill="url(#rk)"/><ellipse cx="${x}" cy="${y + 33}" rx="38" ry="8" fill="#4d62c9" opacity=".7"/></g>`;
    return `<g class="zorb${open ? ' open' : ''}" ${open ? `data-zone="${z.id}" role="button" tabindex="0" aria-label="${t(`zone.${z.id}`)}"` : ''} style="animation-delay:${(i * 0.7).toFixed(1)}s;--c:${col}"><circle cx="${x}" cy="${y}" r="${open ? 22 : 17}" fill="${col}" opacity="${open ? 0.28 : 0.1}" class="halo"/><circle cx="${x}" cy="${y}" r="${open ? 14 : 11}" fill="${open ? col : '#5b6090'}" stroke="#fff" stroke-opacity="${open ? 0.9 : 0.35}" stroke-width="2"/>${open ? `<circle cx="${x - 4}" cy="${y - 5}" r="4" fill="#fff" opacity=".7"/>` : `<path d="M${x - 4} ${y + 1}h8v6h-8zM${x - 2.5} ${y + 1}v-3a2.5 2.5 0 0 1 5 0v3" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>`}</g>`;
  }).join('');
  const cloud = (x, y, r, o) => `<g opacity="${o}"><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.3}"/><ellipse cx="${x - r * 0.5}" cy="${y + 4}" rx="${r * 0.6}" ry="${r * 0.22}"/><ellipse cx="${x + r * 0.55}" cy="${y + 3}" rx="${r * 0.65}" ry="${r * 0.24}"/></g>`;
  let stars = '';
  for (let i = 0; i < 46; i++) stars += `<circle cx="${(i * 137.5) % 400}" cy="${(i * 71.3) % 300}" r="${0.6 + (i % 3) * 0.5}" fill="#fff" opacity="${0.25 + (i % 5) * 0.12}"/>`;
  const svg = `<svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" xmlns="${NS}" aria-hidden="true">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070824"/><stop offset=".45" stop-color="#1b1a5a"/><stop offset=".75" stop-color="#3b2d86"/><stop offset="1" stop-color="#1f5a8f"/></linearGradient>
<linearGradient id="tw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#15183f"/><stop offset=".5" stop-color="#3a3f8f"/><stop offset="1" stop-color="#171a45"/></linearGradient>
<linearGradient id="rk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3680"/><stop offset="1" stop-color="#0d1038"/></linearGradient>
<linearGradient id="bm" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe9ad" stop-opacity=".75"/><stop offset="1" stop-color="#ffe9ad" stop-opacity="0"/></linearGradient>
<radialGradient id="gl" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
</defs>
<rect width="400" height="800" fill="url(#sky)"/>${stars}
<circle cx="200" cy="260" r="190" fill="url(#gl)" class="breathe"/>
<g fill="#aab6ff" opacity=".35" class="cl cl1">${cloud(80, 640, 110, 0.5)}${cloud(330, 610, 120, 0.45)}</g>
<rect x="188" y="-20" width="24" height="270" fill="url(#bm)" class="beam"/>
${isl}
<g class="isl main"><ellipse cx="200" cy="582" rx="108" ry="19" fill="#3b4aa0"/><path d="M92 582 Q200 700 308 582Z" fill="url(#rk)"/><ellipse cx="200" cy="580" rx="108" ry="16" fill="#5a70d8" opacity=".6"/></g>
${tiers}
<path d="M200 190 L226 238 L174 238Z" fill="#2a2f6a" stroke="#e2b75a" stroke-width="1.6"/>
<g class="crystal"><path d="M200 120 L214 156 L200 186 L186 156Z" fill="#ffe9ad" stroke="#fff" stroke-width="1.5"/><path d="M200 120 L200 186" stroke="#e2b75a" stroke-width="1"/></g>
<g fill="#cdd6ff" class="cl cl2">${cloud(60, 700, 130, 0.5)}${cloud(350, 690, 140, 0.42)}${cloud(200, 730, 160, 0.5)}</g>
${orbs}
</svg>`;
  const box = h('div', { class: 'hub-scene' + (DEBUG ? ' static' : '') });
  box.innerHTML = svg;
  box.querySelectorAll('[data-zone]').forEach((n) => {
    const go = () => showStages(n.getAttribute('data-zone'));
    n.addEventListener('click', go);
    n.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  });
  return box;
}

function showHub() {
  run = null;
  record = null;
  const inv = progress.inventory;
  screen(
    hubScene(),
    h(
      'div',
      { class: 'hub-top' },
      h('div', { class: 'avatar', id: 'b-profile', role: 'button', tabindex: '0', 'aria-label': t('profile.title'), style: `background:${COLORS[progress.player.avatar % 6]};cursor:pointer`, onclick: () => showProfile() }, (progress.player.name || '?')[0].toUpperCase()),
      h('div', { class: 'who', id: 'b-profile-name', style: 'cursor:pointer', onclick: () => showProfile() }, h('b', {}, progress.player.name), h('div', { class: 'muted' }, progress.player.callsign)),
      dockBtn('help', t('hub.help'), () => showGlossary(), 'b-help', 'help-btn'),
      dockBtn('settings', t('hub.settings'), () => showSettings(), 'b-set', 'help-btn'),
    ),
    h('div', { class: 'cur', id: 'cur' }, curPill('gold', inv.gold), curPill('spirit', inv.spirit, 'spirit'), curPill('essence', inv.essence)),
    notice ? h('div', { class: 'notice hub-notice' }, t(notice)) : null,
    installRow() ? h('div', { class: 'hub-install' }, installRow()) : null,
    activeRunInfo() ? resumeChip() : null,
    h('div', { class: 'hub-foot' }, h('div', { class: 'credit' }, h('b', {}, t('hub.credit')), h('span', {}, t('hub.version', { v: VERSION, b: BUILD, d: BUILD_DATE })))),
    h(
      'nav',
      { class: 'dock' },
      dockBtn('team', t('hub.team'), () => showTeam(), 'b-team'),
      dockBtn('summon', t('hub.summon'), () => showSummon('standard'), 'b-summon', 'sub'),
      h('button', { class: 'battle', id: 'b-battle', onclick: () => showZones(), 'aria-label': t('hub.battle') }, h('span', {}, t('hub.battle'))),
      dockBtn('shop', t('hub.shop'), () => showHubShop(), 'b-shop'),
      dockBtn('quests', t('hub.quests'), () => showQuests(), 'b-quest'),
    ),
  );
  $('screen').classList.add('hub');
  atHub = true;
  notice = null;
}

// Hồ sơ người chơi: đổi tên, mã hiệu, quê hương, ngoại hình; xem thống kê.
let profDraft = null;
function showProfile(msg) {
  const o = ctx.config.onboarding;
  if (!profDraft) profDraft = { ...progress.player };
  const d = profDraft;
  const st = progress.stats;
  const clears = Object.keys(progress.clears).reduce((a, z) => a + zoneClears(progress, z), 0);
  const stat = (label, v) => h('div', { class: 'card item-row' }, h('span', {}, label), h('b', {}, new Intl.NumberFormat(lang).format(v)));
  const av = Array.from({ length: o.avatars }, (_, i) => h('div', { class: 'avatar' + (d.avatar === i ? ' sel' : ''), 'data-avatar': i, style: `background:${COLORS[i % 6]}`, onclick: () => { d.avatar = i; showProfile(); } }, (d.name || '?')[0].toUpperCase()));
  const save1 = () => {
    const r = updateProfile(ctx, progress, d);
    if (!r.ok) return showProfile(t(`ob.bad.${r.reason}`, { max: r.reason === 'bad_callsign' ? o.callsignMax : o.nameMax }) );
    progress = r.progress;
    save();
    profDraft = null;
    audio.sfx('rare');
    showProfile(t('profile.saved'));
  };
  const keep = (e, k) => { d[k] = e.target.value; };
  const dirty = d.name !== progress.player.name || d.callsign !== progress.player.callsign || (d.hometown || '') !== (progress.player.hometown || '') || d.avatar !== progress.player.avatar;
  screen(
    h('h2', {}, t('profile.title')),
    h('div', { class: 'prof-head' }, h('div', { class: 'avatar big', style: `background:${COLORS[d.avatar % 6]}` }, (d.name || '?')[0].toUpperCase())),
    msg ? h('div', { class: 'notice' }, msg) : null,
    h('div', { class: 'row' }, av),
    h('label', {}, t('ob.name'), h('input', { id: 'pf-name', maxlength: String(o.nameMax), value: d.name, oninput: (e) => keep(e, 'name') })),
    h('label', {}, t('ob.callsign'), h('input', { id: 'pf-callsign', maxlength: String(o.callsignMax), value: d.callsign, oninput: (e) => keep(e, 'callsign') })),
    h('label', {}, t('ob.hometown'), h('input', { id: 'pf-hometown', maxlength: String(o.hometownMax), value: d.hometown || '', oninput: (e) => keep(e, 'hometown') })),
    d.culture ? h('div', { class: 'muted' }, `${t('profile.token')}: ${t(`ob.token.${d.culture}`)}`) : null,
    btn(t('profile.save'), save1, 'primary', { id: 'pf-save' }),
    h('h3', {}, t('profile.stats')),
    stat(t('profile.runs'), st.runs),
    stat(t('profile.wins'), st.wins),
    stat(t('profile.clears'), clears),
    stat(t('profile.owned'), Object.keys(progress.characters).length),
    stat(t('profile.pulls'), progress.summon.pulls),
    btn(t('back'), () => { profDraft = null; showHub(); }, '', { id: 'back' }),
  );
  void dirty;
}

function resumeChip() {
  const r = activeRunInfo().run;
  return h('button', { class: 'resume', id: 'b-resume', onclick: resumeRun }, h('span', { class: 'rs-t' }, t('run.resume')), h('small', {}, `${stageLabel(r)} · ${t('run.floor', { n: r.floor + 1, total: r.floors })}`));
}

// Chọn khu vực (từ nút CHIẾN ĐẤU).
const stageLabel = (r) => `${t(`zone.${r.zoneId}`)} · ${t(`diff.${r.diff}`)}`;

// Chọn độ khó của một khu: Dễ -> Vừa -> Khó, mở lần lượt. Khó hơn thì rớt ngon hơn.
function showStages(zoneId) {
  const order = ctx.config.difficulty.order;
  const cards = order.map((d, i) => {
    const open = stageOpen(ctx, progress, zoneId, d);
    const df = ctx.config.difficulty[d];
    return h(
      'div',
      { class: 'card btn gate stage' + (open ? '' : ' locked'), 'data-stage': d, onclick: open ? () => showTeam(undefined, undefined, { zoneId, diff: d }) : null },
      h('div', { class: 'info' }, h('div', { class: 'name' }, t(`diff.${d}`)), h('small', {}, open ? t('zone.clears', { n: clearsOf(progress, zoneId, d) }) : t('diff.locked', { prev: t(`diff.${order[i - 1]}`) })), h('div', { class: 'muted' }, t('diff.reward', { gold: df.gold, drop: df.drop }))),
    );
  });
  screen(h('h2', {}, t(`zone.${zoneId}`)), ...cards, btn(t('back'), showZones, '', { id: 'back' }));
}

function showZones() {
  const inv = progress.inventory;
  const zoneCards = ctx.zoneList.map((z) => {
    const open = progress.unlocked.includes(z.id);
    const st = inv.stones[z.element];
    return h(
      'div',
      { class: 'card btn gate' + (open ? '' : ' locked'), 'data-zone-card': z.id, style: `--el:${COLORS[z.element]}`, onclick: open ? () => showStages(z.id) : null },
      getImg(`orb:${z.element}`) ? h('img', { src: getImg(`orb:${z.element}`).src, alt: '' }) : null,
      h(
        'div',
        { class: 'info' },
        h('div', { class: 'name' }, t(`zone.${z.id}`)),
        h('small', {}, open ? t('zone.clears', { n: zoneClears(progress, z.id) }) : t('zone.locked')),
        open ? h('div', { class: 'muted' }, `${t('stone.normal')}: ${st.normal} · ${t('stone.rare')}: ${st.rare}`) : null,
      ),
    );
  });
  const act0 = activeRunInfo();
  screen(
    h('h2', {}, t('hub.zones')),
    act0 ? h('div', { class: 'card' }, h('b', {}, t('run.resume')), h('div', { class: 'muted' }, `${stageLabel(act0.run)} · ${t('run.floor', { n: act0.run.floor + 1, total: act0.run.floors })}`), h('div', { class: 'row' }, btn(t('run.resume'), resumeRun, 'primary', { id: 'zones-resume' }), btn(t('run.abandon'), () => { clearActiveRun(); showZones(); }, '', { id: 'zones-abandon' }))) : null,
    zoneCards,
    h('details', {}, h('summary', {}, t('hub.debug')), h('label', {}, t('hub.seed'), h('input', { id: 'seed', inputmode: 'numeric', value: seedText, oninput: (e) => (seedText = e.target.value) })), h('p', { class: 'muted' }, t('hub.progress'))),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
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
const heroUI = createHeroUI({ h, T: (...args) => t(...args), ctx });
const { el, stars, chip, unitText, leaderText, keysOf, keywordBlock, portrait } = heroUI;
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
    list.map((c) => charCard(c.id, () => showChar(c.id, undefined, showCollection))),
    btn(t('back'), () => showTeam(), '', { id: 'back' }),
  );
}

let charBack = null;
// Nhấn giữ (450ms) gọi fn; nhấc tay sau khi đã kích hoạt thì nuốt cú click.
function longPress(node, fn, ms = 450) {
  let timer = 0;
  let fired = false;
  let x0 = 0;
  let y0 = 0;
  const cancel = () => clearTimeout(timer);
  node.addEventListener('pointerdown', (e) => {
    fired = false;
    x0 = e.clientX;
    y0 = e.clientY;
    cancel();
    timer = setTimeout(() => {
      fired = true;
      audio.vibrate(15);
      fn();
    }, ms);
  });
  node.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) node.addEventListener(ev, cancel);
  node.addEventListener('click', (e) => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
  return node;
}

function showChar(id, msg, back) {
  if (back) charBack = back;
  const goBack = charBack || showCollection;
  const c = ctx.characters[id];
  const pc = progress.characters[id];
  const st = statsFor(ctx, id, pc.level, pc.awaken);
  const aw = awakenCost(ctx, id, pc.awaken + 1);
  const inv = progress.inventory;
  const kit = resolveKit(ctx, id, pc.skillLv);
  const keys = [...new Set([...keysOf(kit.skill.units), ...(kit.passive?.units ? keysOf(kit.passive.units) : []), ...ctx.duoList.filter((d) => d.a === id || d.b === id).flatMap((d) => keysOf(d.skill.units))])];
  // Thực hiện một hành động nâng cấp (hàm thuần trả {ok, progress}), lưu, vẽ lại với thông báo.
  const act = (fn, okMsg) => {
    const r = fn();
    if (r.ok) {
      progress = r.progress;
      save();
      showChar(id, okMsg ? okMsg(r) : undefined);
    } else showChar(id, t(`err.${r.reason}`));
  };
  const need = expToMax(ctx, id, pc);
  const gained = (r) => t('char.gained', { n: r.gained ?? r.used }) + (r.levels ? ` · ${t('char.levelsUp', { n: r.levels })}` : '');
  const fodderKeys = Object.keys(inv.fodder).sort();
  const grow = h(
    'div',
    { class: 'hp-grow' },
    h('b', {}, t('char.grow')),
    need <= 0
      ? h('div', { class: 'muted' }, t('char.maxLevel'))
      : [
          h('div', { class: 'muted' }, `${t('char.cakes')}: ${inv.essence}`),
          h('div', { class: 'row' }, [100, 1000].map((n) => btn(t('char.useCakes', { n }), () => act(() => useCakes(ctx, progress, id, n), gained), '', { 'data-cakes': n })), btn(t('char.useCakesMax'), () => act(() => useCakes(ctx, progress, id, 1e9), gained), '', { id: 'cakes-max' })),
          fodderKeys.length
            ? fodderKeys.map((k) => {
                const f = ctx.fodder[k];
                return h('div', { class: 'fodder-row', 'data-fodder': k }, h('span', {}, `${t(`fodder.${f.element}.${f.star}`)} ${'★'.repeat(f.star)} ×${inv.fodder[k]} `, h('small', { class: 'muted' }, t('char.fodderEach', { n: fodderExp(ctx, id, k) }))), btn(t('char.feed'), () => act(() => feedFodder(ctx, progress, id, k, 1), gained)), btn(t('char.feedAll'), () => act(() => feedFodder(ctx, progress, id, k, 999), gained)));
              })
            : h('div', { class: 'muted' }, t('char.noFodder')),
        ],
  );
  const skills = h(
    'div',
    { class: 'hp-grow' },
    h('b', {}, t('char.skillUp')),
    h('div', { class: 'muted' }, `${t('items.offerings')}: ${offeringsLine(inv.offerings, c.race)}`),
    SKILL_KINDS.map((kind) => {
      const lv = pc.skillLv[kind];
      const cost = skillUpCost(ctx, id, kind, lv);
      return h(
        'div',
        { class: 'skillup-row', 'data-skillup': kind },
        h('span', {}, `${t(`char.tag.${kind}`)} · ${t('skill.lv', { n: lv, max: maxSkillLevel(ctx, id) })}`, cost ? h('small', { class: 'muted' }, ` ${t('skill.upCost', { count: cost.count, name: offeringName(cost.offering), gold: cost.gold })}`) : null),
        cost ? btn(t('skill.upBtn'), () => act(() => skillUp(ctx, progress, id, kind), () => t('skill.upDone')), '', { id: `skillup-${kind}` }) : h('small', { class: 'muted' }, t('skill.lvMax')),
      );
    }),
  );
  screen(
    heroUI.header(id),
    msg ? h('div', { class: 'notice' }, msg) : null,
    heroUI.statGrid(st, id),
    heroUI.levelBar(id, pc),
    heroUI.activeBox(id, { cooldown: skillCooldown(ctx, id, pc.awaken, pc.skillLv), skillLv: pc.skillLv }),
    heroUI.leaderBox(id, pc.skillLv),
    heroUI.passiveBox(id, pc.skillLv),
    heroUI.duoBox(id),
    keys.length ? h('div', { class: 'card' }, keywordBlock(keys)) : null,
    grow,
    skills,
    h('div', { class: 'hp-grow' }, h('div', { class: 'muted' }, t('char.awaken', { n: pc.awaken })), aw
      ? [h('div', { class: 'muted' }, t('char.awakenCost', { shards: aw.shards, stones: aw.stones, kind: t(`stone.${aw.stone}`), element: el(aw.element), gold: aw.gold })), btn(t('char.awakenBtn'), () => act(() => awaken(ctx, progress, id)), '', { id: 'awaken' })]
      : h('div', { class: 'muted' }, t('char.maxAwaken'))),
    h('div', { class: 'muted' }, `${t('res.shard')} ${inv.shards} · ${t('res.gold')} ${inv.gold} · ${t('res.stone')} ${el(c.element)}: ${inv.stones[c.element].normal}/${inv.stones[c.element].rare}`),
    btn(t('back'), goBack, '', { id: 'back' }),
  );
}

// Ô nhân vật vuông kiểu thẻ: viền độ hiếm, chấm hệ, sao, cấp. `slotNo` = đang ở ô số mấy trong đội.
function tile(id, slotNo) {
  const def = ctx.characters[id];
  const c = progress.characters[id];
  return h(
    'div',
    { class: 'tile' + (slotNo ? ' in' : ''), 'data-char': id },
    portrait(id, 66),
    h('i', { class: 'tdot', style: `background:${COLORS[def.element]}` }),
    slotNo ? h('b', { class: 'tslot' }, String(slotNo)) : null,
    h('span', { class: 'tlv' }, `${c.level}`),
    h('span', { class: 'tst' }, '★'.repeat(def.rarity)),
  );
}

// Màn đội hình: dùng cả ở menu (Đội hình) lẫn trước khi vào trận (stage = { zoneId, diff } có giá trị).
function showTeam(slot, msg, stage) {
  const team = progress.team;
  if (slot === undefined || slot === null) slot = Math.max(0, team.indexOf(null));
  const members = team.filter((id) => id !== null);
  const duos = [];
  for (let i = 0; i + 1 < members.length; i++) {
    const d = ctx.duoByPair[`${members[i]}|${members[i + 1]}`];
    if (d) duos.push(d);
  }
  const apply = (r) => {
    if (r.ok) {
      progress = r.progress;
      save();
    }
    return r.ok;
  };
  const again = (sl) => showTeam(sl, undefined, stage);
  const pick = (id) => {
    const wasEmpty = team[slot] === null;
    if (!apply(placeInSlot(progress, slot, id))) return again(slot);
    // lấp ô trống xong thì nhảy sang ô trống kế tiếp để chọn liền tay
    const nxt = wasEmpty ? progress.team.findIndex((x, i) => x === null && i > slot) : -1;
    again(nxt >= 0 ? nxt : slot);
  };
  const cur = progress.preset ?? 0;
  const tabs = h('div', { class: 'row' }, presetsOf(progress).map((_, i) => h('button', { class: 'btn' + (i === cur ? ' primary' : ''), 'data-preset': i, onclick: () => { apply(selectPreset(progress, i)); showTeam(undefined, undefined, stage); } }, t('team.preset', { n: i + 1 }))));
  const slots = h('div', { class: 'slots' }, team.map((id, i) => {
    const lead = i === 0;
    const sel = i === slot;
    const cls = 'slot' + (lead ? ' lead' : '') + (sel ? ' slot-sel' : '') + (id ? '' : ' empty');
    const body = id ? [h('small', { class: 'sname' }, lead ? '♛' : String(i + 1)), portrait(id, 60), h('small', { class: 'sn' }, t(`char.${id}`))] : [h('small', { class: 'sname' }, lead ? '♛' : String(i + 1)), h('div', { class: 'plus' }, '+'), h('small', { class: 'sn' }, lead ? t('team.leader') : t('team.empty'))];
    const node = h('div', { class: cls, 'data-slot': i, onclick: () => again(i) }, ...body);
    return id ? longPress(node, () => showChar(id, undefined, () => again(i))) : node;
  }));
  const needLeader = team[0] === null;
  const sorted = owned().slice().sort((a, b) => b.rarity - a.rarity || a.element - b.element || progress.characters[b.id].level - progress.characters[a.id].level || (a.id < b.id ? -1 : 1));
  screen(
    h('h2', {}, stage ? t('team.prep', { zone: `${t(`zone.${stage.zoneId}`)} · ${t(`diff.${stage.diff}`)}` }) : t('hub.team')),
    tabs,
    slots,
    h(
      'div',
      { class: 'row tools' },
      btn(t('team.auto'), () => { apply(autoTeam(ctx, progress)); again(0); }, '', { id: 'team-auto' }),
      btn(t('team.remove'), () => { apply(placeInSlot(progress, slot, null)); again(slot); }, '', { id: 'team-remove', ...(team[slot] === null ? { disabled: '' } : {}) }),
      btn(t('team.clear'), () => { apply(clearTeam(progress)); again(0); }, '', { id: 'team-clear', ...(members.length ? {} : { disabled: '' }) }),
      slot > 0 && team[slot] ? btn(t('team.makeLeader', { name: t(`char.${team[slot]}`) }), () => { apply(makeLeader(progress, slot)); again(0); }, '', { id: 'make-leader' }) : null,
    ),
    members.length ? h('div', { class: 'muted' }, `${t('char.leader')}: ${leaderText(resolveKit(ctx, members[0], progress.characters[members[0]].skillLv).leader)}`) : null,
    h('div', { class: 'muted' }, members.length < 2 ? t('team.noDuo') : duos.length ? `${t('team.duoActive')}: ${duos.map((d) => t(`duo.${d.id}`)).join(', ')}` : t('team.noDuo')),
    stage ? [needLeader || !members.length ? h('div', { class: 'notice' }, t(members.length ? 'team.needLeader' : 'team.needAny')) : null, btn(t('team.go'), () => (activeRunInfo() ? askAbandon(stage) : startRun(stage)), 'primary', { id: 'team-go', ...(needLeader ? { disabled: '' } : {}) })] : null,
    h('p', { class: 'muted' }, t('team.holdHint')),
    h('div', { class: 'roster' }, sorted.map((c) => longPress(Object.assign(tile(c.id, team.indexOf(c.id) + 1 || 0), { onclick: () => pick(c.id) }), () => showChar(c.id, undefined, () => again(slot))))),
    btn(`${t('hub.collection')} ${owned().length}/${ctx.characterList.length}`, () => showCollection(), '', { id: 'team-col' }),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
}

// Kho: toàn bộ tài nguyên đang có.
function showItems() {
  const inv = progress.inventory;
  const row = (label, value, col) => h('div', { class: 'card item-row' }, h('i', { style: `background:${col}` }), h('span', {}, label), h('b', {}, typeof value === 'number' ? new Intl.NumberFormat(lang).format(value) : value));
  screen(
    h('h2', {}, t('hub.items')),
    h('h3', {}, t('items.currency')),
    row(t('res.gold'), inv.gold, CUR_COL.gold),
    row(t('res.spirit'), inv.spirit, CUR_COL.spirit),
    row(t('res.essence'), inv.essence, CUR_COL.essence),
    row(t('res.shard'), inv.shards, CUR_COL.shard),
    h('h3', {}, t('items.fodder')),
    Object.keys(inv.fodder).length
      ? Object.keys(inv.fodder).sort().map((k) => {
          const sell = (n) => {
            const r = sellFodder(ctx, progress, k, n);
            if (r.ok) { progress = r.progress; save(); showItems(); }
          };
          return h('div', { class: 'card fodder-row', 'data-fodder': k }, h('span', {}, `${fodderName(k)} ×${inv.fodder[k]} `, h('small', { class: 'muted' }, `${ctx.fodder[k].sell} ${t('res.gold')}`)), btn(t('fodder.sell'), () => sell(1)), btn(t('fodder.sellAll'), () => sell(999)));
        })
      : h('div', { class: 'muted' }, t('char.noFodder')),
    h('h3', {}, t('items.offerings')),
    Object.keys(inv.offerings).length ? Object.keys(inv.offerings).sort().map((k) => row(offeringName(k), inv.offerings[k], COLORS[4])) : h('div', { class: 'muted' }, t('items.noOfferings')),
    h('h3', {}, t('items.stones')),
    [0, 1, 2, 3, 4, 5].map((e) => row(`${el(e)} · ${t('stone.normal')} / ${t('stone.rare')}`, `${inv.stones[e].normal} / ${inv.stones[e].rare}`, COLORS[e])),
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

// Cửa hàng và Nhiệm vụ: khung chờ, chưa có nội dung (gói ủng hộ ở M6; nhiệm vụ làm sau).
function showHubShop() {
  screen(
    h('h2', {}, t('hub.shop')),
    h('div', { class: 'card soon' }, h('b', {}, t('soon.title')), h('p', { class: 'muted' }, t('shop.soon'))),
    btn(t('hub.items'), showItems, '', { id: 'shop-items' }),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
}
function showQuests() {
  screen(
    h('h2', {}, t('hub.quests')),
    h('div', { class: 'row' }, h('button', { class: 'primary', disabled: '' }, t('quest.daily')), h('button', { disabled: '' }, t('quest.achv'))),
    h('div', { class: 'card soon' }, h('b', {}, t('soon.title')), h('p', { class: 'muted' }, t('quest.soon'))),
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
    btn(t('back'), showSettings, '', { id: 'back' }),
  );
}

// Khối "Dữ liệu offline" trong Cài đặt: trạng thái, tải/cập nhật, xóa.
function offlineSection() {
  const box = h('div', { class: 'card offline', id: 'offline' }, h('b', {}, t('offline.title')));
  if (!offline.offlineSupported()) {
    box.append(h('p', { class: 'muted' }, t('offline.unsupported')));
    return box;
  }
  const status = h('p', { class: 'muted', id: 'off-status' }, '…');
  const bar = h('i', { id: 'off-bar', style: 'width:0%' });
  const track = h('div', { class: 'hpbar', hidden: '' }, bar);
  const go = btn(t('offline.download'), async () => {
    go.disabled = true;
    track.hidden = false;
    try {
      await offline.downloadOffline((d, n) => {
        bar.style.width = `${(d / n) * 100}%`;
        status.textContent = t('offline.progress', { done: d, total: n });
      });
      refresh(t('offline.done'));
    } catch {
      refresh(t('offline.fail'));
    }
    track.hidden = true;
    go.disabled = false;
  }, '', { id: 'off-go' });
  const clear = btn(t('offline.clear'), async () => {
    await offline.clearOffline();
    refresh(t('offline.cleared'));
  }, '', { id: 'off-clear' });
  async function refresh(msg) {
    try {
      const st = await offline.offlineStatus();
      const size = offline.formatMB(st.bytes);
      const full = st.have === st.total;
      status.textContent = msg ?? (full ? t('offline.full', { size }) : st.have ? t('offline.status', { have: st.have, total: st.total, size }) : t('offline.none'));
      go.textContent = t(st.have ? 'offline.update' : 'offline.download');
      clear.hidden = !st.have;
    } catch {
      status.textContent = t('offline.fail');
    }
  }
  box.append(h('p', { class: 'muted' }, t('offline.note')), status, track, go, clear);
  refresh();
  return box;
}

// Âm lượng + bật/tắt nhạc, hiệu ứng, rung: dùng chung cho Cài đặt và bảng Tạm dừng.
function audioControls() {
  return [
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
  ];
}

function showSettings(msg = null, confirmDelete = false) {
  const exportBox = h('textarea', { readonly: '', id: 'export-box' });
  const importBox = h('textarea', { placeholder: '…', id: 'import-box' });
  screen(
    h('h2', {}, t('set.title')),
    msg ? h('div', { class: 'notice' }, msg) : null,
    btn(t('story.title'), showStory, '', { id: 'set-story' }),
    h('label', {}, t('hub.lang'), h('select', { id: 'lang', onchange: (e) => setLang(e.target.value) }, h('option', { value: 'vi' }, 'Tiếng Việt'), h('option', { value: 'en' }, 'English'))),
    ...audioControls(),
    h('p', { class: 'muted' }, t('set.volumeNote')),
    offlineSection(),
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

// Lưu chuyến leo đang dở (tại màn chọn cửa) để thoát ra rồi vào chơi tiếp.
function saveActiveRun() {
  if (!run || run.phase !== 'doors') return;
  progress.activeRun = { run: structuredClone(run), record: structuredClone(record), path: runPath.slice() };
  save();
}
function clearActiveRun() {
  if (progress.activeRun) {
    delete progress.activeRun;
    save();
  }
}
function activeRunInfo() {
  const a = progress.activeRun;
  if (!a?.run || !ctx.zones[a.run.zoneId] || a.run.phase !== 'doors') return null;
  return a;
}
function askAbandon(stage) {
  screen(
    h('h2', {}, t('run.resume')),
    confirmBox(t('run.abandonAsk'), () => startRun(stage), () => showTeam(undefined, undefined, stage), t('run.abandon')),
    btn(t('run.resume'), resumeRun, '', { id: 'ask-resume' }),
  );
}
function resumeRun() {
  const a = activeRunInfo();
  if (!a) return showHub();
  run = a.run;
  record = a.record;
  runPath = a.path || [];
  savedThisRun = false;
  render();
}
function leaveRun() {
  saveActiveRun();
  audio.sfx('back');
  notice = 'run.saved';
  showHub();
}

function startRun({ zoneId, diff }) {
  const seed = pickSeed();
  const pity = !!progress.pity[zoneId];
  const team = teamRoster(progress);
  run = createRun(ctx, { seed, zoneId, team, pityMissed: pity, diff });
  record = newRunRecord(seed, zoneId, team, pity, diff);
  runPath = [];
  savedThisRun = false;
  delete progress.activeRun;
  render();
}

let doorsSnap = null; // trạng thái ngay trước khi chọn cửa: thoát giữa trận thì quay về đây
let runPath = []; // các cửa đã đi: { floor, doors, pick } — chỉ để vẽ bản đồ
function act(action) {
  if (action.type === 'door' && run.phase === 'doors') doorsSnap = { run: structuredClone(run), record: structuredClone(record), path: runPath.slice() };
  const r = runStep(ctx, run, action);
  if (r.events[0]?.type === 'invalid') return;
  if (action.type === 'door' && run.phase === 'doors') runPath.push({ floor: run.floor, doors: run.doors.slice(), pick: action.index });
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
  if (run.phase === 'relic') return showRelicPick();
  return showEnd();
}

const floorTitle = () => h('h2', {}, `${stageLabel(run)} · ${t('run.floor', { n: run.floor + 1, total: run.floors })}`);

// ---- Bản đồ leo tháp (kiểu đường đi Slay the Spire): đáy là cổng vào, đỉnh là trùm; mỗi tầng chọn một trong các cửa.
const NODE = {
  normal: { col: '#6f86ff', ring: '#c9d3ff', icon: '<path d="M6 18L17 7M7 7l11 11M5 19l2.5-.5M19 19l-2.5-.5M5 5l.5 2.5M19 5l-.5 2.5"/>' },
  elite: { col: '#ff7a3c', ring: '#ffd0b0', icon: '<path d="M6 10c0-4 3-6 6-6s6 2 6 6v3l-2 2v3H8v-3l-2-2zM9 11h2M13 11h2M10 18v2M14 18v2"/>' },
  boss: { col: '#ff4b5c', ring: '#ffe0b0', icon: '<path d="M4 18l1.5-9 4 4 2.5-7 2.5 7 4-4 1.5 9zM4 21h16"/>' },
  swarm: { col: '#8fb3ff', ring: '#dbe6ff', icon: '<path d="M12 5a3 3 0 1 0 0 .1M5.500 14a3 3 0 1 0 0 .1M18.500 14a3 3 0 1 0 0 .1M8 20h8M3 20h2M19 20h2"/>' },
  shrine: { col: '#ff8fd0', ring: '#ffd6ee', icon: '<path d="M12 3l5 6-5 12-5-12zM7 9h10M12 3v18"/>' },
  chest: { col: '#ffc83a', ring: '#fff1b8', icon: '<path d="M4 11h16v8H4zM4 11a8 6 0 0 1 16 0M12 11v3M10.5 14h3"/>' },
  rest: { col: '#4ed08a', ring: '#c9ffe0', icon: '<path d="M12 4c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.500 2-4.500 0 1.500 1 2 1.500 2C10.500 8 11 6 12 4zM9 21h6"/>' },
  event: { col: '#b07cff', ring: '#e6d4ff', icon: '<path d="M9 9a3 3 0 1 1 4.500 2.600C12.500 12.200 12 13 12 14.500M12 18v.5"/>' },
  shop: { col: '#3cc7c0', ring: '#c8fffb', icon: '<path d="M6 9h12l1 11H5zM9 9V7a3 3 0 0 1 6 0v2M12 12v5M10.500 14h3"/>' },
};
const ITEM_ICON = {
  potion: '<path d="M9 3h6M10 3v5l-4 9a3 3 0 0 0 2.800 4h6.400a3 3 0 0 0 2.800-4l-4-9V3M8 15h8"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  time: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
};

function runMapSVG() {
  const n = run.floors;
  const top = 118;
  const bottom = 468;
  const step = n > 1 ? (bottom - top) / (n - 1) : 0;
  const rowY = (r) => bottom - r * step;
  const xs = (r, count) => (count === 1 ? [200] : count === 2 ? [118, 282] : [78 + Math.sin(r * 2.1) * 10, 200 + Math.cos(r * 1.7) * 10, 322 + Math.sin(r * 1.3) * 10]);
  // Tầng chưa tới: Elite/Boss đã biết trước (bố cục cố định), còn lại là '?'.
  const future = (r) => {
    const slot = ctx.config.run.layout[r];
    const pool = ctx.config.run.pools[slot.pool];
    const combat = Object.keys(pool).every((k) => ['normal', 'swarm', 'elite', 'boss'].includes(k));
    return Array(slot.doors).fill(slot.pool === 'elite' || slot.pool === 'boss' ? slot.pool : combat ? 'f?' : '?'); // tầng đánh hiện ⚔ mờ, tầng sự kiện hiện ?
  };
  const rows = [];
  for (let r = 0; r < n; r++) {
    const past = runPath.find((e) => e.floor === r);
    const kinds = past ? past.doors : r === run.floor ? run.doors : future(r);
    rows.push({ r, y: rowY(r), kinds, xs: xs(r, kinds.length), pick: past ? past.pick : null, cur: r === run.floor && run.phase === 'doors', past: !!past });
  }
  const start = { x: 200, y: 548 };
  const pos = (row, i) => [row.xs[i], row.y];
  let faint = '';
  let gold = '';
  const link = (a, b, cls) => `<path d="M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2 + (a[0] < b[0] ? -12 : 12)} ${(a[1] + b[1]) / 2} ${b[0]} ${b[1]}" class="${cls}"/>`;
  // nối mờ giữa các tầng liền kề
  const prevPts = (r) => (r === 0 ? [[start.x, start.y]] : rows[r - 1].xs.map((x) => [x, rows[r - 1].y]));
  for (const row of rows) for (let i = 0; i < row.xs.length; i++) for (const q of prevPts(row.r)) faint += link(q, pos(row, i), 'lk');
  // đường đã đi
  let last = [start.x, start.y];
  for (const row of rows) {
    if (!row.past) break;
    const to = pos(row, row.pick);
    gold += link(last, to, 'lk done');
    last = to;
  }
  // đường tới các cửa đang chọn (sáng nhẹ)
  const curRow = rows.find((x) => x.cur);
  if (curRow) curRow.xs.forEach((x, i) => (gold += link(last, [x, curRow.y], 'lk now')));
  let nodes = `<g class="nd start"><circle cx="${start.x}" cy="${start.y}" r="15" fill="#15183f" stroke="#e2b75a" stroke-width="2"/><path d="M${start.x - 6} ${start.y + 7}v-8a6 6 0 0 1 12 0v8z" fill="none" stroke="#e2b75a" stroke-width="1.8"/></g>`;
  const label = (x, y, k, strong) => `<text x="${x}" y="${y}" text-anchor="middle" class="nl${strong ? ' strong' : ''}">${k === '?' || k === 'f?' ? '' : t(`door.${k}`)}</text>`;
  for (const row of rows) {
    row.kinds.forEach((k, i) => {
      const [x, y] = pos(row, i);
      const big = k === 'boss' || (row.r === n - 1);
      const rad = big ? 30 : 23;
      if (k === '?' || k === 'f?') {
        nodes += `<g class="nd ghost"><circle cx="${x}" cy="${y}" r="${rad - 3}" fill="#101338" stroke="#4a5090" stroke-width="1.6" stroke-dasharray="3 4"/>${k === 'f?' ? `<g transform="translate(${x - 9} ${y - 9}) scale(.75)" fill="none" stroke="#7d86d0" stroke-width="2" stroke-linecap="round">${NODE.normal.icon}</g>` : `<text x="${x}" y="${y + 6}" text-anchor="middle" class="q">?</text>`}</g>`;
        return;
      }
      const d = NODE[k];
      const taken = row.past && row.pick === i;
      const skipped = row.past && row.pick !== i;
      const cls = 'nd' + (row.cur ? ' cur' : '') + (taken ? ' taken' : '') + (skipped ? ' skipped' : '') + (big ? ' big' : '');
      const attr = row.cur ? ` data-door="${i}" role="button" tabindex="0" aria-label="${t(`door.${k}`)}"` : '';
      nodes += `<g class="${cls}"${attr} style="--c:${d.col}">${row.cur ? `<circle class="pulse" cx="${x}" cy="${y}" r="${rad + 8}" fill="${d.col}"/>` : ''}<circle cx="${x}" cy="${y}" r="${rad}" fill="#0c0f33" stroke="${taken || row.cur ? d.ring : d.col}" stroke-width="${row.cur ? 3 : 2}"/><circle cx="${x}" cy="${y}" r="${rad - 5}" fill="${d.col}" opacity="${skipped ? 0.1 : taken ? 0.55 : 0.3}"/><g transform="translate(${x - 12 * (rad / 23)} ${y - 12 * (rad / 23)}) scale(${rad / 23})" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="${skipped ? 0.35 : 1}">${d.icon}</g>${row.cur || big ? label(x, y + rad + 17, k, row.cur) : ''}</g>`;
    });
  }
  if (curRow || true) {
    // dấu vị trí đội: viên ngọc phát sáng ở điểm vừa đi tới
    nodes += `<g class="you"><circle cx="${last[0] + 26}" cy="${last[1] - 4}" r="6" fill="#ffe9ad"/><circle cx="${last[0] + 26}" cy="${last[1] - 4}" r="11" fill="#ffe9ad" opacity=".25"/></g>`;
  }
  let stars = '';
  for (let i = 0; i < 40; i++) stars += `<circle cx="${(i * 97.3) % 400}" cy="${(i * 53.7) % 600}" r="${0.6 + (i % 3) * 0.4}" fill="#fff" opacity="${0.15 + (i % 4) * 0.1}"/>`;
  let cols = '';
  for (const x of [26, 374]) cols += `<g opacity=".5"><rect x="${x - 14}" y="40" width="28" height="560" fill="url(#col)"/>${[110, 230, 350, 470].map((y) => `<rect x="${x - 18}" y="${y}" width="36" height="8" fill="#2a2f6a" stroke="#e2b75a" stroke-opacity=".5"/>`).join('')}</g>`;
  return `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid meet" aria-hidden="false">
<defs><linearGradient id="col" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a0c2b"/><stop offset=".5" stop-color="#23286a"/><stop offset="1" stop-color="#0a0c2b"/></linearGradient>
<radialGradient id="rg" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#3a3f9a" stop-opacity=".55"/><stop offset="1" stop-color="#3a3f9a" stop-opacity="0"/></radialGradient></defs>
<rect width="400" height="600" fill="url(#rg)"/>${stars}${cols}${faint}${gold}${nodes}</svg>`;
}

// ---- Di Vật
const RELIC_COL = { 1: '#9fb0ff', 2: '#c58bff', 3: '#ffd24a' };
const relicName = (id) => t(`relic.${id}`);
const modLines = (id) => {
  const r = ctx.relics[id];
  const pct = (v) => Math.round(v * 100);
  return Object.entries(r.mods).map(([k, v]) => {
    const el = r.element != null && (k === 'atkPct' || k === 'hpPct');
    return t(`relic.mod.${k}${el ? 'El' : ''}`, { pct: pct(v), sec: v / 1000, n: v, element: r.element != null ? t(`element.${r.element}`) : '' });
  });
};
function relicCard(id, extra) {
  const r = ctx.relics[id];
  return h('div', { class: 'card relic', 'data-relic': id, style: `border-color:${RELIC_COL[r.rarity]}` }, h('b', {}, relicName(id), ' ', h('small', { style: `color:${RELIC_COL[r.rarity]}` }, t(`relic.rarity.${r.rarity}`))), modLines(id).map((l) => h('div', { class: 'muted' }, l)), extra);
}
// Hàng chip Di Vật đang giữ; bấm một chip xem chi tiết.
const relicStrip = () =>
  run.relics.length
    ? h('div', { class: 'relic-strip' }, run.relics.map((id) => h('button', { class: 'rchip', 'data-relic': id, style: `border-color:${RELIC_COL[ctx.relics[id].rarity]}`, onclick: () => showRelicSheet(id) }, relicName(id))))
    : null;
function showRelicSheet(id) {
  if ($('info')) return;
  const close = () => $('info')?.remove();
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() }, h('div', { class: 'infobox' }, h('h3', {}, t('relic.sheet')), id ? relicCard(id) : run.relics.map((r) => relicCard(r)), btn(t('info.close'), close, 'primary', { id: 'info-close' }))));
}
function showRelicPick() {
  screen(
    floorTitle(),
    hpBar(),
    h('h2', {}, t('relic.title')),
    run.relicChoices.map((id, i) => relicCard(id, btn(t('relic.pick'), () => act({ type: 'pickRelic', index: i }), 'primary', { 'data-pick': i }))),
    relicStrip(),
  );
}
// Quái xem trước của từng cửa chiến đấu.
function doorList() {
  return h('div', { class: 'doorlist' }, run.doors.map((k, i) => {
    const foes = run.preview?.[i];
    return h('div', { class: 'dl', 'data-dl': i }, h('b', {}, `${i + 1}. ${t(`door.${k}`)}`), ' ', foes ? h('small', { class: 'muted' }, foes.map((m) => t(`monster.${m}`)).join(', ')) : h('small', { class: 'muted' }, t(`door.desc.${k}`)));
  }));
}

function showDoors() {
  saveActiveRun();
  const rc = ctx.config.run.items;
  const desc = {
    potion: t('item.desc.potion', { n: Math.round(rc.potion.healPct * 100) }),
    shield: t('item.desc.shield', { n: Math.round(rc.shield.pct * 100) }),
    time: t('item.desc.time', { n: rc.time.bonusMs / 1000 }),
  };
  const items = h('div', { class: 'itembar' }, ['potion', 'shield', 'time'].map((it) => {
    const off = run.items[it] <= 0 || (it === 'potion' && run.hp >= run.maxHp) || run.armed[it];
    const b = h('button', { class: 'itm' + (run.armed[it] ? ' armed' : ''), 'data-item': it, onclick: () => act({ type: 'useItem', item: it }), ...(off ? { disabled: '' } : {}) });
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ITEM_ICON[it]}</svg>`;
    b.append(h('b', {}, `${t(`item.${it}`)} ×${run.items[it]}`), h('small', {}, run.armed[it] ? t('run.armed') : desc[it]));
    return b;
  }));
  const map = h('div', { class: 'runmap' + (DEBUG ? ' static' : '') });
  map.innerHTML = runMapSVG();
  map.querySelectorAll('[data-door]').forEach((nd) => {
    const go = () => act({ type: 'door', index: Number(nd.getAttribute('data-door')) });
    nd.addEventListener('click', go);
    nd.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  });
  screen(
    h('div', { class: 'mapnav' }, floorTitle(), h('div', { class: 'muted' }, `${t('run.hp')}: ${Math.round(run.hp)} / ${run.maxHp}`), h('div', { class: 'hpbar' }, h('i', { style: `width:${Math.max(0, (run.hp / run.maxHp) * 100)}%` }))),
    map,
    h('p', { class: 'sub mapcap' }, run.doors.length > 1 ? t('run.chooseDoor') : t('run.finalDoor')),
    doorList(),
    relicStrip(),
    items,
    btn(t('run.leave'), leaveRun, '', { id: 'leave-run' }),
  );
  $('screen').classList.add('mapscreen');
}

function battleIntro() {
  const danger = run.node === 'boss' || run.node === 'elite';
  const foes = run.battle.enemies;
  const lead = foes[foes.length - 1];
  return {
    danger,
    warn: t(run.node === 'boss' ? 'intro.boss' : 'intro.elite'),
    title: danger ? t(`monster.${lead.id}`) : t(`zone.${run.zoneId}`),
    sub: t('run.floor', { n: run.floor + 1, total: run.floors }),
    go: t('intro.go'),
    dur: danger ? 3000 : 2400,
  };
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
    intro: DEBUG && !location.search.includes('intro') ? null : battleIntro(),
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
    onInspect: showInspect,
    onSkillAsk: showSkillAsk,
    celebrate,
    onEnd(st) {
      audio.sfx(st.status === 'won' ? 'win' : 'lose');
      run = pending;
      render();
    },
  });
  window.__game = game;
  $('pause-btn')?.remove();
  const pb = h('button', { id: 'pause-btn', 'aria-label': t('pause.title'), onclick: () => showPause() });
  pb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
  $('wrap').appendChild(pb);
}
let pending = null;

// Tạm dừng giữa trận: chỉnh âm thanh hoặc thoát. Thoát bỏ trận đang đánh dở, giữ tiến trình các cửa đã xong.
function showPause(confirmQuit = false) {
  if ($('info')) return;
  const close = () => $('info')?.remove();
  const quit = () => {
    if (doorsSnap) progress.activeRun = structuredClone(doorsSnap);
    else delete progress.activeRun;
    save();
    notice = doorsSnap ? 'run.quitSaved' : null;
    audio.sfx('back');
    showHub();
  };
  const body = [
    h('h3', {}, t('pause.title')),
    run?.relics?.length && confirmQuit !== true ? h('div', { class: 'relic-strip' }, run.relics.map((id) => h('span', { class: 'rchip', style: `border-color:${RELIC_COL[ctx.relics[id].rarity]}`, title: modLines(id).join(' · ') }, relicName(id)))) : null,
    confirmQuit === true
      ? confirmBox(t('pause.quitAsk'), quit, () => { close(); showPause(); }, t('pause.quit'))
      : [...audioControls(), btn(t('pause.resume'), close, 'primary', { id: 'pause-resume' }), btn(t('pause.quit'), () => { close(); showPause(true); }, '', { id: 'pause-quit' })],
  ].flat();
  $('wrap').appendChild(h('div', { id: 'info' }, h('div', { class: 'infobox' }, body)));
}

// Bảng chi tiết khi nhấn giữ tướng/quái trong trận.
function effectRows(effects, holder) {
  if (!effects?.length) return [h('div', { class: 'muted' }, t('info.noEffects'))];
  return effects.map((e) => {
    const extra = [t('info.turnsLeft', { n: e.turns })];
    if (e.stacks > 1) extra.push(t('info.stackN', { n: e.stacks }));
    if (e.pool != null) extra.push(t('info.shieldPool', { n: e.pool }));
    else if (e.value) extra.push(`${pct(e.value)}%`);
    return h('div', { class: 'muted' }, h('b', {}, t(`effect.${e.key}.name`)), ` (${extra.join(', ')}): `, t(`effect.${e.key}.desc`));
  });
}
// Chạm tướng đã sẵn sàng: hiện thông tin kỹ năng, chỉ dùng khi người chơi bấm Đồng ý.
function showSkillAsk(idx, confirm) {
  const st = game?.getState?.();
  if (!st || $('info')) return;
  const m = st.members[idx];
  if (!m) return;
  const kit = resolveKit(ctx, m.id, m.skillLv);
  const keys = keysOf(kit.skill.units);
  const close = () => $('info')?.remove();
  const body = [
    h('div', { class: 'charrow' }, portrait(m.id, 72), h('div', { style: 'flex:1;min-width:0' }, h('h3', {}, t(`skill.${m.id}`)), h('div', { class: 'muted' }, t(`char.${m.id}`), ' · ', t('char.cooldown', { n: m.skillMax })))),
    h('div', { class: 'card' }, kit.skill.units.map((u) => h('div', {}, unitText(u)))),
    keys.length ? h('div', { class: 'card' }, keywordBlock(keys)) : null,
    h('div', { class: 'row' }, btn(t('skill.ok'), () => { close(); confirm(); }, 'primary', { id: 'skill-ok' }), btn(t('skill.cancel'), close, '', { id: 'skill-cancel' })),
  ];
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() }, h('div', { class: 'infobox' }, body)));
}

function showInspect(kind, idx) {
  const st = game?.getState?.();
  if (!st || $('info')) return;
  let body;
  if (kind === 'member') {
    const m = st.members[idx];
    if (!m) return;
    const c = ctx.characters[m.id];
    body = [
      heroUI.header(m.id),
      heroUI.statGrid(m, m.id),
      heroUI.levelBar(m.id, { level: m.level, exp: 0 }),
      h('div', { class: 'muted' }, t('info.teamHp', { hp: Math.round(st.hp), max: st.maxHp })),
      heroUI.activeBox(m.id, { skillLv: m.skillLv, cooldown: m.skillMax, status: m.skillCd === 0 ? t('info.skillReady') : t('info.skillWait', { n: m.skillCd }) }),
      idx === 0 && c.leader ? heroUI.leaderBox(m.id, m.skillLv) : null,
      heroUI.passiveBox(m.id, m.skillLv),
      heroUI.duoBox(m.id, false),
      h('div', { class: 'card' }, h('b', {}, t('info.teamEffects')), effectRows(st.team.effects)),
    ];
  } else {
    const e = st.enemies[idx];
    if (!e) return;
    const mk = ctx.monsters[e.id]?.kind || 'normal';
    const off = e.effects?.some((x) => x.key === 'stun' || x.key === 'freeze');
    const im = getImg(`monster:${e.id}`);
    body = [
      h('div', { class: 'charrow' }, im ? h('img', { src: im.src, alt: '', style: 'width:96px;height:96px;flex:none' }) : null, h('div', { style: 'flex:1;min-width:0' }, h('h3', {}, t(`monster.${e.id}`)), h('div', {}, h('span', { class: 'chip', style: `background:${COLORS[e.element]}` }, el(e.element)), ' ', h('small', {}, t(`info.kind.${mk}`))))),
      h('div', { class: 'row' }, h('span', { class: 'res' }, t('info.hpNow', { hp: Math.max(0, Math.round(e.hp)), max: e.maxHp })), h('span', { class: 'res' }, t('info.attack', { atk: e.atk, n: e.every }))),
      e.hp > 0 ? h('div', { class: 'muted' }, off ? t('info.stunnedNow') : t('info.cdNow', { n: e.cd })) : null,
      h('div', { class: 'card' }, h('b', {}, t('info.effects')), effectRows(e.effects)),
    ];
  }
  const close = () => $('info')?.remove();
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() }, h('div', { class: 'infobox' }, body, btn(t('info.close'), close, 'primary', { id: 'info-close' }))));
}

// ---- Cảnh thưởng: rương rung, mở nắp, đồ bay ra từng món có số đếm tăng và âm thanh
const REWARD_ICON = {
  gold: '<circle cx="12" cy="12" r="9" fill="#e2b75a" stroke="#8a6a2a" stroke-width="1.5"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#fff0bd" stroke-width="1.5"/>',
  essence: '<path d="M12 2.5c3.4 4.2 6.4 7.2 6.4 10.8a6.4 6.4 0 0 1-12.8 0C5.6 9.700 8.600 6.700 12 2.500z" fill="#b58bff" stroke="#5a3aa8" stroke-width="1.4"/><ellipse cx="9.800" cy="12" rx="1.400" ry="2.400" fill="#fff" opacity=".6"/>',
  spirit: '<path d="M12 2.500l7.500 6.500-7.500 12.500L4.500 9z" fill="#6bd5ff" stroke="#1f6f9a" stroke-width="1.4" stroke-linejoin="round"/><path d="M4.500 9h15M12 2.500L9 9l3 12.500L15 9z" fill="none" stroke="#e6f8ff" stroke-width="1" opacity=".8"/>',
  shard: '<path d="M7 3.500l8.500 2L19 14l-6.500 6.500L5 14z" fill="#ff7fb0" stroke="#a83a6a" stroke-width="1.400" stroke-linejoin="round"/><path d="M7 3.500L12.500 12 19 14" fill="none" stroke="#ffe0ee" stroke-width="1" opacity=".8"/>',
  fodder: '<ellipse cx="12" cy="13" rx="7.500" ry="6.500" fill="#8fd69a" stroke="#2f7a45" stroke-width="1.400"/><circle cx="9.500" cy="11.500" r="1.200" fill="#1c3a26"/><circle cx="14.500" cy="11.500" r="1.200" fill="#1c3a26"/>',
  offering: '<rect x="4.500" y="9" width="15" height="11" rx="1.500" fill="#ffb86b" stroke="#8a4a1a" stroke-width="1.400"/><path d="M4.500 13h15M12 9v11M12 9c-1-4-5-4-5-1.500S11 9 12 9zm0 0c1-4 5-4 5-1.500S13 9 12 9z" fill="none" stroke="#fff0d0" stroke-width="1.200"/>',
  stoneN: '<path d="M12 3l7.500 4.300v8.400L12 20l-7.500-4.300V7.300z" fill="#7d8fd8" stroke="#3a4690" stroke-width="1.400" stroke-linejoin="round"/>',
  stoneR: '<path d="M12 3l7.500 4.300v8.400L12 20l-7.500-4.300V7.300z" fill="#ffd24a" stroke="#8a6a2a" stroke-width="1.400" stroke-linejoin="round"/><path d="M12 3v17M4.500 7.300L19.500 15.700M19.500 7.300L4.500 15.700" stroke="#fff7d6" stroke-width=".8" opacity=".7"/>',
};
const rewardIcon = (k) => {
  const e = h('span', { class: 'ricon' });
  e.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${REWARD_ICON[k]}</svg>`;
  return e;
};
function lootRows(l) {
  const rows = [];
  if (l.gold) rows.push({ k: 'gold', label: t('res.gold'), n: l.gold });
  if (l.essence) rows.push({ k: 'essence', label: t('res.essence'), n: l.essence });
  for (const [k, n] of Object.entries(l.offerings || {})) rows.push({ k: 'offering', label: offeringName(k), n, rare: Number(k.split('_')[1]) >= 2 });
  for (const [k, n] of Object.entries(l.fodder || {})) rows.push({ k: 'fodder', label: fodderName(k), n, rare: ctx.fodder[k].star === 2 });
  if (l.shards) rows.push({ k: 'shard', label: t('res.shard'), n: l.shards, rare: true });
  if (l.spirit) rows.push({ k: 'spirit', label: t('res.spirit'), n: l.spirit, rare: true });
  if (l.stones?.normal) rows.push({ k: 'stoneN', label: `${t('res.stone')} ${t('stone.normal')}`, n: l.stones.normal });
  if (l.stones?.rare) rows.push({ k: 'stoneR', label: `${t('res.stone')} ${t('stone.rare')}`, n: l.stones.rare, rare: true });
  return rows;
}
const CHEST_SVG = `<svg viewBox="0 0 200 170" aria-hidden="true">
  <ellipse cx="100" cy="158" rx="78" ry="9" fill="#000" opacity=".35"/>
  <g class="chest-lid"><path d="M30 84C30 26 170 26 170 84Z" fill="#7a4822" stroke="#2a160a" stroke-width="5" stroke-linejoin="round"/><path d="M30 84C34 52 62 40 100 40" fill="none" stroke="#a8692f" stroke-width="5" opacity=".7"/><rect x="44" y="40" width="13" height="44" fill="#e2b75a" stroke="#2a160a" stroke-width="3.5"/><rect x="143" y="40" width="13" height="44" fill="#e2b75a" stroke="#2a160a" stroke-width="3.5"/></g>
  <g class="chest-body"><rect x="30" y="82" width="140" height="68" rx="7" fill="#64391a" stroke="#2a160a" stroke-width="5"/><path d="M34 106H166M34 128H166" stroke="#2a160a" stroke-width="3" opacity=".5"/><rect x="44" y="82" width="13" height="68" fill="#e2b75a" stroke="#2a160a" stroke-width="3.5"/><rect x="143" y="82" width="13" height="68" fill="#e2b75a" stroke="#2a160a" stroke-width="3.5"/><rect x="88" y="78" width="24" height="34" rx="5" fill="#ffd24a" stroke="#2a160a" stroke-width="4"/><circle cx="100" cy="94" r="4.500" fill="#2a160a"/></g>
</svg>`;

function lootScene({ title, sub, loot, onContinue }) {
  const rows = lootRows(loot);
  const skipEl = { fn: null };
  const timers = [];
  const later = (ms, f) => timers.push(setTimeout(f, ms));
  const chest = h('div', { class: 'chest' });
  chest.innerHTML = CHEST_SVG;
  const rays = h('div', { class: 'rays' });
  const list = h('div', { class: 'loot-list' });
  const cont = btn(t('result.continue'), () => { timers.forEach(clearTimeout); onContinue(); }, 'primary', { id: 'continue', class: 'primary cont-hidden' });
  const stage = h('div', { class: 'loot-stage' }, rays, chest);
  const root = [h('div', { class: 'victory-title' }, title), sub, rows.length ? stage : null, list, cont];
  screen(...root.filter(Boolean));
  const wrapRect = () => $('wrap').getBoundingClientRect();
  const chestPos = () => { const r = chest.getBoundingClientRect(); const w = wrapRect(); return { x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height * 0.35 }; };
  const spark = (n, col) => { const p = chestPos(); (fxl ||= createFxLayer($('fx'))).sparkle(p.x, p.y, n, col); };
  const showRow = (row, i) => {
    const el = h('div', { class: 'reward' + (row.rare ? ' rare' : '') }, rewardIcon(row.k), h('span', { class: 'rlabel' }, row.label), h('b', { class: 'rnum' }, '+0'));
    list.append(el);
    audio.sfx(row.rare ? 'rare' : i % 2 ? 'coin2' : 'coin');
    audio.vibrate(row.rare ? 30 : 12);
    const num = el.querySelector('.rnum');
    const t0 = performance.now();
    const dur = 520;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      num.textContent = `+${Math.round(row.n * (1 - Math.pow(1 - k, 3)))}`;
      if (k < 1) requestAnimationFrame(tick);
    };
    tick();
    if (row.rare) spark(22, '#fff0bd');
  };
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    cont.classList.remove('cont-hidden');
  };
  skipEl.fn = () => {
    // chạm để xem ngay toàn bộ
    timers.forEach(clearTimeout);
    stage.classList.add('open', 'skipped');
    list.replaceChildren();
    rows.forEach((row) => {
      const el = h('div', { class: 'reward instant' + (row.rare ? ' rare' : '') }, rewardIcon(row.k), h('span', { class: 'rlabel' }, row.label), h('b', { class: 'rnum' }, `+${row.n}`));
      list.append(el);
    });
    finish();
  };
  $('screen').onpointerdown = (e) => { if (!done && !e.target.closest('button')) skipEl.fn(); };
  if (!rows.length) {
    list.append(h('div', { class: 'muted' }, t('result.nothing')));
    finish();
    return;
  }
  // dòng thời gian
  later(450, () => { audio.sfx('chestShake'); stage.classList.add('shake'); });
  later(1250, () => {
    stage.classList.remove('shake');
    stage.classList.add('open');
    audio.sfx('chestOpen');
    audio.vibrate(40);
    spark(36);
  });
  rows.forEach((row, i) => later(1650 + i * 360, () => showRow(row, i)));
  later(1650 + rows.length * 360 + 250, finish);
}

function showResult() {
  const r = run.lastResult;
  if (r.kind === 'battle' || r.kind === 'chest') {
    const isBoss = r.nodeType === 'boss';
    return lootScene({
      title: r.kind === 'chest' ? t('result.chest') : t(isBoss ? 'result.victoryBoss' : 'result.victory'),
      sub: h('div', { class: 'muted' }, `${stageLabel(run)} · ${t('run.floor', { n: run.floor + 1, total: run.floors })}`),
      loot: r.loot,
      onContinue: () => act({ type: 'continue' }),
    });
  }
  let body;
  if (r.kind === 'event') {
    const key = `ev.${r.eventId}`;
    body = h('div', { class: 'card' }, h('b', {}, t(`${key}.title`)), h('p', {}, t(`${key}.o${r.choice}_${r.outcome}`)), run.lastRelic ? relicCard(run.lastRelic) : null);
  } else body = h('div', { class: 'card' }, h('b', {}, t('result.rest', { n: r.heal })));
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
    run.shop.map((sl, i) => {
      const buy = sl.sold ? h('div', { class: 'muted' }, t('shop.sold')) : btn(t('shop.buy', { price: sl.price }), () => act({ type: 'buy', slot: i }), '', { 'data-slot': i, ...(run.loot.gold < sl.price ? { disabled: '' } : {}) });
      return sl.relic ? relicCard(sl.relic, buy) : h('div', { class: 'card' }, h('b', {}, t(`item.${sl.item}`)), buy);
    }),
    relicStrip(),
    btn(t('shop.leave'), () => act({ type: 'leaveShop' }), 'primary', { id: 'leave' }),
  );
}

let savedThisRun = false;
function showEnd() {
  if (!savedThisRun) {
    progress = applyRunResult(ctx, progress, run);
    delete progress.activeRun;
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

// ---- Cảm giác app: chặn menu giữ/chuột phải, kéo ảnh, bôi đen, zoom cử chỉ
for (const ev of ['contextmenu', 'dragstart', 'selectstart', 'gesturestart']) {
  document.addEventListener(ev, (e) => {
    if (ev === 'selectstart' && /^(INPUT|TEXTAREA)$/.test(e.target?.tagName || '')) return;
    if (ev === 'contextmenu' && /^(INPUT|TEXTAREA)$/.test(e.target?.tagName || '')) return;
    e.preventDefault();
  }, { passive: false });
}
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });

// ---- Cài app (PWA)
let installEvt = null;
const isStandalone = () => window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || window.navigator.standalone === true;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (atHub) showHub(); });
window.addEventListener('appinstalled', () => { installEvt = null; if (atHub) showHub(); });
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installRow() {
  if (isStandalone()) return null;
  const canFs = !!document.documentElement.requestFullscreen && !isIOS;
  return h('div', { class: 'row' },
    btn(t('app.install'), async () => {
      if (installEvt) {
        installEvt.prompt();
        await installEvt.userChoice.catch(() => {});
        installEvt = null;
        showHub();
      } else showInstallHelp();
    }, 'primary', { id: 'b-install' }),
    canFs ? btn(t('app.fullscreen'), () => document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}), '', { id: 'b-fs' }) : null,
  );
}
function showInstallHelp() {
  screen(
    h('h2', {}, t('app.install')),
    h('div', { class: 'card' }, h('p', {}, t(isIOS ? 'app.helpIOS' : 'app.helpOther'))),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
}
if ('serviceWorker' in navigator && !DEBUG && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

if (DEBUG) {
  window.__ctx = ctx;
  window.__cheat = (ids = []) => {
    const p = structuredClone(progress);
    p.inventory.essence += 5000;
    p.inventory.gold += 20000;
    p.inventory.shards += 100;
    for (const r of ctx.config.races) for (const t of [1, 2, 3]) p.inventory.offerings[`${r}_${t}`] = (p.inventory.offerings[`${r}_${t}`] || 0) + 40;
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
const loading = createLoading({ t, title: t('game.title'), subtitle: 'Rift Spire: Pantheon', auto: DEBUG });
screen(loading.el);
const bootStart = performance.now();
await preloadAssets((d, n) => loading.setProgress(n ? (d / n) * 0.95 : 0));
if (!DEBUG) await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (performance.now() - bootStart)))); // đủ lâu để đọc 1 mẹo
await loading.ready();
if (progress.onboarding.done) showHub();
else showOnboarding();
