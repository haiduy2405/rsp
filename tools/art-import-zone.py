#!/usr/bin/env python3
"""Nhập tranh nền vùng (ChatGPT, lưới 3x2: water fire wood light dark heart) -> www/assets/bg/zone_<id>.webp 540x960.
Ô vuông đặt phía trên, phần dưới kéo dài bằng mây lật + làm mờ.
  python3 tools/art-import-zone.py <ảnh_hàng_trên> <ảnh_hàng_dưới>
Hàng trên: ô y 10-513; hàng dưới: y 259-764 (ảnh chụp 1568x778). Cột x: 16-517, 535-1033, 1051-1553."""
import sys
from pathlib import Path
from PIL import Image, ImageFilter
OUT = Path(__file__).resolve().parent.parent / 'www/assets/bg'
COLS = [(16, 517), (535, 1033), (1051, 1553)]
IDS = [['water', 'fire', 'wood'], ['light', 'dark', 'heart']]
ROWS = [(10, 513), (259, 764)]
def unmouse(img, box=(790, 338, 815, 365)):
    try:
        import cv2, numpy as np
        a = np.asarray(img)[:, :, ::-1].copy(); m = np.zeros(a.shape[:2], np.uint8); m[box[1]:box[3], box[0]:box[2]] = 255
        return Image.fromarray(cv2.inpaint(a, m, 4, cv2.INPAINT_TELEA)[:, :, ::-1])
    except ImportError:
        return img
def build(panel):
    p = panel.resize((540, 540), Image.LANCZOS)
    im = Image.new('RGB', (540, 960)); im.paste(p, (0, 0))
    strip = p.crop((0, 380, 540, 540)).transpose(Image.FLIP_TOP_BOTTOM).resize((540, 420), Image.BICUBIC).filter(ImageFilter.GaussianBlur(28))
    tail = Image.new('RGB', (540, 420)); tail.paste(strip)
    im.paste(tail, (0, 540))
    zone = im.crop((0, 500, 540, 620)).filter(ImageFilter.GaussianBlur(7)); im.paste(zone, (0, 500))
    return im
for r, ((y0, y1), src) in enumerate(zip(ROWS, sys.argv[1:3])):
    img = Image.open(src).convert('RGB')
    img = unmouse(img)
    for c, (x0, x1) in enumerate(COLS):
        panel = img.crop((x0 + 3, y0 + 3, x1 - 3, y1 - 3))
        build(panel).save(OUT / f'zone_{IDS[r][c]}.webp', quality=82, method=6)
        print('zone_' + IDS[r][c])
