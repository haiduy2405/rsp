import { areAdjacent } from '../core/board.js';
import { step as coreStep } from '../core/battle.js';

// Gợi ý: tìm MỘT ĐƯỜNG KÉO (nhiều bước) tạo nhiều combo nhất nhưng KHÔNG QUÁ config.hint.maxCombos (người mới đừng thấy 10+ combo
// rồi nản), rồi tới số ngọc tan, rồi sát thương, rồi đường ngắn hơn.
// Tìm chùm (beam search) trên mô phỏng thật của lõi nên luôn khớp kết quả thực tế.
const BEAM = 14;

function score(r) {
  const steps = r.events.filter((e) => e.type === 'step');
  if (!steps.length) return null;
  const combos = steps[steps.length - 1].combos;
  const cleared = steps.reduce((n, e) => n + (e.step.cleared?.length || 0), 0);
  const dmg = steps.reduce((n, e) => n + e.hits.reduce((m, h) => m + (h.kind === 'damage' ? h.amount : 0), 0), 0);
  return { combos, cleared, dmg };
}
const better = (a, b) => !b || a.combos !== b.combos ? !b || a.combos > b.combos : a.cleared !== b.cleared ? a.cleared > b.cleared : a.dmg > b.dmg;
// Chế độ tối ưu (gợi ý trong trận): nhiều combo nhất, rồi sát thương cao nhất, rồi số ngọc tan. Bằng điểm thì giữ đường NGẮN (dễ kéo) đã tìm trước.
const betterMax = (a, b) => !b || a.combos !== b.combos ? !b || a.combos > b.combos : a.dmg !== b.dmg ? a.dmg > b.dmg : a.cleared > b.cleared;

// Bản chia lát: generator nhường (yield) khi đã chạy quá sliceMs để không chặn khung hình.
function* search(ctx, state, step, shouldYield, opts = {}) {
  const diag = opts.orthogonal ? false : ctx.config.board.allowDiagonal; // orthogonal: chỉ gợi ý nước ngang/dọc, không chéo
  const cap = opts.maxCombos ?? ctx.config.hint?.maxCombos ?? 6;
  const beamW = opts.beam ?? BEAM;
  const better_ = opts.maximize ? betterMax : better;
  const maxSteps = opts.maxSteps ?? ctx.config.hint?.maxSteps ?? 8;
  const N = state.board.cells.length;
  let best = null;
  let beam = [];
  for (let a = 0; a < N; a++) if (!state.locked.includes(a)) beam.push({ path: [a], sc: null });
  for (let depth = 1; depth <= maxSteps && beam.length; depth++) {
    const next = [];
    for (const node of beam) {
      const last = node.path[node.path.length - 1];
      const prev = node.path[node.path.length - 2];
      for (let b = 0; b < N; b++) {
        if (b === prev || b === last || state.locked.includes(b) || !areAdjacent(last, b, diag)) continue;
        if (shouldYield()) yield;
        const path = [...node.path, b];
        const sc = score(step(ctx, state, { type: 'move', path }));
        if (sc && sc.combos > cap) continue; // quá nhiều combo: bỏ
        const entry = { path, sc: sc || { combos: 0, cleared: 0, dmg: 0 } };
        next.push(entry);
        if (sc && better_(sc, best?.sc)) best = entry; // bằng điểm thì giữ đường ngắn đã tìm trước
      }
    }
    // giữ các đường triển vọng nhất; ưu tiên đường ngắn khi điểm bằng nhau
    next.sort((x, y) => (better_(x.sc, y.sc) ? -1 : better_(y.sc, x.sc) ? 1 : 0));
    beam = next.slice(0, beamW);
  }
  return best ? { path: best.path, combos: best.sc.combos } : null;
}

export function findHint(ctx, state, step = coreStep, opts = {}) {
  const it = search(ctx, state, step, () => false, opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// Không chặn luồng chính: mỗi lát ~4ms rồi trả quyền cho trình duyệt (khung hình vẫn đều 60fps).
export function findHintAsync(ctx, state, step = coreStep, sliceMs = 4, opts = {}) {
  return new Promise((resolve) => {
    let t0 = 0;
    const it = search(ctx, state, step, () => performance.now() - t0 > sliceMs, opts);
    const run = () => {
      t0 = performance.now();
      const r = it.next();
      if (r.done) resolve(r.value);
      else setTimeout(run, 0);
    };
    run();
  });
}
