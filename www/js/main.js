import { buildCtx, loadRaw } from './core/ctx.js';
import { hasFreeOffer } from './core/shop.js';
import { createGuide } from './ui/guide.js';
import { listAchievements, claimAchievement, hasAchvClaimable, bumpBattles } from './core/achievements.js';
import { trackQuest, claimQuest, claimBonus, hasClaimable, ensureQuests, isDone, allClaimed } from './core/quests.js';
import { createRun, runStep, newRunRecord, debugWinBattle, runLayout } from './core/run.js';
import { stageOpen, tierOpen, stagesDone, zoneClears } from './core/stage.js';
import { stageInfo } from './core/stageinfo.js';
import { applyRunResult, firstClearStageSpirit } from './core/progress.js';
import { browserAdapter } from './save/storage.js';
import { createSlots } from './save/slots.js';
import { install as installSlots } from './ui/screen-slots.js';
import { levelCap, grantCharacter, expToMax, skillUp, skillUpCost, useElixir, feedFodder, sellFodder, fodderExp, awakenCost, awaken, setTeam, teamRoster, selectPreset, makeLeader, presetsOf, PRESET_COUNT, placeInSlot, clearTeam, autoTeam, AUTO_MODES } from './core/upgrade.js';
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
import { hubLayers, fitScene, ZONE_POS } from './ui/hub-art.js';
import { createHeroUI, COLORS } from './ui/hero-ui.js';
import { drawOrb } from './ui/render.js';
import { resolveKit, maxSkillLevel, SKILL_KINDS, formOf } from './core/kit.js';
import * as offline from './ui/offline.js';
import { VERSION, BUILD, BUILD_DATE } from './version.js';
import { createFxLayer } from './ui/fxlayer.js';
import { installRewardFx } from './ui/rewardfx.js';
import { createAudio } from './ui/audio.js';
import { $, h, btn } from './ui/dom.js';
import { itemIcon, rewardIcon, REWARD_ICON } from './ui/icons.js';
import { relicIconSvg } from './ui/relic-icons.js';
import { install as installItems } from './ui/screen-items.js';
import { install as installSummon } from './ui/screen-summon.js';
import { install as installProfile } from './ui/screen-profile.js';
import { install as installShop } from './ui/screen-shop.js';
import { install as installWish } from './ui/screen-wish.js';
import { wishAvailable } from './core/wish.js';

let fxl = null;
const celebrate = () => (fxl ||= createFxLayer($('fx'))).celebrate();
// Hộp báo lỗi nhỏ: nếu có lỗi JS (ví dụ vào trận bị màn trống) thì hiện nội dung lỗi để chụp gửi, bấm để tắt.
{
  const showErr = (msg) => {
    try {
      let b = document.getElementById('errbox');
      if (!b) {
        b = document.createElement('div');
        b.id = 'errbox';
        b.addEventListener('click', () => b.remove());
        (document.getElementById('wrap') || document.body).appendChild(b);
      }
      b.textContent = `⚠ ${String(msg).slice(0, 280)}`;
    } catch { /* bỏ qua */ }
  };
  addEventListener('error', (e) => showErr(`${e.message} @ ${(e.filename || '').split('/').slice(-2).join('/')}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => showErr(e.reason?.stack?.split('\n').slice(0, 2).join(' ') || e.reason));
}
// Chiều cao app theo viewport thật: sau khi vào/thoát toàn màn hình, 100dvh trên Android đôi khi giữ giá trị cũ làm màn tràn.
{
  const fitH = () => {
    const vv = window.visualViewport;
    const h = Math.round(Math.min(window.innerHeight, vv ? vv.height + vv.offsetTop : Infinity, document.documentElement.clientHeight || Infinity));
    if (h > 100) document.documentElement.style.setProperty('--app-h', `${h}px`);
  };
  const fitSoon = () => { fitH(); for (const ms of [120, 400, 900, 1800]) setTimeout(fitH, ms); };
  addEventListener('resize', fitH);
  addEventListener('orientationchange', fitSoon);
  addEventListener('pageshow', fitSoon);
  document.addEventListener('fullscreenchange', fitSoon);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fitSoon(); });
  window.visualViewport?.addEventListener('resize', fitH);
  addEventListener('pointerup', () => setTimeout(fitH, 350), { capture: true }); // sau cái chạm đầu (vào toàn màn hình)
  fitSoon();
}
const load = (f) => fetch(`js/${f}`).then((r) => r.json());
const [raw, audioCfg, changelog, vi, en] = await Promise.all([loadRaw(load), load('data/audio.json'), load('data/changelog.json'), load('i18n/vi.json'), load('i18n/en.json')]);
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
  get musicVol() { return progress.settings.musicVol; },
  get sfxVol() { return progress.settings.sfxVol; },
  get music() { return progress.settings.music; },
  get sfx() { return progress.settings.sfx; },
  get haptic() { return progress.settings.haptic; },
});
document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
document.addEventListener('click', (e) => {
  const el = e.target.closest?.('#screen button, #screen [role=button], #screen [data-zone], #screen [data-zone-card], #screen [data-stage], #screen [data-door], #screen .slot, #screen .tm-slot, #screen .tier, #screen .rchip, #screen .card.btn, #info button, .dock button');
  if (!el || el.disabled) return;
  if (el.id === 'door-info') return; // tự phát âm riêng
  audio.sfx(el.matches('.tier, .rchip, .slot, .tm-slot, [data-stage]') ? 'tick' : el.matches('[data-door]') ? 'open' : 'ui');
}, { capture: true });
let run = null;
let record = null;
let game = null;
let seedText = '';

// ---- tiện ích DOM
let atHub = false;
const track = (kind, n = 1) => { progress = trackQuest(ctx, progress, ui.dayKey(), kind, n); if (kind === 'win_battle') progress = bumpBattles(progress, n); }; // tiến độ nhiệm vụ hằng ngày
// Nhạc theo vùng: battle_water, boss_fire, map_wood… Chưa có bài riêng thì dùng bài chung.
const zoneTrack = (kind, zoneId) => {
  const name = `${kind}_${String(zoneId ?? '').replace('zone_', '')}`;
  return audioCfg.tracks[name] ? name : kind;
};
const guide = createGuide($('wrap'));
const guideStep = () => progress?.onboarding?.guide;
const guideSet = (step) => { if (step) progress.onboarding.guide = step; else delete progress.onboarding.guide; save(); };
const guidePoint = (target, key, delay) => guide.point(target, t(key), delay);
let sceneTrack = null; // bài nhạc cho màn sắp dựng (đặt NGAY TRƯỚC screen(...); gọi lại cùng màn thì nhạc không bị khởi động lại)
const music = (name) => { sceneTrack = name; };
// Canvas trận chỉ hiện khi đang đánh: ẩn ở mọi màn khác để khi chuyển cảnh không thoáng thấy bàn ngọc cũ.
function showBattleCanvas(on) {
  const c = $('cv');
  if (!c) return;
  if (!on) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
  c.style.visibility = on ? 'visible' : 'hidden';
  $('wrap')?.classList.toggle('inbattle', on);
}
const screen = (...kids) => {
  $('info')?.remove();
  $('coach')?.remove(); // lớp chỉ dẫn tutorial còn sót (vd thoát giữa chừng) sẽ chặn chạm ở mọi màn
  $('coach-dim')?.remove();
  $('pause-btn')?.remove();
  $('hint-btn')?.remove();
  guide.clear();
  $('tour-ui')?.remove();
  $('screen').onpointerdown = null;
  atHub = false;
  audio.playMusic(sceneTrack || 'hub');
  sceneTrack = null;
  $('screen').style.backgroundImage = '';
  game?.destroy();
  game = null;
  if (updateReady) setTimeout(showUpdatePill, 500);
  showBattleCanvas(false);
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
  el.classList.remove('hub', 'mapscreen', 'hubin', 'fitscreen');
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
  wish: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7M12 14v7M3 12h7M14 12h7"/>',
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

// Cảnh chính: Tòa Tháp 6 tầng giữa trời nắng, cầu vồng, mây, chim; mỗi khu mở là một viên ngọc phát sáng trên đảo nổi (chạm để vào khu).
function hubScene() {
  const zones = ctx.zoneList;
  const pos = ZONE_POS; // đảo khu vực đối xứng hai bên Tháp (ui/hub-art.js)
  const orbs = zones.map((z, i) => {
    const [x, y] = pos[i % pos.length];
    const open = progress.unlocked.includes(z.id);
    const col = COLORS[z.element];
    const S = open ? 88 : 80;
    const lock = open ? '' : '<svg class="zlockico" viewBox="0 0 18 20" aria-hidden="true"><rect x="0" y="7" width="18" height="13" rx="3" fill="#2b66aa" stroke="#fff8e6" stroke-width="1.8"/><path d="M4 7V4.5a5 5 0 0 1 10 0V7" fill="none" stroke="#fff8e6" stroke-width="2"/></svg>';
    return `<div class="sp zorb${open ? ' open' : ''}" ${open ? `data-zone="${z.id}" role="button" tabindex="0" aria-label="${t(`zone.${z.id}`)}"` : ''} style="--x:${x};--y:${y};--w:${S};--h:${S};--c:${col};animation-delay:${(i * 0.7).toFixed(1)}s">${open ? '<i class="halo"></i>' : ''}<img src="assets/ui/zones/${z.id}.webp" alt=""${open ? '' : ' class="locked"'}>${lock}</div>`;
  }).join('');
  const box = h('div', { class: 'hub-scene' + (DEBUG ? ' static' : '') });
  box.innerHTML = hubLayers('0 0 400 800') + orbs;
  fitScene(box, '0 0 400 800');
  box.querySelectorAll('[data-zone]').forEach((n) => {
    const go = () => showStages(n.getAttribute('data-zone'));
    n.addEventListener('click', go);
    n.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  });
  return box;
}

let updateReady = false;
// Có bản mới: ngoài trận thì ÉP cập nhật (hộp thoại chặn, một nút); đang trong trận thì chỉ hiện nút nhỏ để khỏi mất ván.
function doReload(btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = t('app.updating');
  audio.sfx('confirm');
  setTimeout(() => location.reload(), 150);
}
function showUpdatePill() {
  if (!updateReady || !$('wrap')) return;
  if (game) {
    if ($('upd-pill')) return;
    const b = h('button', { id: 'upd-pill', class: 'upd-pill', onclick: () => doReload(b) }, h('i', { 'aria-hidden': 'true' }, '⟳'), h('span', {}, h('b', {}, t('app.update')), h('small', {}, t('app.updateSub'))));
    $('wrap').appendChild(b);
    audio.sfx('reveal');
    return;
  }
  $('upd-pill')?.remove();
  if ($('upd-force')) return;
  $('info')?.remove();
  const go = btn(t('app.updateNow'), () => doReload(go), 'primary', { id: 'upd-go' });
  $('wrap').appendChild(h('div', { id: 'upd-force' }, h('div', { class: 'infobox pausebox updbox' }, h('i', { class: 'upd-big', 'aria-hidden': 'true' }, '⟳'), h('h3', {}, t('app.update')), h('p', {}, t('app.updateForce')), go)));
  audio.sfx('reveal');
}
// Hỏi thẳng máy chủ số bản dựng (không phụ thuộc service worker): khác bản đang chạy → có bản mới.
async function checkVersion() {
  if (updateReady) return;
  try {
    const r = await fetch(`js/version.js?_=${Date.now()}`, { cache: 'no-store' });
    const txt = await r.text();
    const b = Number(/BUILD\s*=\s*(\d+)/.exec(txt)?.[1]);
    const v = /VERSION\s*=\s*'([^']+)'/.exec(txt)?.[1];
    if (b && (b !== BUILD || (v && v !== VERSION))) { updateReady = true; showUpdatePill(); }
  } catch { /* offline: bỏ qua */ }
}
function showHub() {
  run = null;
  record = null;
  { const before = progress; track('login'); if (progress !== before) save(); }
  const inv = progress.inventory;
  screen(
    hubScene(),
    h(
      'div',
      { class: 'hub-top' },
      h('div', { class: 'avatar', id: 'b-profile', role: 'button', tabindex: '0', 'aria-label': t('profile.title'), style: 'cursor:pointer', onclick: () => ui.showProfile() }, avatarNode(progress.player)),
      h('div', { class: 'who', id: 'b-profile-name', style: 'cursor:pointer', onclick: () => ui.showProfile() }, h('b', {}, progress.player.name)),
      dockBtn('wish', t('hub.wish'), () => ui.showWish(), 'b-wish', 'help-btn', wishAvailable(progress, ui.dayKey())),
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
      dockBtn('quests', t('hub.quests'), () => showQuests(), 'b-quest', '', hasClaimable(ctx, progress, ui.dayKey()) || hasAchvClaimable(ctx, progress)),
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
  return h('button', { class: 'primary resume', id: 'b-resume', onclick: resumeRun }, h('span', { class: 'rs-t' }, t('run.resume')), h('small', {}, `${stageLabel(r)} · ${t('run.floor', { n: r.floor + 1, total: r.floors })}`));
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
  // Con đường leo tháp: ải 1 ở đáy, ải cuối (boss) ở đỉnh; các nút zích-zắc nối bằng đường nét đứt, đoạn đã qua sáng vàng.
  const zone = ctx.zones[zoneId];
  const zc = COLORS[zone.element] || '#ffb25a';
  const bossId = zone.monsters.boss[0];
  const ROW = 104;
  const PADY = 56;
  const XS = [32, 68, 36, 70, 32, 64];
  const posOf = (n) => ({ x: n === total ? 50 : XS[(n - 1) % XS.length], y: PADY + (total - n) * ROW + (n < total ? 26 : 0) }); // boss ở đỉnh có thêm khoảng thở
  const heightPx = PADY * 2 + (total - 1) * ROW + 26;
  const pts = Array.from({ length: total }, (_, i) => posOf(i + 1));
  const toPx = (q) => [(q.x / 100) * 360, q.y];
  const seg = (a, b) => { const [x0, y0] = toPx(a); const [x1, y1] = toPx(b); const my = (y0 + y1) / 2; return `M${x0} ${y0} C${x0} ${my} ${x1} ${my} ${x1} ${y1}`; };
  const svgNS = 'http://www.w3.org/2000/svg';
  const road = document.createElementNS(svgNS, 'svg');
  road.setAttribute('viewBox', `0 0 360 ${heightPx}`);
  road.setAttribute('preserveAspectRatio', 'none');
  road.setAttribute('class', 'sp-road');
  road.setAttribute('aria-hidden', 'true');
  road.innerHTML = pts.slice(0, -1).map((q, i) => `<path d="${seg(q, pts[i + 1])}" class="sp-bg"/>`).join('') + pts.slice(0, -1).map((q, i) => `<path d="${seg(q, pts[i + 1])}" class="sp-seg${i + 1 <= done ? ' lit' : ''}"/>`).join('');
  const nodes = Array.from({ length: total }, (_, i) => {
    const n = total - i; // DOM từ đỉnh xuống: boss trước, ải 1 sau cùng
    const open = stageOpen(ctx, progress, zoneId, tier, n);
    const clear = n <= done;
    const boss = n === total;
    const q = posOf(n);
    const face = boss
      ? h('img', { class: 'sn-art', src: `assets/monsters/${bossId}.webp`, alt: '', draggable: 'false' })
      : h('span', { class: 'sn-num' }, clear ? '✓' : open ? String(n) : '🔒');
    const node = h(
      'button',
      { class: 'snode' + (boss ? ' boss' : '') + (open ? '' : ' locked') + (clear ? ' clear' : ' ready'.repeat(open ? 1 : 0)), 'data-stage': String(n), style: `left:${q.x}%;top:${q.y}px`, 'aria-label': t(boss ? 'stage.boss' : 'stage.num', { n }), onclick: () => !heldFlag.v && open && showTeam(undefined, undefined, { zoneId, diff: tier, stage: n }) },
      h('span', { class: 'sn-orb' }, face, boss ? h('b', { class: 'sn-crown' }, '★') : null, clear && !boss ? h('i', { class: 'sn-stars' }, '★★★') : null),
      h('span', { class: 'sn-label' }, t(boss ? 'stage.boss' : 'stage.num', { n }), h('small', {}, clear ? t('stage.cleared') : open ? t('stage.next') : t('stage.lockedPrev'))),
    );
    onHold(node, () => showStageInfo(zoneId, tier, n));
    return node;
  });
  const path = h('div', { class: 'stagepath' }, h('div', { class: 'sp-inner', style: `height:${heightPx}px` }, road, nodes));
  const head = h('div', { class: 'zhead' },
    h('img', { class: 'zh-emblem', src: `assets/ui/zones/${zoneId}.webp`, alt: '' }),
    h('div', { class: 'zh-text' }, h('h2', {}, t(`zone.${zoneId}`)), h('small', {}, t('zone.clears', { n: zoneClears(progress, zoneId) }))));
  const gst = ['zone', 'stage', 'team'].includes(guideStep());
  music(zoneTrack('map', zoneId));
  $('screen').style.setProperty('--zc', zc);
  $('screen').style.setProperty('--zbg', `url(../assets/bg/${zoneId}.webp)`);
  $('screen').style.setProperty('--zbgt', `url(../assets/bg/${zoneId}_tall.webp)`); // nền dài cho đường ải: tranh phủ tới ải 1, chỉ chút mây ở chân
  screen(head, tabs, h('div', { class: 'muted tier-note' }, t('diff.reward', { gold: df.gold, drop: df.drop })), path, h('div', { class: 'muted hold-hint' }, t('stage.hold')), btn(t('back'), showZones, '', { id: 'back' }));
  $('screen').classList.add('fitscreen');
  // cuộn tới ải đang chơi (ải kế tiếp), để người chơi luôn thấy nút cần bấm
  requestAnimationFrame(() => { const sc = $('screen').querySelector('.stagepath'); if (sc) sc.scrollTop = Math.max(0, posOf(Math.min(total, done + 1)).y - sc.clientHeight * 0.55); });
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
  const total = ctx.config.run.stages;
  const order = ctx.config.difficulty.order;
  const lockSvg = '<svg viewBox="0 0 18 20" aria-hidden="true"><rect x="0" y="7" width="18" height="13" rx="3" fill="#2b66aa" stroke="#fff8e6" stroke-width="1.8"/><path d="M4 7V4.5a5 5 0 0 1 10 0V7" fill="none" stroke="#fff8e6" stroke-width="2"/></svg>';
  const zoneCards = ctx.zoneList.map((z, i) => {
    const open = progress.unlocked.includes(z.id);
    const st = inv.stones[z.element];
    const done = order.reduce((a, d) => a + Math.min(total, stagesDone(progress, z.id, d)), 0);
    const art = h('div', { class: 'zc-art' }, h('img', { src: `assets/ui/zones/${z.id}.webp`, alt: '', draggable: 'false' }));
    if (!open) { const lk = h('i', { class: 'zc-lock' }); lk.innerHTML = lockSvg; art.append(lk); }
    return h(
      'div',
      { class: 'zc' + (open ? '' : ' locked'), 'data-zone-card': z.id, role: open ? 'button' : null, tabindex: open ? '0' : null, style: `--el:${COLORS[z.element]};--i:${i}`, onclick: open ? () => showStages(z.id) : null },
      art,
      open
        ? h('div', { class: 'zc-info' },
          h('div', { class: 'zc-top' }, h('b', { class: 'zc-name' }, t(`zone.${z.id}`)), h('span', { class: 'zc-clr' }, t('zone.clears', { n: zoneClears(progress, z.id) }))),
          h('div', { class: 'zc-diffs' }, order.map((d) => { const n = Math.min(total, stagesDone(progress, z.id, d)); return h('div', { class: 'zc-d d-' + d + (n >= total ? ' full' : '') }, h('span', {}, `${t(`diff.${d}`)} ${n}/${total}`), h('i', {}, h('u', { style: `width:${Math.round((n / total) * 100)}%` }))); })),
          h('div', { class: 'zc-loot' }, itemIcon('stoneN', 'sm', COLORS[z.element]), h('span', {}, String(st.normal)), itemIcon('stoneR', 'sm', COLORS[z.element]), h('span', {}, String(st.rare)), h('em', {}, `${done}/${total * order.length}`)))
        : h('div', { class: 'zc-info' }, h('b', { class: 'zc-name' }, t(`zone.${z.id}`)), h('small', {}, t('zone.locked'))),
    );
  });
  const act0 = activeRunInfo();
  const gz = ['zone', 'stage', 'team'].includes(guideStep());
  screen(
    h('h2', { class: 'zones-title' }, t('hub.zones')),
    act0 ? h('div', { class: 'zr' }, h('i', { class: 'zr-glow' }), h('div', { class: 'zr-info' }, h('b', {}, stageLabel(act0.run)), h('small', {}, t('run.floor', { n: act0.run.floor + 1, total: act0.run.floors }))), h('div', { class: 'zr-btns' }, btn(t('run.resume'), resumeRun, 'primary', { id: 'zones-resume' }), btn(t('run.abandon'), () => { clearActiveRun(); showZones(); }, '', { id: 'zones-abandon' }))) : null,
    h('div', { class: 'zc-list' }, zoneCards),
    h('details', { class: 'zc-debug' }, h('summary', {}, t('hub.debug')), h('label', {}, t('hub.seed'), h('input', { id: 'seed', inputmode: 'numeric', value: seedText, oninput: (e) => (seedText = e.target.value) })), h('p', { class: 'muted' }, t('hub.progress'))),
    btn(t('back'), showHub, '', { id: 'back', class: 'zones-back-hid' }),
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
    c ? portrait(id, 64) : h('div', { style: 'width:64px;height:64px;border-radius:12px;border:3px solid #5d9fe0;flex:none;display:flex;align-items:center;justify-content:center;font-size:24px' }, '?'),
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
  music('camp');
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
  const act = (fn, okMsg, quest) => {
    const r = fn();
    if (r.ok) {
      progress = r.progress;
      if (quest) track(quest);
      if (quest === 'level_up') audio.sfx('levelup');
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
          [1, 2, 3].map((tier) => h('div', { class: 'fodder-row', 'data-elixir': tier }, itemIcon(`elixir${tier}`, 'sm'), h('span', {}, `${t(`res.elixir.${tier}`)} ×${inv.elixir[tier]} `, h('small', { class: 'muted' }, `+${ctx.config.elixir[tier].exp} EXP`)), btn(t('char.useOne'), () => act(() => useElixir(ctx, progress, id, tier, 1), gained, 'level_up')), btn(t('char.useUpTo'), () => act(() => useElixir(ctx, progress, id, tier, 1e9), gained, 'level_up')))),
          fodderKeys.length
            ? fodderKeys.map((k) => {
                const f = ctx.fodder[k];
                return h('div', { class: 'fodder-row', 'data-fodder': k }, h('span', {}, `${t(`fodder.${f.element}.${f.star}`)} ${'★'.repeat(f.star)} ×${inv.fodder[k]} `, h('small', { class: 'muted' }, t('char.fodderEach', { n: fodderExp(ctx, id, k) }))), btn(t('char.feed'), () => act(() => feedFodder(ctx, progress, id, k, 1), gained, 'level_up')), btn(t('char.feedAll'), () => act(() => feedFodder(ctx, progress, id, k, 999), gained, 'level_up')));
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
        cost ? btn(t('skill.upBtn'), () => act(() => skillUp(ctx, progress, id, kind), () => t('skill.upDone'), 'skill_up'), '', { id: `skillup-${kind}` }) : h('small', { class: 'muted' }, t('skill.lvMax')),
      );
    }),
  );
  music('camp');
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
    { class: `tile r${def.rarity}` + (slotNo ? ' in' : ''), 'data-char': id, style: `--el:${COLORS[def.element]}` },
    portrait(id, 66),
    slotNo ? h('b', { class: 'tslot' }, String(slotNo)) : null,
    h('span', { class: 'tlv' }, `${c.level}`),
    h('span', { class: 'tst' }, '★'.repeat(def.rarity)),
  );
}

// Chọn kiểu tự lập đội: mỗi kiểu một cách xếp (core/upgrade.js autoTeam).
function showAutoPicker(stage) {
  if ($('info')) return;
  const close = () => $('info')?.remove();
  const go = (mode) => { const r = autoTeam(ctx, progress, mode); if (r.ok) { progress = r.progress; save(); } close(); showTeam(0, undefined, stage); };
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() },
    h('div', { class: 'infobox' }, h('h3', {}, t('team.auto.title')),
      AUTO_MODES.map((m) => h('button', { class: 'auto-opt', 'data-auto': m, onclick: () => go(m) }, h('b', {}, t(`team.auto.${m}`)), h('small', {}, t(`team.auto.${m}.d`)))),
      btn(t('info.close'), close, '', { id: 'info-close' }))));
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
    const at = team.indexOf(id);
    if (at >= 0) { apply(placeInSlot(progress, at, null)); return again(at); } // chạm tướng đã trong đội = bỏ ra khỏi đội
    const wasEmpty = team[slot] === null;
    if (!apply(placeInSlot(progress, slot, id))) return again(slot);
    // lấp ô trống xong thì nhảy sang ô trống kế tiếp để chọn liền tay
    const nxt = wasEmpty ? progress.team.findIndex((x, i) => x === null && i > slot) : -1;
    again(nxt >= 0 ? nxt : slot);
  };
  const cur = progress.preset ?? 0;
  const tabs = h('div', { class: 'team-tabs', style: `--n:${presetsOf(progress).length}` }, presetsOf(progress).map((_, i) => h('button', { class: 'btn' + (i === cur ? ' primary' : ''), 'data-preset': i, onclick: () => { apply(selectPreset(progress, i)); showTeam(undefined, undefined, stage); } }, t('team.preset', { n: i + 1 }))));
  const slots = h('div', { class: 'slots' }, team.map((id, i) => {
    const lead = i === 0;
    const sel = i === slot;
    const cls = 'tm-slot' + (lead ? ' lead' : '') + (sel ? ' slot-sel' : '') + (id ? '' : ' empty');
    const tag = h('small', { class: 'sname' }, lead ? '♛' : String(i + 1));
    const body = id
      ? [tag, h('div', { class: 'tm-ph' }, portrait(id, 64), h('b', { class: 'tm-lv' }, String(progress.characters[id].level))), h('small', { class: 'sn' }, t(`char.${id}`))]
      : [tag, h('div', { class: 'plus' }, '+'), h('small', { class: 'sn' }, lead ? t('team.leader') : t('team.empty'))];
    const node = h('div', { class: cls, 'data-slot': i, onclick: () => again(i) }, ...body);
    return id ? longPress(node, () => showChar(id, undefined, () => again(i))) : node;
  }));
  const needLeader = team[0] === null;
  const sorted = owned().slice().sort((a, b) => b.rarity - a.rarity || a.element - b.element || progress.characters[b.id].level - progress.characters[a.id].level || (a.id < b.id ? -1 : 1));
  music('camp');
  screen(
    h('h2', {}, stage ? t('team.prep', { zone: `${t(`zone.${stage.zoneId}`)} · ${t(`diff.${stage.diff}`)} · ${t('stage.num', { n: stage.stage })}` }) : t('hub.team')),
    tabs,
    slots,
    h(
      'div',
      { class: 'tm-tools' },
      btn(t('team.auto'), () => showAutoPicker(stage), '', { id: 'team-auto' }),
      btn(t('team.remove'), () => { apply(placeInSlot(progress, slot, null)); again(slot); }, '', { id: 'team-remove', ...(team[slot] === null ? { disabled: '' } : {}) }),
      btn(t('team.clear'), () => { apply(clearTeam(progress)); again(0); }, '', { id: 'team-clear', ...(members.length ? {} : { disabled: '' }) }),
      slot > 0 && team[slot] ? btn(t('team.makeLeader', { name: t(`char.${team[slot]}`) }), () => { apply(makeLeader(progress, slot)); again(0); }, '', { id: 'make-leader' }) : null,
    ),
    h('div', { class: 'card tm-info' },
      members.length ? h('div', {}, h('b', {}, '♛ ', t('char.leader')), h('span', { class: 'muted' }, ': ', leaderText(resolveKit(ctx, members[0], progress.characters[members[0]].skillLv, formOf(progress.characters[members[0]].awaken)).leader))) : null,
      h('div', { class: duos.length ? 'tm-duo on' : 'tm-duo' }, h('b', {}, 'Duo'), h('span', { class: 'muted' }, ': ', members.length < 2 || !duos.length ? t('team.noDuo') : duos.map((d) => t(`duo.${d.id}`)).join(', ')))),
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
let questMsg = null;
let questTab = 'daily';
function showQuests() {
  progress = ensureQuests(ctx, progress, ui.dayKey());
  const day = ui.dayKey();
  const q = progress.quests;
  const cfg = ctx.config.quests;
  const rewardText = (r) => [r.spirit ? `${r.spirit} ${t('res.spirit')}` : null, r.gold ? `${r.gold} ${t('res.gold')}` : null, r.tickets ? `${r.tickets} ${t('res.ticket')}` : null].filter(Boolean).join(' · ');
  const claim = (fn, ev) => {
    const r = fn();
    if (r.ok) { progress = r.progress; save(); rewardPop([{ k: 'spirit', n: r.reward.spirit }, { k: 'gold', n: r.reward.gold }, { k: 'ticket', n: r.reward.tickets }], ev); questMsg = `+ ${rewardText(r.reward)}`; } else questMsg = t(`err.${r.reason}`);
    showQuests();
  };
  const rows = q.list.map((x) => {
    const done = isDone(x);
    return h('div', { class: 'card quest' + (done ? ' done' : '') + (x.claimed ? ' claimed' : ''), 'data-quest': x.id },
      h('div', { class: 'q-info' }, h('b', {}, t(`quest.${x.kind}`, { n: x.goal })), h('div', { class: 'q-bar' }, h('i', { style: `width:${Math.round((100 * x.count) / x.goal)}%` })), h('small', { class: 'muted' }, `${x.count}/${x.goal} · ${rewardText(x.reward)}`)),
      x.claimed ? h('span', { class: 'q-done' }, t('quest.claimed')) : btn(t('quest.claim'), (e) => claim(() => claimQuest(ctx, progress, day, x.id), e), done ? 'primary' : '', { id: `claim-${x.id}`, ...(done ? {} : { disabled: '' }) }));
  });
  const all = allClaimed(progress);
  const bonus = h('div', { class: 'card quest bonus' + (all && !q.bonusClaimed ? ' done' : '') + (q.bonusClaimed ? ' claimed' : '') },
    h('div', { class: 'q-info' }, h('b', {}, t('quest.bonus')), h('small', { class: 'muted' }, rewardText(cfg.bonus))),
    q.bonusClaimed ? h('span', { class: 'q-done' }, t('quest.claimed')) : btn(t('quest.claim'), (e) => claim(() => claimBonus(ctx, progress, day), e), all ? 'primary' : '', { id: 'claim-bonus', ...(all ? {} : { disabled: '' }) }));
  const goTab = (tab) => { questTab = tab; questMsg = null; showQuests(); };
  const achvRows = listAchievements(ctx, progress).map((a) => {
    const prev = a.claimed ? a.tiers[a.claimed - 1].goal : 0;
    const goal = a.next ? a.next.goal : a.tiers[a.tiers.length - 1].goal;
    const pct = a.next ? Math.round((100 * Math.max(0, Math.min(a.value, goal) - prev)) / (goal - prev)) : 100;
    return h('div', { class: 'card quest achv' + (a.ready ? ' done' : '') + (!a.next ? ' claimed' : ''), 'data-achv': a.id },
      h('div', { class: 'q-info' }, h('b', {}, t(`achv.${a.id}`)), h('div', { class: 'q-bar' }, h('i', { style: `width:${pct}%` })),
        h('small', { class: 'muted' }, a.next ? `${Math.min(a.value, goal)}/${goal} · ${rewardText(a.next.reward)} · ${t('achv.tier', { n: a.claimed + 1, m: a.tiers.length })}` : `${t('achv.max')} · ${a.tiers.length}/${a.tiers.length}`)),
      !a.next ? h('span', { class: 'q-done' }, t('quest.claimed')) : btn(t('quest.claim'), (e) => claim(() => claimAchievement(ctx, progress, a.id), e), a.ready ? 'primary' : '', { id: `claim-achv-${a.id}`, ...(a.ready ? {} : { disabled: '' }) }));
  });
  const dot = (on) => (on ? h('i', { class: 'red-dot' }) : null);
  const dailyDot = hasClaimable(ctx, progress, day), achvDot = hasAchvClaimable(ctx, progress);
  music('camp');
  screen(
    h('h2', {}, t('hub.quests')),
    h('div', { class: 'row' },
      h('button', { class: questTab === 'daily' ? 'primary' : '', id: 'tab-daily', onclick: () => goTab('daily') }, t('quest.daily'), dot(dailyDot)),
      h('button', { class: questTab === 'achv' ? 'primary' : '', id: 'tab-achv', onclick: () => goTab('achv') }, t('quest.achv'), dot(achvDot))),
    questTab === 'daily' ? h('div', { class: 'muted' }, t('quest.resetNote')) : null,
    questMsg ? h('div', { class: 'notice', id: 'quest-msg' }, questMsg) : null,
    ...(questTab === 'daily' ? [...rows, bonus] : achvRows),
    btn(t('back'), showHub, '', { id: 'back' }),
  );
  questMsg = null;
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
  let nodes = `<g class="nd start"><circle cx="${start.x}" cy="${start.y}" r="26" fill="url(#zg)" class="torchglow"/><circle cx="${start.x}" cy="${start.y}" r="18" fill="url(#rimG)" stroke="#7a4a12" stroke-width="1.2"/><circle cx="${start.x}" cy="${start.y}" r="14.500" fill="#173a6c"/><path d="M${start.x - 7} ${start.y + 8}v-9a7 7 0 0 1 14 0v9z" fill="#ffe9ad" stroke="#fff8e6" stroke-width="1.2"/><path d="M${start.x - 3.500} ${start.y + 8}v-6a3.500 3.500 0 0 1 7 0v6z" fill="#3a2410"/></g>`;
  const label = (x, y, k, strong) => { if (k === '?' || k === 'f?') return ''; const tx = t(`door.${k}`); const w = Math.max(50, tx.length * 7.4 + 18); return `<g class="lab${strong ? ' strong' : ''}"><rect x="${x - w / 2}" y="${y - 12}" width="${w}" height="20" rx="10" class="lbg"/><text x="${x}" y="${y + 2.5}" text-anchor="middle" class="nl${strong ? ' strong' : ''}">${tx}</text></g>`; };
  for (const row of rows) {
    row.kinds.forEach((k, i) => {
      const [x, y] = pos(row, i);
      const big = k === 'boss' || (row.r === n - 1);
      const rad = big ? 30 : 23;
      if (k === '?' || k === 'f?') {
        nodes += `<g class="nd ghost"><circle cx="${x}" cy="${y}" r="${rad - 1}" class="gbub"/><circle cx="${x - rad * 0.3}" cy="${y - rad * 0.35}" r="${rad * 0.18}" fill="#fff" opacity=".6"/>${k === 'f?' ? `<g transform="translate(${x - 9} ${y - 9}) scale(.75)" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2" stroke-linecap="round">${NODE.normal.icon}</g>` : `<text x="${x}" y="${y + 7}" text-anchor="middle" class="q">?</text>`}</g>`;
        return;
      }
      const d = NODE[k];
      const taken = row.past && row.pick === i;
      const skipped = row.past && row.pick !== i;
      const cls = 'nd' + (row.cur ? ' cur' : '') + (taken ? ' taken' : '') + (skipped ? ' skipped' : '') + (big ? ' big' : '');
      const attr = row.cur ? ` data-door="${i}" role="button" tabindex="0" aria-label="${t(`door.${k}`)}"` : '';
      const ic = `<g transform="translate(${x - 12 * (rad / 23)} ${y - 12 * (rad / 23)}) scale(${rad / 23})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="${skipped ? 0.4 : 1}" class="ico">${d.icon}</g>`;
      const spikes = big && !skipped ? `<g class="spikes" style="transform-origin:${x}px ${y}px">${Array.from({ length: 12 }, (_, q) => `<path d="M${x} ${y - rad - 4}l3.4 -9 3.4 9z" transform="rotate(${q * 30} ${x} ${y})" fill="${d.col}" opacity=".85"/>`).join('')}</g>` : '';
      const check = taken ? `<g transform="translate(${x + rad * 0.62} ${y - rad * 0.62})"><circle r="9" fill="#2fbf6a" stroke="#fff8e6" stroke-width="2"/><path d="M-4 0l3 3.2 5-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>` : '';
      nodes += `<g class="${cls}"${attr} style="--c:${d.col}">${row.cur ? `<circle class="pulse" cx="${x}" cy="${y}" r="${rad + 12}" fill="${d.col}"/><circle class="spin" cx="${x}" cy="${y}" r="${rad + 8}" fill="none" stroke="#fff6c0" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round" style="transform-origin:${x}px ${y}px"/>` : ''}${spikes}<circle cx="${x}" cy="${y}" r="${rad + 3.5}" fill="${skipped ? '#9aa6b8' : 'url(#rimG)'}" stroke="#7a4a12" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="${rad}" fill="url(#nb-${k})" stroke="#173a6c" stroke-width="2"/><path d="M${x - rad * 0.78} ${y - rad * 0.25}A${rad * 0.82} ${rad * 0.82} 0 0 1 ${x + rad * 0.78} ${y - rad * 0.25}Q${x} ${y - rad * 0.75} ${x - rad * 0.78} ${y - rad * 0.25}z" fill="#fff" opacity="${skipped ? 0.1 : 0.28}"/>${ic}${check}${row.cur || big ? label(x, y + rad + 15, k, row.cur) : ''}</g>`;
    });
  }
  if (curRow || true) {
    // dấu vị trí đội: viên ngọc phát sáng ở điểm vừa đi tới
    nodes += `<g class="you"><circle cx="${last[0] + 26}" cy="${last[1] - 4}" r="6" fill="#ffe9ad"/><circle cx="${last[0] + 26}" cy="${last[1] - 4}" r="11" fill="#ffe9ad" opacity=".25"/></g>`;
  }
  let stars = '';
  for (let i = 0; i < 26; i++) stars += `<path class="tw" style="animation-delay:${((i * 0.37) % 3).toFixed(2)}s" transform="translate(${(i * 97.3) % 400} ${(i * 53.7) % 600}) scale(${0.5 + (i % 3) * 0.35})" d="M0 -5L1.300 -1.300L5 0L1.300 1.300L0 5L-1.300 1.300L-5 0L-1.300 -1.300z" fill="#fff" opacity=".7"/>`;
  let cols = '';
  for (const x of [26, 374]) {
    cols += `<g class="pillar"><rect x="${x - 13}" y="62" width="26" height="520" rx="3" fill="url(#col)" stroke="#b98a3a" stroke-width="1.4"/>`;
    for (const gx of [-6, 0, 6]) cols += `<path d="M${x + gx} 64v516" stroke="#c9a15a" stroke-opacity=".35" stroke-width="1"/>`;
    cols += `<rect x="${x - 19}" y="52" width="38" height="12" rx="3" fill="url(#rimG)" stroke="#7a4a12"/><rect x="${x - 19}" y="578" width="38" height="12" rx="3" fill="url(#rimG)" stroke="#7a4a12"/>`;
    for (const y of [150, 270, 390, 500]) cols += `<path d="M${x} ${y - 9}l7 9-7 9-7-9z" fill="var(--zc,#ffb25a)" stroke="#fff8e6" stroke-width="1.2" opacity=".9" class="rune"/>`;
    cols += `<path d="M${x - 15} 52h30l-4 -9h-22z" fill="url(#rimG)" stroke="#7a4a12"/><g transform="translate(${x} 43) scale(1.7) translate(${-x} -43)"><g class="flame" style="transform-origin:${x}px 43px"><path d="M${x} 14c5 7 8 11 8 17a8 8 0 0 1-16 0c0-4 2-6 4-9 0 3 1 4 2 4-1-4-1-8 2-12z" fill="var(--zc,#ffb25a)"/><path d="M${x} 24c3 4 4 6 4 9a4 4 0 0 1-8 0c0-2 1-3 2-5 0 2 1 2 2 2z" fill="#fff2c4"/></g></g><circle cx="${x}" cy="30" r="40" fill="url(#zg)" class="torchglow"/></g>`;
  }
  return `<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid meet" aria-hidden="false">
<defs><linearGradient id="col" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6cf9c"/><stop offset=".45" stop-color="#fff8e2"/><stop offset="1" stop-color="#d4b57a"/></linearGradient><linearGradient id="rimG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#f3c64e"/><stop offset="1" stop-color="#c77a0e"/></linearGradient><radialGradient id="nb-normal" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${NODE.normal.ring}"/><stop offset=".55" stop-color="${NODE.normal.col}"/><stop offset="1" stop-color="#173a6c"/></radialGradient><radialGradient id="nb-elite" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${NODE.elite.ring}"/><stop offset=".55" stop-color="${NODE.elite.col}"/><stop offset="1" stop-color="#173a6c"/></radialGradient><radialGradient id="nb-boss" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${NODE.boss.ring}"/><stop offset=".55" stop-color="${NODE.boss.col}"/><stop offset="1" stop-color="#173a6c"/></radialGradient><radialGradient id="nb-swarm" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${NODE.swarm.ring}"/><stop offset=".55" stop-color="${NODE.swarm.col}"/><stop offset="1" stop-color="#173a6c"/></radialGradient><radialGradient id="nb-shrine" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${NODE.shrine.ring}"/><stop offset=".55" stop-color="${NODE.shrine.col}"/><stop offset="1" stop-color="#173a6c"/></radialGradient><radialGradient id="nb-chest" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${NODE.chest.ring}"/><stop offset=".55" stop-color="${NODE.chest.col}"/><stop offset="1" stop-color="#173a6c"/></radialGradient><radialGradient id="nb-rest" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${NODE.rest.ring}"/><stop offset=".55" stop-color="${NODE.rest.col}"/><stop offset="1" stop-color="#173a6c"/></radialGradient><radialGradient id="nb-event" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${NODE.event.ring}"/><stop offset=".55" stop-color="${NODE.event.col}"/><stop offset="1" stop-color="#173a6c"/></radialGradient><radialGradient id="nb-shop" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${NODE.shop.ring}"/><stop offset=".55" stop-color="${NODE.shop.col}"/><stop offset="1" stop-color="#173a6c"/></radialGradient><radialGradient id="zg"><stop offset="0" stop-color="var(--zc,#ffb25a)" stop-opacity=".55"/><stop offset="1" stop-color="var(--zc,#ffb25a)" stop-opacity="0"/></radialGradient><radialGradient id="tg" cx=".5" cy=".12" r=".7"><stop offset="0" stop-color="#fff6c0" stop-opacity=".35"/><stop offset="1" stop-color="#fff6c0" stop-opacity="0"/></radialGradient><radialGradient id="rg" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="400" height="600" fill="url(#rg)"/><rect width="400" height="600" fill="url(#tg)"/>${stars}${cols}${faint}${gold}${nodes}</svg>`;
}


// ---- Túi đồ trong chuyến: vật phẩm + Di Vật đang giữ, lưới ô như hòm đồ ngoài
const ITEM_COL = { potion: '#6be39a', shield: '#6bb7ff', time: '#c58bff' };
const BAG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5.5A2.5 2.5 0 0 1 10.500 3h3A2.500 2.500 0 0 1 16 5.500V7"/><path d="M6.500 7h11A2.500 2.500 0 0 1 20 9.500v9A2.500 2.500 0 0 1 17.500 21h-11A2.500 2.500 0 0 1 4 18.500v-9A2.500 2.500 0 0 1 6.500 7z"/><path d="M4 13h16M10.500 13v2h3v-2"/></svg>';
const HOME_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7M6 10v10h4v-6h4v6h4V10"/></svg>';
function mapFoot() {
  const n = run.items.potion + run.items.shield + run.items.time + run.relics.length;
  const bag = h('button', { class: 'bagbtn', id: 'bag-btn', 'aria-label': t('run.bag'), onclick: () => showBag() });
  bag.innerHTML = BAG_SVG;
  if (n > 0) bag.append(h('b', {}, String(n)));
  const leave = h('button', { class: 'leavebtn', id: 'leave-run', onclick: leaveRun });
  leave.innerHTML = HOME_SVG;
  leave.append(h('span', {}, t('run.leave')));
  return h('div', { class: 'mapfoot' }, bag, leave);
}
function showBag(selKey) {
  $('info')?.remove();
  const rc = ctx.config.run.items;
  const desc = {
    potion: t('item.desc.potion', { n: Math.round(rc.potion.healPct * 100) }),
    shield: t('item.desc.shield', { n: Math.round(rc.shield.pct * 100) }),
    time: t('item.desc.time', { n: rc.time.bonusMs / 1000 }),
  };
  const entries = [];
  for (const it of ['potion', 'shield', 'time']) if (run.items[it] > 0 || run.armed[it]) entries.push({ key: it, kind: 'item', it, name: t(`item.${it}`), n: run.items[it], col: ITEM_COL[it], armed: !!run.armed[it] });
  for (const id of run.relics) entries.push({ key: `r_${id}`, kind: 'relic', id, name: relicName(id), n: 0, col: RELIC_COL[ctx.relics[id].rarity] });
  const close = () => $('info')?.remove();
  const tabs = [['all', t('items.all')], ['item', t('run.bag.items')], ['relic', t('run.bag.relics')]];
  if (!tabs.some(([k]) => k === bagTab)) bagTab = 'all';
  const shown = entries.filter((e) => bagTab === 'all' || e.kind === bagTab);
  const sel = shown.find((e) => e.key === selKey) || shown[0];
  const tabRow = h('div', { class: 'row tabs' }, tabs.map(([k, label]) => btn(label, () => { bagTab = k; showBag(); }, bagTab === k ? 'primary' : '', { 'data-tab': k })));
  const cells = shown.map((e) => {
    const ic = h('span', { class: 'ricon icon-lg' });
    ic.innerHTML = e.kind === 'item' ? `<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:${e.col};stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round">${ITEM_ICON[e.it]}</svg>` : relicIconSvg(e.id);
    const c = h('button', { class: 'slot' + (e === sel ? ' sel' : ''), 'data-bag': e.key, style: `--rc:${e.col}`, onclick: () => { audio.sfx('tick'); showBag(e.key); } }, ic);
    if (e.n > 0) c.append(h('b', {}, `×${e.n}`));
    if (e.armed) c.append(h('em', { class: 'bag-on' }, '✓'));
    return c;
  });
  let detail = null;
  if (sel) {
    const ic = h('span', { class: 'ricon icon-lg' });
    ic.innerHTML = sel.kind === 'item' ? `<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:none;stroke:${sel.col};stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round">${ITEM_ICON[sel.it]}</svg>` : relicIconSvg(sel.id);
    let body;
    if (sel.kind === 'item') {
      const off = run.items[sel.it] <= 0 || (sel.it === 'potion' && run.hp >= run.maxHp) || run.armed[sel.it];
      body = [h('b', {}, `${sel.name} ×${run.items[sel.it]}`), h('small', { class: 'muted' }, desc[sel.it]),
        btn(run.armed[sel.it] ? t('run.armed') : t('bag.use'), () => { act({ type: 'useItem', item: sel.it }); showBag(run.items[sel.it] > 0 || run.armed[sel.it] ? sel.key : undefined); }, off ? '' : 'primary', { id: 'bag-use', ...(off ? { disabled: '' } : {}) })];
    } else {
      const r = ctx.relics[sel.id];
      body = [h('b', {}, sel.name, ' ', h('small', { style: `color:${sel.col}` }, t(`relic.rarity.${r.rarity}`))), modLines(sel.id).map((l) => h('div', { class: 'muted' }, l))];
    }
    detail = h('div', { class: 'card item-detail', id: 'bag-detail', 'data-relic': sel.kind === 'relic' ? sel.id : null, style: `--rc:${sel.col}` }, h('div', { class: 'row', style: 'gap:12px;align-items:center' }, ic, h('div', { class: 'col', style: 'gap:4px;flex:1' }, body)));
  }
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() },
    h('div', { class: 'infobox bagbox' }, h('h3', {}, t('run.bag')), tabRow,
      shown.length ? h('div', { class: 'item-grid', id: 'bag-grid' }, cells) : h('div', { class: 'muted bag-empty' }, t('run.bagEmpty')),
      detail, btn(t('info.close'), close, '', { id: 'info-close' }))));
}
let bagTab = 'all';

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
  const ic = h('span', { class: 'ricon icon-lg rc-ic', style: `--rc:${RELIC_COL[r.rarity]}` });
  ic.innerHTML = relicIconSvg(id);
  return h('div', { class: 'card relic', 'data-relic': id, style: `border-color:${RELIC_COL[r.rarity]}` }, h('div', { class: 'row', style: 'gap:10px;align-items:center;text-align:left' }, ic, h('div', { class: 'col', style: 'gap:3px;flex:1' }, h('b', {}, relicName(id), ' ', h('small', { style: `color:${RELIC_COL[r.rarity]}` }, t(`relic.rarity.${r.rarity}`))), modLines(id).map((l) => h('div', { class: 'muted' }, l)))), extra);
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
  const ico = h('span', { class: 'dd-medal' });
  ico.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d.icon}</svg>`;
  const foeCard = (m, n) => {
    const im = getImg(`monster:${m}`);
    const mo = ctx.monsters[m];
    const el = mo?.element ?? 0;
    const kind = mo?.kind || 'normal';
    const pas = (mo?.onAttack || []).map((u) => {
      const ch = u.chance ?? ctx.config.monsterPassive.chance[kind] ?? 1;
      return h('span', { class: 'dd-pas', title: `${t(`effect.${u.key}.name`)} ${Math.round(ch * 100)}%` }, h('img', { src: `assets/ui/fx/${u.key}.webp`, alt: t(`effect.${u.key}.name`) }), h('i', {}, `${Math.round(ch * 100)}%`));
    });
    return h('div', { class: `dd-card k-${kind}`, title: t(`monster.${m}`), style: `--el:${COLORS[el]};--i:${n}` },
      h('div', { class: 'dd-art' }, h('i', { class: 'dd-spot' }), h('i', { class: 'dd-shine' }), im ? h('img', { src: im.src, alt: t(`monster.${m}`) }) : null, h('i', { class: 'dd-floor' }), h('span', { class: 'dd-el' }, el_orb(el))),
      pas.length ? h('div', { class: 'dd-pass' }, pas) : null);
  };
  const body = foes ? h('div', { class: 'dd-foes n' + foes.length }, foes.map((m, n) => foeCard(m, n))) : h('div', { class: 'dd-plain' }, h('p', {}, t(`door.desc.${k}`)));
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() },
    h('div', { class: 'doordetail dd', style: `--c:${d.col};--ring:${d.ring}` },
      h('div', { class: 'dd-head' }, h('div', { class: 'dd-halo' }), ico, h('div', { class: 'dd-title' }, h('h3', {}, t(`door.${k}`)), h('small', {}, t(`door.desc.${k}`)))),
      foes ? h('div', { class: 'dd-sec' }, t('run.foes')) : null,
      body,
      h('div', { class: 'dd-btns' }, btn(t('info.close'), close, '', { id: 'info-close' }), btn(t('run.enterDoor'), () => { close(); act({ type: 'door', index: i }); }, 'primary', { id: 'door-enter' })))));
  if (doorHint) { doorHint = false; guidePoint('#door-enter', 'guide.enter', 250); }
}
// chấm hệ nhỏ (icon ngọc hệ) cho thẻ quái
function el_orb(e) {
  const s = h('span', { class: 'dd-orb', style: `--el:${COLORS[e]}` });
  const c = h('canvas', { width: 96, height: 96 });
  drawOrb(c.getContext('2d'), e, 48, 48, 42);
  s.append(c);
  return s;
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
  const map = h('div', { class: 'runmap' + (DEBUG ? ' static' : '') });
  map.innerHTML = runMapSVG();
  map.querySelectorAll('[data-door]').forEach((nd) => {
    const idx = Number(nd.getAttribute('data-door'));
    const go = () => { if (heldFlag.v) return; if (run.doors.length > 1) showDoorDetail(idx); else act({ type: 'door', index: idx }); }; // chọn cửa nào cũng có xác nhận (cửa duy nhất thì vào luôn)
    onHold(nd, () => showDoorDetail(idx));
    nd.addEventListener('click', go);
    nd.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  });
  music(zoneTrack('map', run.zoneId));
  screen(
    mapHeader(),
    map,
    run.doors.length > 1 ? h('div', { class: 'muted hold-hint' }, t('run.holdHint')) : null,
    mapFoot(),
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
  $('screen').style.setProperty('--zbgt', `url(../assets/bg/${run.zoneId}_tall.webp)`);
}

function battleIntro() {
  const danger = run.node === 'boss' || run.node === 'elite';
  const foes = run.battle.enemies;
  const lead = foes[foes.length - 1];
  const zc = COLORS[ctx.zones[run.zoneId].element] || '#ffd24a';
  return {
    danger,
    warn: t(run.node === 'boss' ? 'intro.boss' : 'intro.elite'),
    title: danger ? t(`monster.${lead.id}`) : t(`zone.${run.zoneId}`).toUpperCase(),
    zone: t(`zone.${run.zoneId}`).toUpperCase(),
    stage: t('stage.num', { n: run.stage ?? 1 }).toUpperCase(),
    col: zc,
    floor: run.floor, floors: run.floors,
    sub: danger ? `${t(`zone.${run.zoneId}`)} · ${t('stage.num', { n: run.stage ?? 1 })} · ${t('run.floor', { n: run.floor + 1, total: run.floors })}` : t('run.floor', { n: run.floor + 1, total: run.floors }),
    go: t('intro.go'),
    dur: danger ? 3000 : 3000,
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
  // Lớp tối phủ khi đang đọc chỉ dẫn; bong bóng nằm giữa bàn ngọc, người chơi bấm mũi tên ▶ thì bong bóng trôi lên và mờ đi.
  $('coach-dim')?.remove();
  const veil = h('div', { id: 'coach-dim' });
  $('wrap').insertBefore(veil, bubble);
  const coach = (key) => {
    if (!key) { bubble.classList.remove('on', 'go'); veil.classList.remove('on'); game?.setDim(false); return; }
    bubble.classList.remove('on', 'go');
    void bubble.offsetWidth;
    // Câu đầu (tới dấu chấm đầu tiên) là tiêu đề to màu vàng, phần còn lại là chỉ dẫn nhỏ hơn.
    const full = t(key);
    const cut = full.indexOf('. ');
    const last = key === 'tut.free';
    const go = h('button', { class: 'co-go', 'aria-label': t('ob.next'), onclick: () => {
      bubble.classList.add('go');
      veil.classList.remove('on');
      game?.setDim(!last);
      audio.sfx('ui');
    } }, '▶');
    bubble.replaceChildren(h('div', { class: 'co-h' }, cut > 0 ? full.slice(0, cut + 1) : full), ...(cut > 0 ? [h('div', { class: 'co-b' }, full.slice(cut + 2))] : []), go);
    bubble.classList.toggle('last', last);
    game?.setDim(false);
    veil.classList.add('on');
    bubble.classList.add('on');
    audio.sfx('tick');
  };
  // Người chơi làm đúng chỉ dẫn → bỏ lớp tối/đèn rọi và đường gợi ý ngay để thấy trọn màn hình trong lúc đòn diễn ra.
  const guard = (fn) => (a) => { const ok = fn(a); if (ok) { game.setDim(false); game.hideHint?.(); bubble.classList.add('go'); veil.classList.remove('on'); } return ok; };
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
        game.setGuide({ title, board: L.board || null, enemy: low, spot: { k: 'enemy', i: low }, allow: guard((a) => a.type === 'target' && a.index === low) });
        coach(L.coachLock);
      } else {
        lockIdx = -1;
        game.setGuide({ title, board: L.board || null, spot: { k: 'skill', i: L.index }, allow: guard((a) => a.type === 'skill' && a.index === L.index && (!L.lock || game.getState().focus === low)) });
        coach(L.coach);
      }
      return;
    } else {
      game.setGuide({ title, board: L.board, path: L.path, spot: { k: 'path', path: L.path }, text: t('tut.guide'), allow: guard((a) => a.type === 'move' && samePath(a.path, L.path)) });
    }
    coach(L.coach);
  };
  const done = () => { veil.remove(); bubble.remove(); $('pause-btn')?.remove(); $('hint-btn')?.remove(); };
  audio.playMusic('tutorial');
  $('screen').classList.remove('show');
  game?.destroy();
  game = startGame({
    canvas: ($('cv').style.visibility = 'visible', $('wrap').classList.add('inbattle'), $('cv')),
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
  audio.playMusic(zoneTrack(run.node === 'boss' ? 'boss' : 'battle', run.zoneId));
  if (run.node === 'boss') audio.sfx('bossIn');
  $('screen').classList.remove('show');
  game?.destroy();
  game = startGame({
    canvas: ($('cv').style.visibility = 'visible', $('wrap').classList.add('inbattle'), $('cv')),
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
  const ico = h('span', { class: 'pz-ico', 'aria-hidden': 'true' });
  ico.innerHTML = '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="3.8" height="14" rx="1.4"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.4"/></svg>';
  let box;
  if (confirmQuit === true) {
    box = h('div', { class: 'infobox pausebox quit' },
      h('div', { class: 'pz-head' }, ico, h('h3', {}, t('pause.quit'))),
      h('p', { class: 'pz-ask' }, t('pause.quitAsk')),
      h('div', { class: 'pz-btns' }, btn(t('slot.cancel'), () => { close(); showPause(); }, '', { id: 'quit-no' }), btn(t('pause.quit'), quit, 'primary', { id: 'quit-yes' })));
  } else {
    const au = ui.audioControls();
    box = h('div', { class: 'infobox pausebox' },
      h('div', { class: 'pz-head' }, ico, h('h3', {}, t('pause.title'))),
      run?.relics?.length ? h('div', { class: 'relic-strip' }, run.relics.map((id) => h('span', { class: 'rchip', style: `border-color:${RELIC_COL[ctx.relics[id].rarity]}`, title: modLines(id).join(' · ') }, relicName(id)))) : null,
      h('div', { class: 'pz-sl' }, au.slice(0, 3)),
      h('div', { class: 'pz-tg' }, au.slice(3)),
      h('div', { class: 'pz-btns' }, btn(t('pause.quit'), () => { close(); showPause(true); }, '', { id: 'pause-quit' }), btn(t('pause.resume'), close, 'primary', { id: 'pause-resume' })));
  }
  $('wrap').appendChild(h('div', { id: 'info' }, box));
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
// Nội tại của quái: hiệu ứng áp lên đội mỗi lần quái đánh (đọc từ data/monsters.json)
function passiveRows(list, monId) {
  return list.map((u) => {
    const extra = [t('info.passiveTurns', { n: u.turns })];
    const ch = u.chance ?? ctx.config.monsterPassive.chance[ctx.monsters[monId]?.kind || 'normal'] ?? 1;
    extra.push(t('info.chance', { n: Math.round(ch * 100) }));
    if (u.key === 'lock') extra.push(t('info.cells', { n: u.value }));
    else if (u.value) extra.push(`${pct(u.value)}%`);
    return h('div', { class: 'muted fxrow' }, h('img', { class: 'fxico', src: `assets/ui/fx/${u.key}.webp`, alt: '' }), h('div', { style: 'flex:1;min-width:0' }, h('b', {}, t(`effect.${u.key}.name`)), ` (${extra.join(', ')}): `, t(`effect.${u.key}.desc`)));
  });
}
// Khung giới thiệu Duo trong hộp hỏi dùng skill: hai tướng, hệ số, hiệu ứng riêng của cặp.
// ---- Bảng hỏi dùng skill: mỗi loại hiệu ứng một màu + biểu tượng riêng; Duo có khung ánh sáng, tia liên kết và tia lửa.
const SA_NEG = new Set(['burn', 'poison', 'stun', 'freeze', 'atkDown', 'lock']);
const SA_ICON = {
  damage: ['#ff6b5a', '<path d="M5 19L17 7M14 5h5v5M5 19l2.5-.5M8.5 15.5L6 18"/>'],
  heal: ['#4fe08a', '<path d="M12 5v14M5 12h14"/>'],
  buff: ['#ffd24a', '<path d="M12 19V6M6.5 11.5L12 6l5.5 5.5"/>'],
  debuff: ['#b98cff', '<path d="M12 5v13M6.5 12.5L12 18l5.5-5.5"/>'],
  convert: ['#5ec8ff', '<path d="M12 4l6 8-6 8-6-8z"/>'],
  enhance: ['#ffe27a', '<path d="M12 4l2.4 5 5.6.8-4 4 1 5.6-5-2.7-5 2.7 1-5.6-4-4 5.6-.8z"/>'],
  freeze: ['#7fe6ff', '<circle cx="12" cy="12" r="7.5"/><path d="M12 7.5V12l3 2"/>'],
};
const saCat = (u) => (u.type === 'applyEffect' ? (SA_NEG.has(u.key) ? 'debuff' : 'buff') : u.type === 'timeFreeze' ? 'freeze' : SA_ICON[u.type] ? u.type : 'buff');
function saRows(units, el) {
  return h('div', { class: 'sa-fx' }, units.map((u) => {
    const c = saCat(u);
    const ic = h('i', { class: 'sa-ic', style: `--k:${SA_ICON[c][0]}` });
    ic.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SA_ICON[c][1]}</svg>`;
    return h('div', { class: `sa-row ${c}`, style: `--k:${SA_ICON[c][0]}` }, ic, h('span', {}, unitText(u, el)));
  }));
}
// Chạm tướng đã sẵn sàng: hiện thông tin kỹ năng, chỉ dùng khi người chơi bấm Đồng ý.
function showSkillAsk(idx, confirm, duoGo = null, duo = null) {
  const st = game?.getState?.();
  if (!st || $('info')) return;
  const m = st.members[idx];
  if (!m) return;
  const kit = resolveKit(ctx, m.id, m.skillLv, formOf(m.awaken));
  const keys = keysOf(kit.skill.units);
  const close = () => $('info')?.remove();
  const col = COLORS[m.element];
  const orbImg = getImg(`orb:${m.element}`);
  const isDuo = !!(duoGo && duo);
  const head = h('div', { class: 'sa-head', style: `--c:${col}` },
    h('div', { class: 'sa-port' }, portrait(m.id, 62)),
    h('div', { class: 'sa-who' }, h('b', {}, t(`char.${m.id}`)), h('small', {}, t('char.cooldown', { n: m.skillMax }))),
    h('span', { class: 'sa-gem' }, orbImg ? h('img', { src: orbImg.src, alt: '' }) : null),
    h('span', { class: 'sa-ready' }, t('skill.ready')));
  const single = [
    h('h3', { class: 'sa-name' }, h('i', {}, '✦'), t(`skill.${m.id}`), h('i', {}, '✦')),
    saRows(kit.skill.units, m.element),
    keys.length ? h('div', { class: 'sa-kw' }, keywordBlock(keys)) : null,
  ];
  let duoPart = null;
  if (isDuo) {
    const def = ctx.duos[duo.id];
    const a = st.members[duo.slot];
    const b = st.members[duo.slot + 1];
    const pct = Math.round((ctx.config.duo?.mult ?? 1.5) * 100);
    const sparks = Array.from({ length: 10 }, (_, i) => h('i', { class: 'sa-spark', style: `--x:${8 + ((i * 37) % 84)}%;--d:${(i * 0.45).toFixed(2)}s;--s:${3 + (i % 3)}px` }));
    duoPart = h('div', { class: 'sa-duo' },
      h('div', { class: 'sa-duo-top' },
        h('div', { class: 'sa-duo-p l' }, portrait(a.id, 58), h('small', {}, t(`char.${a.id}`))),
        h('div', { class: 'sa-link' }, h('i', { class: 'sa-beam' }), h('b', { class: 'sa-emblem' }, 'DUO'), h('em', { class: 'sa-mult' }, `×${pct}%`)),
        h('div', { class: 'sa-duo-p r' }, portrait(b.id, 58), h('small', {}, t(`char.${b.id}`)))),
      h('h3', { class: 'sa-duo-name' }, t(`duo.${duo.id}`)),
      h('div', { class: 'sa-duo-note' }, t('sa.both')),
      def.skill.units.length ? [h('div', { class: 'sa-sec' }, t('sa.pair')), saRows(def.skill.units, a.element)] : null,
      sparks);
  }
  const btns = isDuo
    ? h('div', { class: 'sa-btns' },
      btn(t('skill.duoOk'), () => { close(); duoGo(); }, 'primary duo sa-go', { id: 'duo-ok' }),
      h('div', { class: 'sa-btns2' }, btn(t('skill.single'), () => { close(); confirm(); }, '', { id: 'skill-ok' }), btn(t('skill.cancel'), close, '', { id: 'skill-cancel' })))
    : h('div', { class: 'sa-btns' }, btn(t('skill.ok'), () => { close(); confirm(); }, 'primary sa-go', { id: 'skill-ok' }), btn(t('skill.cancel'), close, '', { id: 'skill-cancel' }));
  $('wrap').appendChild(h('div', { id: 'info', onclick: (ev) => ev.target.id === 'info' && close() }, h('div', { class: 'infobox sa' + (isDuo ? ' isduo' : ''), style: `--c:${col}` }, isDuo ? null : head, isDuo ? duoPart : null, isDuo ? h('details', { class: 'sa-more' }, h('summary', {}, t('sa.single')), single) : single, btns)));
  audio.sfx(isDuo ? 'enhance' : 'reveal');
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
      heroUI.duoBox(m.id),
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
      (ctx.monsters[e.id]?.onAttack || []).length ? h('div', { class: 'card' }, h('b', {}, t('info.passive')), h('div', { class: 'muted' }, t('info.passiveNote')), passiveRows(ctx.monsters[e.id].onAttack, e.id)) : null,
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

let lastTrackedResult = null;
function showResult() {
  const r = run.lastResult;
  if (r.kind === 'battle' && r !== lastTrackedResult) { lastTrackedResult = r; track('win_battle'); }
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
  music('mystery');
  screen(
    floorTitle(),
    hpBar(),
    h('div', { class: 'card' }, h('b', {}, t(`${key}.title`)), h('p', {}, t(`${key}.body`))),
    h('p', { class: 'sub' }, t('event.choose')),
    ev.choices.map((_, i) => btn(t(`${key}.c${i}`), () => act({ type: 'eventChoice', index: i }), '', { 'data-choice': i })),
  );
}

function showShop() {
  music('shop');
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
    if (run.result === 'won') track('win_stage');
    endLevels = progress.team.filter(Boolean).map((id) => ({ id, from: before.characters[id].level, to: progress.characters[id].level })).filter((x) => x.to > x.from);
    delete progress.activeRun;
    save();
    savedThisRun = true;
    window.__lastRecord = record;
  }
  const won = run.result === 'won';
  music(run.result === 'won' ? 'victory' : 'defeat');
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
function showInstallHelp(back = showHub) {
  screen(
    h('h2', {}, t('app.install')),
    h('div', { class: 'card' }, h('p', {}, t(isIOS ? 'app.helpIOS' : 'app.helpOther'))),
    btn(t('back'), back, '', { id: 'back' }),
  );
}
// Cài app từ màn Cài đặt: có prompt gốc thì gọi, không thì hiện hướng dẫn rồi quay lại Cài đặt
async function installFromSettings() {
  if (installEvt) { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; ui.showSettings(); } else showInstallHelp(() => ui.showSettings());
}
// ---- Màn hình tách module: dùng chung trạng thái qua `app`, gọi chéo qua `app.*` / `ui.*`
const ui = {};
const rewardPop = installRewardFx({ audio, fxLayer: () => (fxl ||= createFxLayer($('fx'))) });
const app = {
  rewardPop, installFromSettings, isStandalone,
  startTutorial: () => startTutorial(), enterHub: showHub, guideStep, guideSet, guidePoint, trackQuest: track,
  ctx, audio, music, storage, slots, enterSlot, dicts, h, btn, $, el, chip, portrait, CUR_COL, fodderName, offeringName, pct, save, screen, setLang, showHub,
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
Object.assign(ui, installWish(app));
Object.assign(app, ui);

if ('serviceWorker' in navigator && !DEBUG && location.protocol.startsWith('http')) {
  // Bản mới: SW mới chiếm quyền → đánh dấu, tự nạp lại ở lần vào Hub kế tiếp (không ngắt giữa trận).
  const hadSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSW) { updateReady = true; showUpdatePill(); } });
  setTimeout(checkVersion, 3000);
  setInterval(checkVersion, 2 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => { setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000); document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); }); }).catch(() => {});
}

if (DEBUG) {
  window.__showSkillAsk = (i, f, d, du) => showSkillAsk(i, f, d, du);
  window.__ctx = ctx;
  window.__showHub = () => showHub();
  window.__showZones = () => showZones();
  window.__ui = ui;
  window.__showUpdate = () => { updateReady = true; showUpdatePill(); };
  window.__showTeam = (...a) => showTeam(...a);
  window.__showStages = (...a) => showStages(...a);
  window.__startRun = (o) => startRun(o);
  window.__runItems = (o) => { Object.assign(run.items, o); render(); };
  window.__runRelics = (ids) => { run.relics.push(...ids); render(); };
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
// Chrome bỏ qua mục lịch sử tạo khi chưa có thao tác người dùng → đệm 3 mục và nạp lại ở mỗi lần chạm đầu tiên sau khi bị tiêu hao.
let histBuf = 0;
const refillHist = () => { while (histBuf < 3) { history.pushState({ rsp: 1 }, ''); histBuf++; } };
refillHist();
window.addEventListener('pointerdown', () => { if (histBuf < 3) refillHist(); }, { capture: true, passive: true });
window.addEventListener('popstate', () => {
  histBuf = Math.max(0, histBuf - 1);
  refillHist();
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
const loading = createLoading({ t, title: t('game.title'), subtitle: t('game.subtitle'), version: `${t('hub.credit')} · v${VERSION} · build ${BUILD}`, auto: DEBUG,
  notes: changelog.map((e) => ({ version: e.version, date: e.date, items: e.items.map((i) => ({ tag: i.tag, tagText: t(`cl.tag.${i.tag}`), text: t(i.key) })) })), notesTitle: t('cl.title'), notesOlder: t('cl.older'), currentVersion: VERSION });
screen(loading.el);
const bootStart = performance.now();
await preloadAssets((d, n) => loading.setProgress(n ? (d / n) * 0.95 : 0));
if (!DEBUG) await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (performance.now() - bootStart)))); // đủ lâu để đọc 1 mẹo
await loading.ready();
if (DEBUG && !location.search.includes('slots')) enterSlot(slots.last() || 1);
else ui.showSlots();
