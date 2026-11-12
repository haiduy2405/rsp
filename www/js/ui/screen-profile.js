// Màn hình: profile (tách khỏi main.js). Trạng thái dùng chung đi qua `app`.
import { $, h, btn } from './dom.js';
import { zoneClears } from '../core/stage.js';
import { avatarNode, photoFromFile } from '../ui/avatar.js';
import { summon } from '../core/summon.js';
import { finishOnboarding, storyUnlocked, updateProfile } from '../core/onboarding.js';
import { newProgress } from '../core/progress.js';
import * as offline from '../ui/offline.js';

export function install(app) {
  const { audio, ctx, dicts, save, screen, setLang, showHub, storage, t } = app;

  // Hồ sơ người chơi: đổi tên, mã hiệu, quê hương, ngoại hình; xem thống kê.
  let profDraft = null;

  function showProfile(msg) {
    const o = ctx.config.onboarding;
    if (!profDraft) profDraft = { ...app.progress.player };
    const d = profDraft;
    const st = app.progress.stats;
    const clears = Object.keys(app.progress.clears).reduce((a, z) => a + zoneClears(app.progress, z), 0);
    const stat = (label, v) => h('div', { class: 'card item-row' }, h('span', {}, label), h('b', {}, new Intl.NumberFormat(app.lang).format(v)));
    const av = Array.from({ length: o.avatars }, (_, i) => h('div', { class: 'avatar' + (d.avatar === i && !d.photo ? ' sel' : ''), 'data-avatar': i, onclick: () => { d.avatar = i; d.photo = null; showProfile(); } }, avatarNode({ avatar: i })));
    const save1 = () => {
      const r = updateProfile(ctx, app.progress, d);
      if (!r.ok) return showProfile(t(`ob.bad.${r.reason}`, { max: r.reason === 'bad_callsign' ? o.callsignMax : o.nameMax }) );
      app.progress = r.progress;
      save();
      profDraft = null;
      audio.sfx('rare');
      showProfile(t('profile.saved'));
    };
    const keep = (e, k) => { d[k] = e.target.value; };
    const dirty = d.name !== app.progress.player.name || d.callsign !== app.progress.player.callsign || (d.hometown || '') !== (app.progress.player.hometown || '') || d.avatar !== app.progress.player.avatar || (d.photo || null) !== (app.progress.player.photo || null);
    screen(
      h('h2', {}, t('profile.title')),
      h('div', { class: 'prof-head' }, h('div', { class: 'avatar big' }, avatarNode(d))),
      msg ? h('div', { class: 'notice' }, msg) : null,
      h('div', { class: 'row' }, av),
      photoPicker(d, () => showProfile(), 'pf'),
      h('label', {}, t('ob.name'), h('input', { id: 'pf-name', maxlength: String(o.nameMax), value: d.name, oninput: (e) => keep(e, 'name') })),
      h('label', {}, t('ob.callsign'), h('input', { id: 'pf-callsign', maxlength: String(o.callsignMax), value: d.callsign, oninput: (e) => keep(e, 'callsign') })),
      h('label', {}, t('ob.hometown'), h('input', { id: 'pf-hometown', maxlength: String(o.hometownMax), value: d.hometown || '', oninput: (e) => keep(e, 'hometown') })),
      d.culture ? h('div', { class: 'muted' }, `${t('profile.token')}: ${t(`ob.token.${d.culture}`)}`) : null,
      btn(t('profile.save'), save1, 'primary', { id: 'pf-save' }),
      h('h3', {}, t('profile.stats')),
      stat(t('profile.runs'), st.runs),
      stat(t('profile.wins'), st.wins),
      stat(t('profile.clears'), clears),
      stat(t('profile.owned'), Object.keys(app.progress.characters).length),
      stat(t('profile.pulls'), app.progress.summon.pulls),
      btn(t('back'), () => { profDraft = null; showHub(); }, '', { id: 'back' }),
    );
    void dirty;
  }

  // Chọn ảnh làm avatar: thu về 128px JPEG rồi lưu trong bản nháp `draft.photo`.
  function photoPicker(draft, redraw, pre) {
    const input = h('input', { type: 'file', accept: 'image/*', id: `${pre}-photo-input`, style: 'display:none', onchange: async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        draft.photo = await photoFromFile(f);
        redraw();
      } catch {
        input.parentElement.append(h('div', { class: 'notice' }, t('ob.bad.bad_image')));
      }
    } });
    return h('div', { class: 'row' }, input, btn(t('ob.photo'), () => input.click(), '', { id: `${pre}-photo` }), draft.photo ? btn(t('ob.photoClear'), () => { draft.photo = null; redraw(); }, '', { id: `${pre}-photo-clear` }) : null);
  }

  function showStory() {
    const open = new Set(storyUnlocked(ctx, app.progress));
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
      h('label', {}, h('span', { id: 'vol-l' }, t('set.volume', { n: app.progress.settings.volume })), h('input', { id: 'vol', type: 'range', min: '0', max: '100', value: String(app.progress.settings.volume), oninput: (e) => {
        app.progress.settings.volume = Number(e.target.value);
        $('vol-l').textContent = t('set.volume', { n: app.progress.settings.volume });
        audio.applyGains();
      }, onchange: () => save() })),
      ...[['music', 'set.music'], ['sfx', 'set.sfx'], ['haptic', 'set.haptic']].map(([k, label]) =>
        h('label', { style: 'flex-direction:row;gap:10px' }, h('input', { type: 'checkbox', id: `opt-${k}`, ...(app.progress.settings[k] !== false ? { checked: '' } : {}), onchange: (e) => {
          app.progress.settings[k] = e.target.checked;
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
      btn(t('hub.export'), () => (exportBox.value = storage.exportText(app.progress)), '', { id: 'export' }),
      exportBox,
      importBox,
      btn(t('hub.import'), () => {
        try {
          app.progress = storage.importText(importBox.value.trim());
          save();
          showSettings(t('hub.import.ok'));
        } catch {
          showSettings(t('hub.import.bad'));
        }
      }, '', { id: 'import' }),
      confirmDelete
        ? app.confirmBox(t('set.deleteConfirm'), () => {
            storage.clear();
            app.progress = newProgress(ctx);
            showOnboarding();
          }, () => showSettings(), t('set.deleteYes'))
        : btn(t('set.delete'), () => showSettings(null, true), '', { id: 'delete' }),
      btn(t('back'), showHub, '', { id: 'back' }),
    );
    $('lang').value = app.lang;
  }

  // Onboarding: mở đầu -> quê hương -> Tín Vật -> ngoại hình -> tên -> lượt triệu hồi đầu.
  const ob = { hometown: '', culture: null, avatar: 0, photo: null, name: '', callsign: '' };

  function showOnboarding(step = 1, err = null) {
    app.obTimers.forEach(clearTimeout);
    app.obTimers = [];
    const o = ctx.config.onboarding;
    const next = (n) => () => showOnboarding(n);
    if (step === 1) {
      const lines = ['ob.alarm1', 'ob.alarm2', 'ob.alarm3'].map((k) => h('p', { class: 'ob-line', style: 'opacity:0;transition:opacity 1s' }, t(k)));
      screen(h('h1', {}, t('game.title')), lines, btn(t('ob.next'), next(2), 'primary', { id: 'ob-next' }), btn(t('ob.skip'), next(2), '', { id: 'ob-skip' }));
      lines.forEach((l, i) => app.obTimers.push(setTimeout(() => (l.style.opacity = '1'), 300 + i * 2500)));
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
      const av = Array.from({ length: o.avatars }, (_, i) => h('div', { class: 'avatar' + (ob.avatar === i && !ob.photo ? ' sel' : ''), 'data-avatar': i, onclick: () => { ob.avatar = i; ob.photo = null; showOnboarding(4); } }, avatarNode({ avatar: i })));
      screen(h('div', { class: 'card' }, h('p', {}, t('ob.avatar'))), h('div', { class: 'row' }, av), photoPicker(ob, () => showOnboarding(4), 'ob'), btn(t('ob.next'), next(5), 'primary', { id: 'ob-next' }));
    } else if (step === 5) {
      screen(
        err ? h('div', { class: 'notice' }, err) : null,
        h('label', {}, t('ob.name'), h('input', { id: 'ob-name', maxlength: String(o.nameMax), value: ob.name, oninput: (e) => (ob.name = e.target.value) })),
        h('label', {}, t('ob.callsign'), h('input', { id: 'ob-callsign', maxlength: String(o.callsignMax), value: ob.callsign, oninput: (e) => (ob.callsign = e.target.value) })),
        btn(t('ob.start'), () => {
          const r = finishOnboarding(ctx, app.progress, { name: ob.name, callsign: ob.callsign, hometown: ob.hometown, avatar: ob.avatar, photo: ob.photo, culture: ob.culture });
          if (!r.ok) {
            const key = `ob.bad.${r.reason}`;
            return showOnboarding(5, dicts[app.lang][key] ? t(key, { max: r.reason === 'bad_name' ? o.nameMax : o.callsignMax }) : t('ob.bad.other'));
          }
          app.progress = r.progress;
          const s = summon(ctx, app.progress, { bannerId: 'standard', count: 1, free: true, dayKey: app.dayKey(), seed: (Math.random() * 4294967296) >>> 0 });
          app.progress = s.progress;
          save();
          app.showFirstSummon(s.results[0]);
        }, 'primary', { id: 'ob-start' }),
      );
    }
  }

  return { audioControls, offlineSection, photoPicker, showOnboarding, showProfile, showSettings, showStory };
}
