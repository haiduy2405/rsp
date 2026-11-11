import { N, areAdjacent, cloneBoard } from './board.js';

// Trả về null nếu hợp lệ, hoặc mã lỗi (chuỗi).
export function validatePath(path, allowDiagonal = false) {
  if (!Array.isArray(path) || path.length < 2) return 'path_too_short';
  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (!Number.isInteger(p) || p < 0 || p >= N) return 'cell_out_of_range';
    if (seen.has(p)) return 'cell_repeated';
    seen.add(p);
    if (i > 0 && !areAdjacent(path[i - 1], p, allowDiagonal)) return 'not_adjacent';
  }
  return null;
}

// Ngọc đang cầm đi dọc đường kéo; mỗi bước hoán đổi với ô kế tiếp.
export function applyPath(board, path) {
  const b = cloneBoard(board);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const c = path[i];
    [b.cells[a], b.cells[c]] = [b.cells[c], b.cells[a]];
    [b.enh[a], b.enh[c]] = [b.enh[c], b.enh[a]];
  }
  return b;
}
