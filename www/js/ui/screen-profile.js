// Màn hình: profile (tách khỏi main.js). Trạng thái dùng chung đi qua `app`.
import { $, h, btn } from './dom.js';
import { zoneClears } from '../core/stage.js';
import { avatarNode, photoFromFile } from '../ui/avatar.js';
import { finishOnboarding, storyUnlocked, updateProfile } from '../core/onboarding.js';
import { newProgress } from '../core/progress.js';
import { redeemGift } from '../core/giftcode.js';
import * as offline from '../ui/offline.js';
import { flagPicker } from './flags.js';
import { TOWER } from './tower-art.js';

export function install(app) {
  const { audio, ctx, dicts, music, save, screen, setLang, showHub, storage, t } = app;

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
      if (!r.ok) return showProfile(t(`ob.bad.${r.reason}`, { max: o.nameMax }));
      app.progress = r.progress;
      save();
      profDraft = null;
      audio.sfx('rare');
      showProfile(t('profile.saved'));
    };
    const keep = (e, k) => { d[k] = e.target.value; };
    const dirty = d.name !== app.progress.player.name || (d.hometown || '') !== (app.progress.player.hometown || '') || d.avatar !== app.progress.player.avatar || (d.photo || null) !== (app.progress.player.photo || null);
    screen(
      h('h2', {}, t('profile.title')),
      h('div', { class: 'prof-head' }, h('div', { class: 'avatar big' }, avatarNode(d))),
      msg ? h('div', { class: 'notice' }, msg) : null,
      h('div', { class: 'row' }, av),
      photoPicker(d, () => showProfile(), 'pf'),
      h('label', {}, t('ob.name'), h('input', { id: 'pf-name', maxlength: String(o.nameMax), value: d.name, oninput: (e) => keep(e, 'name') })),
      h('label', {}, t('ob.hometown')), flagPicker(ctx, t, d.hometown || '', (c) => keep({ target: { value: c } }, 'hometown'), 'pf'),
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
      btn(t('back'), () => showSettings(), '', { id: 'back' }),
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
      h('div', { class: 'card', id: 'gift' }, h('b', {}, t('set.gift.title')),
        h('div', { class: 'row' }, h('input', { id: 'gift-input', type: 'text', placeholder: t('set.gift.placeholder'), autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: '40' }),
          btn(t('set.gift.btn'), (ev) => {
            const r = redeemGift(ctx, app.progress, $('gift-input').value);
            if (!r.ok) return showSettings(t(`set.gift.${r.reason === 'used' ? 'used' : 'bad'}`));
            app.progress = r.progress;
            save();
            app.rewardPop([{ k: 'gold', n: r.reward.gold }, { k: 'spirit', n: r.reward.spirit }, { k: 'ticket', n: r.reward.tickets }], ev, { big: true });
            showSettings(t('set.gift.ok', { gold: r.reward.gold.toLocaleString(), spirit: r.reward.spirit.toLocaleString(), tickets: r.reward.tickets.toLocaleString() }));
          }, 'primary', { id: 'gift-btn' }))),
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
      btn(t('slot.switch'), () => { save(); app.showSlots(); }, '', { id: 'set-slots' }),
      btn(t('back'), showHub, '', { id: 'back' }),
    );
    $('lang').value = app.lang;
  }

  // Mở đầu: cốt truyện -> AIDA hỏi tên, ngoại hình, quê hương -> màn hướng dẫn (trận thật) -> quà 10 vé.
  const ob = { hometown: '', avatar: 0, photo: null, name: '' };

  function showOnboarding(step = 1, err = null) {
    if (step === 1) Object.assign(ob, { hometown: '', avatar: 0, photo: null, name: '' });
    app.obTimers.forEach(clearTimeout);
    app.obTimers = [];
    const o = ctx.config.onboarding;
    if (step === 1) {
      const lines = ['ob.alarm1', 'ob.alarm2', 'ob.alarm3'].map((k) => h('p', { class: 'ob-line' }, t(k)));
      const tower = h('div', { class: 'ob-tower' });
      tower.innerHTML = TOWER;
      music('title');
      screen(
        h('div', { class: 'ob-story' }, tower, h('h1', { class: 'gold3d', 'data-t': t('game.title') }, t('game.title')), h('div', { class: 'ob-lines' }, lines),
          h('div', { class: 'ob-actions' }, btn(t('ob.next'), () => showOnboarding(2), 'primary', { id: 'ob-next' }), btn(t('ob.skip'), () => showOnboarding(2), 'ghost', { id: 'ob-skip' }))),
      );
      lines.forEach((l, i) => app.obTimers.push(setTimeout(() => l.classList.add('on'), 500 + i * 2200)));
    } else {
      const preview = h('div', { class: 'avatar big ob-me' }, avatarNode(ob));
      const av = Array.from({ length: o.avatars }, (_, i) => h('div', { class: 'avatar' + (ob.avatar === i && !ob.photo ? ' sel' : ''), 'data-avatar': i, onclick: () => { ob.avatar = i; ob.photo = null; showOnboarding(2, err); } }, avatarNode({ avatar: i })));
      music('title');
      screen(
        h('div', { class: 'ob-id' },
          h('div', { class: 'ob-aida' }, h('b', {}, 'AIDA'), h('p', {}, t('ob.aida'))),
          err ? h('div', { class: 'notice' }, err) : null,
          h('div', { class: 'ob-me-row' }, preview, h('label', { class: 'ob-name' }, t('ob.name'), h('input', { id: 'ob-name', maxlength: String(o.nameMax), value: ob.name, autocomplete: 'off', oninput: (e) => (ob.name = e.target.value) }))),
          h('div', { class: 'ob-avs' }, av),
          photoPicker(ob, () => showOnboarding(2, err), 'ob'),
          h('details', { class: 'ob-flag' }, h('summary', {}, t('ob.hometown')), flagPicker(ctx, t, ob.hometown, (c) => (ob.hometown = c), 'ob'), h('p', { class: 'muted' }, t('ob.hometownHint'))),
          btn(t('ob.start'), () => {
            const r = finishOnboarding(ctx, app.progress, { name: ob.name, hometown: ob.hometown, avatar: ob.avatar, photo: ob.photo });
            if (!r.ok) {
              const key = `ob.bad.${r.reason}`;
              return showOnboarding(2, dicts[app.lang][key] ? t(key, { max: o.nameMax }) : t('ob.bad.other'));
            }
            app.progress = r.progress;
            save();
            app.showPrologue();
          }, 'primary', { id: 'ob-start' }),
        ),
      );
    }
  }

  return { audioControls, offlineSection, photoPicker, showOnboarding, showProfile, showSettings, showStory, resetDrafts: () => { profDraft = null; } };
}
