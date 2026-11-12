import { buildCtx, loadRaw } from './core/ctx.js';
import { hasFreeOffer } from './core/shop.js';
import { createGuide } from './ui/guide.js';
import { createRun, runStep, newRunRecord, debugWinBattle, runLayout } from './core/run.js';
import { stageOpen, tierOpen, stagesDone, zoneClears } from './core/stage.js';
import { stageInfo } from './core/stageinfo.js';
import { applyRunResult, firstClearStageSpirit } from './core/progress.js';
import { browserAdapter } from './save/storage.js';
import { createSlots } from './save/slots.js';
import { install as installSlots } from './ui/screen-slots.js';
import { levelCap, grantCharacter, expToMax, skillUp, skillUpCost, useElixir, feedFodder, sellFodder, fodderExp, awakenCost, awaken, setTeam, teamRoster, selectPreset, makeLeader, presetsOf, PRESET_COUNT, placeInSlot, clearTeam, autoTeam } from './core/upgrade.js';
import { statsFor, skillCooldown } from './core/stats.js';
import { KEYS } from './core/effects.js';
import { avatarNode, photoFromFile } from './ui/avatar.js';
import { completeTutorial, storyUnlocked } from './core/onboarding.js';
import { createBattle, step as battleStep } from './core/battle.js';
import { install as installIntro } from './ui/screen-intro.js';
import { newProgress } from './core/progress.js';
import { createT, detectLang } from './i18n/index.js';
import { startGame } from './ui/game.js';
import { preloadAssets, getImg } from './ui/assets.js';
import { createLoading } from './ui/loading.js';
import { createHeroUI, COLORS } from './ui/hero-ui.js';
import { resolveKit, maxSkillLevel, SKILL_KINDS, formOf } from './core/kit.js';
import * as offline from './ui/offline.js';
import { VERSION, BUILD, BUILD_DATE } from './version.js';
import { createFxLayer } from './ui/fxlayer.js';
import { createAudio } from './ui/audio.js';
import { $, h, btn } from './ui/dom.js';
import { itemIcon, rewardIcon, REWARD_ICON } from './ui/icons.js';
import { install as installItems } from './ui/screen-items.js';
import { install as installSummon } from './ui/screen-summon.js';
import { install as installProfile } from './ui/screen-profile.js';
import { install as installShop } from './ui/screen-shop.js';

let fxl = null;
const celebrate = () => (fxl ||= createFxLayer($('fx'))).celebrate();
const load = (f) => fetch(`js/${f}`).then((r) => r.json());
const [raw, audioCfg, vi, en] = await Promise.all([loadRaw(load), load('data/audio.json'), load('i18n/vi.json'), load('i18n/en.json')]);
const ctx = buildCtx(raw);
const dicts = { vi, en };
// 3 ô lưu: `storage` là lớp bọc trỏ tới ô đang chơi (đổi bằng enterSlot).
const slots = createSlots(browserAdapter(), ctx);
let activeSlot = null;
let curStore = slots.storage(slots.last() || 1);
const storage = {
  save: (p) => curStore.save(p),
  load: () => curStore.load(),
  clear: () => curStore.clear(),
  exportText: (p) => curStore.exportText(p),
  importText: (t) => curStore.importText(t),
};
const DEBUG = new URLSearchParams(location.search).has('debug');

let lang = (() => {
  try {
    return localStorage.getItem('rsp.lang') || detectLang(navigator.language);
  } catch {
    return detectLang(navigator.language);
  }
})();
let t = createT(dicts[lang], en);
let progress = newProgress(ctx);
let notice = null;
// Nạp trước phông cho canvas (DOM chỉ nạp khi dùng tới).
for (const f of ['650 20px Fraunces', '600 14px "Be Vietnam Pro"', '700 20px Oswald']) document.fonts?.load(f, 'Aáảạ');
const audio = createAudio(audioCfg, {
  get volume() { return progress.settings.volume; },
  get music() { return progress.settings.music; },
  get sfx() { return progress.settings.sfx; },
  get haptic() { return progress.settings.haptic; },
});
document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
document.addEventListener('click', (e) => {
  const el = e.target.closest?.('#screen button, #screen [role=button], #screen [data-zone], #screen [data-zone-card], #screen [data-stage], #screen [data-door], #screen .slot, #screen .tier, #screen .rchip, #screen .card.btn, #info button, .dock button');
  if (!el || el.disabled) return;
  if (el.id === 'door-info') return; // tự phát âm riêng
  audio.sfx(el.matches('.tier, .rchip, .slot, [data-stage]') ? 'tick' : el.matches('[data-door]') ? 'open' : 'ui');
}, { capture: true });
let run = null;
let record = null;
let game = null;
let seedText = '';

// ---- tiện ích DOM
let atHub = false;
const guide = createGuide($('wrap'));
const guideStep = () => progress?.onboarding?.guide;
const guideSet = (step) => { if (step) progress.onboarding.guide = step; else delete progress.onboarding.guide; save(); };
const guidePoint = (target, key, delay) => guide.point(target, t(key), delay);
const screen = (...kids) => {
  $('info')?.remove();
  $('pause-btn')?.remove();
  guide.clear();
  $('tour-ui')?.remove();
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
    b.innerHTML = '<img src="assets/ui/icons/back.webp" alt="" draggable="false">';
    el.prepend(h('div', { class: 'back-wrap' }, b));
  }
  el.classList.remove('hub', 'mapscreen', 'hubin');
  el.classList.add('show');
  el.scrollTop = 0;
};
const save = () => {
  if (!storage.save(progress)) notice = 'hub.saveFail';
  else if (activeSlot) slots.touch(activeSlot);
};
// Vào một ô lưu: nạp tiến trình của ô đó rồi tới màn chính (hoặc mở đầu nếu ô còn trống).
function enterSlot(n) {
  activeSlot = n;
  curStore = slots.storage(n);
  slots.setLast(n);
  const l = curStore.load();
  progress = l.progress;
  notice = l.recovered ? 'hub.recovered' : null;
  run = null;
  record = null;
  runPath = [];
  ui.resetDrafts?.();
  if (!progress.onboarding.done) ui.showOnboarding();
  else if (!progress.onboarding.starterDone) startTutorial();
  else showHub();
}
const fodderName = (key) => `${t('fodder.' + key.replace('_', '.'))} ${'★'.repeat(ctx.fodder[key].star)}`;
const offeringName = (key) => `${t('offering.' + key.replace('_', '.'))} ${'★'.repeat(Number(key.split('_')[1]))}`;
const offeringsLine = (o, race) => {
  const parts = Object.keys(o).filter((k) => k.startsWith(`${race}_`)).sort().map((k) => `${offeringName(k)} ×${o[k]}`);
  return parts.length ? parts.join(', ') : '—';
};
const lootLine = (l) => {
  const parts = [];
  if (l.gold) parts.push(`${t('res.gold')} ${l.gold >= 0 ? '+' : ''}${l.gold}`);
  for (const tier of [1, 2, 3]) if (l.elixir?.[tier]) parts.push(`${t(`res.elixir.${tier}`)} +${l.elixir[tier]}`);
  if (l.shards) parts.push(`${t('res.shard')} +${l.shards}`);
  for (const [id, n] of Object.entries(l.fragments || {})) parts.push(`${t('res.fragment', { name: t(`char.${id}`) })} +${n}`);
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
const ART_ICONS = new Set(['team', 'summon', 'shop', 'quests', 'help', 'settings', 'collection', 'glossary', 'story', 'items', 'clues']);
function dockBtn(icon, label, onclick, id, cls = '', dot = false) {
  const b = h('button', { onclick, id, class: cls, 'aria-label': label, title: label });
  b.innerHTML = ART_ICONS.has(icon) ? `<img src="assets/ui/icons/${icon}.webp" alt="" draggable="false">` : `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>`;
  if (dot) b.append(h('i', { class: 'red-dot', 'aria-hidden': 'true' }));
  return b;
}
const CUR_COL = { gold: '#ffd24a', spirit: '#b58bff', ticket: '#ff9a4a', shard: '#ff9acb' };
const lastCur = {};
const curPill = (k, v, id) => h('button', { class: 'cur-pill' + (lastCur[k] !== undefined && lastCur[k] !== v ? ' bump' : '') + ((lastCur[k] = v), ''), ...(id ? { id } : {}), onclick: () => ui.showItems(), 'aria-label': t(`res.${k}`) }, h('img', { src: `assets/ui/items/${k}.webp`, alt: '', draggable: 'false' }), h('b', {}, new Intl.NumberFormat(lang).format(v)));
const resPill = (label, value, id) => h('span', { class: 'res', ...(id ? { id } : {}) }, label, h('b', {}, String(value)));

// Cảnh chính: Tòa Tháp giữa các đảo nổi. Mỗi khu mở là một viên ngọc phát sáng trên đảo (chạm để vào khu).
function hubScene() {
  const zones = ctx.zoneList;
  // Vị trí ngọc khu trên các đảo nổi của ảnh nền bg/hub.webp (viewBox 400 rộng, ảnh 400x711).
  const pos = [[205, 372], [56, 168], [218, 130], [38, 280], [360, 270], [338, 108]];
  const NS = 'http://www.w3.org/2000/svg';
  const orbs = zones.map((z, i) => {
    const [x, y] = pos[i % pos.length];
    const open = progress.unlocked.includes(z.id);
    const col = COLORS[z.element];
    const S = open ? 66 : 60;
    const lock = open ? '' : `<g transform="translate(${x - 9} ${y - 8})"><rect x="0" y="7" width="18" height="13" rx="3" fill="#3a2416" stroke="#f6edd6" stroke-width="1.6"/><path d="M4 7V4.5a5 5 0 0 1 10 0V7" fill="none" stroke="#f6edd6" stroke-width="1.8"/></g>`;
    return `<g class="zorb${open ? ' open' : ''}" ${open ? `data-zone="${z.id}" role="button" tabindex="0" aria-label="${t(`zone.${z.id}`)}"` : ''} style="animation-delay:${(i * 0.7).toFixed(1)}s;--c:${col}">${open ? `<ellipse cx="${x}" cy="${y + S * 0.34}" rx="${S * 0.46}" ry="${S * 0.12}" fill="${col}" opacity=".35" class="halo"/>` : ''}<image href="assets/ui/zones/${z.id}.webp" x="${x - S / 2}" y="${y - S / 2}" width="${S}" height="${S}" ${open ? '' : 'filter="url(#zlock)" opacity=".7"'}/>${lock}</g>`;
  }).join('');
  const svg = `<svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMin slice" xmlns="${NS}" aria-hidden="true">
<defs><filter id="zlock"><feColorMatrix type="saturate" values="0.1"/></filter></defs>
<rect width="400" height="800" fill="#fbd9a8"/>
<image href="assets/bg/hub.webp" x="0" y="0" width="400" height="711" preserveAspectRatio="xMidYMin slice"/>
${orbs}
</svg>`;
  const box = h('div', { class: 'hub-scene' + (DEBUG ? ' static' : '') });
  box.innerHTML = svg;
  if (!DEBUG) for (let i = 0; i < 12; i++) box.appendChild(h('i', { class: 'spark', style: `left:${(i * 37 + 11) % 92 + 3}%;top:${(i * 53 + 17) % 62 + 8}%;animation-delay:${(i * 0.83).toFixed(2)}s;animation-duration:${(5 + (i % 4)).toFixed(0)}s` })); // đom đóm bay quanh Tháp
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
      h('div', { class: 'avatar', id: 'b-profile', role: 'button', tabindex: '0', 'aria-label': t('profile.title'), style: 'cursor:pointer', onclick: () => ui.showProfile() }, avatarNode(progress.player)),
      h('div', { class: 'who', id: 'b-profile-name', style: 'cursor:pointer', onclick: () => ui.showProfile() }, h('b', {}, progress.player.name)),
      dockBtn('help', t('hub.help'), () => ui.showGlossary(), 'b-help', 'help-btn'),
      dockBtn('settings', t('hub.settings'), () => ui.showSettings(), 'b-set', 'help-btn'),
    ),
    h('div', { class: 'cur', id: 'cur' }, curPill('gold', inv.gold), curPill('spirit', inv.spirit, 'spirit'), curPill('ticket', inv.tickets, 'tickets')),
    notice ? h('div', { class: 'notice hub-notice' }, t(notice)) : null,
    installRow() ? h('div', { class: 'hub-install' }, installRow()) : null,
    activeRunInfo() ? resumeChip() : null,
    h('div', { class: 'hub-foot' }, h('div', { class: 'credit' }, h('b', {}, t('hub.credit')), h('span', {}, t('hub.version', { v: VERSION, b: BUILD, d: BUILD_DATE })))),
    h(
      'nav',
      { class: 'dock' },
      dockBtn('team', t('hub.team'), () => showTeam(), 'b-team'),
      dockBtn('summon', t('hub.summon'), () => ui.showSummon('standard'), 'b-summon', 'sub', progress.summon.freeDay !== ui.dayKey()),
      h('button', { class: 'battle', id: 'b-battle', onclick: () => { if (guideStep() === 'battle') guideSet('zone'); showZones(); }, 'aria-label': t('hub.battle') }, h('img', { src: 'assets/ui/icons/battle.webp', alt: '', draggable: 'false' }), h('span', {}, t('hub.battle'))),
      dockBtn('shop', t('hub.shop'), () => { if (guideStep() === 'shop') guideSet('claim'); ui.showShop(); }, 'b-shop', '', hasFreeOffer(ctx, progress, ui.dayKey())),
      dockBtn('quests', t('hub.quests'), () => showQuests(), 'b-quest'),
    ),
  );
  $('screen').classList.add('hub');
  atHub = true;
  notice = null;
  const nEl = document.querySelector('#screen .hub-notice'); // thông báo tự mờ rồi biến mất sau vài giây
  if (nEl) setTimeout(() => { nEl.classList.add('fade'); setTimeout(() => nEl.remove(), 600); }, 4000);
  // Hướng dẫn tân thủ: shop (quà miễn phí) → Chiến đấu → ải 1 → Vào trận → luật chọn đường
  let gs = guideStep();
  if (gs && gs !== 'shop' && gs !== 'battle') { guideSet('battle'); gs = 'battle'; }
  if (gs === 'shop') guidePoint('#b-shop', 'guide.shop', 1000);
  else if (gs === 'battle') guidePoint('#b-battle', 'guide.battle');
}

function resumeChip() {
  const r = activeRunInfo().run;
  return h('button', { class: 'resume', id: 'b-resume', onclick: resumeRun }, h('span', { class: 'rs-t' }, t('run.resume')), h('small', {}, `${stageLabel(r)} · ${t('run.floor', { n: r.floor + 1, total: r.floors })}`));
}

// Chọn khu vực (từ nút CHIẾN ĐẤU).
const stageLabel = (r) => `${t(`zone.${r.zoneId}`)} · ${t(`diff.${r.diff}`)} · ${t('stage.num', { n: r.stage ?? 1 })}`;

// Chọn ải của một khu: 3 độ khó (Dễ -> Vừa -> Khó), mỗi độ khó 7 ải mở lần lượt, ải 7 là boss. Khó hơn thì quái mạnh hơn, thưởng và tỉ lệ rớt cao hơn.
let stageTier = null;
function showStages(zoneId, tier) {
  const order = ctx.config.difficulty.order;
  const total = ctx.config.run.stages;
  // Mặc định mở đúng độ khó đang chơi dở: độ khó cao nhất đã mở mà chưa xong.
  tier ??= stageTier?.zone === zoneId ? stageTier.tier : [...order].reverse().find((d) => tierOpen(ctx, progress, zoneId, d) && stagesDone(progress, zoneId, d) < total) ?? order.find((d) => tierOpen(ctx, progress, zoneId, d)) ?? order[0];
  stageTier = { zone: zoneId, tier };
  const done = stagesDone(progress, zoneId, tier);
  const df = ctx.config.difficulty[tier];
  const tabs = h('div', { class: 'tiertabs' }, order.map((d, i) => {
    const open = tierOpen(ctx, progress, zoneId, d);
    return h('button', { class: 'tier' + (d === tier ? ' on' : '') + (open ? '' : ' locked'), 'data-tier': d, onclick: () => open && showStages(zoneId, d) }, t(`diff.${d}`), h('small', {}, open ? t('stage.progress', { n: stagesDone(progress, zoneId, d), total }) : '🔒'));
  }));
  const cards = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    const open = stageOpen(ctx, progress, zoneId, tier, n);
    const clear = n <= done;
    const boss = n === total;
    const card = h(
      'div',
      { class: 'card btn gate stage' + (boss ? ' boss' : '') + (open ? '' : ' locked') + (clear ? ' clear' : ''), 'data-stage': String(n), onclick: () => !heldFlag.v && open && showTeam(undefined, undefined, { zoneId, diff: tier, stage: n }) },
      h('div', { class: 'snum' }, boss ? '★' : String(n)),
      h('div', { class: 'info' }, h('div', { class: 'name' }, t(boss ? 'stage.boss' : 'stage.num', { n })), h('small', {}, clear ? t('stage.cleared') : open ? t('stage.next') : t('stage.lockedPrev'))),
    );
    onHold(card, () => showStageInfo(zoneId, tier, n));
    return card;
  });
  const gst = ['zone', 'stage', 'team'].includes(guideStep());
  screen(h('h2', {}, t(`zone.${zoneId}`)), tabs, h('div', { class: 'muted tier-note' }, t('diff.reward', { gold: df.gold, drop: df.drop })), h('div', { class: 'stagelist' }, cards), h('div', { class: 'muted hold-hint' }, t('stage.hold')), btn(t('back'), showZones, '', { id: 'back' }));
  if (gst) { guideSet('stage'); guidePoint(`#screen [data-stage="${done + 1 > total ? 1 : done + 1}"]`, 'guide.stage'); }
}

// Giữ lâu (450ms) trên một phần tử để mở thông tin; thả tay sau khi mở không tính là chạm.
const heldFlag = { v: false };
function onHold(el, fn, ms = 450) {
  let timer = null;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', () => {
    heldFlag.v = false;
    timer = setTimeout(() => { heldFlag.v = true; audio.sfx('ui'); fn(); setTimeout(() => (heldFlag.v = false), 400); }, ms);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, cancel);
  el.addEventListener('contextmenu', (e) => { e.preventDefault(); cancel(); heldFlag.v = true; fn(); setTimeout(() => (heldFlag.v = false), 400); });
}

// Thông tin chi tiết một ải: hệ số quái, đặc tính, quái trong khu, bảng rớt và tỉ lệ theo từng nguồn.
const pctText = (p) => (p <= 0 ? '0%' : p >= 0.995 ? '100%' : `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`);
const rangeText = ([a, b]) => (a === b ? `${a}` : `${a}–${b}`);
function showStageInfo(zoneId, diff, stage = 1) {
  const si = stageInfo(ctx, zoneId, diff, stage);
  const close = () => $('info')?.remove();
  const row = (k, v) => h('div', { class: 'si-row' }, h('span', {}, k), h('b', {}, v));
  const names = (ids) => ids.map((m) => t(`monster.${m}`)).join(', ');
  const dropLabel = (key) => (key === 'fragment' ? t('items.tab.frag') : key.startsWith('elixir.') ? t(`res.${key}`) : key.startsWith('stone.') ? `${t('res.stone')} ${t(`stone.${key.slice(6)}`)}` : t(`res.${key}`));
  const src = si.sources.map((s) => h('div', { class: 'si-src' },
    h('div', { class: 'si-head' }, h('b', {}, t(`loot.src.${s.kind}`)), h('small', { class: 'muted' }, `${t('res.gold')} ${rangeText(s.gold)}`)),
    s.drops.map((d) => row(dropLabel(d.key), `${pctText(d.chance)} · ×${rangeText(d.count)}`)),
  ));
  const tiers = si.tiers.map((x) => `${t('loot.tier', { n: x.tier })} ${pctText(x.pct)}`).join(' · ');
  const body = [
    h('h3', {}, `${t(`zone.${zoneId}`)} · ${t(`diff.${diff}`)} · ${t('stage.num', { n: stage })}`),
    h('div', { class: 'si-sec' }, h('b', {}, t('stage.info.enemy')),
      row(t('stat.hp'), `×${si.hp[0].toFixed(2)} → ×${si.hp[1].toFixed(2)}`),
      row(t('stat.atk'), `×${si.atk[0].toFixed(2)} → ×${si.atk[1].toFixed(2)}`),
      row(t('stage.info.floors'), String(si.floors)),
      h('small', { class: 'muted' }, `${t('door.normal')}: ${names(si.monsters.normal)}`), h('small', { class: 'muted' }, `Elite: ${names(si.monsters.elite)}`), h('small', { class: 'muted' }, `Boss: ${names(si.monsters.boss)}`)),
    h('div', { class: 'si-sec' }, h('b', {}, t('stage.info.loot')), row(t('stage.info.firstClear'), stage <= stagesDone(progress, zoneId, diff) ? t('stage.info.claimed') : `${si.firstClear} ${t('res.spirit')}`), h('small', { class: 'muted' }, t('diff.reward', { gold: si.gold, drop: si.drop })), src,
      h('small', { class: 'muted' }, `${t('stage.info.offering')} ${si.races.map((r) => t(`race.${r}`)).join(', ')}: ${tiers}`)),
  ];
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() }, h('div', { class: 'infobox stageinfo' }, ...body, btn(t('info.close'), close, 'primary', { id: 'info-close' }))));
}

function showZones() {
  const inv = progress.inventory;
  const zoneCards = ctx.zoneList.map((z) => {
    const open = progress.unlocked.includes(z.id);
    const st = inv.stones[z.element];
    return h(
      'div',
      { class: 'card btn gate' + (open ? '' : ' locked'), 'data-zone-card': z.id, style: `--el:${COLORS[z.element]}`, onclick: open ? () => showStages(z.id) : null },
      h('img', { src: `assets/ui/zones/${z.id}.webp`, alt: '', draggable: 'false' }),
      h(
        'div',
        { class: 'info' },
        h('div', { class: 'name' }, t(`zone.${z.id}`)),
        h('small', {}, open ? t('zone.clears', { n: zoneClears(progress, z.id) }) : t('zone.locked')),
        open ? h('div', { class: 'diffdots' }, ctx.config.difficulty.order.map((d) => h('span', { class: stagesDone(progress, z.id, d) >= ctx.config.run.stages ? 'on' : '' }, `${t(`diff.${d}`)} ${stagesDone(progress, z.id, d)}/${ctx.config.run.stages}`))) : null,
        open ? h('div', { class: 'muted' }, `${t('stone.normal')}: ${st.normal} · ${t('stone.rare')}: ${st.rare}`) : null,
      ),
    );
  });
  const act0 = activeRunInfo();
  const gz = ['zone', 'stage', 'team'].includes(guideStep());
  screen(
    h('h2', {}, t('hub.zones')),
    act0 ? h('div', { class: 'card' }, h('b', {}, t('run.resume')), h('div', { class: 'muted' }, `${stageLabel(act0.run)} · ${t('run.floor', { n: act0.run.floor + 1, total: act0.run.floors })}`), h('div', { class: 'row' }, btn(t('run.resume'), resumeRun, 'primary', { id: 'zones-resume' }), btn(t('run.abandon'), () => { clearActiveRun(); showZones(); }, '', { id: 'zones-abandon' }))) : null,
    zoneCards,
    h('details', {}, h('summary', {}, t('hub.debug')), h('label', {}, t('hub.seed'), h('input', { id: 'seed', inputmode: 'numeric', value: seedText, oninput: (e) => (seedText = e.target.value) })), h('p', { class: 'muted' }, t('hub.progress'))),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
  if (gz) { guideSet('zone'); guidePoint('#screen [data-zone-card]:not(.locked)', 'guide.zone'); }
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
  ui.showSettings();
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
    c ? portrait(id, 64) : h('div', { style: 'width:64px;height:64px;border-radius:12px;border:3px solid #6a4529;flex:none;display:flex;align-items:center;justify-content:center;font-size:24px' }, '?'),
    h(
      'div',
      { style: 'flex:1;min-width:0' },
      h('h3', {}, t(`char.${id}`), ' ', h('small', {}, '★'.repeat(def.rarity))),
      h('div', {}, h('span', { class: 'chip', style: `background:${COLORS[def.element]}` }, el(def.element)), ' ', h('small', {}, c ? `${t('char.level', { n: c.level, max: levelCap(ctx, c.awaken) })} · ${t('char.form', { n: formOf(c.awaken) })}` : '???')),
      c ? (() => { const st = statsFor(ctx, id, c.level, c.awaken); return h('div', { class: 'mini-stats' }, h('span', {}, t('stat.hp'), ' ', h('b', {}, String(st.hp))), h('span', {}, t('stat.atk'), ' ', h('b', {}, String(st.atk)))); })() : null,
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

// Dẫn người chơi đi qua từng mục trong trang chi tiết tướng (chạy một lần).
function runHeroTour() {
  const hasTag = (k) => document.querySelector(`#screen .hp-tag.${k}`)?.closest('.hp-skill');
  const grows = [...document.querySelectorAll('#screen .hp-grow')];
  const steps = [
    ['#screen .hp-head', 'guide.hero.head'],
    ['#screen .hp-stats', 'guide.hero.stats'],
    ['#screen .hp-level', 'guide.hero.level'],
    [hasTag('active'), 'guide.hero.active'],
    [hasTag('leader'), 'guide.hero.leader'],
    [hasTag('passive'), 'guide.hero.passive'],
    [hasTag('duo'), 'guide.hero.duo'],
    [document.querySelector('#screen .fxrow')?.closest('.card'), 'guide.hero.keys'],
    [grows[0], 'guide.hero.grow'],
    [grows[1], 'guide.hero.skillup'],
    [grows[2], 'guide.hero.awaken'],
  ].map(([el, key]) => [typeof el === 'string' ? document.querySelector(el) : el, key]).filter(([el]) => el);
  if (!steps.length) return;
  let i = 0;
  const ui = h('div', { id: 'tour-ui', class: 'tour-ui' });
  const end = () => { ui.remove(); guide.clear(); };
  const next = h('button', { id: 'tour-next', class: 'primary' }, t('guide.next'));
  const skip = h('button', { id: 'tour-skip', class: 'ghost' }, t('guide.skip'));
  const show = () => {
    const [el, key] = steps[i];
    guide.point(el, t(key), 0, { dock: true });
    next.textContent = i === steps.length - 1 ? t('guide.done') : t('guide.next');
  };
  next.onclick = () => { audio.sfx('tick'); if (++i >= steps.length) end(); else show(); };
  skip.onclick = end;
  ui.append(skip, next);
  $('wrap').appendChild(ui);
  setTimeout(show, 350);
}

function showChar(id, msg, back) {
  if (back) charBack = back;
  const goBack = charBack || showCollection;
  const c = ctx.characters[id];
  const pc = progress.characters[id];
  const st = statsFor(ctx, id, pc.level, pc.awaken);
  const aw = awakenCost(ctx, id, pc.awaken + 1);
  const inv = progress.inventory;
  const awakenReady = !!aw && inv.shards >= aw.shards && inv.stones[aw.element][aw.stone] >= aw.stones && inv.gold >= aw.gold;
  const kit = resolveKit(ctx, id, pc.skillLv, formOf(pc.awaken));
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
  const gained = (r) => t('char.gained', { n: r.gained ?? r.exp ?? r.used }) + (r.levels ? ` · ${t('char.levelsUp', { n: r.levels })}` : '');
  const fodderKeys = Object.keys(inv.fodder).sort();
  const grow = h(
    'div',
    { class: 'hp-grow' },
    h('b', {}, t('char.grow')),
    need <= 0
      ? h('div', { class: 'muted' }, t('char.maxLevel'))
      : [
          h('div', { class: 'muted' }, t('char.elixir')),
          [1, 2, 3].map((tier) => h('div', { class: 'fodder-row', 'data-elixir': tier }, itemIcon(`elixir${tier}`, 'sm'), h('span', {}, `${t(`res.elixir.${tier}`)} ×${inv.elixir[tier]} `, h('small', { class: 'muted' }, `+${ctx.config.elixir[tier].exp} EXP`)), btn(t('char.useOne'), () => act(() => useElixir(ctx, progress, id, tier, 1), gained)), btn(t('char.useUpTo'), () => act(() => useElixir(ctx, progress, id, tier, 1e9), gained)))),
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
    heroUI.activeBox(id, { cooldown: skillCooldown(ctx, id, pc.awaken, pc.skillLv), skillLv: pc.skillLv, awaken: pc.awaken }),
    heroUI.leaderBox(id, pc.skillLv, pc.awaken),
    heroUI.passiveBox(id, pc.skillLv, pc.awaken),
    heroUI.duoBox(id),
    keys.length ? h('div', { class: 'card' }, keywordBlock(keys)) : null,
    grow,
    skills,
    h('div', { class: 'hp-grow' }, h('div', { class: 'muted' }, t('char.form', { n: formOf(pc.awaken) })), aw
      ? [h('div', { class: 'muted' }, t('char.form2Preview', { cap: ctx.config.progression.levelMax, pct: Math.round(ctx.config.progression.awaken[0].stat * 100) })), heroUI.activeBox(id, { skillLv: pc.skillLv, awaken: 1, cooldown: skillCooldown(ctx, id, 1, pc.skillLv) }), h('div', { class: 'muted' }, t('char.awakenCost', { shards: aw.shards, stones: aw.stones, kind: t(`stone.${aw.stone}`), element: el(aw.element), gold: aw.gold })), btn(t('char.awakenBtn'), () => act(() => awaken(ctx, progress, id)), '', { id: 'awaken', class: awakenReady ? 'ready' : 'notready' })]
      : h('div', { class: 'muted' }, t('char.maxAwaken'))),
    h('div', { class: 'muted' }, `${t('res.shard')} ${inv.shards} · ${t('res.gold')} ${inv.gold} · ${t('res.stone')} ${el(c.element)}: ${inv.stones[c.element].normal}/${inv.stones[c.element].rare}`),
    btn(t('back'), goBack, '', { id: 'back' }),
  );
  if (progress.onboarding.teamTour !== 'done' && !guideStep()) { progress.onboarding.teamTour = 'done'; save(); runHeroTour(); } // lần đầu xem chi tiết tướng: dẫn từng mục
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
  const gt = stage && ['stage', 'team'].includes(guideStep());
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
    h('h2', {}, stage ? t('team.prep', { zone: `${t(`zone.${stage.zoneId}`)} · ${t(`diff.${stage.diff}`)} · ${t('stage.num', { n: stage.stage })}` }) : t('hub.team')),
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
    members.length ? h('div', { class: 'muted' }, `${t('char.leader')}: ${leaderText(resolveKit(ctx, members[0], progress.characters[members[0]].skillLv, formOf(progress.characters[members[0]].awaken)).leader)}`) : null,
    h('div', { class: 'muted' }, members.length < 2 ? t('team.noDuo') : duos.length ? `${t('team.duoActive')}: ${duos.map((d) => t(`duo.${d.id}`)).join(', ')}` : t('team.noDuo')),
    stage ? [needLeader || !members.length ? h('div', { class: 'notice' }, t(members.length ? 'team.needLeader' : 'team.needAny')) : null, btn(t('team.go'), () => (activeRunInfo() ? askAbandon(stage) : startRun(stage)), 'primary', { id: 'team-go', ...(needLeader ? { disabled: '' } : {}) })] : null,
    h('p', { class: 'muted' }, t('team.holdHint')),
    h('div', { class: 'roster' }, sorted.map((c) => longPress(Object.assign(tile(c.id, team.indexOf(c.id) + 1 || 0), { onclick: () => pick(c.id) }), () => showChar(c.id, undefined, () => again(slot))))),
    btn(`${t('hub.collection')} ${owned().length}/${ctx.characterList.length}`, () => showCollection(), '', { id: 'team-col' }),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
  if (gt && !needLeader && members.length) { guideSet('team'); guidePoint('#team-go', 'guide.team'); }
  else if (!stage && !guideStep() && progress.onboarding.teamTour !== 'done' && members.length) guidePoint('#screen .roster > *', 'guide.teamHold', 600);
}

// Cửa hàng và Nhiệm vụ: khung chờ, chưa có nội dung (gói ủng hộ ở M6; nhiệm vụ làm sau).
function showQuests() {
  screen(
    h('h2', {}, t('hub.quests')),
    h('div', { class: 'row' }, h('button', { class: 'primary', disabled: '' }, t('quest.daily')), h('button', { disabled: '' }, t('quest.achv'))),
    h('div', { class: 'card soon' }, h('b', {}, t('soon.title')), h('p', { class: 'muted' }, t('quest.soon'))),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
}


let obTimers = [];
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
    ui.confirmBox(t('run.abandonAsk'), () => startRun(stage), () => showTeam(undefined, undefined, stage), t('run.abandon')),
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

function startRun({ zoneId, diff, stage = 1 }) {
  const seed = pickSeed();
  const pity = !!progress.pity[zoneId];
  const team = teamRoster(progress);
  run = createRun(ctx, { seed, zoneId, team, pityMissed: pity, diff, stage });
  record = newRunRecord(seed, zoneId, team, pity, diff, stage);
  runPath = [];
  savedThisRun = false;
  delete progress.activeRun;
  if (guideStep() === 'team') guideSet('doors');
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
    const slot = runLayout(ctx, run)[r];
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
  let nodes = `<g class="nd start"><circle cx="${start.x}" cy="${start.y}" r="15" fill="#191b20" stroke="#e2b75a" stroke-width="2"/><path d="M${start.x - 6} ${start.y + 7}v-8a6 6 0 0 1 12 0v8z" fill="none" stroke="#e2b75a" stroke-width="1.8"/></g>`;
  const label = (x, y, k, strong) => `<text x="${x}" y="${y}" text-anchor="middle" class="nl${strong ? ' strong' : ''}">${k === '?' || k === 'f?' ? '' : t(`door.${k}`)}</text>`;
  for (const row of rows) {
    row.kinds.forEach((k, i) => {
      const [x, y] = pos(row, i);
      const big = k === 'boss' || (row.r === n - 1);
      const rad = big ? 30 : 23;
      if (k === '?' || k === 'f?') {
        nodes += `<g class="nd ghost"><circle cx="${x}" cy="${y}" r="${rad - 3}" fill="#16181c" stroke="#606570" stroke-width="1.6" stroke-dasharray="3 4"/>${k === 'f?' ? `<g transform="translate(${x - 9} ${y - 9}) scale(.75)" fill="none" stroke="#8f95a2" stroke-width="2" stroke-linecap="round">${NODE.normal.icon}</g>` : `<text x="${x}" y="${y + 6}" text-anchor="middle" class="q">?</text>`}</g>`;
        return;
      }
      const d = NODE[k];
      const taken = row.past && row.pick === i;
      const skipped = row.past && row.pick !== i;
      const cls = 'nd' + (row.cur ? ' cur' : '') + (taken ? ' taken' : '') + (skipped ? ' skipped' : '') + (big ? ' big' : '');
      const attr = row.cur ? ` data-door="${i}" role="button" tabindex="0" aria-label="${t(`door.${k}`)}"` : '';
      nodes += `<g class="${cls}"${attr} style="--c:${d.col}">${row.cur ? `<circle class="pulse" cx="${x}" cy="${y}" r="${rad + 8}" fill="${d.col}"/>` : ''}<circle cx="${x}" cy="${y}" r="${rad + 3}" fill="none" stroke="#d39a5e" stroke-opacity="${row.cur || taken ? 0.85 : 0.35}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="${rad}" fill="#1d120b" stroke="${taken || row.cur ? d.ring : d.col}" stroke-width="${row.cur ? 3 : 2}"/><circle cx="${x}" cy="${y}" r="${rad - 5}" fill="${d.col}" opacity="${skipped ? 0.1 : taken ? 0.55 : 0.3}"/><g transform="translate(${x - 12 * (rad / 23)} ${y - 12 * (rad / 23)}) scale(${rad / 23})" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="${skipped ? 0.35 : 1}">${d.icon}</g>${row.cur || big ? label(x, y + rad + 17, k, row.cur) : ''}</g>`;
    });
  }
  if (curRow || true) {
    // dấu vị trí đội: viên ngọc phát sáng ở điểm vừa đi tới
    nodes += `<g class="you"><circle cx="${last[0] + 26}" cy="${last[1] - 4}" r="6" fill="#ffe9ad"/><circle cx="${last[0] + 26}" cy="${last[1] - 4}" r="11" fill="#ffe9ad" opacity=".25"/></g>`;
  }
  let stars = '';
  for (let i = 0; i < 40; i++) stars += `<circle cx="${(i * 97.3) % 400}" cy="${(i * 53.7) % 600}" r="${0.6 + (i % 3) * 0.4}" fill="#fff" opacity="${0.15 + (i % 4) * 0.1}"/>`;
  let cols = '';
  for (const x of [26, 374]) {
    cols += `<g class="pillar"><rect x="${x - 13}" y="62" width="26" height="520" fill="url(#col)" stroke="#6a4529" stroke-opacity=".7"/><rect x="${x - 19}" y="52" width="38" height="12" rx="2" fill="#4a2f1c" stroke="#d39a5e" stroke-opacity=".6"/><rect x="${x - 19}" y="578" width="38" height="12" rx="2" fill="#4a2f1c" stroke="#d39a5e" stroke-opacity=".6"/>`;
    for (const y of [150, 270, 390, 500]) cols += `<path d="M${x} ${y - 9}l7 9-7 9-7-9z" fill="none" stroke="var(--zc,#ffb25a)" stroke-width="1.4" opacity=".55" class="rune"/>`;
    cols += `<path d="M${x - 15} 52h30l-4 -9h-22z" fill="#2a1810" stroke="#d39a5e" stroke-opacity=".6"/><g transform="translate(${x} 43) scale(1.7) translate(${-x} -43)"><g class="flame" style="transform-origin:${x}px 43px"><path d="M${x} 14c5 7 8 11 8 17a8 8 0 0 1-16 0c0-4 2-6 4-9 0 3 1 4 2 4-1-4-1-8 2-12z" fill="var(--zc,#ffb25a)"/><path d="M${x} 24c3 4 4 6 4 9a4 4 0 0 1-8 0c0-2 1-3 2-5 0 2 1 2 2 2z" fill="#fff2c4"/></g></g><circle cx="${x}" cy="30" r="34" fill="url(#zg)" class="torchglow"/></g>`;
  }
  return `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid meet" aria-hidden="false">
<defs><linearGradient id="col" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#111216"/><stop offset=".5" stop-color="#424753"/><stop offset="1" stop-color="#111216"/></linearGradient>
<radialGradient id="zg"><stop offset="0" stop-color="var(--zc,#ffb25a)" stop-opacity=".45"/><stop offset="1" stop-color="var(--zc,#ffb25a)" stop-opacity="0"/></radialGradient><radialGradient id="tg" cx=".5" cy=".12" r=".7"><stop offset="0" stop-color="var(--zc,#ffb25a)" stop-opacity=".22"/><stop offset="1" stop-color="var(--zc,#ffb25a)" stop-opacity="0"/></radialGradient><radialGradient id="rg" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#626878" stop-opacity=".55"/><stop offset="1" stop-color="#626878" stop-opacity="0"/></radialGradient></defs>
<rect width="400" height="600" fill="url(#rg)"/><rect width="400" height="600" fill="url(#tg)"/>${stars}${cols}${faint}${gold}${nodes}</svg>`;
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
// Tiêu đề bản đồ: huy hiệu vùng, tên ải, chấm tầng, thanh máu có tim.
function mapHeader() {
  const zc = COLORS[ctx.zones[run.zoneId].element] || '#ffb25a';
  const pips = Array.from({ length: run.floors }, (_, i) => h('i', { class: 'pip' + (i < run.floor ? ' done' : i === run.floor ? ' cur' : '') + (i === run.floors - 1 ? ' boss' : '') }));
  const pct = Math.max(0, (run.hp / run.maxHp) * 100);
  const heart = h('span', { class: 'heart' });
  heart.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15.500 2.500 11.800 2.500 8.300A4.800 4.800 0 0 1 7.300 3.500c2 0 3.700 1 4.700 2.700 1-1.700 2.700-2.700 4.700-2.700a4.800 4.800 0 0 1 4.800 4.800C21.500 11.800 19 15.500 12 21z"/></svg>';
  return h('div', { class: 'mapnav', style: `--zc:${zc}` },
    h('div', { class: 'mn-top' },
      h('img', { class: 'mn-zone', src: `assets/ui/zones/${run.zoneId}.webp`, alt: '' }),
      h('div', { class: 'mn-title' }, h('h2', {}, t(`zone.${run.zoneId}`)), h('div', { class: 'mn-sub' }, h('span', { class: `tag d-${run.diff}` }, t(`diff.${run.diff}`)), h('span', {}, t('stage.num', { n: run.stage ?? 1 })))),
      h('div', { class: 'mn-floor' }, h('div', { class: 'pips' }, pips), h('small', {}, t('run.floor', { n: run.floor + 1, total: run.floors })))),
    h('div', { class: 'mn-hp' }, heart, h('div', { class: 'hpbar' }, h('i', { style: `width:${pct}%` }), h('span', {}, `${Math.round(run.hp)} / ${run.maxHp}`))));
}
// Quái xem trước của từng cửa chiến đấu.
function doorList() {
  return h('div', { class: 'doorlist' }, run.doors.map((k, i) => {
    const foes = run.preview?.[i];
    const d = NODE[k] || NODE.normal;
    const ico = h('span', { class: 'dl-ico', style: `--c:${d.col}` });
    ico.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d.icon}</svg>`;
    const thumbs = foes ? h('span', { class: 'dl-foes' }, foes.map((m) => { const im = getImg(`monster:${m}`); return h('span', { class: 'dl-foe', title: t(`monster.${m}`) }, im ? h('img', { src: im.src, alt: t(`monster.${m}`) }) : null, h('small', {}, t(`monster.${m}`))); })) : h('small', { class: 'muted' }, t(`door.desc.${k}`));
    return h('div', { class: 'dl', 'data-dl': i, style: `--c:${d.col}` }, h('span', { class: 'dl-n' }, String(i + 1)), ico, h('div', { class: 'dl-body' }, h('b', {}, t(`door.${k}`)), thumbs));
  }));
}

// Giữ lâu một cửa trên bản đồ: xem chi tiết cửa đó (quái, mô tả) rồi chọn vào hoặc đóng.
let doorHint = false; // sau phần luật: chỉ tay vào nút xác nhận ở lần mở chi tiết cửa đầu tiên
function showDoorDetail(i) {
  if ($('info')) return;
  const k = run.doors[i];
  const d = NODE[k] || NODE.normal;
  const foes = run.preview?.[i];
  const close = () => $('info')?.remove();
  const ico = h('span', { class: 'dl-ico big', style: `--c:${d.col}` });
  ico.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d.icon}</svg>`;
  const rows = foes ? foes.map((m) => {
    const im = getImg(`monster:${m}`);
    const mo = ctx.monsters[m];
    return h('div', { class: 'dd-foe' }, im ? h('img', { src: im.src, alt: '' }) : null, h('div', {}, h('b', {}, t(`monster.${m}`)), h('div', { class: 'muted' }, h('span', { class: 'chip', style: `background:${COLORS[mo?.element ?? 0]}` }, t(`element.${mo?.element ?? 0}`)), ' ', t(`info.kind.${mo?.kind || 'normal'}`), mo?.attackEvery ? ` · ${t('info.every', { n: mo.attackEvery })}` : '')));
  }) : [h('div', { class: 'muted' }, t(`door.desc.${k}`))];
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() }, h('div', { class: 'infobox doordetail' },
    h('div', { class: 'charrow' }, ico, h('div', { style: 'flex:1;min-width:0' }, h('h3', {}, t(`door.${k}`)), h('small', { class: 'muted' }, t(`door.desc.${k}`)))),
    h('div', { class: 'card' }, h('b', {}, foes ? t('run.foes') : t('run.reward')), rows),
    h('div', { class: 'row' }, btn(t('info.close'), close, '', { id: 'info-close' }), btn(t('run.enterDoor'), () => { close(); act({ type: 'door', index: i }); }, 'primary', { id: 'door-enter' })))));
  if (doorHint) { doorHint = false; guidePoint('#door-enter', 'guide.enter', 250); }
}

function showRules() {
  const close = () => {
    $('info')?.remove();
    doorHint = true;
    guidePoint('#screen [data-door]', 'guide.door', 300);
  };
  const body = h('div', { class: 'infobox rules-box' }, h('h3', {}, t('guide.rules.title')), h('ul', {}, [1, 2, 3, 4, 5].map((n) => h('li', {}, t(`guide.rules.${n}`)))), btn(t('guide.rules.ok'), close, 'primary', { id: 'rules-ok' }));
  setTimeout(() => { if (!$('info')) $('wrap').appendChild(h('div', { id: 'info' }, body)); }, 350);
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
    const b = h('button', { class: 'itm' + (run.armed[it] ? ' armed' : ''), 'data-item': it, title: t(`item.${it}`), 'aria-label': `${t(`item.${it}`)} ×${run.items[it]}`, onclick: () => act({ type: 'useItem', item: it }), ...(off ? { disabled: '' } : {}) });
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ITEM_ICON[it]}</svg>`;
    b.append(h('b', {}, `×${run.items[it]}`));
    if (run.armed[it]) b.append(h('small', {}, t('run.armed')));
    return b;
  }));
  // Bảng thông tin (ẩn mặc định): quái từng cửa + mô tả vật phẩm
  const itemInfo = h('div', { class: 'iteminfo' }, ['potion', 'shield', 'time'].map((it) => {
    const ic = h('span', { class: 'ii-ico', 'data-item': it });
    ic.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ITEM_ICON[it]}</svg>`;
    return h('div', { class: 'ii' }, ic, h('div', {}, h('b', {}, `${t(`item.${it}`)} ×${run.items[it]}`), h('small', {}, desc[it])));
  }));
  const infoPanel = h('div', { class: 'infopanel' }, h('div', { class: 'ip-in' }, doorList(), itemInfo));
  const infoBtn = h('button', { class: 'infobtn', id: 'door-info', 'aria-label': t('run.info'), 'aria-expanded': 'false', onclick: () => { const on = infoPanel.classList.toggle('open'); infoBtn.setAttribute('aria-expanded', String(on)); infoBtn.classList.toggle('on', on); audio.sfx('tick'); setTimeout(focusMap, 380); } }, 'i');
  const map = h('div', { class: 'runmap' + (DEBUG ? ' static' : '') });
  map.innerHTML = runMapSVG();
  map.querySelectorAll('[data-door]').forEach((nd) => {
    const idx = Number(nd.getAttribute('data-door'));
    const go = () => { if (heldFlag.v) return; if (run.doors.length > 1) showDoorDetail(idx); else act({ type: 'door', index: idx }); }; // chọn cửa nào cũng có xác nhận (cửa duy nhất thì vào luôn)
    onHold(nd, () => showDoorDetail(idx));
    nd.addEventListener('click', go);
    nd.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  });
  screen(
    mapHeader(),
    map,
    h('p', { class: 'sub mapcap' }, h('span', {}, run.doors.length > 1 ? t('run.chooseDoor') : t('run.finalDoor')), infoBtn),
    run.doors.length > 1 ? h('div', { class: 'muted hold-hint' }, t('run.holdHint')) : null,
    infoPanel,
    relicStrip(),
    items,
    btn(t('run.leave'), leaveRun, 'ghost', { id: 'leave-run' }),
  );
  $('screen').classList.add('mapscreen');
  if (guideStep() === 'doors') { guideSet(null); showRules(); }
  // cuộn bản đồ tới tầng đang chọn (kéo cuộn để xem phần còn lại)
  const svg = map.querySelector('svg');
  const vy = run.floors > 1 ? 468 - run.floor * ((468 - 118) / (run.floors - 1)) : 468;
  const focusMap = () => { map.scrollTop = Math.max(0, (vy / 600) * svg.clientHeight - map.clientHeight * 0.55); };
  focusMap();
  requestAnimationFrame(focusMap);
  $('screen').style.setProperty('--zc', COLORS[ctx.zones[run.zoneId].element] || '#ffb25a');
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
  startBattleUI();
}

// Màn hướng dẫn: một trận ngắn với đội mượn sẵn, quái yếu. Bong bóng chỉ dẫn đổi theo từng nước đi; thua thì chơi lại.
function startTutorial(retry = false) {
  const tc = ctx.config.tutorial;
  // Đội, quái, bàn và đường kéo đều cố định trong config: mọi tài khoản học cùng một bài.
  const st0 = createBattle(ctx, { seed: tc.seed, team: tc.team, enemies: tc.enemies, scale: tc.scale });
  st0.members[0].skillCd = 0; // tướng đầu sẵn kỹ năng để dạy
  if (tc.lessons[0]?.board) st0.board = { cells: tc.lessons[0].board.slice(), enh: new Array(tc.lessons[0].board.length).fill(0) }; // bàn bài 1 có ngay từ khung hình đầu, không đổi bàn sau đó
  const lessons = tc.lessons;
  let li = 0;
  $('coach')?.remove();
  const bubble = h('div', { id: 'coach' });
  $('wrap').appendChild(bubble);
  let dimTimer = 0;
  const coach = (key) => {
    if (!key) { bubble.classList.remove('on'); return; }
    bubble.classList.remove('on');
    void bubble.offsetWidth;
    // Câu đầu (tới dấu chấm đầu tiên) là tiêu đề to màu vàng, phần còn lại là chỉ dẫn nhỏ hơn.
    const full = t(key);
    const cut = full.indexOf('. ');
    bubble.replaceChildren(h('div', { class: 'co-h' }, cut > 0 ? full.slice(0, cut + 1) : full), ...(cut > 0 ? [h('div', { class: 'co-b' }, full.slice(cut + 2))] : []));
    // Hiện giữa bàn ngọc, rồi mờ dần và trôi lên khỏi bàn để người chơi thấy ngọc mà xoay.
    bubble.classList.toggle('last', key === 'tut.free');
    const wrapH = bubble.parentElement?.clientHeight || 600;
    bubble.style.setProperty('--dy', `${Math.round(wrapH * 0.75 - (bubble.offsetTop + bubble.offsetHeight / 2))}px`);
    bubble.classList.add('on');
    audio.sfx('tick');
  };
  const samePath = (a, b) => a.length === b.length && a.every((c, i) => c === b[i]);
  let lockIdx = -1;
  const startLesson = (i) => {
    li = i;
    if (i >= lessons.length) {
      game.setGuide({ title: t('tut.lesson', { n: lessons.length, total: lessons.length }), allow: null });
      coach('tut.free');
      return; // chơi tự do: không còn gợi ý
    }
    const L = lessons[i];
    const title = t('tut.lesson', { n: i + 1, total: lessons.length });
    if (L.kind === 'skill') {
      // Bài kỹ năng: trước hết khóa mục tiêu vào quái ÍT MÁU NHẤT (mũi tên chỉ), rồi mới dùng skill đánh đúng quái đó.
      const st = game.getState();
      const low = st.enemies.reduce((b, e, k) => (e.hp > 0 && (b < 0 || e.hp < st.enemies[b].hp) ? k : b), -1);
      if (L.lock && st.focus !== low) {
        lockIdx = low;
        game.setGuide({ title, board: L.board || null, enemy: low, allow: (a) => a.type === 'target' && a.index === low });
        coach(L.coachLock);
      } else {
        lockIdx = -1;
        game.setGuide({ title, board: L.board || null, allow: (a) => a.type === 'skill' && a.index === L.index && (!L.lock || game.getState().focus === low) });
        coach(L.coach);
      }
      return;
    } else {
      game.setGuide({ title, board: L.board, path: L.path, text: t('tut.guide'), allow: (a) => a.type === 'move' && samePath(a.path, L.path) });
    }
    coach(L.coach);
  };
  const done = () => { clearTimeout(dimTimer); bubble.remove(); $('pause-btn')?.remove(); $('hint-btn')?.remove(); };
  audio.playMusic('battle');
  $('screen').classList.remove('show');
  game?.destroy();
  game = startGame({
    canvas: $('cv'),
    ctx,
    t,
    state: st0,
    titleText: t('tut.lesson', { n: 1, total: lessons.length }),
    intro: null,
    stepper: (state, action) => battleStep(ctx, state, action),
    fx: audio,
    hint: false, // gợi ý do setGuide điều khiển; hint tự động sẽ vẽ đường/chữ khác rồi bị thay → giật
    onInspect: showInspect,
    onSkillAsk: showSkillAsk, // tutorial cũng hỏi xác nhận như trận thường để người chơi quen
    celebrate,
    onReject(a) { coach(a.type === 'target' ? 'tut.wrongTarget' : a.type === 'skill' ? 'tut.wrongSkill' : 'tut.wrong'); },
    onLock() { if (lockIdx >= 0) startLesson(li); }, // đã khóa đúng quái: sang bước dùng skill
    onSettled(state) {
      if (li < lessons.length) startLesson(li + 1);
    },
    onEnd(state) {
      done();
      if (state.status === 'won') {
        audio.sfx('win');
        progress = completeTutorial(progress);
        save();
        ui.showTutorialDone();
      } else {
        audio.sfx('lose');
        screen(h('h2', {}, t('tut.lose.title')), h('div', { class: 'card' }, h('p', {}, t('tut.lose.body'))), btn(t('tut.lose.retry'), () => startTutorial(true), 'primary', { id: 'tut-retry' }));
      }
    },
  });
  window.__game = game;
  startLesson(0);
}

function startBattleUI() {
  const hint = progress.settings.hint !== false; // gợi ý đường kéo cho nước đi ĐẦU TIÊN của mỗi trận (người chơi tắt được bằng nút bóng đèn)
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
  addBattleButtons(true);
}

// Nút trên đầu trận: tạm dừng và (không phải màn hướng dẫn) bật/tắt gợi ý nước đầu mỗi ván.
const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.2" y="5" width="4" height="14" rx="1.6"/><rect x="13.8" y="5" width="4" height="14" rx="1.6"/></svg>';
const ICON_HINT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>';
function addBattleButtons(withHint) {
  $('pause-btn')?.remove();
  $('hint-btn')?.remove();
  const pb = h('button', { id: 'pause-btn', class: 'bbtn', 'aria-label': t('pause.title'), onclick: () => showPause() });
  pb.innerHTML = ICON_PAUSE;
  $('wrap').appendChild(pb);
  if (!withHint) return;
  const on = () => progress.settings.hint !== false;
  const hb = h('button', { id: 'hint-btn', class: 'bbtn' + (on() ? '' : ' off'), 'aria-label': t('hint.toggle'), 'aria-pressed': String(on()), title: t('hint.toggle'), onclick: () => {
    progress.settings.hint = !on();
    save();
    hb.classList.toggle('off', !on());
    hb.setAttribute('aria-pressed', String(on()));
    if (!on()) game?.hideHint?.();
    audio.sfx('toggle');
  } });
  hb.innerHTML = ICON_HINT;
  $('wrap').appendChild(hb);
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
      ? ui.confirmBox(t('pause.quitAsk'), quit, () => { close(); showPause(); }, t('pause.quit'))
      : [...ui.audioControls(), btn(t('pause.resume'), close, 'primary', { id: 'pause-resume' }), btn(t('pause.quit'), () => { close(); showPause(true); }, '', { id: 'pause-quit' })],
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
    return h('div', { class: 'muted fxrow' }, h('img', { class: 'fxico', src: `assets/ui/fx/${e.key}.webp`, alt: '' }), h('div', { style: 'flex:1;min-width:0' }, h('b', {}, t(`effect.${e.key}.name`)), ` (${extra.join(', ')}): `, t(`effect.${e.key}.desc`)));
  });
}
// Chạm tướng đã sẵn sàng: hiện thông tin kỹ năng, chỉ dùng khi người chơi bấm Đồng ý.
function showSkillAsk(idx, confirm) {
  const st = game?.getState?.();
  if (!st || $('info')) return;
  const m = st.members[idx];
  if (!m) return;
  const kit = resolveKit(ctx, m.id, m.skillLv, formOf(m.awaken));
  const keys = keysOf(kit.skill.units);
  const close = () => $('info')?.remove();
  const body = [
    h('div', { class: 'charrow' }, portrait(m.id, 72), h('div', { style: 'flex:1;min-width:0' }, h('h3', {}, t(`skill.${m.id}`)), h('div', { class: 'muted' }, t(`char.${m.id}`), ' · ', t('char.cooldown', { n: m.skillMax })))),
    h('div', { class: 'card' }, kit.skill.units.map((u) => h('div', {}, unitText(u, m.element)))),
    keys.length ? h('div', { class: 'card' }, keywordBlock(keys)) : null,
    h('div', { class: 'row' }, btn(t('skill.ok'), () => { close(); confirm(); }, 'primary', { id: 'skill-ok' }), btn(t('skill.cancel'), close, '', { id: 'skill-cancel' })),
  ];
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() }, h('div', { class: 'infobox' }, body)));
}

function showInspect(kind, idx) {
  const st = game?.getState?.();
  if (!st || $('info')) return;
  let body;
  if (kind === 'team') {
    body = [h('h3', {}, t('info.teamEffects')), h('div', { class: 'card' }, effectRows(st.team.effects))];
  } else if (kind === 'member') {
    const m = st.members[idx];
    if (!m) return;
    const c = ctx.characters[m.id];
    body = [
      heroUI.header(m.id),
      heroUI.statGrid(m, m.id),
      heroUI.levelBar(m.id, { level: m.level, exp: 0 }),
      h('div', { class: 'muted' }, t('info.teamHp', { hp: Math.round(st.hp), max: st.maxHp })),
      heroUI.activeBox(m.id, { skillLv: m.skillLv, awaken: m.awaken, cooldown: m.skillMax, status: m.skillCd === 0 ? t('info.skillReady') : t('info.skillWait', { n: m.skillCd }) }),
      idx === 0 && c.leader ? heroUI.leaderBox(m.id, m.skillLv, m.awaken) : null,
      heroUI.passiveBox(m.id, m.skillLv, m.awaken),
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

function lootRows(l) {
  const rows = [];
  if (l.gold) rows.push({ k: 'gold', label: t('res.gold'), n: l.gold });
  for (const tier of [1, 2, 3]) if (l.elixir?.[tier]) rows.push({ k: `elixir${tier}`, label: t(`res.elixir.${tier}`), n: l.elixir[tier], rare: tier >= 3 });
  for (const [k, n] of Object.entries(l.offerings || {})) rows.push({ k: 'offering', label: offeringName(k), n, rare: Number(k.split('_')[1]) >= 2 });
  for (const [k, n] of Object.entries(l.fodder || {})) rows.push({ k: 'fodder', label: fodderName(k), n, rare: ctx.fodder[k].star === 2 });
  for (const [id, n] of Object.entries(l.fragments || {})) rows.push({ k: 'fragment', label: t('res.fragment', { name: t(`char.${id}`) }), n, rare: true });
  if (l.shards) rows.push({ k: 'shard', label: t('res.shard'), n: l.shards, rare: true });
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
let endLevels = [];
let firstClear = 0;
function showEnd() {
  if (!savedThisRun) {
    const before = progress;
    firstClear = run.result === 'won' && (run.stage ?? 1) > stagesDone(before, run.zoneId, run.diff) ? firstClearStageSpirit(ctx, run.zoneId, run.diff, run.stage ?? 1) : 0;
    progress = applyRunResult(ctx, progress, run);
    endLevels = progress.team.filter(Boolean).map((id) => ({ id, from: before.characters[id].level, to: progress.characters[id].level })).filter((x) => x.to > x.from);
    delete progress.activeRun;
    save();
    savedThisRun = true;
    window.__lastRecord = record;
  }
  const won = run.result === 'won';
  screen(
    h('h1', { class: 'end-title ' + (won ? 'won' : 'lost') }, t(won ? 'end.won' : 'end.lost')),
    floorTitle(),
    h('div', { class: 'endteam' }, progress.team.filter(Boolean).map((id, i) => { const lv = endLevels.find((x) => x.id === id); return h('div', { class: 'endhero' + (lv ? ' up' : '') + (won ? '' : ' down'), style: `--d:${(0.15 + i * 0.12).toFixed(2)}s` }, portrait(id, 56), lv ? h('i', {}, `Lv ${lv.to}`) : null); })),
    h('div', { class: 'card endloot' }, h('b', {}, t('end.loot')), h('p', {}, lootLine(run.loot))),
    firstClear ? h('div', { class: 'card notice', id: 'end-first' }, t('end.firstClear', { n: firstClear })) : null,
    run.heroExp ? h('div', { class: 'card', id: 'end-exp' }, h('b', {}, t('result.heroExp', { n: run.heroExp })), endLevels.map((x) => h('div', { class: 'muted' }, t('result.levelUp', { name: t(`char.${x.id}`), lv: x.to })))) : null,
    won ? h('div', { class: 'muted' }, t('end.completion')) : h('div', { class: 'notice' }, t('end.noCompletion')),
    run.pityGranted ? h('div', { class: 'notice' }, t('end.pity')) : null,
    won && (run.stage ?? 1) < ctx.config.run.stages ? btn(t('end.nextStage'), () => { savedThisRun = false; showTeam(undefined, undefined, { zoneId: run.zoneId, diff: run.diff, stage: (run.stage ?? 1) + 1 }); }, 'primary', { id: 'end-next' }) : null,
    btn(t('end.back'), () => {
      savedThisRun = false;
      showHub();
    }, won && (run.stage ?? 1) < ctx.config.run.stages ? '' : 'primary', { id: 'back' }),
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
// ---- Màn hình tách module: dùng chung trạng thái qua `app`, gọi chéo qua `app.*` / `ui.*`
const ui = {};
const app = {
  startTutorial: () => startTutorial(), enterHub: showHub, guideStep, guideSet, guidePoint,
  ctx, audio, storage, slots, enterSlot, dicts, h, btn, $, el, chip, portrait, CUR_COL, fodderName, offeringName, pct, save, screen, setLang, showHub,
  t: (...a) => t(...a),
  get lang() { return lang; },
  set lang(v) { lang = v; },
  get obTimers() { return obTimers; },
  set obTimers(v) { obTimers = v; },
  get progress() { return progress; },
  set progress(v) { progress = v; },
};
Object.assign(ui, installItems(app));
Object.assign(ui, installSummon(app));
Object.assign(ui, installProfile(app));
Object.assign(ui, installSlots(app));
Object.assign(ui, installIntro(app));
Object.assign(app, ui);
Object.assign(ui, installShop(app));
Object.assign(app, ui);

if ('serviceWorker' in navigator && !DEBUG && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

if (DEBUG) {
  window.__ctx = ctx;
  window.__progress = () => progress;
  window.__cheat = (ids = []) => {
    const p = structuredClone(progress);
    for (const tier of [1, 2, 3]) p.inventory.elixir[tier] += 50;
    p.inventory.tickets += 30;
    p.inventory.spirit += 2000;
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
// Vuốt mép / nút Back của trình duyệt = bấm nút mũi tên quay lại góc trái trên của màn hiện tại.
// Luôn đẩy lại một mục lịch sử để trình duyệt không thoát trang; trong chuyến hoặc ở Hub thì bỏ qua.
history.pushState({ rsp: 1 }, '');
window.addEventListener('popstate', () => {
  history.pushState({ rsp: 1 }, '');
  if (run || atHub) return;
  const back = $('back-top') || $('back');
  if (back) {
    audio.sfx('back');
    back.click();
  }
});
try {
  window.screen.orientation?.lock?.('portrait').catch(() => {});
} catch {
  /* bỏ qua */
}
document.title = t('game.title');
document.documentElement.lang = lang;
const loading = createLoading({ t, title: t('game.title'), subtitle: 'Rift Spire: Pantheon', version: `v${VERSION} · build ${BUILD}`, auto: DEBUG });
screen(loading.el);
const bootStart = performance.now();
await preloadAssets((d, n) => loading.setProgress(n ? (d / n) * 0.95 : 0));
if (!DEBUG) await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (performance.now() - bootStart)))); // đủ lâu để đọc 1 mẹo
await loading.ready();
if (DEBUG && !location.search.includes('slots')) enterSlot(slots.last() || 1);
else ui.showSlots();
