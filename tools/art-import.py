#!/usr/bin/env python3
"""Nhập ảnh tướng chụp từ Gemini: art-import.py <ảnh> <id>. Cắt watermark, ép 2:3, ra card 1024x1536 + icon 512 (webp)."""
import sys
from PIL import Image
src, cid = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
w, h = im.size
im = im.crop((0, 0, w, h - 47))          # bỏ watermark
w, h = im.size
tw = int(h * 2 / 3)                        # ép 2:3, giữ giữa
x0 = max(0, (w - tw) // 2)
im = im.crop((x0, 0, x0 + min(tw, w), h))
card = im.resize((1024, 1536), Image.LANCZOS)
card.save(f'www/assets/characters/{cid}_card.webp', quality=82, method=6)
s = im.size[0]
k = int(s * 0.7)
x = (s - k) // 2
icon = im.crop((x, int(im.size[1]*0.02), x + k, int(im.size[1]*0.02) + k)).resize((512, 512), Image.LANCZOS)
icon.save(f'www/assets/characters/{cid}_icon.webp', quality=85, method=6)
print(cid, card.size, icon.size)
