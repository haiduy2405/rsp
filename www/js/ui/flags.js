import { h } from './dom.js';

// Chọn quốc kỳ quê hương: lưới cờ tròn nhỏ (circle-flags, MIT). Giá trị lưu là mã 2 chữ cái (VD VN) trong player.hometown.
export function flagPicker(ctx, t, value, onPick, idPrefix = 'fl') {
  const name = h('div', { class: 'flag-name' }, value && ctx.flagList.includes(value) ? t(`flag.${value}`) : t('flag.none'));
  const grid = h('div', { class: 'flaggrid', role: 'listbox', 'aria-label': t('flag.pick') });
  const cells = ctx.flagList.map((code) => {
    const b = h('button', { type: 'button', class: 'flagbtn' + (code === value ? ' sel' : ''), 'data-flag': code, title: t(`flag.${code}`), 'aria-label': t(`flag.${code}`), role: 'option', 'aria-selected': String(code === value) },
      h('img', { src: `assets/ui/flags/${code.toLowerCase()}.svg`, alt: '', width: '34', height: '34', loading: 'lazy', draggable: 'false' }));
    b.onclick = () => {
      const on = !b.classList.contains('sel');
      cells.forEach((c) => { c.classList.remove('sel'); c.setAttribute('aria-selected', 'false'); });
      if (on) { b.classList.add('sel'); b.setAttribute('aria-selected', 'true'); }
      name.textContent = on ? t(`flag.${code}`) : t('flag.none');
      onPick(on ? code : '');
    };
    return b;
  });
  grid.append(...cells);
  return h('div', { class: 'flagpick', id: `${idPrefix}-flags` }, h('div', { class: 'flag-title' }, t('flag.pick')), grid, name);
}
