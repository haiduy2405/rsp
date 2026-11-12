#!/usr/bin/env python3
"""Nhập quái phong cách vẽ tay (v2): art-import-mon.py <lưới.png> <số cột> <số hàng> <id>... (trái->phải, trên->dưới).
Cắt ô, tách nền kem theo flood-fill từ viền, cắt sát, đặt vào ô vuông 512 có lề, lưu www/assets/monsters/<id>.webp."""
import sys, numpy as np
from scipy import ndimage
from PIL import Image, ImageFilter
from collections import deque
def cut(im, tol=60):
    a = np.asarray(im.convert('RGB')).astype(int); h, w, _ = a.shape
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); bg = np.median(edge, axis=0)
    near = (np.abs(a - bg).sum(axis=2) <= tol)
    seen = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]: seen[ny, nx] = True; q.append((ny, nx))
    lab, n = ndimage.label(~seen)
    if n:
        ar = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); big = ar.max(); keep = np.zeros(n + 1, bool)
        for i in range(1, n + 1):
            ys, xs = np.where(lab == i); border = ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1
            keep[i] = ar[i - 1] >= big * (0.10 if border else 0.015)
        seen = ~keep[lab]
    alpha = Image.fromarray(((~seen) * 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA'); out.putalpha(alpha); return out
src, cols, rows, ids = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
im = Image.open(src).convert('RGB'); W, H = im.size
cw, ch = W // cols, H // rows
for n, mid in enumerate(ids):
    c, r = n % cols, n // cols
    cell = cut(im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
    bb = cell.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    cell = cell.crop(bb); k = 512 * 0.9 / max(cell.size)
    cell = cell.resize((max(1, round(cell.width * k)), max(1, round(cell.height * k))), Image.LANCZOS)
    out = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    out.paste(cell, ((512 - cell.width) // 2, 512 - 24 - cell.height if cell.height > 400 else (512 - cell.height) // 2), cell)
    out.save(f'www/assets/monsters/{mid}.webp', quality=88, method=6); print(mid, cell.size)
