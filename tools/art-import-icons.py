#!/usr/bin/env python3
"""Nhập icon vẽ tay: art-import-icons.py <bảng.png> <cột> <hàng> <thư mục ra> <cỡ> <tên>... (trái->phải, trên->dưới; '-' = bỏ ô).
Cắt ô, tách nền kem bằng flood-fill từ viền, cắt sát, đặt giữa ô vuông <cỡ> có lề, lưu <thư mục ra>/<tên>.webp."""
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
import os
src, cols, rows, out, size, names = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], int(sys.argv[5]), sys.argv[6:]
os.makedirs(out, exist_ok=True)
im = Image.open(src).convert('RGB'); W, H = im.size
cw, ch = W // cols, H // rows
for n, name in enumerate(names):
    if name == '-': continue
    c, r = n % cols, n // cols
    cell = cut(im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
    bb = cell.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    cell = cell.crop(bb); k = size * 0.9 / max(cell.size)
    cell = cell.resize((max(1, round(cell.width * k)), max(1, round(cell.height * k))), Image.LANCZOS)
    o = Image.new('RGBA', (size, size), (0, 0, 0, 0)); o.paste(cell, ((size - cell.width) // 2, (size - cell.height) // 2), cell)
    o.save(f'{out}/{name}.webp', quality=90, method=6); print(name, cell.size)
