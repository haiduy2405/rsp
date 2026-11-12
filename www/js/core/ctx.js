// Dựng ctx (dữ liệu game không đổi) từ các JSON thô. Dùng chung cho trình duyệt, test và tools.
export function indexById(list) {
  const out = {};
  for (const x of list) out[x.id] = x;
  return out;
}

// Mọi tệp dữ liệu game (www/js/data/<tên>.json). Thêm tệp mới chỉ cần thêm tên vào đây và vào buildCtx.
export const DATA_FILES = ['config', 'characters', 'monsters', 'zones', 'events', 'duos', 'banners', 'story', 'fodder', 'relics', 'flags'];

// Đọc toàn bộ dữ liệu qua hàm read(đường dẫn tương đối trong js/) trả JSON (đồng bộ hoặc Promise).
export async function loadRaw(read) {
  const vals = await Promise.all(DATA_FILES.map((k) => read(`data/${k}.json`)));
  return Object.fromEntries(DATA_FILES.map((k, i) => [k, vals[i]]));
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
    flagList: raw.flags || [],
    relicList: raw.relics || [],
    relics: indexById(raw.relics || []),
    fodderList: raw.fodder || [],
    fodder: Object.fromEntries((raw.fodder || []).map((f) => [`${f.element}_${f.star}`, f])), // khóa 'hệ_sao'
    duoByPair: Object.fromEntries((raw.duos || []).flatMap((d) => [[`${d.a}|${d.b}`, d], [`${d.b}|${d.a}`, d]])),
  };
}
