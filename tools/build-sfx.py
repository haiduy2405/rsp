#!/usr/bin/env python3
"""Tổng hợp SFX trận (đánh trúng, trúng đòn, hạ quái, kỹ năng) bằng numpy, xuất mp3 mono vào www/assets/audio.
Xác định (seed cố định). Dùng: python3 tools/build-sfx.py"""
import subprocess, numpy as np
from scipy.signal import butter, sosfilt
SR = 44100
rng = np.random.default_rng(7)
def t(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.002, d=0.1, curve=4.0):
    x = np.arange(n) / SR; e = np.exp(-curve * x / d); e[: int(a * SR)] *= np.linspace(0, 1, int(a * SR)); return e
def sweep(f0, f1, d, wave='sine', curve=4.0):
    x = t(d); f = f0 * (f1 / f0) ** (x / d); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) if wave == 'sine' else (2 * np.abs(2 * ((ph / (2 * np.pi)) % 1) - 1) - 1)
    return s * env(len(x), 0.002, d, curve)
def noise(d, lo=None, hi=None, curve=5.0):
    n = rng.standard_normal(int(SR * d))
    if lo and hi: n = sosfilt(butter(4, [lo, hi], 'bandpass', fs=SR, output='sos'), n)
    elif hi: n = sosfilt(butter(4, hi, 'lowpass', fs=SR, output='sos'), n)
    elif lo: n = sosfilt(butter(4, lo, 'highpass', fs=SR, output='sos'), n)
    return n / (np.abs(n).max() + 1e-9) * env(len(n), 0.001, d, curve)
def mix(total, parts):
    out = np.zeros(int(SR * total))
    for at, s, g in parts:
        i = int(at * SR); out[i:i + len(s)] += s[: len(out) - i] * g
    return out
def echo(x, delay=0.11, fb=0.35, n=3):
    out = x.copy()
    for k in range(1, n + 1):
        d = int(delay * SR * k); out[d:] += x[: len(x) - d] * (fb ** k)
    return out
def save(name, x, peak=0.89):
    x = x / (np.abs(x).max() + 1e-9) * peak
    x = np.concatenate([x, np.zeros(int(0.01 * SR))])
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-', '-b:a', '72k', f'www/assets/audio/{name}.mp3'], input=pcm, check=True)
    print(name, round(len(x) / SR, 2), 's')

def hit(p=1.0, crack=(1800, 7000)):
    return mix(0.4, [
        (0, sweep(260 * p, 55 * p, 0.2, 'sine', 5), 1.0),            # thân đòn: tụt tần
        (0, sweep(520 * p, 140 * p, 0.1, 'tri', 6), 0.55),            # cú đấm trung
        (0, noise(0.07, *crack, curve=6), 0.8),                       # tiếng chát
        (0.004, noise(0.22, None, 900, curve=5), 0.5),                 # đuôi trầm
    ])
save('hit', hit(1.0)); save('hit2', hit(1.18, (2400, 8000))); save('hit3', hit(0.86, (1400, 6000)))
# trúng đòn: nặng, đục
save('hurt', mix(0.5, [(0, sweep(170, 40, 0.3, 'sine', 4), 1.0), (0, noise(0.25, None, 700, 4), 0.7), (0.0, sweep(300, 90, 0.12, 'tri', 7), 0.4)]))
# hạ quái: đòn mạnh + nổ vỡ + chuông pha lê
shat = noise(0.45, 3000, 11000, 6)
ping = mix(0.5, [(0, sweep(1760, 1760, 0.5, 'sine', 5), 0.5), (0, sweep(2637, 2637, 0.4, 'sine', 6), 0.35)])
save('kill', echo(mix(0.9, [(0, hit(0.8), 1.0), (0.03, shat, 0.6), (0.06, sweep(110, 35, 0.5, 'sine', 4), 0.9), (0.1, ping, 0.5)]), 0.09, 0.3, 2))
# kỹ năng: gió tụ lực dâng lên -> chùm nốt lấp lánh -> bùng nổ
def skill(notes, root=1.0):
    rise = np.zeros(int(SR * 0.7)); n = rng.standard_normal(len(rise))
    for k in range(7):  # quét dải lọc tăng dần
        lo = 250 * 1.55 ** k; seg = sosfilt(butter(3, [lo, lo * 1.6], 'bandpass', fs=SR, output='sos'), n)
        a = int(len(rise) * k / 8); w = np.hanning(int(len(rise) * 0.35)); rise[a:a + len(w)] += seg[a:a + len(w)] * w[: len(rise) - a]
    rise = rise / np.abs(rise).max() * np.linspace(0.1, 1, len(rise)) ** 1.5
    parts = [(0, rise, 0.55)]
    for i, f in enumerate(notes):
        parts.append((0.06 * i, mix(0.45, [(0, sweep(f * root, f * root, 0.45, 'sine', 5), 0.5), (0, sweep(f * root * 2, f * root * 2, 0.3, 'sine', 7), 0.2)]), 0.45))
    b = 0.72
    for f in (523, 659, 784):
        parts.append((b, sweep(f * root, f * root, 0.55, 'sine', 4), 0.4))
    parts += [(b, sweep(140, 38, 0.45, 'sine', 4), 1.0), (b, noise(0.1, 1500, 9000, 6), 0.8), (b, noise(0.4, 2500, 11000, 5), 0.35)]
    return echo(mix(1.45, parts), 0.13, 0.3, 3)
save('skill', skill([523, 659, 784, 1047, 1319]))
save('skill2', skill([587, 740, 880, 1175, 1480], 1.0))
