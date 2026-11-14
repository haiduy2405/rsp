// Tiện ích DOM dùng chung cho các màn.
export const $ = (id) => document.getElementById(id);

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k);
  return el;
}
export const btn = (label, onclick, cls = '', extra = {}) => h('button', { class: cls, onclick, ...extra }, label);

// Hộp thoại nổi dùng chung: nền mờ + hộp bật lên, đóng có hiệu ứng. Chỉ dùng opacity/transform (chạy trên GPU, không vẽ lại).
export function openModal(box, { dismiss = true } = {}) {
  const wrap = document.getElementById('wrap');
  wrap.querySelectorAll('.mdl').forEach((m) => m.remove());
  const back = h('div', { class: 'mdl' }, box);
  const close = () => {
    if (back.classList.contains('out')) return;
    back.classList.add('out');
    setTimeout(() => back.remove(), 170);
  };
  if (dismiss) back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  wrap.append(back);
  return close;
}
// Đóng một lớp phủ (#info...) bằng hiệu ứng thay vì biến mất ngay; gỡ id ngay để không chặn lần mở kế tiếp.
export function dismissEl(el) {
  if (!el) return;
  el.id = `${el.id}-out`;
  el.classList.add('out');
  setTimeout(() => el.remove(), 170);
}
