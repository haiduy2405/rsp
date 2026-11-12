// Thành phần giao diện thẻ tướng dùng chung: màn chi tiết (Bộ sưu tập, Đội hình) và bảng thông tin trong trận.
// Chỉ dựng DOM từ dữ liệu; không giữ trạng thái game. `h` tạo phần tử, `T` là hàm dịch hiện tại (đổi theo ngôn ngữ).
import { getImg } from './assets.js';
import { expToNext, levelCap } from '../core/upgrade.js';
import { resolveKit, maxSkillLevel, newSkillLevels, formOf } from '../core/kit.js';

export const COLORS = ['#3b9cff', '#ff5a3c', '#4cc46a', '#ffd84a', '#9a5cff', '#ff7fb0'];
const pct = (v) => Math.round(v * 100);

export function createHeroUI({ h, T, ctx }) {
  const el = (n) => T(`element.${n}`);
  const stars = (id) => '★'.repeat(ctx.characters[id].rarity);

  function unitText(u) {
    if (u.type === 'damage') {
      const target = T(`target.${u.target}`);
      return u.element != null ? T('unit.damage.el', { mult: u.mult, target, element: el(u.element) }) : T('unit.damage', { mult: u.mult, target });
    }
    if (u.type === 'heal') return T('unit.heal', { pct: pct(u.pctMax) });
    if (u.type === 'convert') return T('unit.convert', { count: u.count, element: el(u.to) });
    const val = u.value ? `, ${pct(u.value)}%` : '';
    return T('unit.apply', { effect: T(`effect.${u.key}.name`), target: T(`target.${u.target}`), turns: u.turns, value: val });
  }
  const leaderText = (l) => T(`leader.${l.template}`, { pct: pct(l.pct || 0), element: l.element != null ? el(l.element) : '', n: l.n });
  const keysOf = (units) => [...new Set(units.filter((u) => u.type === 'applyEffect').map((u) => u.key))];
  const keywordBlock = (keys) => keys.map((k) => h('div', { class: 'muted' }, h('b', {}, T(`effect.${k}.name`)), ': ', T(`effect.${k}.desc`)));

  // Ảnh chân dung vuông: icon nếu có, không thì ngọc hệ.
  function portrait(id, size = 64) {
    const c = ctx.characters[id];
    const im = getImg(`icon:${id}`);
    const rar = c.rarity === 5 ? '#ffd84a' : c.rarity === 4 ? '#c58bff' : '#4a4f90';
    const box = `width:${size}px;height:${size}px;border-radius:12px;border:3px solid ${rar};flex:none;background:${COLORS[c.element]}33;display:flex;align-items:center;justify-content:center;overflow:hidden`;
    const orb = getImg(`orb:${c.element}`);
    const inner = im ? h('img', { src: im.src, alt: '', width: String(size), height: String(size), style: 'width:100%;height:100%;object-fit:cover' }) : orb ? h('img', { src: orb.src, alt: '', style: `width:${size * 0.7}px` }) : h('b', {}, el(c.element));
    return h('div', { style: box }, inner);
  }

  // Nhãn hệ nhỏ kèm icon tướng (dùng ở danh sách triệu hồi).
  const chip = (id) => {
    const e = ctx.characters[id].element;
    const im = getImg(`icon:${id}`);
    const c = h('span', { class: 'chip', style: `background:${COLORS[e]}` }, el(e));
    return im ? h('span', {}, h('img', { src: im.src, alt: '', width: '36', height: '36', style: 'border-radius:8px;vertical-align:middle;margin-right:4px' }), c) : c;
  };

  const elementBadge = (e) => h('span', { class: 'hp-el', style: `--c:${COLORS[e]}`, title: el(e) }, getImg(`orb:${e}`) ? h('img', { src: getImg(`orb:${e}`).src, alt: el(e) }) : el(e));
  const raceChip = (id) => h('span', { class: 'hp-race', 'data-race': ctx.characters[id].race }, T(`race.${ctx.characters[id].race}`));

  // Đầu thẻ: huy hiệu hệ, tên, sao, tộc; ảnh thẻ lớn nếu có.
  function header(id) {
    const c = ctx.characters[id];
    const card = getImg(`card:${id}`);
    return h(
      'div',
      { class: 'hp-head', style: `--c:${COLORS[c.element]}` },
      h('div', { class: 'hp-title' }, elementBadge(c.element), h('div', { class: 'hp-name' }, h('h2', {}, T(`char.${id}`)), h('div', { class: 'stars' }, stars(id)))),
      card ? h('img', { class: 'hp-art', src: card.src, alt: T(`char.${id}`) }) : h('div', { class: 'hp-art ph' }, portrait(id, 120)),
    );
  }

  // Lưới chỉ số kiểu thẻ ToS: Máu / Công / Hồi / Tộc.
  const statGrid = (st, id) =>
    h(
      'div',
      { class: 'hp-stats' },
      h('div', {}, h('small', {}, T('stat.hp')), h('b', {}, String(st.hp))),
      h('div', {}, h('small', {}, T('stat.atk')), h('b', {}, String(st.atk))),
      h('div', {}, h('small', {}, T('stat.heal')), h('b', {}, String(st.heal))),
      h('div', {}, h('small', {}, T('char.race')), raceChip(id)),
    );

  // Cấp và thanh EXP.
  function levelBar(id, ch) {
    const max = levelCap(ctx, ch.awaken);
    const need = expToNext(ctx, id, ch.level, ch.awaken);
    return h(
      'div',
      { class: 'hp-level' },
      h('div', { class: 'hp-lv' }, h('small', {}, 'Lv'), h('b', {}, String(ch.level)), h('small', {}, `/${max}`)),
      h('div', { class: 'hp-exp' }, h('div', { class: 'hpbar' }, h('i', { style: `width:${need ? Math.min(100, (ch.exp / need) * 100) : 100}%;background:#b58bff` })), h('small', {}, need ? T('char.expBar', { n: ch.exp, max: need }) : T('char.maxLevel'))),
    );
  }

  // Khối kỹ năng có nhãn loại (Chủ động / Đội trưởng / Ghép) ở góc trên như thẻ ToS.
  const skillBox = (tagKey, title, ...lines) => h('div', { class: 'hp-skill' }, h('span', { class: `hp-tag ${tagKey}` }, T(`char.tag.${tagKey}`)), title ? h('b', { class: 'hp-sname' }, title) : null, ...lines);

  const lvTag = (id, lv) => (lv ? h('small', { class: 'muted' }, T('skill.lv', { n: lv, max: maxSkillLevel(ctx, id) })) : null);
  function activeBox(id, { cooldown, status, skillLv, awaken = 0 } = {}) {
    const kit = resolveKit(ctx, id, skillLv || newSkillLevels(), formOf(awaken));
    return skillBox('active', T(`skill.${id}`), lvTag(id, skillLv?.active), h('div', { class: 'muted' }, [status, T('char.cooldown', { n: cooldown ?? kit.skill.cooldown })].filter(Boolean).join(' · ')), kit.skill.units.map((u) => h('div', {}, unitText(u))));
  }
  const leaderBox = (id, skillLv, awaken = 0) => skillBox('leader', null, lvTag(id, skillLv?.leader), h('div', {}, leaderText(resolveKit(ctx, id, skillLv || newSkillLevels(), formOf(awaken)).leader)));
  function passiveText(p) {
    if (p.kind === 'stat') return [h('div', {}, T('passive.stat', { pct: pct(p.pct), stat: T(`stat.${p.stat}`), scope: T(`passive.scope.${p.scope}`, { element: p.element != null ? el(p.element) : '' }) }))];
    return [h('div', { class: 'muted' }, p.trigger === 'start' ? T('passive.start') : T('passive.turn', { n: p.every })), ...p.units.map((u) => h('div', {}, unitText(u)))];
  }
  function passiveBox(id, skillLv, awaken = 0) {
    const p = resolveKit(ctx, id, skillLv || newSkillLevels(), formOf(awaken)).passive;
    return p ? skillBox('passive', T(`passive.${id}`), lvTag(id, skillLv?.passive), passiveText(p)) : null;
  }
  function duoBox(id, detail = true) {
    const duos = ctx.duoList.filter((d) => d.a === id || d.b === id);
    return skillBox('duo', null, ...(duos.length ? duos.map((d) => h('div', {}, h('b', {}, T(`duo.${d.id}`)), ` · ${T('char.duoWith', { name: T(`char.${d.a === id ? d.b : d.a}`) })}`, detail ? d.skill.units.map((u) => h('div', { class: 'muted' }, unitText(u))) : null)) : [h('div', { class: 'muted' }, T('char.noDuo'))]));
  }

  return { chip, el, stars, unitText, leaderText, keysOf, keywordBlock, portrait, header, statGrid, levelBar, activeBox, leaderBox, duoBox, passiveBox, passiveText, raceChip, elementBadge };
}
