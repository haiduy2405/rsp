// Bàn ngọc 6 cột x 5 hàng. Chỉ số ô = hàng * COLS + cột.
// Loại ngọc: 0 Thủy, 1 Hỏa, 2 Mộc, 3 Quang, 4 Ám, 5 Tim (hồi máu).
export const COLS = 6;
export const ROWS = 5;
export const N = COLS * ROWS;
export const ORB_TYPES = 6;
export const ORB_HEART = 5;

export function createBoard(rng) {
  const cells = new Array(N);
  for (let i = 0; i < N; i++) {
    const r = (i / COLS) | 0;
    const c = i % COLS;
    let t;
    do {
      t = rng.int(ORB_TYPES);
    } while (
      (c >= 2 && cells[i - 1] === t && cells[i - 2] === t) ||
      (r >= 2 && cells[i - COLS] === t && cells[i - 2 * COLS] === t)
    );
    cells[i] = t;
  }
  return { cells, enh: new Array(N).fill(0) };
}

export function cloneBoard(b) {
  return { cells: b.cells.slice(), enh: b.enh.slice() };
}

export function areAdjacent(a, b, allowDiagonal = false) {
  const dr = Math.abs(((a / COLS) | 0) - ((b / COLS) | 0));
  const dc = Math.abs((a % COLS) - (b % COLS));
  if (allowDiagonal) return Math.max(dr, dc) === 1;
  return dr + dc === 1;
}
