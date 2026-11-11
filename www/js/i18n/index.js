// t(key, params): thiếu key ở ngôn ngữ chính thì dùng en, rồi mới trả về chính key.
export function createT(dict, fallback = {}) {
  return (key, params = {}) => {
    const s = dict[key] ?? fallback[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
  };
}

// Mặc định theo ngôn ngữ thiết bị, dự phòng en.
export function detectLang(navLang) {
  return String(navLang || '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
}
