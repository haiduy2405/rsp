#!/usr/bin/env python3
"""SFX đợt 3: nhận thưởng. coinGet (vàng leng keng), gemGet (Linh Thạch chuông pha lê), ticketGet (vé: giấy xé + ting), claim (nhận chung: pop + chuông), bigClaim (thưởng lớn).
  python3 tools/build-sfx3.py"""
import json, os
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / 'tools/build-sfx.py').read_text(encoding='utf-8')
exec(compile(src[: src.index('def hit(')], 'sfx-helpers', 'exec'))
os.chdir(ROOT)
def tone(f, d, curve=4.0, a=0.003, harm=((1, 1.0),)):
    x = t(d); s = sum(amp * np.sin(2 * np.pi * f * m * x) for m, amp in harm)
    return s * env(len(x), a, d, curve)
def bell(f, d=0.6): return tone(f, d, 5, 0.002, ((1, 1.0), (2.01, 0.35), (3.97, 0.12)))
def coin(f, d=0.35): return tone(f, d, 6, 0.001, ((1, 1.0), (2.76, 0.55), (5.4, 0.3), (8.9, 0.15)))

# vàng: ba đồng xu rơi chạm nhau, nhanh
save('coinGet', echo(mix(0.9, [(0, coin(1760), 0.8), (0.07, coin(2349), 0.7), (0.15, coin(1976), 0.65), (0.24, coin(2637), 0.7), (0.0, noise(0.03, 4000, 12000, 8), 0.5)]), 0.09, 0.25, 2))
# Linh Thạch: chuông pha lê đi lên + lấp lánh
save('gemGet', echo(mix(1.5, [(0, bell(1047, 0.9), 0.6), (0.08, bell(1319, 0.9), 0.55), (0.16, bell(1568, 0.9), 0.55), (0.25, bell(2093, 1.0), 0.6), (0.3, noise(0.5, 6000, 14000, 4) * np.linspace(1, 0, int(SR * 0.5)), 0.25)]), 0.15, 0.3, 3))
# vé: xé giấy ngắn + ting
save('ticketGet', echo(mix(0.9, [(0, noise(0.12, 1500, 9000, 3), 0.7), (0.0, sweep(900, 300, 0.1, 'tri', 4), 0.3), (0.12, bell(1568, 0.6), 0.6), (0.2, bell(2093, 0.6), 0.5)]), 0.1, 0.25, 2))
# nhận chung: pop mềm + chuông đôi
save('claim', echo(mix(0.8, [(0, sweep(300, 700, 0.09, 'sine', 3), 0.7), (0.06, bell(1175, 0.6), 0.55), (0.14, bell(1760, 0.6), 0.5)]), 0.1, 0.25, 2))
# thưởng lớn: hợp âm dâng + dội chuông + lấp lánh
sw = sum(tone(f, 1.6, 1.5, 0.2) for f in (262, 330, 392, 523))
save('bigClaim', echo(mix(2.2, [(0, sw, 0.4), (0.15, coin(1760), 0.6), (0.3, coin(2349), 0.6), (0.45, bell(1047, 1.2), 0.6), (0.6, bell(1568, 1.2), 0.6), (0.75, bell(2093, 1.2), 0.55), (0.5, noise(1.0, 5000, 14000, 3) * np.linspace(1, 0, int(SR)), 0.3)]), 0.16, 0.3, 3))

cfgp = ROOT / 'www/js/data/audio.json'
cfg = json.loads(cfgp.read_text(encoding='utf-8'))
for k, g in dict(coinGet=0.85, gemGet=0.85, ticketGet=0.85, claim=0.8, bigClaim=0.9).items():
    cfg['samples'][k] = {'url': f'assets/audio/{k}.mp3', 'gain': g, 'rate': 1}
cfgp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('xong')
