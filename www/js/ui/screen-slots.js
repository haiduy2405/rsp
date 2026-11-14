// Màn chọn sao lưu: 3 ô, mỗi ô là một tiến trình riêng. Chơi / ván mới, đổi tên, xóa (có xác nhận).
import { h, btn } from './dom.js';
import { avatarNode } from './avatar.js';
import { NAME_MAX } from '../save/slots.js';

export function install(app) {
  const { t, screen, slots } = app;

  const cleared = (p) => Object.values(p?.stages || {}).reduce((a, z) => a + Object.values(z || {}).reduce((b, n) => b + (Number(n) || 0), 0), 0);
  const when = (at) => (at ? new Date(at).toLocaleDateString(app.lang === 'vi' ? 'vi-VN' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null);

  // mode: null | { rename: n } | { del: n }
  function showSlots(mode = null) {
    const list = slots.list();
    const last = slots.last();
    const cards = list.map((s) => {
      if (mode?.rename === s.n) return renameCard(s);
      if (mode?.del === s.n) {
        return app.confirmBox(t('slot.deleteAsk', { name: s.name || t('slot.n', { n: s.n }) }), () => { slots.remove(s.n); app.audio.sfx('back'); showSlots(); }, () => showSlots(), t('slot.deleteYes'));
      }
      if (!s.used) {
        return h('div', { class: 'card btn slotcard empty', 'data-slot': s.n, role: 'button', tabindex: '0', onclick: () => app.enterSlot(s.n) },
          h('span', { class: 'sl-plus' }, '+'),
          h('div', { class: 'sl-body' }, h('b', {}, t('slot.n', { n: s.n })), h('small', { class: 'muted' }, t('slot.new'))));
      }
      const p = s.progress.player;
      const meta = [t('slot.cleared', { n: cleared(s.progress) }), when(s.at)].filter(Boolean).join(' · ');
      return h('div', { class: 'card slotcard' + (last === s.n ? ' last' : ''), 'data-slot': s.n },
        h('div', { class: 'sl-main', role: 'button', tabindex: '0', onclick: () => app.enterSlot(s.n) },
          h('span', { class: 'sl-av' }, avatarNode(p)),
          h('div', { class: 'sl-body' }, h('b', {}, s.name || t('slot.n', { n: s.n })), h('small', { class: 'muted' }, meta))),
        h('div', { class: 'sl-actions' },
          btn(t('slot.play'), () => app.enterSlot(s.n), 'primary', { 'data-play': s.n }),
          btn(t('slot.rename'), () => showSlots({ rename: s.n }), '', { 'data-rename': s.n }),
          btn(t('slot.delete'), () => showSlots({ del: s.n }), 'danger', { 'data-del': s.n })));
    });
    screen(h('h2', {}, t('slot.title')), h('p', { class: 'muted' }, t('slot.hint')), h('div', { class: 'slotlist' }, cards));
  }

  function renameCard(s) {
    const input = h('input', { id: 'slot-name', maxlength: String(NAME_MAX), value: s.label || s.name, placeholder: t('slot.n', { n: s.n }), 'aria-label': t('slot.nameLabel') });
    const done = () => { slots.rename(s.n, input.value); app.audio.sfx('rare'); showSlots(); };
    input.addEventListener('keydown', (e) => e.key === 'Enter' && done());
    setTimeout(() => { input.focus(); input.select(); }, 30);
    return h('div', { class: 'card slotcard', 'data-slot': s.n },
      h('label', {}, t('slot.nameLabel'), input),
      h('div', { class: 'row' }, btn(t('slot.cancel'), () => showSlots(), '', { id: 'slot-cancel' }), btn(t('slot.save'), done, 'primary', { id: 'slot-save' })));
  }

  return { showSlots };
}
