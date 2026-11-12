#!/usr/bin/env python3
"""Làm ngọc nâng cấp cùng phong cách ngọc thường: giữ khung vàng có cánh của orbNe, thay phần ruột bóng loáng bằng
ngọc thường (viền nâu đậm, tô phẳng) đặt trên nền tròn tối cùng tông hệ. Chạy lại được từ bản gốc trong --src.
  python3 tools/orb-unify.py <thư mục chứa bản orbNe gốc>   (mặc định /tmp/orbs_bak)"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageStat
import numpy as np
ROOT = Path(__file__).resolve().parent.parent / 'www/assets/orbs'
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/orbs_bak')
S = 4  # siêu lấy mẫu cho mép mượt
CX, CY, R_IN = 128, 129, 82
for i in range(6):
    e = Image.open(SRC / f'orb{i}e.webp').convert('RGBA')
    n = Image.open(ROOT / f'orb{i}.webp').convert('RGBA')
    big = e.resize((256 * S, 256 * S), Image.LANCZOS)
    # khung = mọi điểm ngoài đĩa trong; trong đĩa bỏ trống
    arr = np.array(big)
    yy, xx = np.ogrid[:256 * S, :256 * S]
    inside = (xx - CX * S) ** 2 + (yy - CY * S) ** 2 < (R_IN * S) ** 2
    arr[inside, 3] = 0
    frame = Image.fromarray(arr)
    # nền tròn tối tông hệ: lấy màu chủ đạo của ngọc thường, tối đi
    na = np.array(n); m = na[..., 3] > 200
    col = na[m][:, :3].mean(0) if m.any() else np.array([120, 120, 120])
    base = tuple(int(c * 0.78 + 8) for c in col)
    disc = Image.new('RGBA', (256 * S, 256 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(disc)
    r = (R_IN + 3) * S  # lấn dưới khung một chút để không hở
    d.ellipse([CX * S - r, CY * S - r, CX * S + r, CY * S + r], fill=base + (255,))
    # vòng sáng nhẹ ở đáy đĩa cho có chiều sâu, vẫn phẳng
    glow = Image.new('RGBA', disc.size, (0, 0, 0, 0)); g = ImageDraw.Draw(glow)
    rr = int(r * 0.78); g.ellipse([CX * S - rr, CY * S - rr, CX * S + rr, CY * S + rr], fill=tuple(int(c * 0.9 + 40) for c in col) + (150,))
    glow = glow.filter(ImageFilter.GaussianBlur(14 * S))
    disc = Image.alpha_composite(disc, glow)
    # ngọc thường ở giữa, cắt theo bbox rồi co vừa đĩa
    bb = n.getbbox(); icon = n.crop(bb)
    k = (R_IN * 2 * 0.86 * S) / max(icon.size)
    icon = icon.resize((int(icon.width * k), int(icon.height * k)), Image.LANCZOS)
    disc.alpha_composite(icon, (CX * S - icon.width // 2, CY * S - icon.height // 2))
    out = Image.alpha_composite(disc, frame).resize((256, 256), Image.LANCZOS)
    out.save(ROOT / f'orb{i}e.webp', quality=92, method=6)
    print(i, 'ok', base)
