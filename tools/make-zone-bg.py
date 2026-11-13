#!/usr/bin/env python3
"""Nền cho màn chọn ải từng vùng: tranh Tòa Tháp (hub.webp) đổi tông theo hệ bằng gradient map (tối→giữa→sáng), 540x960 webp.
Tạm thời cho tới khi có tranh vẽ riêng từng vùng; thay file assets/bg/zone_<id>.webp là xong, không cần sửa code.
  python3 tools/make-zone-bg.py"""
from pathlib import Path
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent / 'www/assets/bg'
PAL = {  # (tối, giữa, sáng)
    'zone_water': ('#0b2a4f', '#3b9cff', '#dff4ff'), 'zone_fire': ('#3a0d06', '#ff5a3c', '#ffe3a0'),
    'zone_wood': ('#0f2e17', '#4cc46a', '#efffcf'), 'zone_light': ('#4a380c', '#ffd84a', '#fffbe6'),
    'zone_dark': ('#150b2e', '#7a4cd8', '#eadcff'), 'zone_heart': ('#46122c', '#ff7fb0', '#ffe9f2'),
}
hx = lambda s: np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)], float)
src = Image.open(ROOT / 'hub.webp').convert('RGB').resize((540, 960), Image.LANCZOS)
a = np.asarray(src).astype(float)
lum = (0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]) / 255
lum = np.clip((lum - 0.25) / 0.7, 0, 1)  # kéo giãn tương phản
for zid, (d, m, l) in PAL.items():
    d, m, l = hx(d), hx(m), hx(l)
    t = lum[..., None]
    lo = d + (m - d) * np.clip(t * 2, 0, 1)
    hi = m + (l - m) * np.clip(t * 2 - 1, 0, 1)
    g = np.where(t < 0.5, lo, hi)
    out = np.clip(g * 0.82 + a * 0.18 * (np.array(m) / 255), 0, 255).astype('uint8')
    Image.fromarray(out).save(ROOT / f'{zid}.webp', quality=78, method=6)
    print(zid, (ROOT / f'{zid}.webp').stat().st_size // 1024, 'KB')
