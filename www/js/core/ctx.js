// Dựng ctx (dữ liệu game không đổi) từ các JSON thô. Dùng chung cho trình duyệt, test và tools.
export function indexById(list) {
  const out = {};
  for (const x of list) out[x.id] = x;
  return out;
}

export function buildCtx(raw) {
  const zoneList = raw.zones.slice().sort((a, b) => a.order - b.order);
  return {
    config: raw.config,
    characters: indexById(raw.characters),
    monsters: indexById(raw.monsters),
    zones: indexById(zoneList),
    zoneList,
    events: indexById(raw.events),
    eventList: raw.events,
  };
}
