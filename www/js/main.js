import { indexById } from './core/battle.js';
import { createT, detectLang } from './i18n/index.js';
import { startGame } from './ui/game.js';

const $ = (id) => document.getElementById(id);
const TEAM = ['demo_thuy', 'demo_hoa', 'demo_moc', 'demo_quang', 'demo_tim'];
const FOES = ['m_ember', 'm_tide', 'm_shade'];

const load = (f) => fetch(`js/${f}`).then((r) => r.json());
const [config, characters, monsters, vi, en] = await Promise.all([
  load('data/config.json'),
  load('data/characters.json'),
  load('data/monsters.json'),
  load('i18n/vi.json'),
  load('i18n/en.json'),
]);
const ctx = { config, characters: indexById(characters), monsters: indexById(monsters) };
const dicts = { vi, en };

let lang = detectLang(navigator.language);
let t = createT(dicts[lang], en);
let game = null;

function applyLang() {
  t = createT(dicts[lang], en);
  document.documentElement.lang = lang;
  document.title = t('game.title');
  $('m-title').textContent = t('game.title');
  $('m-sub').textContent = t('menu.version');
  $('m-seed-l').textContent = t('menu.seed');
  $('m-lang-l').textContent = t('menu.lang');
  $('m-start').textContent = t('menu.start');
  $('r-again').textContent = t('battle.again');
  $('r-menu').textContent = t('battle.menu');
  $('m-lang').value = lang;
}

function begin(seed) {
  game?.destroy();
  $('menu').classList.remove('show');
  $('result').classList.remove('show');
  game = startGame({
    canvas: $('cv'),
    ctx,
    t,
    seed,
    team: TEAM,
    enemies: FOES,
    onEnd(status, record) {
      $('r-title').textContent = t(status === 'won' ? 'battle.win' : 'battle.lose');
      $('r-seed').textContent = t('battle.seed', { seed });
      $('result').classList.add('show');
      window.__lastRecord = record;
    },
  });
  window.__rsp = game;
}

function pickSeed() {
  const raw = $('m-seed').value.trim();
  if (/^\d+$/.test(raw)) return Number(raw) >>> 0;
  return (Math.random() * 4294967296) >>> 0; // UI được phép dùng Math.random; core thì không
}

let lastSeed = 0;
$('m-start').onclick = () => begin((lastSeed = pickSeed()));
$('r-again').onclick = () => begin((lastSeed = $('m-seed').value.trim() ? lastSeed : pickSeed()));
$('r-menu').onclick = () => {
  game?.destroy();
  game = null;
  $('result').classList.remove('show');
  $('menu').classList.add('show');
};
$('m-lang').onchange = (e) => {
  lang = e.target.value;
  applyLang();
};
applyLang();
