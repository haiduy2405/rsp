#!/usr/bin/env python3
"""Tách nền phẳng của ảnh quái: flood-fill từ viền theo màu nền, làm mềm mép alpha. Dùng: cut-bg.py <file.webp>..."""
import sys, numpy as np
from PIL import Image, ImageFilter
from collections import deque
def cut(path, tol=38):
    im = Image.open(path).convert('RGB'); a = np.asarray(im).astype(int); h, w, _ = a.shape
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
    alpha = Image.fromarray(((~seen) * 255).astype('uint8')).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA'); out.putalpha(alpha); out.save(path, quality=88, method=6)
    return seen.mean()
for p in sys.argv[1:]: print(p.split('/')[-1], round(cut(p), 2))
