// 3 ô lưu tiến trình. Ô 1 dùng đúng khóa cũ (rsp.save) nên người chơi cũ tự nhiên có sẵn ván ở ô 1.
// Tên đặt riêng và lần chơi cuối nằm trong một khóa siêu dữ liệu nhỏ (rsp.slots).
import { createStorage, KEY, BAK_KEY } from './storage.js';

export const SLOT_COUNT = 3;
export const META_KEY = 'rsp.slots';
export const NAME_MAX = 16;

export const slotKeys = (n) => (n === 1 ? { key: KEY, bak: BAK_KEY } : { key: `${KEY}.s${n}`, bak: `${KEY}.s${n}.bak` });

export function createSlots(adapter, ctx) {
  const readMeta = () => {
    try {
      const m = JSON.parse(adapter.getItem(META_KEY) || '{}');
      return { names: m.names || {}, at: m.at || {}, last: Number.isInteger(m.last) ? m.last : null };
    } catch {
      return { names: {}, at: {}, last: null };
    }
  };
  const writeMeta = (m) => {
    try {
      adapter.setItem(META_KEY, JSON.stringify(m));
    } catch {
      /* bỏ qua */
    }
  };
  const stores = {};
  const storage = (n) => (stores[n] ||= createStorage(adapter, ctx, slotKeys(n)));
  const valid = (n) => Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT;
  return {
    count: SLOT_COUNT,
    storage,
    last: () => { const l = readMeta().last; return valid(l) ? l : null; },
    setLast(n) { if (!valid(n)) return; const m = readMeta(); m.last = n; writeMeta(m); },
    touch(n, now = Date.now()) { if (!valid(n)) return; const m = readMeta(); m.at[n] = now; writeMeta(m); },
    // [{ n, used, name, label, at, progress }] — progress là bản xem nhanh (null nếu ô trống/hỏng)
    list() {
      const m = readMeta();
      return Array.from({ length: SLOT_COUNT }, (_, i) => {
        const n = i + 1;
        const progress = storage(n).peek();
        const label = (m.names[n] || '').trim();
        return { n, used: !!progress, label, name: label || progress?.player?.name || '', at: m.at[n] || null, progress };
      });
    },
    rename(n, name) {
      if (!valid(n)) return false;
      const v = String(name || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
      const m = readMeta();
      if (v) m.names[n] = v; else delete m.names[n];
      writeMeta(m);
      return true;
    },
    remove(n) {
      if (!valid(n)) return false;
      storage(n).clear();
      const m = readMeta();
      delete m.names[n];
      delete m.at[n];
      if (m.last === n) m.last = null;
      writeMeta(m);
      return true;
    },
  };
}
