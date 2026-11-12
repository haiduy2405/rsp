// Lưu/đọc tiến trình. Trừu tượng hóa qua adapter {getItem,setItem,removeItem} để đổi sang
// IndexedDB/Capacitor Preferences sau này mà không sửa logic. Có checksum, version, bản sao dự phòng.
import { SAVE_VERSION, isValidProgress, newProgress } from '../core/progress.js';
import { hashState } from '../core/hash.js';
import { migrate } from './migrate.js';

export const KEY = 'rsp.save';
export const BAK_KEY = 'rsp.save.bak';

export function encode(progress) {
  return JSON.stringify({ v: SAVE_VERSION, sum: hashState(progress), data: progress });
}

// Trả về progress hợp lệ (đã nâng cấp) hoặc null nếu hỏng/không nhận ra.
export function decode(text, ctx) {
  if (typeof text !== 'string' || !text) return null;
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  if (!obj || typeof obj.v !== 'number' || !obj.data || typeof obj.sum !== 'number') return null;
  if (hashState(obj.data) !== obj.sum) return null;
  const data = migrate(obj.data, obj.v, ctx);
  return data && isValidProgress(data) ? data : null;
}

export function createStorage(adapter, ctx, keys = { key: KEY, bak: BAK_KEY }) {
  const KEY_ = keys.key;
  const BAK_ = keys.bak;
  const safeGet = (k) => {
    try {
      return adapter.getItem(k);
    } catch {
      return null;
    }
  };
  return {
    save(progress) {
      const text = encode(progress);
      const prev = safeGet(KEY_);
      try {
        // Chỉ sao lưu bản chính nếu nó còn lành, để không ghi đè bản dự phòng tốt bằng bản hỏng.
        if (prev && decode(prev, ctx)) adapter.setItem(BAK_, prev);
        adapter.setItem(KEY_, text);
        return true;
      } catch {
        return false; // hết dung lượng / bị chặn
      }
    },
    load() {
      const rawMain = safeGet(KEY_);
      const main = decode(rawMain, ctx);
      if (main) return { progress: main, source: 'main', recovered: false };
      const rawBak = safeGet(BAK_);
      const bak = decode(rawBak, ctx);
      if (bak) {
        try {
          adapter.setItem(KEY_, encode(bak));
        } catch {
          /* bỏ qua */
        }
        return { progress: bak, source: 'backup', recovered: true };
      }
      return { progress: newProgress(ctx), source: 'new', recovered: !!(rawMain || rawBak) };
    },
    clear() {
      try {
        adapter.removeItem(KEY_);
        adapter.removeItem(BAK_);
        return true;
      } catch {
        return false;
      }
    },
    // Xem nhanh một ô lưu (không ghi gì): progress hợp lệ hoặc null.
    peek() {
      return decode(safeGet(KEY_), ctx) || decode(safeGet(BAK_), ctx);
    },
    exportText: (progress) => encode(progress),
    importText(text) {
      const p = decode(text, ctx);
      if (!p) throw new Error('invalid_save');
      return p;
    },
  };
}

// Adapter cho trình duyệt: localStorage, rơi về bộ nhớ nếu bị chặn.
export function browserAdapter() {
  const mem = new Map();
  let ls = null;
  try {
    ls = globalThis.localStorage;
    ls.setItem('rsp.probe', '1');
    ls.removeItem('rsp.probe');
  } catch {
    ls = null;
  }
  return {
    getItem: (k) => (ls ? ls.getItem(k) : (mem.get(k) ?? null)),
    setItem: (k, v) => (ls ? ls.setItem(k, v) : mem.set(k, v)),
    removeItem: (k) => (ls ? ls.removeItem(k) : mem.delete(k)),
  };
}
