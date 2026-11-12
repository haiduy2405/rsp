// Tiện ích DOM dùng chung cho các màn.
export const $ = (id) => document.getElementById(id);

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k);
  return el;
}
export const btn = (label, onclick, cls = '', extra = {}) => h('button', { class: cls, onclick, ...extra }, label);
