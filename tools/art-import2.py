#!/usr/bin/env python3
"""Nhập ảnh tướng phong cách vẽ tay (v2): art-import2.py <ảnh ngang 3:2 chứa 2 tướng> <id_trái> <id_phải>.
Chia đôi ảnh, mỗi nửa thành card 768x1024 (3:4) + icon 512 (cắt vuông phần mặt)."""
import sys
from PIL import Image
src, left, right = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert('RGB')
w, h = im.size
for i, cid in enumerate((left, right)):
    cell = im.crop((i * w // 2, 0, (i + 1) * w // 2, h))
    cw, ch = cell.size
    cell.resize((768, 1024), Image.LANCZOS).save(f'www/assets/characters/{cid}_card.webp', quality=82, method=6)
    k = int(cw * 0.8); x = (cw - k) // 2; y = int(ch * 0.03)
    cell.crop((x, y, x + k, y + k)).resize((512, 512), Image.LANCZOS).save(f'www/assets/characters/{cid}_icon.webp', quality=85, method=6)
    print(cid, 'ok')
