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
    characterList: raw.characters,
    monsters: indexById(raw.monsters),
    zones: indexById(zoneList),
    zoneList,
    events: indexById(raw.events),
    eventList: raw.events,
    banners: indexById(raw.banners || []),
    bannerList: raw.banners || [],
    storyList: raw.story || [],
    duos: indexById(raw.duos || []),
    duoList: raw.duos || [],
    duoByPair: Object.fromEntries((raw.duos || []).flatMap((d) => [[`${d.a}|${d.b}`, d], [`${d.b}|${d.a}`, d]])),
  };
}
