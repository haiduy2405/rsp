import { areAdjacent } from '../core/board.js';
import { step as coreStep } from '../core/battle.js';

// Gợi ý: tìm MỘT ĐƯỜNG KÉO (nhiều bước) tạo được nhiều combo nhất (rồi tới số ngọc tan, rồi sát thương).
// Tìm chùm (beam search) trên mô phỏng thật của lõi nên luôn khớp kết quả thực tế.
const BEAM = 14;
const MAX_STEPS = 8;

function score(r) {
  const steps = r.events.filter((e) => e.type === 'step');
  if (!steps.length) return null;
  const combos = steps[steps.length - 1].combos;
  const cleared = steps.reduce((n, e) => n + (e.step.cleared?.length || 0), 0);
  const dmg = steps.reduce((n, e) => n + e.hits.reduce((m, h) => m + (h.kind === 'damage' ? h.amount : 0), 0), 0);
  return { combos, cleared, dmg };
}
const better = (a, b) => !b || a.combos !== b.combos ? !b || a.combos > b.combos : a.cleared !== b.cleared ? a.cleared > b.cleared : a.dmg > b.dmg;

export function findHint(ctx, state, step = coreStep) {
  const diag = ctx.config.board.allowDiagonal;
  const N = state.board.cells.length;
  let best = null;
  let beam = [];
  for (let a = 0; a < N; a++) if (!state.locked.includes(a)) beam.push({ path: [a], sc: null });
  for (let depth = 1; depth <= MAX_STEPS && beam.length; depth++) {
    const next = [];
    for (const node of beam) {
      const last = node.path[node.path.length - 1];
      const prev = node.path[node.path.length - 2];
      for (let b = 0; b < N; b++) {
        if (b === prev || b === last || state.locked.includes(b) || !areAdjacent(last, b, diag)) continue;
        const path = [...node.path, b];
        const sc = score(step(ctx, state, { type: 'move', path }));
        const entry = { path, sc: sc || { combos: 0, cleared: 0, dmg: 0 } };
        next.push(entry);
        if (sc && better(sc, best?.sc)) best = entry;
      }
    }
    // giữ các đường triển vọng nhất; ưu tiên đường ngắn khi điểm bằng nhau
    next.sort((x, y) => (better(x.sc, y.sc) ? -1 : better(y.sc, x.sc) ? 1 : 0));
    beam = next.slice(0, BEAM);
  }
  return best ? { path: best.path, combos: best.sc.combos } : null;
}
