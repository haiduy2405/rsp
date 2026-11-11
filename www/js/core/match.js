import { COLS, ROWS, N, ORB_TYPES, cloneBoard } from './board.js';

// Tìm các nhóm (combo). Các dải >=3 cùng loại chồng lên nhau (L, T, +) gộp thành một nhóm.
export function findGroups(board) {
  const { cells, enh } = board;
  const runs = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      const t = cells[r * COLS + c];
      let e = c + 1;
      while (e < COLS && cells[r * COLS + e] === t) e++;
      if (e - c >= 3) {
        const list = [];
        for (let k = c; k < e; k++) list.push(r * COLS + k);
        runs.push({ type: t, cells: list });
      }
      c = e;
    }
  }
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      const t = cells[r * COLS + c];
      let e = r + 1;
      while (e < ROWS && cells[e * COLS + c] === t) e++;
      if (e - r >= 3) {
        const list = [];
        for (let k = r; k < e; k++) list.push(k * COLS + c);
        runs.push({ type: t, cells: list });
      }
      r = e;
    }
  }
  const groups = [];
  for (const run of runs) {
    const hit = groups.filter((g) => g.type === run.type && run.cells.some((x) => g.set.has(x)));
    if (hit.length === 0) {
      groups.push({ type: run.type, set: new Set(run.cells) });
    } else {
      const base = hit[0];
      run.cells.forEach((x) => base.set.add(x));
      for (const extra of hit.slice(1)) {
        extra.set.forEach((x) => base.set.add(x));
        groups.splice(groups.indexOf(extra), 1);
      }
    }
  }
  return groups
    .map((g) => {
      const list = [...g.set].sort((a, b) => a - b);
      return {
        type: g.type,
        cells: list,
        size: list.length,
        enhCount: list.filter((x) => enh[x]).length,
      };
    })
    .sort((a, b) => a.cells[0] - b.cells[0]);
}

// Xóa nhóm, thả ngọc, bù ngọc mới từ rng, lặp đến khi ổn định.
// Nhóm >=5 ngọc để lại 1 ngọc cường hóa tại ô đầu tiên.
export function resolve(board, rng) {
  let b = cloneBoard(board);
  const steps = [];
  for (let guard = 0; guard < 100; guard++) {
    const groups = findGroups(b);
    if (groups.length === 0) break;
    const cleared = new Array(N).fill(false);
    const spawned = [];
    for (const g of groups) {
      for (const x of g.cells) cleared[x] = true;
      if (g.size >= 5) {
        const keep = g.cells[0];
        cleared[keep] = false;
        b.enh[keep] = 1;
        spawned.push(keep);
      }
    }
    const clearedList = [];
    for (let i = 0; i < N; i++) if (cleared[i]) clearedList.push(i);

    const cells = new Array(N);
    const enh = new Array(N);
    const falls = new Array(N).fill(0);
    for (let c = 0; c < COLS; c++) {
      const surv = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        const i = r * COLS + c;
        if (!cleared[i]) surv.push({ t: b.cells[i], e: b.enh[i], r });
      }
      const m = ROWS - surv.length;
      surv.forEach((s, k) => {
        const destRow = ROWS - 1 - k;
        const di = destRow * COLS + c;
        cells[di] = s.t;
        enh[di] = s.e;
        falls[di] = destRow - s.r;
      });
      for (let r = 0; r < m; r++) {
        const di = r * COLS + c;
        cells[di] = rng.int(ORB_TYPES);
        enh[di] = 0;
        falls[di] = m;
      }
    }
    const before = b;
    b = { cells, enh };
    steps.push({
      groups,
      cleared: clearedList,
      spawnedEnhanced: spawned,
      falls,
      boardBefore: before,
      board: cloneBoard(b),
    });
  }
  return { board: b, steps };
}
