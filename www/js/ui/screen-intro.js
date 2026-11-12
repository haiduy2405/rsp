// Màn hình: quà tân thủ (10 vé), mở 10 lượt, cutscene tướng 4★, vào màn chính. Trạng thái dùng chung đi qua `app`.
import { $, h, btn } from './dom.js';
import { itemIcon } from './icons.js';
import { starterSummon } from '../core/summon.js';
import { TOWER } from './tower-art.js';

export function install(app) {
  const { audio, ctx, portrait, save, screen, t } = app;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Dạo đầu ngắn trước màn hướng dẫn: cổng Tháp mở ra, AIDA dẫn vào trận đầu.
  function showPrologue() {
    $('cut')?.remove();
    const lines = ['pro.1', 'pro.2', 'pro.3'].map((k) => t(k));
    const text = h('p', { class: 'cut-line' });
    const tower = h('div', { class: 'cut-tower' });
    tower.innerHTML = TOWER;
    const root = h('div', { id: 'cut', class: 'cut' }, h('div', { class: 'cut-rays' }), h('div', { class: 'cut-glow' }), tower, text, h('div', { class: 'cut-tap' }, t('pro.tap')));
    $('wrap').appendChild(root);
    audio.sfx('sting');
    let i = -1;
    let timer = null;
    const next = () => {
      clearTimeout(timer);
      i += 1;
      if (i >= lines.length) return finish();
      text.classList.remove('on');
      void text.offsetWidth;
      text.textContent = lines[i];
      text.classList.add('on');
      if (i === 0) tower.classList.add('in');
      else audio.sfx('tick');
      timer = setTimeout(next, reduced() ? 2400 : 3000);
    };
    const finish = () => {
      clearTimeout(timer);
      root.removeEventListener('click', next);
      audio.sfx('open');
      root.classList.add('out');
      setTimeout(() => { root.remove(); app.startTutorial(); }, reduced() ? 50 : 700);
    };
    root.addEventListener('click', next);
    next();
  }

  // Sau tutorial: AIDA tặng 10 vé, người chơi bấm để triệu hồi.
  function showStarterReward() {
    audio.playMusic?.('hub');
    const n = ctx.config.summon.starter.four + ctx.config.summon.starter.three;
    const fan = Array.from({ length: n }, (_, i) => h('div', { class: 'st-tk', style: `--i:${i};--n:${n}` }, itemIcon('ticket', 'sm')));
    audio.sfx('reveal');
    screen(
      h('div', { class: 'st-reward' },
        h('div', { class: 'st-aida' }, t('st.aida')),
        h('div', { class: 'st-fan' }, fan),
        h('h2', { class: 'st-title' }, t('st.title', { n })),
        h('p', { class: 'st-sub' }, t('st.sub')),
        btn(t('st.pull', { n }), pull, 'primary st-go', { id: 'st-pull' }),
      ),
    );
  }

  function pull() {
    const r = starterSummon(ctx, app.progress, (Math.random() * 4294967296) >>> 0);
    if (!r.ok) return app.enterHub();
    app.progress = r.progress;
    save();
    audio.sfx('summon');
    app.showSummonResult('standard', r.results, () => {
      const star = r.results.find((x) => x.rarity === 4) || r.results[0];
      showCutscene(star.id);
    });
  }

  // Cutscene ngắn: tướng 4★ bước ra và cùng người chơi bắt đầu hành trình.
  function showCutscene(heroId) {
    $('cut')?.remove();
    const name = app.progress.player.name;
    const lines = ['cut.1', 'cut.2', 'cut.3'].map((k) => t(k, { hero: t(`char.${heroId}`), name }));
    const text = h('p', { class: 'cut-line' });
    const hero = h('div', { class: 'cut-hero' }, portrait(heroId, 200));
    const root = h('div', { id: 'cut', class: 'cut' },
      h('div', { class: 'cut-rays' }),
      h('div', { class: 'cut-glow' }),
      hero,
      h('div', { class: 'cut-name' }, t(`char.${heroId}`)),
      text,
      h('div', { class: 'cut-tap' }, t('cut.tap')),
    );
    $('wrap').appendChild(root);
    audio.sfx('rare');
    let i = -1;
    let timer = null;
    const next = () => {
      clearTimeout(timer);
      i += 1;
      if (i >= lines.length) return finish();
      text.classList.remove('on');
      void text.offsetWidth;
      text.textContent = lines[i];
      text.classList.add('on');
      if (i === 0) hero.classList.add('in');
      else audio.sfx('tick');
      timer = setTimeout(next, reduced() ? 2600 : 3200);
    };
    const finish = () => {
      clearTimeout(timer);
      root.removeEventListener('click', next);
      const f = $('flash');
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
      audio.sfx('fanfare');
      // Dựng màn chính NGAY dưới lớp cutscene (còn đục), rồi mới mờ cutscene: không lộ màn triệu hồi cũ, không có nhịp trống.
      enterHubFx();
      root.classList.add('out');
      setTimeout(() => root.remove(), reduced() ? 50 : 750);
    };
    root.addEventListener('click', next);
    next();
  }

  // Vào Cupola lần đầu: màn chính mở ra có hiệu ứng.
  function enterHubFx() {
    app.enterHub();
    const sc = $('screen');
    sc.classList.remove('hubin');
    void sc.offsetWidth;
    sc.classList.add('hubin');
    // không gỡ class bằng timer: gỡ giữa chừng làm lớp compositor bị vẽ lại → nháy 1 khung; screen() sẽ gỡ khi sang màn khác
  }

  return { showPrologue, showStarterReward, showCutscene };
}
