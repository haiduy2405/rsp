// Vẽ canvas (hình khối màu tạm, chưa có art). Không chứa logic game.
import { COLS, ROWS } from '../core/board.js';

import { getImg } from './assets.js';

export const W = 540;
export const H = 960;
export const CELL = 90;
export const BOARD_X = 0;
export const BOARD_Y = 480;
export const COLORS = ['#3b9cff', '#ff5a3c', '#4cc46a', '#ffd84a', '#9a5cff', '#ff7fb0'];

export function cellCenter(i) {
  return { x: BOARD_X + (i % COLS) * CELL + CELL / 2, y: BOARD_Y + ((i / COLS) | 0) * CELL + CELL / 2 };
}

export function cellAt(px, py) {
  const c = Math.floor((px - BOARD_X) / CELL);
  const r = Math.floor((py - BOARD_Y) / CELL);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
  return r * COLS + c;
}

// Ngọc Nâng Cấp: vòng vàng nhấp nháy và bốn tia sáng xoay chậm, nhìn là biết mạnh hơn.
function enhancedAura(g, x, y, r) {
  const t = (typeof performance !== 'undefined' ? performance.now() : 0) * 0.001;
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  g.save();
  g.shadowColor = '#ffd24a';
  g.shadowBlur = 10 + 8 * pulse;
  g.strokeStyle = `rgba(255,226,122,${0.75 + 0.25 * pulse})`;
  g.lineWidth = 4;
  g.beginPath();
  g.arc(x, y, r + 5, 0, Math.PI * 2);
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = '#fff6c8';
  for (let k = 0; k < 4; k++) {
    const a = t * 0.9 + (k * Math.PI) / 2;
    const px = x + Math.cos(a) * (r + 5);
    const py = y + Math.sin(a) * (r + 5);
    g.beginPath();
    g.moveTo(px, py - 6);
    g.lineTo(px + 2.4, py);
    g.lineTo(px, py + 6);
    g.lineTo(px - 2.4, py);
    g.closePath();
    g.fill();
  }
  g.restore();
}

// Bóng chạm đất mềm dưới ngọc (art ngọc đã tự có khối, ánh sáng và viền).
function orbShadow(g, x, y, r) {
  const sh = g.createRadialGradient(x, y + r * 0.8, 0, x, y + r * 0.8, r * 0.95);
  sh.addColorStop(0, 'rgba(0,0,0,0.4)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(x, y + r * 0.8, r * 0.95, r * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// Ánh sáng chạy trên ngọc: (1) một chùm sáng chéo quét qua cả bàn như nguồn sáng di chuyển, (2) thỉnh thoảng từng viên lóe một vệt chéo riêng.
// Vệt sáng chỉ tô lên phần có hình của ngọc (source-atop trên canvas phụ dùng chung), và chỉ vẽ cho viên đang được chạm sáng.
const SHEEN_DIR = [0.87, 0.49];
const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let sheenCv = null;
function orbSheen(g, im, x, y, r) {
  if (REDUCED || !im || !im.naturalWidth || typeof document === 'undefined') return;
  const t = performance.now();
  // (1) chùm sáng toàn bàn: đi từ góc trên trái sang dưới phải trong ~3,2s, nghỉ ~4s
  const u = x * SHEEN_DIR[0] + y * SHEEN_DIR[1];
  const ph = (t % 7200) / 7200;
  let off = 0, k = 0;
  if (ph < 0.45) {
    const bc = -80 + (ph / 0.45) * 780;
    const d = u - bc;
    if (Math.abs(d) < 58) { k = 1 - Math.abs(d) / 58; off = -d; }
  }
  // (2) vệt riêng của từng viên: ~0,7s mỗi ~9s, lệch pha theo vị trí
  const q = ((t * 0.001 + ((x * 7.13 + y * 3.71) % 9)) % 9.3) / 0.75;
  if (q < 1 && k < 0.6) { k = Math.sin(q * Math.PI) * 0.85; off = (q - 0.5) * 2.6 * r; }
  if (k <= 0.02) return;
  const S = 128;
  if (!sheenCv) { sheenCv = document.createElement('canvas'); sheenCv.width = S; sheenCv.height = S; }
  const c = sheenCv.getContext('2d');
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, S, S);
  c.drawImage(im, 0, 0, S, S);
  c.globalCompositeOperation = 'source-atop';
  const sc = S / (r * 2), cx = S / 2 + off * SHEEN_DIR[0] * sc, cy = S / 2 + off * SHEEN_DIR[1] * sc, w = 20 * sc * 0.55;
  const gr = c.createLinearGradient(cx - SHEEN_DIR[0] * w, cy - SHEEN_DIR[1] * w, cx + SHEEN_DIR[0] * w, cy + SHEEN_DIR[1] * w);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr;
  c.fillRect(0, 0, S, S);
  g.save();
  g.globalAlpha *= k;
  g.globalCompositeOperation = 'lighter';
  g.drawImage(sheenCv, x - r, y - r, r * 2, r * 2);
  g.restore();
}


// Biểu tượng (giọt nước, ngọn lửa, lá...) là lớp riêng đặt lên ngọc trống, cử động CHUNG cho mọi viên (cùng pha) để bàn không rối:
// thở nhẹ liên tục (±4%), mỗi ~4,8s nảy lên một cái (kéo giãn rồi dẹt khi chạm).
const EMB_FRAC = 0.33 / 0.97;
// Ngọc "thở" tự nhiên: hít chậm dần-nhanh dần (ease in-out), nghỉ một thoáng, thở ra dài hơn. Mọi viên cùng pha.
// Trả về -1..1. Chu kỳ 3,4s: hít 38%, nghỉ 6%, thở ra 50%, nghỉ 6%.
const BREATH_MS = 3400;
const smooth = (k) => k * k * (3 - 2 * k);
function breathCurve() {
  const k = (performance.now() % BREATH_MS) / BREATH_MS;
  let v;
  if (k < 0.38) v = smooth(k / 0.38);
  else if (k < 0.44) v = 1;
  else if (k < 0.94) v = 1 - smooth((k - 0.44) / 0.5);
  else v = 0;
  return v * 2 - 1;
}
function gemBreath() {
  if (REDUCED) return 1;
  return 1 + 0.03 * breathCurve();
}
function embPose(r) {
  if (REDUCED) return { sx: 1, sy: 1, dy: 0 };
  const t = performance.now();
  const br = breathCurve() * 0.035; // cùng nhịp thở với thân ngọc
  let sx = 1 + br, sy = 1 + br, dy = 0;
  const h = (t % 4800) / 800; // 0..6; nảy trong 0..1
  if (h < 1) {
    const lift = Math.sin(h * Math.PI);
    dy = -lift * r * 0.11;
    sx *= 1 - lift * 0.05; sy *= 1 + lift * 0.07;
  } else if (h < 1.25) { // dẹt nhẹ khi chạm
    const q = Math.sin(((h - 1) / 0.25) * Math.PI);
    sx *= 1 + q * 0.07; sy *= 1 - q * 0.08;
  }
  return { sx, sy, dy };
}
// Bóng đổ của biểu tượng lên mặt ngọc: như có đèn chiếu từ phía trước-trên-trái nên bóng rơi chếch xuống-phải.
// Bóng làm sẵn một lần (silhouette tối + nhòe) rồi cache; khi biểu tượng nảy lên bóng ở lại mặt ngọc, nhạt và nhỏ lại nên có chiều sâu.
const shadowCache = {};
function emblemShadow(type, em) {
  if (shadowCache[type] || typeof document === 'undefined') return shadowCache[type] || null;
  const S = 160, M = 128, off = (S - M) / 2;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const c = cv.getContext('2d');
  c.shadowColor = 'rgba(0,8,30,0.95)';
  c.shadowBlur = 6;
  c.shadowOffsetX = 1000 + 7;
  c.shadowOffsetY = 9;
  c.drawImage(em, off - 1000, off, M, M);
  return (shadowCache[type] = cv);
}
function drawEmblem(g, type, x, y, R) {
  const em = getImg(`emb:${type}`);
  if (!em) return false;
  const p = embPose(R), w = R * 2 * EMB_FRAC;
  const sh = emblemShadow(type, em);
  if (sh) {
    const lift = Math.min(1, -p.dy / (R * 0.11 || 1)); // 0 khi nằm trên ngọc, 1 khi nảy cao nhất
    const sw = w * (160 / 128) * (1 - 0.1 * lift);
    g.save();
    g.globalAlpha *= 0.95 - 0.35 * lift;
    g.drawImage(sh, x - sw / 2 + w * 0.03 * lift, y - sw / 2 + w * 0.02 * lift, sw, sw);
    g.restore();
  }
  g.drawImage(em, x - (w * p.sx) / 2, y + p.dy - (w * p.sy) / 2 + w * (1 - p.sy) * 0.5, w * p.sx, w * p.sy);
  return true;
}
// Mỗi hệ một hình khác nhau để phân biệt khi mù màu.
export function drawOrb(g, type, x, y, r, enhanced = false, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  // Ngọc Nâng Cấp có art riêng (huy hiệu viền vàng, cánh, miện); chưa có art thì vẽ ngọc thường + hào quang.
  const bkE = enhanced ? getImg(`blankE:${type}`) : null;
  if (bkE && getImg(`emb:${type}`)) {
    const R = r * 1.04 * gemBreath();
    if (r >= 14) orbShadow(g, x, y, r);
    g.drawImage(bkE, x - R, y - R, R * 2, R * 2);
    if (r >= 20) orbSheen(g, bkE, x, y, R);
    drawEmblem(g, type, x, y, R);
    g.restore();
    return;
  }
  const imE = enhanced ? getImg(`orbE:${type}`) : null;
  if (imE) {
    const R = r * 1.04;
    if (r >= 14) orbShadow(g, x, y, r);
    g.drawImage(imE, x - R, y - R, R * 2, R * 2);
    if (r >= 20) orbSheen(g, imE, x, y, R);
    g.restore();
    return;
  }
  const bk = getImg(`blank:${type}`);
  if (bk && getImg(`emb:${type}`)) {
    const rb = r * gemBreath();
    if (r >= 14) orbShadow(g, x, y, r);
    g.drawImage(bk, x - rb, y - rb, rb * 2, rb * 2);
    if (r >= 20) orbSheen(g, bk, x, y, rb);
    drawEmblem(g, type, x, y, rb);
    if (enhanced) enhancedAura(g, x, y, r);
    g.restore();
    return;
  }
  const im = getImg(`orb:${type}`);
  if (im) {
    if (r >= 14) orbShadow(g, x, y, r);
    g.drawImage(im, x - r, y - r, r * 2, r * 2);
    if (r >= 20) orbSheen(g, im, x, y, r);
    if (enhanced) enhancedAura(g, x, y, r);
    g.restore();
    return;
  }
  g.fillStyle = COLORS[type];
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3;
  g.beginPath();
  if (type === 0) g.arc(x, y, r, 0, Math.PI * 2);
  else if (type === 1) {
    g.moveTo(x, y - r);
    g.lineTo(x + r * 0.95, y + r * 0.8);
    g.lineTo(x - r * 0.95, y + r * 0.8);
    g.closePath();
  } else if (type === 2) {
    const s = r * 0.85;
    g.roundRect(x - s, y - s, s * 2, s * 2, 10);
  } else if (type === 3) {
    g.moveTo(x, y - r);
    g.lineTo(x + r, y);
    g.lineTo(x, y + r);
    g.lineTo(x - r, y);
    g.closePath();
  } else if (type === 4) {
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
  } else {
    g.moveTo(x, y + r);
    g.bezierCurveTo(x - r * 1.4, y + r * 0.1, x - r * 0.7, y - r * 1.0, x, y - r * 0.35);
    g.bezierCurveTo(x + r * 0.7, y - r * 1.0, x + r * 1.4, y + r * 0.1, x, y + r);
    g.closePath();
  }
  g.fill();
  g.stroke();
  if (enhanced) enhancedAura(g, x, y, r);
  g.restore();
}

// Thanh máu: rãnh tối, viền, thân có độ bóng và vạch chia.
// KHUNG VÀNG GOLD hoa văn + đèn quét ngang. Một "đèn" chạy qua cả màn (cùng pha mọi khung): chỉ phần viền nằm trong dải sáng mới lóe.
// opts: { orn: vẽ hoa văn góc (mặc định khi đủ rộng), lw: độ dày viền }
let goldCv = null;
function goldFrame(g, x, y, w, h, opts = {}) {
  const lw = opts.lw ?? 3;
  const orn = opts.orn ?? (w >= 90 && h >= 28);
  const gg = g.createLinearGradient(0, y, 0, y + h);
  gg.addColorStop(0, '#fff0a8'); gg.addColorStop(0.38, '#e8b13a'); gg.addColorStop(0.62, '#8a5a14'); gg.addColorStop(1, '#f3c64e');
  g.save();
  g.strokeStyle = gg;
  g.lineWidth = lw;
  g.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(50,25,4,0.85)';
  g.strokeRect(x + lw + 0.5, y + lw + 0.5, w - lw * 2 - 1, h - lw * 2 - 1);
  g.strokeStyle = 'rgba(255,236,170,0.5)';
  g.strokeRect(x + lw + 1.5, y + lw + 1.5, w - lw * 2 - 3, h - lw * 2 - 3);
  if (orn) {
    // hoa văn góc cổ điển (ảnh ui:corner, lật 4 góc); cỡ theo chiều cao khung để không che chữ
    const im = getImg('ui:corner');
    const cs = Math.max(14, Math.min(34, h * 0.36));
    if (im) {
      for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        g.save(); g.translate(cx, cy); g.scale(sx, sy); g.drawImage(im, -1, -1, cs, cs); g.restore();
      }
    }
  }
  // đèn quét: dải sáng nghiêng, chạy từ trái sang phải toàn màn mỗi ~4,4s (cắt theo vành viền)
  if (!REDUCED) {
    const t = performance.now();
    const bx = -140 + ((t % 4400) / 4400) * (W + 280);
    if (bx + 70 > x && bx - 70 < x + w) {
      g.beginPath();
      g.rect(x, y, w, h);
      g.rect(x + lw + 1, y + lw + 1, w - (lw + 1) * 2, h - (lw + 1) * 2);
      g.clip('evenodd');
      g.globalCompositeOperation = 'lighter';
      const sg = g.createLinearGradient(bx - 40, y + h, bx + 40, y);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,235,0.95)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg;
      g.fillRect(x - 2, y - 2, w + 4, h + 4);
    }
  }
  g.restore();
}

// KHUNG PHỤC HƯNG cho thẻ tướng: viền vàng bọc cả ô (ảnh + tên), hàng hạt ngọc dọc cạnh trên/dưới, xoắn volute ở 4 góc kèm lá acanthus,
// vỏ sò (scallop) ở giữa cạnh trên và nút thoi ở giữa cạnh dưới. Đèn quét ngang dùng chung với goldFrame.
function renaissanceFrame(g, x, y, w, h, strong) {
  goldFrame(g, x, y, w, h, { lw: 3, orn: false });
  g.save();
  const gold = '#f3c64e', hi = '#fff0a8', dk = '#6b410a';
  // hạt ngọc dọc cạnh trên và dưới (nằm trong dải viền)
  g.fillStyle = hi;
  for (let px = x + 18; px <= x + w - 18; px += 6) {
    if (Math.abs(px - (x + w / 2)) < 9) continue;
    g.beginPath(); g.arc(px, y + 1.5, 1, 0, 6.283); g.fill();
    g.beginPath(); g.arc(px, y + h - 1.5, 1, 0, 6.283); g.fill();
  }
  // viền hoa văn nằm gọn trong dải viền (không lấn vào nội dung thẻ): khung góc vát + thoi nhỏ ở 4 góc và giữa cạnh
  const ins = 5, L = strong ? 13 : 11, c = 3.5;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    g.beginPath();
    g.moveTo(cx + sx * (ins + L), cy + sy * ins); g.lineTo(cx + sx * (ins + c), cy + sy * ins); g.lineTo(cx + sx * ins, cy + sy * (ins + c)); g.lineTo(cx + sx * ins, cy + sy * (ins + L));
    g.strokeStyle = dk; g.lineWidth = 2.6; g.stroke();
    g.strokeStyle = gold; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = hi; g.strokeStyle = dk; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(cx + sx * 2, cy + sy * 2 - sy * 3.4); g.lineTo(cx + sx * 2 + sx * 3.4, cy + sy * 2); g.lineTo(cx + sx * 2, cy + sy * 2 + sy * 3.4); g.lineTo(cx + sx * 2 - sx * 3.4, cy + sy * 2); g.closePath(); g.fill(); g.stroke();
  }
  const mx = x + w / 2;
  g.fillStyle = gold; g.strokeStyle = dk; g.lineWidth = 0.8;
  for (const my of [y + 1.5, y + h - 1.5]) { g.beginPath(); g.moveTo(mx, my - 3.4); g.lineTo(mx + 5, my); g.lineTo(mx, my + 3.4); g.lineTo(mx - 5, my); g.closePath(); g.fill(); g.stroke(); }
  g.restore();
}

function bar(g, x, y, w, h, frac, color, light) {
  g.fillStyle = 'rgba(22, 58, 108, 0.85)';
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  const fw = Math.max(0, w * Math.min(1, frac));
  if (fw > 0) {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, light || '#ffffff');
    gr.addColorStop(0.35, color);
    gr.addColorStop(1, color);
    g.fillStyle = gr;
    g.fillRect(x, y, fw, h);
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.fillRect(x, y, fw, Math.max(1, h * 0.28));
  }
  g.fillStyle = 'rgba(22, 58, 108, 0.3)';
  for (let k = 1; k < 10; k++) g.fillRect(x + (w * k) / 10 - 0.5, y, 1, h);
  goldFrame(g, x - 3, y - 3, w + 6, h + 6, h >= 14 ? { lw: 2.5, orn: w >= 120 } : { lw: 1.5, orn: false });
}

// Bốn góc vàng: dấu hiệu "điểm dị" của UI.
function brackets(g, x, y, w, h, len, color, lw = 2) {
  g.save();
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.beginPath();
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    g.moveTo(cx + dx * len, cy);
    g.lineTo(cx, cy);
    g.lineTo(cx, cy + dy * len);
  }
  g.stroke();
  g.restore();
}
function panel(g, x, y, w, h, accent, ren) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, 'rgba(66, 124, 196, 0.9)');
  gr.addColorStop(1, 'rgba(20, 52, 100, 0.94)');
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)'; // bóng đổ xuống nền
  g.shadowBlur = 10;
  g.shadowOffsetY = 4;
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
  g.restore();
  if (ren) renaissanceFrame(g, x, y, w, h, ren === 2);
  else goldFrame(g, x, y, w, h, { lw: 2.5, orn: w >= 120 });
  if (accent) {
    // viền neon theo màu hệ: một nét sáng trong + quầng mờ ngoài
    g.save();
    g.shadowColor = accent;
    g.shadowBlur = 9;
    g.strokeStyle = accent;
    g.globalAlpha = 0.85;
    g.lineWidth = 1.5;
    g.strokeRect(x + 4, y + 4, w - 8, h - 8);
    g.restore();
    const hl = g.createLinearGradient(x, 0, x + w, 0);
    hl.addColorStop(0, 'rgba(255,255,255,0)');
    hl.addColorStop(0.5, accent);
    hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = accent;
    g.fillRect(x + 4, y + 4, w - 8, 3);
    g.fillStyle = hl;
    g.globalAlpha = 0.5;
    g.fillRect(x + 4, y + 7, w - 8, 5);
    g.globalAlpha = 1;
  } else {
    // panel không thuộc hệ nào: điểm xuyết một vệt băng xanh #9DF1FF → trắng ở mép trên
    const ic = g.createLinearGradient(x, 0, x + w, 0);
    ic.addColorStop(0, 'rgba(157,241,255,0)'); ic.addColorStop(0.3, 'rgba(157,241,255,0.9)'); ic.addColorStop(0.7, 'rgba(255,255,255,0.9)'); ic.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ic;
    g.fillRect(x + 8, y + 4, w - 16, 2);
  }
}

// Chữ có viền tối và tô chuyển sắc (trên sáng, dưới màu hệ) kèm quầng sáng nhẹ.
function outlined(g, str, x, y, size, top, bottom, family, lw = 5, weight = '700') {
  g.save();
  g.font = `${weight} ${size}px ${family}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.miterLimit = 2;
  g.lineWidth = lw;
  g.strokeStyle = 'rgba(22, 58, 108, 0.95)';
  // viền sáng giả bằng nét mờ rộng hơn (shadowBlur trên chữ rất tốn CPU khi có nhiều số bay)
  const w0 = g.globalAlpha;
  g.globalAlpha = w0 * 0.35;
  g.strokeStyle = bottom;
  g.lineWidth = lw + size * 0.18;
  g.strokeText(str, x, y);
  g.globalAlpha = w0;
  g.lineWidth = lw;
  g.strokeStyle = 'rgba(22, 58, 108, 0.95)';
  g.strokeText(str, x, y);
  const gr = g.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  gr.addColorStop(0, top);
  gr.addColorStop(0.55, top);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillText(str, x, y);
  g.restore();
}
// Số tổng nhiều hệ: chữ tô sọc chéo xen kẽ màu các hệ đã cộng vào, sọc trôi liên tục (quấn lấy nhau).
const stripeCache = new Map();
function stripePattern(g, els) {
  const key = els.join(',');
  let c = stripeCache.get(key);
  if (!c) {
    const sw = 14, cv = document.createElement('canvas');
    cv.width = sw * els.length; cv.height = 8;
    const cx = cv.getContext('2d');
    els.forEach((e, i) => {
      const gr = cx.createLinearGradient(0, 0, 0, 8);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, mixWhite(COLORS[e], 0.25)); gr.addColorStop(1, COLORS[e]);
      cx.fillStyle = gr; cx.fillRect(i * sw, 0, sw, 8);
    });
    c = cv; stripeCache.set(key, c);
  }
  return { cv: c, pat: g.createPattern(c, 'repeat') };
}
function mixWhite(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v + (255 - v) * k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function outlinedStripes(g, str, x, y, size, els, t, family, lw = 5) {
  g.save();
  g.font = `700 ${size}px ${family}`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.miterLimit = 2;
  const w0 = g.globalAlpha;
  g.globalAlpha = w0 * 0.4; g.strokeStyle = COLORS[els[0]]; g.lineWidth = lw + size * 0.2; g.strokeText(str, x, y);
  g.globalAlpha = w0; g.strokeStyle = 'rgba(22, 58, 108, 0.95)'; g.lineWidth = lw; g.strokeText(str, x, y);
  if (els.length === 1) {
    const gr = g.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, mixWhite(COLORS[els[0]], 0.3)); gr.addColorStop(1, COLORS[els[0]]);
    g.fillStyle = gr;
  } else {
    const { pat } = stripePattern(g, els);
    const m = new DOMMatrix().translate(x + t * 0.035, y).rotate(32).scale(Math.max(0.8, size / 44), Math.max(0.8, size / 44));
    pat.setTransform(m);
    g.fillStyle = pat;
  }
  g.fillText(str, x, y);
  g.restore();
}
const bounceOut = (x) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
const SANS = '"Be Vietnam Pro", system-ui, sans-serif';
const SERIF = 'Fraunces, Cormorant, "Times New Roman", serif';
const HEAL_AT = { x: W / 2, y: 378 }; // thanh máu đội (khớp game.js)
const TALLY_AT = { x: W / 2 + 90, y: 340 }; // ô tổng sát thương (khớp game.js)
const POP_LIGHT = ['#b8e0ff', '#ffc0ac', '#b8f5c4', '#fff4b0', '#dcc4ff', '#ffd0e4']; // màu sáng theo hệ cho số của tướng
const easeOut = (k) => 1 - (1 - k) ** 3;
const NUM = 'Oswald, "Be Vietnam Pro", system-ui, sans-serif'; // số: chữ cao hẹp, dễ đọc khi to
// Thanh đầu trận: bảng "Lượt" (số lớn) và bảng "Tầng" (kèm chấm tiến độ) trên nền gỗ tối viền vàng.
function plaque(g, x, y, w, h) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, 'rgba(66, 124, 196, 0.92)');
  gr.addColorStop(1, 'rgba(34, 19, 11, 0.92)');
  g.beginPath();
  g.roundRect ? g.roundRect(x, y, w, h, 10) : g.rect(x, y, w, h);
  g.fillStyle = gr;
  g.fill();
  goldFrame(g, x, y, w, h, { lw: 2.5, orn: true });
  g.beginPath();
  g.moveTo(x + 8, y + 2.5);
  g.lineTo(x + w - 8, y + 2.5);
  g.strokeStyle = 'rgba(255, 238, 200, 0.18)';
  g.lineWidth = 1;
  g.stroke();
}
function hud(g, view) {
  g.fillStyle = 'rgba(20, 11, 6, 0.7)';
  g.fillRect(0, 0, W, 56);
  g.fillStyle = 'rgba(211, 154, 94, 0.7)';
  g.fillRect(0, 56, W, 1.5);
  // Lượt
  plaque(g, 10, 8, 104, 40);
  text(g, view.t('battle.turnWord'), 22, 28, 12, '#c9a678', 'left', '700');
  text(g, String(view.turn + 1), 100, 29, 26, '#fff0a8', 'right', '800', NUM);
  // Tầng: số + chấm tiến độ; không khớp dạng "n/tổng" thì in nguyên chữ
  const m = /(\d+)\s*\/\s*(\d+)/.exec(view.titleText || '');
  if (m) {
    const n = +m[1];
    const tot = +m[2];
    const w = Math.max(132, 44 + tot * 16);
    plaque(g, 122, 8, w, 40);
    if (/^[\d\s/]+$/.test(view.titleText)) {
      text(g, `${n}/${tot}`, 134, 22, 15, '#fff8e6', 'left', '800'); // bài hướng dẫn: chỉ "n/tổng", không chữ "Tầng"
    } else {
      text(g, view.t('battle.floorWord'), 134, 22, 11, '#c9a678', 'left', '700');
      text(g, `${n}/${tot}`, 134 + 52, 22, 13, '#fff8e6', 'left', '700');
    }
    for (let i = 0; i < tot; i++) {
      const px = 134 + i * 16 + 6;
      g.beginPath();
      g.arc(px, 38, 4.5, 0, Math.PI * 2);
      g.fillStyle = i < n - 1 ? '#9fd4ff' : i === n - 1 ? '#fff0a8' : 'rgba(255,255,255,0.14)';
      g.fill();
      if (i === n - 1) {
        g.lineWidth = 1.5;
        g.strokeStyle = '#fff3c9';
        g.stroke();
      }
    }
  } else if (view.titleText) {
    plaque(g, 122, 8, 150, 40);
    text(g, view.titleText, 197, 29, 14, '#fff8e6', 'center', '700');
  }
}

function text(g, s, x, y, size, color = '#e8ebff', align = 'center', weight = '600', family = SANS) {
  g.fillStyle = color;
  g.font = `${weight} ${size}px ${family}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

const NEG = new Set(['burn', 'poison', 'stun', 'freeze', 'atkDown', 'lock']);
// Biểu tượng hiệu ứng: chỉ icon + số lượt (độc thêm số tầng), không chữ. Tiêu cực viền đỏ, tích cực viền xanh. Chi tiết xem khi bấm giữ.
const FXS = 26;
function badges(g, effects, x, y, view, align = 'left') {
  const gap = 4;
  const total = effects.length * (FXS + gap) - gap;
  let bx = align === 'center' ? x - total / 2 : x;
  for (const e of effects) {
    const neg = NEG.has(e.key);
    g.fillStyle = neg ? 'rgba(80,20,28,0.88)' : 'rgba(16,64,46,0.88)';
    g.strokeStyle = neg ? '#ff8a98' : '#7dffb0';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(bx, y, FXS, FXS, neg ? 5 : 13);
    g.fill();
    g.stroke();
    const im = getImg(`fx:${e.key}`);
    if (im) g.drawImage(im, bx + 2, y + 2, FXS - 4, FXS - 4);
    else text(g, view.t(`effect.${e.key}.short`).slice(0, 2), bx + FXS / 2, y + FXS / 2, 11, '#ffffff');
    const n = e.turns > 99 ? '∞' : String(e.turns);
    g.font = `700 11px ${NUM}`;
    g.textAlign = 'right';
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    g.lineWidth = 3;
    g.strokeStyle = '#173a6c';
    g.strokeText(n, bx + FXS + 1, y + FXS + 2);
    g.fillStyle = '#ffffff';
    g.fillText(n, bx + FXS + 1, y + FXS + 2);
    if (e.key === 'poison' && e.stacks > 1) {
      g.textAlign = 'left';
      g.strokeText(`×${e.stacks}`, bx - 1, y + 9);
      g.fillStyle = '#b8ff9a';
      g.fillText(`×${e.stacks}`, bx - 1, y + 9);
    }
    bx += FXS + gap;
  }
}

// Hiệu ứng trạng thái vẽ trên quái: Bỏng lửa bay lên, Độc bong bóng, Choáng sao xoay, Đóng băng khối băng, Khiên vòng sáng.
function statusFx(g, effects, x, y, t) {
  const has = (k) => effects.some((e) => e.key === k);
  g.save();
  if (has('freeze')) {
    g.fillStyle = 'rgba(150,215,255,0.45)';
    g.strokeStyle = '#d8f2ff';
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(x - 56, y - 56, 112, 112, 14);
    g.fill();
    g.stroke();
  }
  if (has('burn')) {
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.0012 + i / 6) % 1);
      g.globalAlpha = 1 - k;
      g.fillStyle = i % 2 ? '#ffb347' : '#ff5a3c';
      g.beginPath();
      g.arc(x - 40 + i * 16 + Math.sin(t * 0.01 + i) * 4, y + 50 - k * 100, 7 * (1 - k) + 2, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (has('poison')) {
    for (let i = 0; i < 5; i++) {
      const k = ((t * 0.0008 + i / 5) % 1);
      g.globalAlpha = 0.9 * (1 - k);
      g.strokeStyle = '#7dff6a';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(x - 36 + i * 18, y + 40 - k * 80, 6 + (i % 3) * 2, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (has('stun')) {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.006 + (i * Math.PI * 2) / 3;
      g.globalAlpha = 1;
      g.fillStyle = '#ffe66b';
      g.font = '700 22px system-ui';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('★', x + Math.cos(a) * 46, y - 56 + Math.sin(a) * 12);
    }
  }
  if (has('shield') || has('immune')) {
    g.globalAlpha = 0.5 + Math.sin(t * 0.006) * 0.2;
    g.strokeStyle = has('immune') ? '#ffe9a0' : '#6bd5ff';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, y, 62, 0, Math.PI * 2);
    g.stroke();
  }
  if (has('atkDown')) {
    g.globalAlpha = 1;
    g.fillStyle = '#ff8a98';
    g.font = '800 26px system-ui';
    g.textAlign = 'center';
    g.fillText('▼', x + 54, y - 40);
  }
  g.restore();
}

// view: { board:{cells,enh}, enemies:[{id,element,hp,maxHp,cd,every}], hp, maxHp, members:[{id,element,skillCd}],
//         hl:Set, fall:array|null, fallT:0..1, drag:{path,x,y}|null, timer:0..1|null, floaters:[], shake, combo, turn, flash }

// Mũi tên khắc hệ: xanh lục lao lên (ta khắc quái), đỏ lao xuống (bị quái khắc); ba mũi tên lệch pha, mờ dần rồi lặp.
function relArrows(g, cx, cy, dir, t) {
  const col = dir > 0 ? ['#7dffa0', '#2fd16a'] : ['#ff8a7a', '#e23a2e'];
  for (let k = 0; k < 3; k++) {
    const p = (t / 1400 + k / 3) % 1;
    const a = Math.sin(Math.PI * Math.min(1, p * 1.15)) ** 1.3;
    const y = cy + (dir > 0 ? 15 - 30 * p : -15 + 30 * p);
    const w = 8 + (dir > 0 ? 0 : 0), h = 6;
    g.save();
    g.globalAlpha = a;
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    if (dir > 0) { g.moveTo(cx - w, y + h / 2); g.lineTo(cx, y - h / 2); g.lineTo(cx + w, y + h / 2); }
    else { g.moveTo(cx - w, y - h / 2); g.lineTo(cx, y + h / 2); g.lineTo(cx + w, y - h / 2); }
    g.strokeStyle = 'rgba(40,20,10,.9)'; g.lineWidth = 6.5; g.stroke();
    g.shadowColor = col[1]; g.shadowBlur = 8;
    g.strokeStyle = col[0]; g.lineWidth = 3.6; g.stroke();
    g.restore();
  }
}
export function draw(g, view, t) {
  g.clearRect(0, 0, W, H);
  g.save();
  if (view.camShake > 0.2) g.translate(Math.sin(t * 0.13) * view.camShake * 0.6, Math.cos(t * 0.17) * view.camShake * 0.6);
  if ((view.zoom || 1) > 1.001) {
    g.translate(W / 2, 190);
    g.scale(view.zoom, view.zoom);
    g.translate(-W / 2, -190);
  }
  g.fillStyle = '#173a6c';
  g.fillRect(0, 0, W, H);
  const bg = getImg('bg:battle');
  if (bg) {
    g.drawImage(bg, 0, 0, W, H);
    const ink = g.createLinearGradient(0, 0, 0, 372);
    ink.addColorStop(0, 'rgba(22, 58, 108,0.12)');
    ink.addColorStop(1, 'rgba(60,30,16,0.12)');
    g.fillStyle = ink;
    g.fillRect(0, 0, W, 372);
  }

  // quái
  const n = view.enemies.length;
  const slot = W / Math.max(1, n);
  view.enemies.forEach((e, i) => {
    const cx = slot * i + slot / 2;
    const dead = e.hp <= 0;
    const dk = dead ? Math.min(1, (e.deadAge ?? 9999) / 650) : 0; // tiến độ tan biến
    if (dk >= 1) return;
    const ik = view.intro ? Math.max(0, Math.min(1, (view.intro.age - (250 + i * 230)) / 520)) : 1; // rơi vào cảnh
    if (ik <= 0) return;
    const introY = view.intro ? -(1 - bounceOut(ik)) * 260 : 0;
    const sh = (view.shake && view.shake.enemy === i ? Math.sin(t * 0.06) * 8 : 0) + (e.hit ? Math.sin(t * 0.09) * 10 * e.hit : 0);
    g.save();
    g.translate(0, introY);
    g.globalAlpha = (dead ? 1 - dk : 1) * Math.min(1, ik * 3);
    g.fillStyle = COLORS[e.element];
    g.globalAlpha *= 0.25;
    if (!getImg(`monster:${e.id}`)) g.fillRect(cx - 70 + sh, 90, 140, 150);
    g.globalAlpha = dead ? 1 - dk : 1;
    const mi = getImg(`monster:${e.id}`);
    // Lao tới khi tấn công: phóng to + trượt xuống rồi lùi về (view.lunge.age 0..520ms).
    const lk = view.lunge && view.lunge.enemy === i ? Math.sin(Math.min(1, view.lunge.age / 520) * Math.PI) : 0;
    const sc = 1 + 0.08 * (e.hit || 0) + dk * 0.35 + 0.22 * lk;
    if (mi) {
      const bob = dead ? 0 : Math.sin(t * 0.003 + i) * 3 + lk * 46;
      const sz = 150 * sc;
      const br = dead ? 0 : Math.sin(t * 0.0042 + i * 1.7) * 0.025; // thở: co giãn dọc, chân đứng yên
      // bóng đổ dưới chân (co lại khi quái nhảy lên) + quầng neon màu hệ nhấp nhô quanh hình
      const gy = 165 + 150 * 0.4 + 6;
      const sk = 1 - Math.min(0.35, Math.max(0, (bob - 3) / 160));
      const sg = g.createRadialGradient(cx + sh * 0.4, gy, 0, cx + sh * 0.4, gy, 70 * sk);
      sg.addColorStop(0, 'rgba(0,0,0,0.55)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.globalAlpha *= 0.9;
      g.fillStyle = sg;
      g.beginPath();
      g.ellipse(cx + sh * 0.4, gy, 70 * sk, 15 * sk, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.save();
      g.shadowColor = COLORS[e.element];
      g.shadowBlur = dead ? 0 : 14 + 6 * Math.sin(t * 0.004 + i);
      g.drawImage(mi, cx + sh - sz / 2 * (1 - br), 165 - sz / 2 + bob - sz * br, sz * (1 - br), sz * (1 + br));
      g.restore();
    } else drawOrb(g, e.element, cx + sh, 160, 46 * (1 + 0.12 * (e.hit || 0)));
    if (e.effects?.length && !dead) statusFx(g, e.effects, cx + sh, 160, t);
    if (e.hit) {
      g.globalAlpha = 0.55 * e.hit;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(cx + sh, 160, 50, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    if (view.focus === i && !dead) {
      // khóa mục tiêu: vòng ngắm xoay + bốn góc
      const R = 84 + (view.lockFlash || 0) * 14;
      g.save();
      g.translate(cx + sh, 165);
      g.rotate(t * 0.0012);
      g.strokeStyle = '#ff4d5e';
      g.lineWidth = 4;
      g.shadowColor = '#ff4d5e';
      g.shadowBlur = 14;
      for (let q = 0; q < 4; q++) {
        g.rotate(Math.PI / 2);
        g.beginPath();
        g.arc(0, 0, R, -0.35, 0.35);
        g.stroke();
        g.beginPath();
        g.moveTo(R + 6, 0);
        g.lineTo(R + 20, 0);
        g.stroke();
      }
      g.restore();
      text(g, view.t('battle.locked'), cx, 98, 13, '#ff8a96');
    }
    if (view.guideEnemy === i && !dead && view.focus !== i) {
      // bài hướng dẫn: mũi tên nảy + vòng vàng nhấp nháy trên quái cần khóa
      const bob = Math.sin(t * 0.008) * 7;
      g.save();
      g.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 0.005));
      g.strokeStyle = '#ffd978';
      g.lineWidth = 4;
      g.setLineDash([10, 8]);
      g.beginPath();
      g.arc(cx + sh, 165, 84, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
      g.fillStyle = '#ffd978';
      g.strokeStyle = '#3a210e';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx - 20, 64 + bob);
      g.lineTo(cx + 20, 64 + bob);
      g.lineTo(cx, 96 + bob);
      g.closePath();
      g.stroke();
      g.fill();
      g.restore();
    }
    g.globalAlpha = dead ? 1 - dk : 1;
    panel(g, cx - 82, 244, 164, 76, null);
    brackets(g, cx - 82, 244, 164, 76, 9, view.focus === i ? '#ff4d5e' : '#cfe6ff');
    g.fillStyle = COLORS[e.element];
    g.fillRect(cx - 82, 244, 4, 76);
    text(g, view.t(`monster.${e.id}`), cx + 2, 258, 15, '#fff8e6', 'center', '700', SERIF);
    bar(g, cx - 70, 270, 140, 11, (e.hpShow ?? e.hp) / e.maxHp, '#e8475b', '#ff9aa6');
    text(g, `${Math.max(0, Math.round(e.hp))}`, cx, 276, 9, '#ffffff', 'center', '800');
    if (!dead) {
      const off = e.effects?.some((x) => x.key === 'stun' || x.key === 'freeze');
      text(g, off ? view.t('effect.stun.name') : view.t('battle.attackIn', { n: e.cd }), cx, 294, 12, off ? '#9ad0ff' : '#ffc27a');
      if (e.effects?.length) badges(g, e.effects, cx, 302, view, 'center');
    }
    g.globalAlpha = 1;
  });

  g.globalAlpha = 1;
  for (const sh of view.shots || []) drawShot(g, sh);
  g.globalAlpha = 1;
  // HUD
  hud(g, view);
  const sh = (view.teamFx || []).find((e) => e.key === 'shield');
  if (sh) text(g, view.t('battle.shield', { n: sh.pool }), W - 16, 336, 15, '#6bd5ff', 'right', '700');
  if (view.teamFx?.length) badges(g, view.teamFx, 16, 326, view);
  if (view.combo > 0) drawComboBadge(g, view, W / 2 - 128, 333);
  if (view.tally && view.tally.shown > 0) {
    const txt = new Intl.NumberFormat(document.documentElement.lang || 'vi').format(Math.round(view.tally.shown));
    const sz = Math.round(50 * (1 + 0.4 * Math.min(1, view.tally.pulse)));
    const els = view.tally.els?.length ? view.tally.els : null;
    if (els) outlinedStripes(g, txt, W / 2 + 90, 340, sz, els, performance.now(), NUM, 5);
    else outlined(g, txt, W / 2 + 90, 340, sz, '#fff0d0', '#ff7a2a', NUM, 5);
  }

  // máu đội chung
  if (view.hpPulse > 0.01) {
    g.save();
    g.shadowColor = '#6bf0a0';
    g.shadowBlur = 24 * view.hpPulse;
    g.fillStyle = `rgba(107,240,160,${0.35 * view.hpPulse})`;
    g.fillRect(14, 370, W - 28, 18);
    g.restore();
  }
  bar(g, 16, 372, W - 32, 14, view.hp / view.maxHp, '#2fa86c', '#a8f5cb');
  text(g, `${Math.round(view.hp)} / ${view.maxHp}`, W / 2, 379, 11, '#ffffff', 'center', '800');

  // đội hình
  view.members.forEach((m, i) => {
    const x = 12 + i * 104;
    const lead = i === 0;
    const th = lead ? 84 : 76; // đáy hai loại ô thẳng hàng ở 466; đội trưởng cao hơn 8px
    const y = 466 - th;
    const ready = m.skillCd === 0;
    panel(g, x, y, 98, th, lead ? '#ffd24a' : null, lead ? 2 : 1); // không viền màu hệ: đã có ngọc hệ
    if (lead) {
      g.save();
      g.globalAlpha = 0.7 + 0.3 * Math.sin(t * 0.004);
      g.strokeStyle = '#ffd24a';
      g.lineWidth = 2;
      g.strokeRect(x + 1, y + 1, 96, th - 2);
      g.restore();
      // vương miện ở góc trên trái (viền vàng + miện đủ nhận biết đội trưởng, nhường chỗ cho ảnh tướng lớn hơn)
      g.fillStyle = '#ffd24a';
      g.beginPath();
      const cx0 = x + 15, cy0 = y + 12;
      g.moveTo(cx0 - 9, cy0 + 5); g.lineTo(cx0 - 10, cy0 - 6); g.lineTo(cx0 - 4, cy0); g.lineTo(cx0, cy0 - 9); g.lineTo(cx0 + 4, cy0); g.lineTo(cx0 + 10, cy0 - 6); g.lineTo(cx0 + 9, cy0 + 5);
      g.closePath();
      g.fill();
    }
    const icy = 466 - 48; // tâm ảnh tướng cách đáy 48 (cùng cao ở mọi ô)
    const rel = view.rel ? view.rel(m.element) : 1; // chỉ có khi đã khóa mục tiêu: lợi (▲ xanh) / bất lợi (▼ đỏ) so với hệ quái bị khóa
    if (rel !== 1) { relArrows(g, x + 14, icy, rel > 1 ? 1 : -1, t); relArrows(g, x + 84, icy + 4, rel > 1 ? 1 : -1, t + 460); }
    const ic = getImg(`icon:${m.id}`);
    if (ic) {
      const S = 44;
      g.save();
      g.beginPath();
      g.roundRect(x + 49 - S / 2, icy - S / 2, S, S, 9);
      g.clip();
      g.drawImage(ic, x + 49 - S / 2, icy - S / 2, S, S);
      g.restore();
      g.strokeStyle = COLORS[m.element];
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(x + 49 - S / 2, icy - S / 2, S, S, 9);
      g.stroke();
      // icon hệ nhỏ ở góc ô
      g.fillStyle = 'rgba(20,12,6,0.85)';
      g.beginPath();
      g.arc(x + 87, y + 13, 10, 0, Math.PI * 2);
      g.fill();
      drawOrb(g, m.element, x + 87, y + 13, 8);
    } else drawOrb(g, m.element, x + 49, icy, 22);
    let nm = view.t(`char.${m.id}`);
    g.font = `${lead ? 800 : 700} 13px ${SANS}`;
    const nfs = Math.max(11, Math.min(13, (13 * 90) / Math.max(1, g.measureText(nm).width)));
    g.font = `${lead ? 800 : 700} ${nfs}px ${SANS}`;
    if (g.measureText(nm).width > 92) { while (nm.length > 3 && g.measureText(`${nm}…`).width > 92) nm = nm.slice(0, -1).trimEnd(); nm += '…'; } // tên quá dài: cắt bớt, xem đủ khi bấm giữ
    text(g, nm, x + 49, y + th - 22, nfs, lead ? '#fff4c9' : '#f0f2ff', 'center', lead ? '800' : '700');
    if (ready) text(g, view.t('battle.skillReady'), x + 49, y + th - 8, 12, '#7dffa0', 'center', '800');
    else {
      // hồi chiêu: chấm đầy = số lượt còn lại
      const n = m.skillMax || 1;
      const gap = Math.min(12, 80 / n);
      const x0 = x + 49 - ((n - 1) * gap) / 2;
      for (let k = 0; k < n; k++) {
        g.fillStyle = k < m.skillCd ? '#e8b878' : 'rgba(232,184,120,0.25)';
        g.beginPath();
        g.arc(x0 + k * gap, y + th - 8, 3.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (ready) {
      // hào quang dâng lên từ chân ô khi kỹ năng sẵn sàng
      const gr = g.createLinearGradient(0, y + th, 0, y);
      gr.addColorStop(0, 'rgba(125,255,160,0.5)');
      gr.addColorStop(0.7, 'rgba(125,255,160,0.1)');
      gr.addColorStop(1, 'rgba(125,255,160,0)');
      g.save();
      g.beginPath(); g.rect(x, y, 98, th); g.clip();
      g.fillStyle = gr; g.fillRect(x, y, 98, th);
      g.fillStyle = '#d8ffe2';
      for (let k = 0; k < 4; k++) {
        const ph = (t * 0.0009 + i * 0.37 + k * 0.25) % 1;
        g.globalAlpha = 0.9 * Math.sin(ph * Math.PI);
        g.beginPath(); g.arc(x + 12 + ((i * 29 + k * 23) % 74), y + th - 4 - ph * (th - 8), 3, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
    if (ready && view.canAct) {
      const glow = 0.55 + 0.45 * Math.sin(t * 0.006);
      g.save();
      g.globalAlpha = glow;
      brackets(g, x - 2, y - 2, 102, th + 4, 12, '#7dffa0', 2.5);
      g.restore();
    }
  });

  // Duo: khi cả hai skill đơn sẵn sàng thì hai ô cùng phát sáng, dây năng lượng nối hai ảnh tướng, nút DUO nhịp thở + tia lấp lánh
  for (const d of view.duos || []) {
    const cx = 12 + (d.slot + 1) * 104 - 3;
    const ready = !!d.ready;
    if (ready) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.006);
      const icy = 466 - 48;
      g.save();
      g.shadowColor = '#ffd24a';
      g.shadowBlur = 10 + 10 * pulse;
      g.strokeStyle = `rgba(255, 220, 110, ${0.55 + 0.4 * pulse})`;
      g.lineWidth = 3;
      for (const sl of [d.slot, d.slot + 1]) {
        const lead = sl === 0;
        const th = lead ? 84 : 76;
        g.strokeRect(12 + sl * 104 - 1, 466 - th - 1, 100, th + 2);
      }
      // dây năng lượng giữa hai ảnh tướng (nét đứt chạy)
      const x0 = 12 + d.slot * 104 + 49 + 24;
      const x1 = 12 + (d.slot + 1) * 104 + 49 - 24;
      g.lineCap = 'round';
      g.lineWidth = 5;
      g.setLineDash([8, 7]);
      g.lineDashOffset = -t * 0.04;
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, COLORS[view.members[d.slot].element]);
      gr.addColorStop(0.5, '#fff6c8');
      gr.addColorStop(1, COLORS[view.members[d.slot + 1].element]);
      g.strokeStyle = gr;
      g.beginPath(); g.moveTo(x0, icy); g.lineTo(x1, icy); g.stroke();
      g.setLineDash([]);
      // tia lấp lánh quay quanh nút
      for (let k = 0; k < 4; k++) {
        const a = t * 0.004 + (k * Math.PI) / 2;
        g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.01 + k);
        g.fillStyle = '#fff6c8';
        g.beginPath(); g.arc(cx + Math.cos(a) * 34, 395 + Math.sin(a) * 14, 2.2, 0, 6.3); g.fill();
      }
      g.restore();
    }
    const sc = ready ? 1 + 0.06 * Math.sin(t * 0.007) : 1;
    g.save();
    g.translate(cx, 395);
    g.scale(sc, sc);
    g.fillStyle = ready ? '#ffd24a' : '#444954';
    g.shadowColor = ready ? '#ffb000' : 'transparent';
    g.shadowBlur = ready ? 14 : 0;
    g.beginPath();
    g.roundRect(-28, -11, 56, 22, 5);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = ready ? '#fff6c8' : '#9a6a3a';
    g.lineWidth = 1.5;
    g.stroke();
    text(g, view.t('battle.duo'), 0, 0.5, 12, ready ? '#3a1d00' : '#8b90a8', 'center', '800');
    g.restore();
  }

  // đồng hồ kéo
  g.fillStyle = 'rgba(22, 58, 108, 0.9)';
  g.fillRect(0, 466, W, 14);
  if (view.timer !== null) {
    const low = view.timer < 0.25;
    g.fillStyle = low ? '#ff5468' : '#cfe6ff';
    g.shadowColor = g.fillStyle;
    g.shadowBlur = low ? 14 : 8;
    g.fillRect(0, 468, W * view.timer, 10);
    g.shadowBlur = 0;
    if (view.timerSec !== undefined) outlined(g, `${view.timerSec.toFixed(1)}`, W / 2, 473, 12, '#ffffff', '#ffffff', NUM, 3, '800');
  }

  // Dừng thời gian: chữ báo còn mấy lượt + nút Tiêu
  if (view.freezeTurns > 0) {
    text(g, view.t('battle.frozen', { n: view.freezeTurns }), W / 2, 473, 11, '#9fe3ff', 'center', '800');
    if (view.canAct) {
      g.fillStyle = 'rgba(20,70,96,0.95)';
      g.strokeStyle = '#9fe3ff';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(412, 346, 112, 32, 8);
      g.fill();
      g.stroke();
      text(g, view.t('battle.clear'), 468, 362, 16, '#e8f8ff', 'center', '800');
    }
  }

  // bàn: khung kính, mỗi ô là một hốc bo nhẹ
  g.fillStyle = 'rgba(22, 58, 108, 0.92)';
  g.fillRect(0, BOARD_Y, W, ROWS * CELL);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      g.fillStyle = (r + c) % 2 ? 'rgba(96, 62, 36, 0.6)' : 'rgba(66, 40, 22, 0.6)';
      g.beginPath();
      g.roundRect(BOARD_X + c * CELL + 2, BOARD_Y + r * CELL + 2, CELL - 4, CELL - 4, 8);
      g.fill();
      // hốc lõm: bóng tối ở mép trên, vệt sáng mảnh ở mép dưới
      const hx = BOARD_X + c * CELL + 2, hy = BOARD_Y + r * CELL + 2;
      const hg = g.createLinearGradient(0, hy, 0, hy + CELL - 4);
      hg.addColorStop(0, 'rgba(10,4,0,0.38)');
      hg.addColorStop(0.35, 'rgba(10,4,0,0)');
      hg.addColorStop(1, 'rgba(255,200,140,0.10)');
      g.fillStyle = hg;
      g.beginPath();
      g.roundRect(hx, hy, CELL - 4, CELL - 4, 8);
      g.fill();
    }
  g.fillStyle = 'rgba(220,195,160,0.55)';
  g.fillRect(0, BOARD_Y - 1, W, 1.5);
  g.fillRect(0, BOARD_Y + ROWS * CELL - 0.5, W, 1.5);
  const held = view.drag && view.drag.path.length ? view.drag.path[view.drag.path.length - 1] : -1;
  g.save();
  g.beginPath();
  g.rect(0, BOARD_Y, W, ROWS * CELL + 30);
  g.clip(); // ngọc rơi từ trên xuống không được đè lên hàng tướng
  if (view.boardIn !== undefined && view.boardIn < 1) g.globalAlpha = view.boardIn; // đổi bàn ở bài hướng dẫn: hiện dần, không chớp
  // viên đang cầm luồn bên dưới
  if (held >= 0) drawOrb(g, view.board.cells[held], view.drag.x, view.drag.y, 40, !!view.board.enh[held], 0.92);
  const lifted = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const type = view.board.cells[i];
    if (type < 0) continue;
    if (i === held) continue;
    const p = cellCenter(i);
    let x = p.x;
    let y = p.y;
    if (view.fall) y -= view.fall[i] * CELL * (1 - view.fallT);
    if (y < BOARD_Y - CELL / 2) continue;
    const sl = view.slides && view.slides[i];
    if (sl) {
      const k = Math.min(1, sl.age / 160);
      const e = 1 - (1 - k) * (1 - k);
      x = sl.x + (p.x - sl.x) * e;
      y = sl.y + (p.y - sl.y) * e;
      lifted.push({ i, type, x, y, k });
      continue;
    }
    const pulse = view.hl && view.hl.has(i) ? 1 + Math.sin(t * 0.03) * 0.12 : 1;
    const alpha = view.hl && view.hl.has(i) ? 0.75 : 1;
    if (view.hl && view.hl.has(i)) {
      // vùng ghép được: viền sáng nhấp nháy quanh ô
      g.save();
      g.globalAlpha = 0.55 + 0.35 * Math.sin(t * 0.012);
      g.strokeStyle = '#fff3b0';
      g.shadowColor = '#ffd24a';
      g.shadowBlur = 12;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(p.x - CELL / 2 + 3, p.y - CELL / 2 + 3, CELL - 6, CELL - 6, 9);
      g.stroke();
      g.restore();
    }
    const ep = view.enhPop?.find((p) => p.i === i);
    const born = ep ? Math.min(1, ep.age / 520) : 1;
    const popK = born < 1 ? easeOut(born) * (1 + 0.5 * Math.sin(born * Math.PI)) : 1;
    drawOrb(g, type, x, y, 34 * pulse * popK, !!view.board.enh[i], 1);
  }
  // viên bị đi qua nổi lên: to hơn một chút, có bóng, vẽ phía trên viên đang cầm
  for (const l of lifted) {
    const up = Math.sin(l.k * Math.PI);
    g.save();
    g.globalAlpha = 0.35 * up;
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(l.x + 4, l.y + 14 + up * 6, 34, 26, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    drawOrb(g, l.type, l.x, l.y - up * 8, 34 * (1 + 0.22 * up), !!view.board.enh[l.i]);
  }
  // hồi máu: cả bàn cờ sáng xanh, một dải sáng quét từ dưới lên
  if (view.healGlow > 0.01) {
    const k = view.healGlow;
    const gr = g.createLinearGradient(0, BOARD_Y, 0, BOARD_Y + ROWS * CELL);
    gr.addColorStop(0, `rgba(80,255,150,${0.06 * k})`);
    gr.addColorStop(1, `rgba(80,255,150,${0.34 * k})`);
    g.fillStyle = gr;
    g.fillRect(0, BOARD_Y, W, ROWS * CELL);
    const sweep = BOARD_Y + ROWS * CELL * (1 - (1 - k) * 1.25);
    const sg = g.createLinearGradient(0, sweep - 50, 0, sweep + 50);
    sg.addColorStop(0, 'rgba(190,255,220,0)');
    sg.addColorStop(0.5, `rgba(190,255,220,${0.5 * k})`);
    sg.addColorStop(1, 'rgba(190,255,220,0)');
    g.fillStyle = sg;
    g.fillRect(0, sweep - 50, W, 100);
  }
  g.restore();

  // Bài hướng dẫn: làm tối phần còn lại của màn hình, chỉ chừa vùng cần thao tác (đường kéo / quái cần khóa / ô tướng dùng skill)
  view.guideDimA = (view.guideDimA || 0) + ((view.guideDim && view.guideSpot ? 1 : 0) - (view.guideDimA || 0)) * 0.14;
  if (view.guideDimA > 0.02 && view.guideSpot) {
    const sp = view.guideSpot;
    let rx, ry, rw, rh, rr = 18;
    if (sp.k === 'path') {
      const cs = sp.path.map(cellCenter);
      const x0 = Math.min(...cs.map((c) => c[0] ?? c.x)), x1 = Math.max(...cs.map((c) => c[0] ?? c.x));
      const y0 = Math.min(...cs.map((c) => c[1] ?? c.y)), y1 = Math.max(...cs.map((c) => c[1] ?? c.y));
      rx = x0 - 54; ry = y0 - 54; rw = x1 - x0 + 108; rh = y1 - y0 + 108;
    } else if (sp.k === 'enemy') {
      const sl = W / Math.max(1, view.enemies.length);
      rx = sl * sp.i + 6; ry = 40; rw = sl - 12; rh = 250; rr = 26;
    } else { rx = 12 + sp.i * 104 - 5; ry = 466 - (sp.i === 0 ? 84 : 76) - 5; rw = 108; rh = (sp.i === 0 ? 84 : 76) + 10; }
    g.save();
    g.fillStyle = `rgba(6, 18, 44, ${0.62 * view.guideDimA})`;
    g.beginPath();
    g.rect(0, 0, W, H);
    g.roundRect(rx, ry, rw, rh, rr);
    g.fill('evenodd');
    g.globalAlpha = view.guideDimA;
    g.strokeStyle = '#ffd978';
    g.lineWidth = 3;
    g.roundRect(rx, ry, rw, rh, rr);
    g.stroke();
    g.restore();
  }

  if (view.hint && !view.drag) {
    const pts = view.hint.path.map(cellCenter);
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 6;
    g.setLineDash([12, 10]);
    g.beginPath();
    pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
    g.stroke();
    g.setLineDash([]);
    // viên ngọc dẫn đường chạy dọc cả đường gợi ý rồi nghỉ một nhịp
    const segs = pts.length - 1;
    const run = segs * 420;
    const kk = Math.min(1, (t % (run + 600)) / run) * segs;
    const si = Math.min(segs - 1, Math.floor(kk));
    const f = kk - si;
    const q = { x: pts[si].x + (pts[si + 1].x - pts[si].x) * f, y: pts[si].y + (pts[si + 1].y - pts[si].y) * f };
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(q.x, q.y, 20, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffd84a';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(q.x, q.y, 28 + Math.sin(t * 0.01) * 4, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(22, 58, 108, 0.85)';
    g.fillRect(0, 932, W, 28);
    text(g, view.hint.text, W / 2, 946, 15, '#ffe9a0');
  }

  for (const i of view.locked || []) {
    const c = i % COLS;
    const r = (i / COLS) | 0;
    const x = BOARD_X + c * CELL;
    const y = BOARD_Y + r * CELL;
    g.fillStyle = 'rgba(22, 58, 108, 0.55)';
    g.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
    g.strokeStyle = '#ff8a98';
    g.lineWidth = 3;
    g.strokeRect(x + 6, y + 6, CELL - 12, CELL - 12);
    g.fillStyle = '#ffd0d6';
    g.fillRect(x + CELL / 2 - 10, y + CELL / 2 - 2, 20, 16);
    g.beginPath();
    g.arc(x + CELL / 2, y + CELL / 2 - 2, 7, Math.PI, 0);
    g.stroke();
  }

  if (view.hurt > 0) {
    const gr = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
    gr.addColorStop(0, 'rgba(255,40,40,0)');
    gr.addColorStop(1, `rgba(255,40,40,${0.55 * view.hurt})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  // chữ nổi: nảy ra (overshoot), bay lên chậm, mờ dần ở cuối
  for (const f of view.floaters) {
    const k = f.age / f.life;
    const pop = Math.min(1, f.age / 150);
    const back = 1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2); // easeOutBack
    let sc = f.kind === 'dmg' ? 0.35 + 0.65 * back + (f.age < 150 ? 0.18 * (1 - pop) : 0) : 0.6 + 0.4 * back;
    if (f.grow && f.grow !== 1 && !REDUCED) { const gk = Math.min(1, Math.max(0, (f.age - 120) / 650)); sc *= 1 + (f.grow - 1) * (gk * gk * (3 - 2 * gk)); } // to dần / nhỏ dần sau cú nảy đầu
    else if (f.grow && REDUCED) sc *= f.grow;
    const rise = 46 * (1 - Math.pow(1 - Math.min(1, k * 1.3), 2));
    g.save();
    g.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    g.translate(f.x, f.y - rise);
    g.scale(sc, sc);
    if (f.kind === 'dmg') outlined(g, f.s, 0, 0, f.size || 40, f.color, f.color2 || f.color, NUM, Math.max(4, (f.size || 40) * 0.13));
    else outlined(g, f.s, 0, 0, f.size || 24, f.color, f.color, SANS, 4, '800');
    g.restore();
  }
  // số sát thương từng tướng: nảy ở ô tướng, rồi bay gộp vào ô tổng
  // Vòng sóng + hạt + lóe màu vẽ SAU bàn ngọc (trước đây nằm dưới bàn nên hạt nổ ở ô ngọc bị che mất)
  for (const r of view.rings || []) {
    const k = r.age / r.life;
    g.globalAlpha = 1 - k;
    g.strokeStyle = COLORS[r.col];
    g.lineWidth = 8 * (1 - k) + 2;
    g.beginPath();
    g.arc(r.x, r.y, (r.r0 ?? 20) + easeOut(k) * ((r.r1 ?? 140) - (r.r0 ?? 20)), 0, Math.PI * 2);
    g.stroke();
  }
  for (const f of view.fxs || []) drawFx(g, f);
  // Ngọc đang nổ: phình to + mờ dần, lóe sáng trắng-màu (cộng sáng), rồi mảnh vỡ/tia (particles) bay ra
  for (const b of view.blasts || []) {
    const a = b.age - b.delay;
    if (a < 0) continue;
    const k = Math.min(1, a / b.life);
    if (k < 0.55) drawOrb(g, b.type, b.x, b.y, 34 * (1 + 0.5 * easeOut(k / 0.55)), b.enh, 1 - k / 0.55);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const rad = 34 * (0.8 + k * (1.2 + b.tier * 0.5));
    const gr = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k)})`);
    gr.addColorStop(0.45, COLORS[b.type] + '');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.85 * (1 - k) * (1 - k);
    g.fillStyle = gr;
    g.beginPath(); g.arc(b.x, b.y, rad, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  if (view.blastFlash) {
    const f = view.blastFlash, k = f.age / f.life, rad = 60 + f.tier * 55 + k * 70;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = (1 - k) * (0.35 + f.tier * 0.12);
    const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, COLORS[f.col]); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, rad, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.globalAlpha = 1;
  if (view.tint) {
    const k = view.tint.age / view.tint.life;
    g.globalAlpha = 0.2 * Math.sin(Math.min(1, k * 1.6) * Math.PI) * (1 - k * 0.5);
    g.fillStyle = COLORS[view.tint.col];
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  for (const q of view.particles || []) {
    const k = q.age / q.life;
    g.globalAlpha = 1 - k;
    const col = q.color || COLORS[q.col] || '#fff';
    g.fillStyle = col;
    if (q.shape === 'bubble') {
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(q.x, q.y, q.size, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = (1 - k) * 0.4; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(q.x - q.size * 0.35, q.y - q.size * 0.35, q.size * 0.22, 0, Math.PI * 2); g.fill();
    } else if (q.shape === 'leaf') {
      g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.beginPath(); g.ellipse(0, 0, q.size, q.size * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(20,60,20,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-q.size, 0); g.lineTo(q.size, 0); g.stroke(); g.restore();
    } else if (q.shape === 'spark') {
      const sz = q.size * (0.6 + 0.4 * Math.sin(k * Math.PI)); // nhấp nháy: nở rồi tắt
      g.beginPath(); g.moveTo(q.x, q.y - sz); g.lineTo(q.x + sz * 0.22, q.y - sz * 0.22); g.lineTo(q.x + sz, q.y); g.lineTo(q.x + sz * 0.22, q.y + sz * 0.22);
      g.lineTo(q.x, q.y + sz); g.lineTo(q.x - sz * 0.22, q.y + sz * 0.22); g.lineTo(q.x - sz, q.y); g.lineTo(q.x - sz * 0.22, q.y - sz * 0.22); g.closePath(); g.fill();
    } else if (q.shape === 'shard') {
      g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.globalAlpha = Math.min(1, (1 - k) * 1.6);
      g.beginPath(); g.moveTo(0, -q.size); g.lineTo(q.size * 0.55, 0); g.lineTo(0, q.size * 0.9); g.lineTo(-q.size * 0.55, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(0, -q.size); g.lineTo(q.size * 0.55, 0); g.lineTo(0, -q.size * 0.1); g.closePath(); g.fill(); g.restore();
    } else if (q.shape === 'glint') {
      const sz = q.size * (1 - k * 0.7);
      g.save(); g.globalCompositeOperation = 'lighter';
      g.beginPath(); g.moveTo(q.x, q.y - sz); g.lineTo(q.x + sz * 0.2, q.y - sz * 0.2); g.lineTo(q.x + sz, q.y); g.lineTo(q.x + sz * 0.2, q.y + sz * 0.2);
      g.lineTo(q.x, q.y + sz); g.lineTo(q.x - sz * 0.2, q.y + sz * 0.2); g.lineTo(q.x - sz, q.y); g.lineTo(q.x - sz * 0.2, q.y - sz * 0.2); g.closePath(); g.fill(); g.restore();
    } else if (q.shape === 'wisp') {
      g.globalAlpha = (1 - k) * 0.35; g.beginPath(); g.arc(q.x, q.y, q.size * (1 + k * 0.6), 0, Math.PI * 2); g.fill();
    } else if (q.shape === 'heart') {
      g.font = `${Math.round(q.size * 2)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', q.x, q.y);
    } else {
      g.beginPath(); g.arc(q.x, q.y, q.size ?? (q.color ? 4 : 5), 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;

  for (const q of view.pops || []) {
    if (q.age < q.delay) continue;
    const t = q.age - q.delay;
    const pop = Math.min(1, t / 200);
    const back = 1 + 2.4 * Math.pow(pop - 1, 3) + 1.4 * Math.pow(pop - 1, 2);
    let x = q.x, y = q.y - 14 * easeOut(Math.min(1, t / 400)), sc = 0.3 + 0.7 * back, a = 1;
    if (t > q.hold) {
      const e = Math.min(1, (t - q.hold) / q.fly) ** 2.2;
      const to = q.heal ? HEAL_AT : TALLY_AT;
      x += (to.x - x) * e;
      y += (to.y - y) * e;
      sc *= 1 - 0.5 * e;
      a = 1 - 0.7 * e * e;
    }
    const col = q.heal ? '#35d27c' : COLORS[q.el] || '#ffd84a';
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    g.scale(sc, sc);
    const halo = g.createRadialGradient(0, 0, 4, 0, 0, q.size * 1.1);
    halo.addColorStop(0, `${col}66`);
    halo.addColorStop(1, `${col}00`);
    g.fillStyle = halo;
    g.fillRect(-q.size * 1.4, -q.size * 1.1, q.size * 2.8, q.size * 2.2);
    outlined(g, q.s, 0, 0, q.size, q.heal ? '#d8ffe6' : POP_LIGHT[q.el] || '#fff0a0', col, NUM, Math.max(5, q.size * 0.16), '700');
    g.restore();
  }
  g.restore(); // hết máy quay

  // vignette khi slow-motion, chớp trắng khi quái chết
  if (view.vig > 0.01) {
    const gr = g.createRadialGradient(W / 2, 330, 160, W / 2, 330, 640);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,10,${0.7 * view.vig})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  if (view.whiteFlash > 0.01) {
    g.fillStyle = `rgba(255,255,255,${view.whiteFlash * 0.6})`;
    g.fillRect(0, 0, W, H);
  }
  if (view.intro) drawIntro(g, view);
}

// Cutscene mở màn: thanh phim, màn che bàn ngọc, biển tên tầng, cảnh báo đỏ (Elite/Boss), "Bắt đầu!".
const ease = (x) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;
function drawIntro(g, view) {
  const it = view.intro;
  const a = it.age;
  const T = it.dur;
  const barK = Math.min(ease(a / 380), 1 - ease((a - (T - 700)) / 420));
  const bh = 70 * barK;
  // màn che khu bàn ngọc + HUD, tan dần ở cuối
  const veil = 0.94 * (1 - ease((a - (T - 900)) / 700));
  if (veil > 0.01) {
    g.fillStyle = `rgba(4,5,18,${veil})`;
    g.fillRect(0, 372, W, H - 372);
  }
  if (it.danger) {
    const pulse = 0.5 + 0.5 * Math.sin(a * 0.012);
    const k = Math.min(1, a / 300) * (1 - ease((a - (T - 800)) / 500));
    g.fillStyle = `rgba(190,20,40,${0.22 * pulse * k})`;
    g.fillRect(0, 0, W, 372);
  }
  g.fillStyle = '#0a0b0d';
  g.fillRect(0, 0, W, bh);
  g.fillRect(0, H - bh, W, bh);
  g.fillStyle = it.danger ? '#ff5a6a' : '#cfe6ff';
  g.fillRect(0, bh - 2, W, 2);
  g.fillRect(0, H - bh, W, 2);
  // biển tên giữa khu che
  const bk = ease((a - 650) / 450) * (1 - ease((a - (T - 900)) / 380));
  if (bk > 0.01 && !it.danger) drawZoneSign(g, it, a, bk);
  else if (bk > 0.01) {
    const cy = 560;
    g.save();
    g.globalAlpha = bk;
    const lw = 250 * bk;
    g.fillStyle = '#ff5a6a';
    g.fillRect(W / 2 - lw, cy - 52, lw * 2, 2);
    g.fillRect(W / 2 - lw, cy + 52, lw * 2, 2);
    text(g, it.warn, W / 2, cy - 30, 15, '#ff8a96', 'center', '800');
    g.translate((1 - bk) * -40, 0);
    outlined(g, it.title, W / 2, cy + 8, it.title.length > 16 ? 30 : 38, '#ffffff', '#ff5a6a', SERIF, 6, '700');
    text(g, it.sub, W / 2, cy + 38, 13, '#fff8e6', 'center', '700');
    g.restore();
  }
  // "Bắt đầu!"
  const sk = (a - (T - 650)) / 650;
  if (sk > 0 && sk < 1) {
    const pop = ease(sk * 3);
    g.save();
    g.globalAlpha = 1 - ease((sk - 0.55) / 0.45);
    g.translate(W / 2, 330);
    g.scale(0.6 + 0.5 * pop, 0.6 + 0.5 * pop);
    outlined(g, it.go, 0, 0, 62, '#ffffff', '#ffd24a', SERIF, 8, '700');
    g.restore();
  }
}


// ---- Hiệu ứng đòn đánh (v0.93) ----
const LIGHTER = (g, fn) => { g.save(); g.globalCompositeOperation = 'lighter'; fn(); g.restore(); };

// Huy hiệu combo: lục giác viền vàng kép, nóng dần theo combo, dải ruy-băng "COMBO" phía dưới
function drawComboBadge(g, view, cx, cy) {
  const c = view.combo, pop = view.comboPop || 0;
  const heat = c >= 10 ? { a: '#ff7a5c', b: '#8e1410', rim: '#ffd9a0', glow: '255,70,40' } : c >= 6 ? { a: '#ffae3d', b: '#a8480a', rim: '#fff0b0', glow: '255,150,40' } : { a: '#5aa7ff', b: '#1b3a86', rim: '#ffe28a', glow: '255,205,90' };
  const r = 25 * (1 + 0.2 * pop);
  const hex = (rad) => { g.beginPath(); for (let i = 0; i < 6; i++) { const an = Math.PI / 6 + i * Math.PI / 3 - Math.PI / 2 + Math.PI / 6; const px = cx + Math.cos(an) * rad, py = cy + Math.sin(an) * rad; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); };
  g.save();
  // hào quang
  LIGHTER(g, () => { const gr = g.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.9); gr.addColorStop(0, `rgba(${heat.glow},${0.35 + 0.3 * pop})`); gr.addColorStop(1, `rgba(${heat.glow},0)`); g.fillStyle = gr; g.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4); });
  // viền ngoài vàng
  hex(r + 4); g.fillStyle = '#3a2208'; g.fill();
  const rim = g.createLinearGradient(cx, cy - r, cx, cy + r); rim.addColorStop(0, heat.rim); rim.addColorStop(0.5, '#e0a52a'); rim.addColorStop(1, '#8a5a12');
  hex(r + 2); g.fillStyle = rim; g.fill();
  hex(r - 2); g.fillStyle = '#2a1706'; g.fill();
  // mặt huy hiệu
  const face = g.createLinearGradient(cx, cy - r, cx, cy + r); face.addColorStop(0, heat.a); face.addColorStop(1, heat.b);
  hex(r - 4); g.fillStyle = face; g.fill();
  // bóng kính nửa trên
  g.save(); hex(r - 4); g.clip(); g.fillStyle = 'rgba(255,255,255,0.2)'; g.beginPath(); g.ellipse(cx, cy - r * 0.55, r * 0.95, r * 0.55, 0, 0, Math.PI * 2); g.fill(); g.restore();
  // số
  const str = `${c}`, sz = Math.round((str.length > 2 ? 20 : str.length > 1 ? 26 : 32) * (1 + 0.3 * pop));
  outlined(g, str, cx, cy - 1, sz, '#ffffff', '#fff0c0', NUM, 4);
  // ruy-băng
  const rw = 56, rh = 13, ry = cy + 25 - 3;
  g.beginPath(); g.moveTo(cx - rw / 2 - 7, ry + 2); g.lineTo(cx - rw / 2, ry); g.lineTo(cx - rw / 2, ry + rh); g.lineTo(cx - rw / 2 - 7, ry + rh + 2); g.lineTo(cx - rw / 2 - 2, ry + rh / 2 + 1); g.closePath(); g.fillStyle = heat.b; g.fill();
  g.beginPath(); g.moveTo(cx + rw / 2 + 7, ry + 2); g.lineTo(cx + rw / 2, ry); g.lineTo(cx + rw / 2, ry + rh); g.lineTo(cx + rw / 2 + 7, ry + rh + 2); g.lineTo(cx + rw / 2 + 2, ry + rh / 2 + 1); g.closePath(); g.fill();
  const rg = g.createLinearGradient(0, ry, 0, ry + rh); rg.addColorStop(0, heat.rim); rg.addColorStop(1, '#d99a22');
  g.fillStyle = rg; g.fillRect(cx - rw / 2, ry, rw, rh);
  g.strokeStyle = '#6a3e08'; g.lineWidth = 1.2; g.strokeRect(cx - rw / 2, ry, rw, rh);
  text(g, view.t('battle.comboWord').toUpperCase(), cx, ry + rh / 2 + 0.5, 10, '#4a2606', 'center', '800');
  g.restore();
}
const glow = (g, x, y, r, col, a) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,255,255,${a})`);
  gr.addColorStop(0.3, hexA(col, a * 0.85));
  gr.addColorStop(1, hexA(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
};
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
const bez = (sh, k) => { // đường bay cong: nhấc lên giữa đường, lệch ngang theo hash của đòn
  const sway = ((sh.x0 * 7 + sh.y1) % 3 - 1) * 28;
  const x = sh.x0 + (sh.x1 - sh.x0) * k + Math.sin(k * Math.PI) * sway;
  const y = sh.y0 + (sh.y1 - sh.y0) * k - Math.sin(k * Math.PI) * 70;
  return [x, y];
};
// Đạn: sao chổi hệ màu (lõi trắng, vệt sáng thon dần, tia lửa rơi) bay theo đường cong.
function drawShot(g, sh) {
  const k = (sh.age - sh.delay) / sh.life;
  if (k < 0) return;
  const col = COLORS[sh.col];
  const [x, y] = bez(sh, Math.min(1, k));
  LIGHTER(g, () => {
    for (let j = 16; j >= 1; j--) {
      const kk = Math.max(0, k - j * 0.028);
      const [tx, ty] = bez(sh, kk);
      const f = 1 - j / 17;
      g.globalAlpha = 0.55 * f;
      g.fillStyle = col;
      g.beginPath(); g.arc(tx, ty, 3 + 13 * f, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    glow(g, x, y, 34, col, 0.9);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 6.5, 0, Math.PI * 2); g.fill();
  });
}
// Hiệu ứng nổi: 'hit' (đòn trúng quái), 'claw' (vuốt chém lên đội), 'burst' (nổ tại điểm).
function drawFx(g, f) {
  const k = Math.min(1, f.age / f.life);
  const col = COLORS[f.col] ?? '#ffffff';
  if (f.kind === 'hit') {
    const e = easeOut(k);
    LIGHTER(g, () => {
      g.globalAlpha = Math.pow(1 - k, 1.4);
      glow(g, f.x, f.y, 30 + 60 * e * (1 + f.tier * 0.3), col, 0.8);
      // tia nhọn tỏa ra, thon dần
      const n = 9 + f.tier * 4;
      for (let i = 0; i < n; i++) {
        const a = f.ang + (i / n) * Math.PI * 2 + (i % 2 ? 0.08 : -0.08);
        const len = (22 + (i % 3) * 18 + f.tier * 14) * (0.4 + e) * (i % 2 ? 1 : 1.35);
        const r0 = 8 + 18 * e, w = 5 * (1 - k) + 1;
        g.fillStyle = i % 3 ? col : '#ffffff';
        g.beginPath();
        g.moveTo(f.x + Math.cos(a) * r0 - Math.sin(a) * w, f.y + Math.sin(a) * r0 + Math.cos(a) * w);
        g.lineTo(f.x + Math.cos(a) * (r0 + len), f.y + Math.sin(a) * (r0 + len));
        g.lineTo(f.x + Math.cos(a) * r0 + Math.sin(a) * w, f.y + Math.sin(a) * r0 - Math.cos(a) * w);
        g.closePath(); g.fill();
      }
      // vòng sốc mỏng
      g.globalAlpha = (1 - k) * 0.8;
      g.strokeStyle = '#fff'; g.lineWidth = 3 * (1 - k) + 0.5;
      g.beginPath(); g.arc(f.x, f.y, 14 + 78 * e, 0, Math.PI * 2); g.stroke();
    });
    // vết chém chéo (lưỡi liềm trắng-màu) lướt qua rồi tắt nhanh
    if (k < 0.55) {
      const sk = k / 0.55, sw = easeOut(Math.min(1, sk * 1.6));
      g.save(); g.translate(f.x, f.y); g.rotate(f.ang * 0.3 - 0.6);
      for (const [off, c, wd] of [[0, '#ffffff', 5], [5, col, 11]]) {
        g.globalAlpha = (1 - sk) * (off ? 0.7 : 1);
        g.strokeStyle = c; g.lineCap = 'round'; g.lineWidth = wd * (1 - sk * 0.6);
        g.beginPath(); g.moveTo(-70 * sw, -52 * sw + off); g.quadraticCurveTo(0, -8 + off, 70 * sw, 52 * sw + off); g.stroke();
      }
      g.restore();
    }
    // dấu riêng từng hệ
    if (f.col === 3 || f.tier > 1) LIGHTER(g, () => { // ánh sáng: sao 4 cánh; đòn khắc hệ cũng có
      g.globalAlpha = (1 - k) * 0.9; g.fillStyle = '#fffbe0';
      const L = 70 * e + 10, W2 = 6 * (1 - k);
      g.beginPath(); g.moveTo(f.x, f.y - L); g.lineTo(f.x + W2, f.y); g.lineTo(f.x, f.y + L); g.lineTo(f.x - W2, f.y); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(f.x - L, f.y); g.lineTo(f.x, f.y + W2); g.lineTo(f.x + L, f.y); g.lineTo(f.x, f.y - W2); g.closePath(); g.fill();
    });
    if (f.col === 4) { // bóng tối: xoáy tím thu vào rồi nổ
      g.globalAlpha = (1 - k) * 0.55; g.fillStyle = '#2a1050';
      g.beginPath(); g.arc(f.x, f.y, 34 * (1 - Math.abs(k - 0.35) * 1.2) + 6, 0, Math.PI * 2); g.fill();
    }
  } else if (f.kind === 'claw') {
    // 3 vết vuốt chéo quét qua hàng tướng, trễ nhịp nhau
    for (let i = 0; i < 3; i++) {
      const t0 = i * 0.14, kk = Math.max(0, Math.min(1, (k - t0) / 0.5));
      if (kk <= 0 || kk >= 1) continue;
      const sw = easeOut(Math.min(1, kk * 1.8));
      const x0 = f.x - 130 + i * 78, y0 = f.y - 70, x1 = x0 + 70 * sw, y1 = y0 + 150 * sw;
      g.save(); g.lineCap = 'round'; g.globalCompositeOperation = 'lighter';
      g.globalAlpha = (1 - kk);
      g.strokeStyle = col; g.lineWidth = 16 * (1 - kk * 0.7); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 6 * (1 - kk * 0.7); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.restore();
    }
    LIGHTER(g, () => { g.globalAlpha = Math.pow(1 - k, 2); glow(g, f.x, f.y + 10, 150 * easeOut(Math.min(1, k * 2.4)) + 20, '#ff3b30', 0.75); });
  } else if (f.kind === 'bolt') {
    // đạn của quái bay xuống đội: sao chổi màu hệ lao thẳng
    const x = f.x0 + (f.x1 - f.x0) * easeOut(k), y = f.y0 + (f.y1 - f.y0) * easeOut(k);
    LIGHTER(g, () => {
      for (let j = 12; j >= 1; j--) {
        const kk = Math.max(0, k - j * 0.035), tx = f.x0 + (f.x1 - f.x0) * easeOut(kk), ty = f.y0 + (f.y1 - f.y0) * easeOut(kk), q = 1 - j / 13;
        g.globalAlpha = 0.5 * q; g.fillStyle = col; g.beginPath(); g.arc(tx, ty, 3 + 14 * q, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1; glow(g, x, y, 40, col, 0.9);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    });
  }
}

// Biển giới thiệu ải: tên khu cỡ lớn chữ vàng phát sáng màu hệ, dải ruy băng "ẢI n", hàng tầng, tia sáng xoay phía sau.
function drawZoneSign(g, it, a, bk) {
  const cy = 548, col = it.col;
  g.save();
  g.globalAlpha = bk;
  LIGHTER(g, () => { // tia sáng xoay + quầng màu hệ
    g.globalAlpha = bk * 0.5;
    glow(g, W / 2, cy, 260, col, 0.6);
    g.translate(W / 2, cy); g.rotate(a * 0.0004);
    g.fillStyle = '#fff6d0';
    for (let i = 0; i < 14; i++) { g.rotate((Math.PI * 2) / 14); g.beginPath(); g.moveTo(0, 0); g.lineTo(-9, -300); g.lineTo(9, -300); g.closePath(); g.globalAlpha = bk * 0.07; g.fill(); }
  });
  // đường vàng + thoi ở giữa
  const lw = 230 * bk;
  const goldLine = (y) => {
    const gr = g.createLinearGradient(W / 2 - lw, 0, W / 2 + lw, 0);
    gr.addColorStop(0, 'rgba(255,210,74,0)'); gr.addColorStop(0.5, '#ffe9a0'); gr.addColorStop(1, 'rgba(255,210,74,0)');
    g.fillStyle = gr; g.fillRect(W / 2 - lw, y - 1.5, lw * 2, 3);
    g.fillStyle = '#fff6c0'; g.beginPath(); g.moveTo(W / 2, y - 8); g.lineTo(W / 2 + 8, y); g.lineTo(W / 2, y + 8); g.lineTo(W / 2 - 8, y); g.closePath(); g.fill();
  };
  goldLine(cy - 70);
  // tên khu: nảy vào từ lớn
  const sc = 1 + (1 - bk) * 0.35;
  g.save(); g.translate(W / 2, cy - 22); g.scale(sc, sc);
  g.font = '700 46px ' + SERIF; // đo để vừa khung
  const tw = g.measureText(it.zone).width;
  const fs = Math.min(52, 46 * Math.min(1.3, (W - 70) / Math.max(1, tw)));
  g.letterSpacing = '3px';
  outlined(g, it.zone, 0, 0, fs, '#fff6c0', col, SERIF, 8, '700');
  g.restore();
  // ruy băng ẢI n
  const rw = 150 * ease((a - 900) / 400), rh = 40, ry = cy + 30;
  if (rw > 2) {
    g.save(); g.translate(W / 2, ry);
    const rg = g.createLinearGradient(0, -rh / 2, 0, rh / 2);
    rg.addColorStop(0, '#fff0a8'); rg.addColorStop(0.5, '#f3c64e'); rg.addColorStop(1, '#c77a0e');
    g.fillStyle = rg; g.strokeStyle = '#5a3210'; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-rw - 24, -rh / 2 + 8); g.lineTo(-rw, -rh / 2 + 8); g.lineTo(-rw, rh / 2 + 8); g.lineTo(-rw - 24, rh / 2 + 8); g.lineTo(-rw - 12, 8); g.closePath(); g.fill(); g.stroke(); // đuôi trái
    g.beginPath();
    g.moveTo(rw + 24, -rh / 2 + 8); g.lineTo(rw, -rh / 2 + 8); g.lineTo(rw, rh / 2 + 8); g.lineTo(rw + 24, rh / 2 + 8); g.lineTo(rw + 12, 8); g.closePath(); g.fill(); g.stroke(); // đuôi phải
    g.beginPath(); g.roundRect(-rw, -rh / 2, rw * 2, rh, 6); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-rw + 4, -rh / 2 + 3, rw * 2 - 8, 5);
    g.letterSpacing = '4px';
    text(g, it.stage, 0, 2, 26, '#3a2410', 'center', '800', SERIF);
    g.restore();
  }
  // hàng tầng: thoi sáng đến tầng hiện tại
  const n = it.floors || 1;
  for (let i = 0; i < n; i++) {
    const px = W / 2 + (i - (n - 1) / 2) * 26, py = cy + 92;
    g.save(); g.translate(px, py); g.rotate(Math.PI / 4);
    const cur = i === it.floor, done = i < it.floor;
    g.fillStyle = cur ? '#fff6c0' : done ? '#f3c64e' : 'rgba(255,255,255,.18)';
    g.strokeStyle = cur ? '#fff' : '#f3c64e'; g.lineWidth = 2;
    const sz = cur ? 9 + Math.sin(a * 0.012) * 1.5 : 7;
    g.fillRect(-sz / 2, -sz / 2, sz, sz); g.strokeRect(-sz / 2, -sz / 2, sz, sz);
    g.restore();
  }
  text(g, it.sub, W / 2, cy + 122, 14, '#fff8e6', 'center', '700');
  goldLine(cy + 146);
  g.restore();
}
