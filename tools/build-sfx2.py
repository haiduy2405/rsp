#!/usr/bin/env python3
"""SFX đợt 2 (numpy, tất định): kỹ năng theo hệ, lên cấp, ngọc nâng cấp, boss xuất hiện, trạng thái xấu, phản đòn, hồi sinh.
Dùng lại hàm trợ giúp của build-sfx.py (phần trước def hit). Xuất mp3 vào www/assets/audio và đăng ký vào data/audio.json.
  python3 tools/build-sfx2.py"""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / 'tools/build-sfx.py').read_text(encoding='utf-8')
exec(compile(src[: src.index('def hit(')], 'sfx-helpers', 'exec'))  # SR, rng, t, env, sweep, noise, mix, echo, save + imports
import os
os.chdir(ROOT)

def tone(f, d, curve=4.0, a=0.003, harm=((1, 1.0),)):
    x = t(d); s = sum(amp * np.sin(2 * np.pi * f * m * x) for m, amp in harm)
    return s * env(len(x), a, d, curve)
def swell(d, lo, hi, peak=0.6):
    n = noise(d, lo, hi, 0.01); w = np.sin(np.linspace(0, np.pi, len(n))) ** (1.0 + peak)
    return n * w
def rise_noise(d, lo, hi):
    n = noise(d, lo, hi, 0.01); return n * np.linspace(0.05, 1, len(n)) ** 2
def lowpass(x, fc):
    return sosfilt(butter(2, fc, 'lowpass', fs=SR, output='sos'), x)
def bell(f, d=0.6):
    return tone(f, d, 5, 0.002, ((1, 1.0), (2.01, 0.35), (3.97, 0.12)))

# ---- Kỹ năng theo hệ ----
def skill_water():
    parts = [(0, swell(0.7, 300, 3500, 0.2), 0.5)]
    for i, (st, f0) in enumerate([(0.0, 520), (0.09, 700), (0.17, 880), (0.26, 1100), (0.36, 760)]):
        parts.append((st, sweep(f0, f0 * 1.9, 0.12, 'sine', 4), 0.5))      # bong bóng nổi lên
    for i, f in enumerate([659, 784, 988, 1319]):
        parts.append((0.45 + 0.05 * i, bell(f, 0.7), 0.35))                  # chuông nước
    parts += [(0.7, noise(0.45, 1200, 9000, 5), 0.6), (0.7, sweep(180, 60, 0.35, 'sine', 4), 0.8)]  # nước vỡ
    return echo(mix(1.4, parts), 0.14, 0.32, 3)

def skill_fire():
    crack = np.zeros(int(SR * 0.9))
    for k in range(26):
        at = rng.uniform(0, 0.85); c = noise(0.012 + rng.uniform(0, 0.02), 2500, 9000, 3) * rng.uniform(0.3, 1)
        i = int(at * SR); crack[i:i + len(c)] += c[: len(crack) - i]
    parts = [(0, lowpass(rise_noise(0.75, 80, 5000), 1600), 0.9), (0, crack, 0.45),
             (0.0, sweep(90, 160, 0.7, 'tri', 1.0), 0.5), (0.6, sweep(200, 38, 0.5, 'sine', 4), 1.0),
             (0.6, noise(0.5, 200, 6000, 4), 0.8), (0.62, sweep(700, 90, 0.3, 'tri', 5), 0.5)]
    return echo(mix(1.5, parts), 0.1, 0.28, 2)

def skill_wood():
    leaf = swell(0.8, 2500, 9000, 0.0)
    am = 0.55 + 0.45 * np.sin(2 * np.pi * 14 * t(0.8)); leaf = leaf * am
    parts = [(0, leaf, 0.5)]
    for i, f in enumerate([392, 494, 587, 784, 988]):                          # mộc cầm
        parts.append((0.08 + 0.1 * i, tone(f, 0.35, 8, 0.002, ((1, 1.0), (4.0, 0.25))), 0.55))
    glide = sweep(600, 1200, 0.4, 'sine', 3); parts.append((0.55, glide, 0.35))
    parts += [(0.75, sweep(150, 70, 0.25, 'sine', 6), 0.8), (0.75, noise(0.2, 800, 5000, 6), 0.5)]
    return echo(mix(1.3, parts), 0.12, 0.25, 2)

def skill_light():
    parts = [(0, rise_noise(0.6, 6000, 14000), 0.25)]
    for i, f in enumerate([1047, 1319, 1568, 2093, 2637, 3136]):
        parts.append((0.07 * i, bell(f, 0.8), 0.4))                           # chùm chuông bay lên
    chord = sum(tone(f, 0.9, 2.5, 0.05) for f in (523, 659, 784, 1047))
    parts += [(0.5, chord, 0.28), (0.5, sweep(120, 45, 0.4, 'sine', 4), 0.6), (0.5, noise(0.4, 4000, 13000, 5), 0.35)]
    return echo(mix(1.5, parts), 0.16, 0.38, 4)

def skill_dark():
    drone = tone(70, 1.0, 1.2, 0.2) + 0.6 * tone(74.5, 1.0, 1.2, 0.2) + 0.4 * tone(105, 1.0, 1.5, 0.2)  # lệch nhau → rền u ám
    back = noise(0.7, 150, 3000, 0.01)[::-1] * np.linspace(1, 0.05, int(SR * 0.7)) ** 0 * np.linspace(0.05, 1, int(SR * 0.7)) ** 2
    parts = [(0, drone, 0.5), (0, back, 0.55), (0, sweep(900, 180, 0.6, 'tri', 2), 0.25),
             (0.6, sweep(130, 32, 0.6, 'sine', 3), 1.0), (0.6, noise(0.45, 100, 2500, 4), 0.7),
             (0.62, tone(233, 0.9, 3, 0.002, ((1, 1.0), (1.06, 0.8))), 0.3)]
    return echo(mix(1.6, parts), 0.18, 0.4, 3)

def skill_heart():
    heart = [(0, sweep(130, 55, 0.14, 'sine', 5), 0.9), (0.2, sweep(120, 52, 0.14, 'sine', 5), 0.7)]
    chord = sum(tone(f, 1.1, 2.2, 0.08) for f in (392, 494, 587))
    parts = heart + [(0.05, chord, 0.35), (0.45, bell(784, 0.8), 0.4), (0.55, bell(988, 0.8), 0.4), (0.65, bell(1175, 0.9), 0.4),
                     (0.3, swell(0.7, 3000, 11000, 0.2), 0.15)]
    return echo(mix(1.5, parts), 0.15, 0.35, 3)

for name, fn in [('skill_water', skill_water), ('skill_fire', skill_fire), ('skill_wood', skill_wood), ('skill_light', skill_light), ('skill_dark', skill_dark), ('skill_heart', skill_heart)]:
    save(name, fn())

# ---- Lên cấp: nốt rải lên + chuông octave + lấp lánh ----
parts = [(0.08 * i, bell(f, 0.7), 0.5) for i, f in enumerate([523, 659, 784, 1047, 1319, 1568])]
parts += [(0.5, sum(tone(f, 0.8, 3, 0.01) for f in (523, 784, 1047)), 0.3), (0.5, noise(0.4, 6000, 14000, 5), 0.2)]
save('levelup', echo(mix(1.4, parts), 0.12, 0.3, 3))

# ---- Ngọc nâng cấp xuất hiện: pop + chuông cánh ----
save('enhance', echo(mix(0.9, [(0, sweep(300, 1200, 0.08, 'sine', 3), 0.7), (0.05, bell(2093, 0.7), 0.5), (0.1, bell(3136, 0.6), 0.35), (0.05, noise(0.18, 5000, 13000, 6), 0.3)]), 0.09, 0.3, 2))

# ---- Boss xuất hiện: kèn trầm + trống + dâng ----
horn = lowpass(sum(sweep(f * 0.97, f, 0.9, 'tri', 0.6) for f in (55, 82.5, 110)), 900)
save('bossIn', echo(mix(1.8, [(0, horn, 0.6), (0, rise_noise(0.9, 200, 4000), 0.4), (0.9, sweep(110, 30, 0.7, 'sine', 3), 1.0), (0.9, noise(0.5, 100, 4000, 4), 0.7), (1.05, sweep(100, 30, 0.6, 'sine', 3), 0.8)]), 0.15, 0.3, 3))

# ---- Bị hiệu ứng xấu: nốt tụt méo + rung ----
x = sweep(520, 170, 0.4, 'tri', 2.0) * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t(0.4)))
save('debuff', mix(0.5, [(0, x, 0.8), (0, noise(0.15, 300, 2500, 6), 0.3)]))

# ---- Phản đòn: kim loại va ----
clang = sum(a * tone(800 * m, 0.7, 6 + m, 0.001) for m, a in [(1, 1.0), (2.76, 0.6), (5.4, 0.4), (8.93, 0.25)])
save('reflect', mix(0.8, [(0, clang, 0.7), (0, noise(0.04, 3000, 12000, 8), 0.7), (0.01, sweep(300, 80, 0.12, 'sine', 6), 0.5)]))

# ---- Hồi sinh: hợp âm dâng + chuông ----
rev = sum(tone(f, 1.4, 1.6, 0.25) for f in (262, 330, 392, 523))
save('revive', echo(mix(1.9, [(0, rev, 0.45), (0, rise_noise(0.9, 2000, 11000), 0.3), (0.8, bell(1047, 0.9), 0.5), (0.9, bell(1568, 0.9), 0.45), (0.8, sweep(160, 50, 0.4, 'sine', 4), 0.7)]), 0.16, 0.35, 3))

# ---- đăng ký vào audio.json ----
cfgp = ROOT / 'www/js/data/audio.json'
cfg = json.loads(cfgp.read_text(encoding='utf-8'))
gains = dict(skill_water=0.9, skill_fire=0.9, skill_wood=0.9, skill_light=0.9, skill_dark=0.95, skill_heart=0.9, levelup=0.85, enhance=0.8, bossIn=0.9, debuff=0.6, reflect=0.8, revive=0.85)
for k, g in gains.items():
    cfg['samples'][k] = {'url': f'assets/audio/{k}.mp3', 'gain': g, 'rate': 1}
cfgp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('đã đăng ký', len(gains), 'mẫu')
