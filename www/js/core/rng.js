// RNG có seed (mulberry32). Trạng thái = một số 32-bit, serialize/khôi phục được.
// Đây là nguồn ngẫu nhiên DUY NHẤT cho code trong core.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return {
    get state() {
      return a >>> 0;
    },
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n) {
      return Math.floor(this.next() * n);
    },
  };
}
