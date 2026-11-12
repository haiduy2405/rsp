#!/usr/bin/env python3
"""Sinh các bài nhạc nền (dữ liệu, không phải file âm thanh) vào www/js/data/audio.json.

Mỗi vùng có giọng riêng (thang âm, tiết tấu, âm sắc) và 3 phiên bản: map (đi đường, êm), battle, boss.
Giai điệu sinh theo luật: nhịp mạnh bám nốt hợp âm, còn lại đi liền bậc, câu 4 ô nhịp lặp lại có biến tấu,
ô cuối về chủ âm. Hạt giống cố định → chạy lại ra đúng bản cũ. Giữ nguyên tracks cũ hub/battle/boss làm dự phòng.

  python3 tools/gen-music.py
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILE = ROOT / "www/js/data/audio.json"

SCALES = {
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "phrygdom": [0, 1, 4, 5, 7, 8, 10],
    "mixo": [0, 2, 4, 5, 7, 9, 10],
    "lydian": [0, 2, 4, 6, 7, 9, 11],
    "harmin": [0, 2, 3, 5, 7, 8, 11],
    "ionian": [0, 2, 4, 5, 7, 9, 11],
    "aeolian": [0, 2, 3, 5, 7, 8, 10],
}

# 8 ô nhịp, mỗi số là bậc gốc của hợp âm (0 = chủ âm).
RHY = {
    "flow": ["x...x.x.x...x...", "x.x...x.x...x.x.", "x...x...x.x.x...", "x.x.x...x.....x."],
    "drive": ["x.x.x.x.x.xx.x.x", "xx.xx.x.xx.xx.x.", "x.xxx.x.x.xxx.x.", "x.x.xx.xx.x.xx.x"],
    "folk": ["x..x..x.x..x.x..", "x.x..x..x.x..x.x", "x..x.x..x..x..x.", "x.x..x.xx..x.x.."],
    "bright": ["x.x.x...x.x.x...", "x...x.x.x.x...x.", "x.x...x.x...x.x.", "x.x.x.x.x...x..."],
    "dark": ["x.....x.x.....x.", "x...x.....x.x...", "x.....x...x.x...", "x.x...x.....x..."],
    "calm": ["x.......x.......", "x.......x...x...", "x...........x...", "x...x.......x..."],
}

ZONES = {
    "water": dict(
        root=50, scale="dorian", chords=[0, 3, 5, 3, 0, 3, 4, 0], seed=11, rhy="flow", lo=3, hi=11,
        battle=dict(bpm=118, lead=dict(wave="sine", gain=0.30, cut=3400, vib=14, partials=[[1, 1], [2, 0.18]]),
                    harm=dict(wave="triangle", gain=0.10),
                    arp=dict(wave="triangle", gain=0.15, cut=3000, pattern="0.12.32.1.23.21."),
                    pad=dict(wave="sawtooth", gain=0.06, cut=1300),
                    bass=dict(wave="triangle", gain=0.36, pattern="0.....0.0.....0."),
                    drums=dict(kick="x.......x.......", snare="........x.......", hat="..x...x...x...x.", shaker="x.x.x.x.x.x.x.x."), reverb=0.5),
        map=dict(bpm=76, arp="0.1.2.3.2.1.0.1.", wave="sine"),
    ),
    "fire": dict(
        root=52, scale="phrygdom", chords=[0, 1, 0, 6, 0, 1, 5, 1], seed=23, rhy="drive", lo=4, hi=13,
        battle=dict(bpm=148, lead=dict(wave="sawtooth", gain=0.15, cut=2600, vib=0),
                    harm=dict(wave="square", gain=0.05, cut=1800),
                    arp=dict(wave="square", gain=0.08, cut=3200, pattern="0123210123210123"),
                    pad=dict(wave="sawtooth", gain=0.06, cut=1500),
                    bass=dict(wave="sawtooth", gain=0.30, cut=520, pattern="0.0.0.0.0.0.0.00"),
                    drums=dict(kick="x..xx..xx..xx.x.", snare="....x.......x...", hat="x.x.x.x.x.x.x.xx", shaker=""), reverb=0.22),
        map=dict(bpm=84, arp="0..1..2..1..0...", wave="triangle"),
    ),
    "wood": dict(
        root=55, scale="mixo", chords=[0, 6, 3, 0, 0, 6, 3, 4], seed=37, rhy="folk", lo=4, hi=12,
        battle=dict(bpm=124, lead=dict(wave="triangle", gain=0.34, cut=3000, sustain=0.28, maxLen=2, vib=0),
                    harm=dict(wave="triangle", gain=0.12, below=2),
                    arp=dict(wave="square", gain=0.07, cut=2200, pattern="0.1.2.1.0.1.2.3.", len=1.4, sustain=0.2),
                    pad=dict(wave="triangle", gain=0.09, cut=1400),
                    bass=dict(wave="triangle", gain=0.38, pattern="0.....5.0.....5."),
                    drums=dict(kick="x.......x.....x.", snare="....x.......x...", hat="", shaker="x.x.x.x.x.x.x.x."), reverb=0.3),
        map=dict(bpm=88, arp="0.1.2.1.0.1.2.1.", wave="triangle"),
    ),
    "light": dict(
        root=53, scale="lydian", chords=[0, 1, 0, 4, 5, 1, 0, 4], seed=41, rhy="bright", lo=5, hi=13,
        battle=dict(bpm=132, lead=dict(wave="triangle", gain=0.26, cut=4200, vib=10, partials=[[1, 1], [2.0, 0.35], [3.0, 0.12]]),
                    harm=dict(wave="sine", gain=0.10),
                    arp=dict(wave="sine", gain=0.15, cut=4200, pattern="0.12.3.20.12.3.2", partials=[[1, 1], [2.0, 0.4]]),
                    pad=dict(wave="sawtooth", gain=0.075, cut=1900),
                    bass=dict(wave="triangle", gain=0.34, pattern="0...0...0...0..."),
                    drums=dict(kick="x...x...x...x...", snare="....x.......x...", hat="..x...x...x...x.", shaker="x.x.x.x.x.x.x.x."), reverb=0.45),
        map=dict(bpm=80, arp="0.12.3.20.12.3.2", wave="sine"),
    ),
    "dark": dict(
        root=45, scale="harmin", chords=[0, 5, 0, 4, 0, 5, 3, 4], seed=53, rhy="dark", lo=3, hi=11,
        battle=dict(bpm=126, lead=dict(wave="square", gain=0.13, cut=1900, vib=8),
                    harm=dict(wave="sawtooth", gain=0.045, cut=1200, below=4),
                    arp=dict(wave="sawtooth", gain=0.07, cut=1500, pattern="0..1..2.1..0..3."),
                    pad=dict(wave="sawtooth", gain=0.08, cut=900),
                    bass=dict(wave="sawtooth", gain=0.34, cut=420, pattern="0..0..0.0..0..0."),
                    drums=dict(kick="x..x..x...x.x...", snare="....x.......x...", hat="..x.....x.....x.", shaker=""), reverb=0.5),
        map=dict(bpm=66, arp="0.....2.....1...", wave="triangle"),
    ),
    "heart": dict(
        root=55, scale="ionian", chords=[0, 4, 5, 3, 0, 4, 3, 0], seed=67, rhy="flow", lo=4, hi=12,
        battle=dict(bpm=112, lead=dict(wave="triangle", gain=0.32, cut=3200, vib=10),
                    harm=dict(wave="sine", gain=0.11),
                    arp=dict(wave="triangle", gain=0.13, cut=2800, pattern="0.1.2.1.3.2.1.2."),
                    pad=dict(wave="sawtooth", gain=0.065, cut=1300),
                    bass=dict(wave="triangle", gain=0.36, pattern="0.......0.....0."),
                    drums=dict(kick="x.......x.......", snare="", hat="..x...x...x...x.", shaker="x.x.x.x.x.x.x.x."), reverb=0.45),
        map=dict(bpm=72, arp="0.1.2.3.2.1.0.1.", wave="sine"),
    ),
}


def make_lead(z, rhy_name, seed, lo, hi, sparse=False):
    """8 ô nhịp x 16 bước, ký tự base36 là bậc thang âm, '.' là giữ nốt."""
    rnd = random.Random(seed)
    chords = z["chords"]
    lib = RHY[rhy_name]
    # hai khuôn nhịp cho câu A (lặp), một khuôn khác cho ô kết câu
    a, b, c = rnd.sample(lib, 3) if len(lib) >= 3 else (lib[0], lib[0], lib[0])
    plan = [a, b, a, c, a, b, a, c]
    cur = z["chords"][0] + 4  # bắt đầu quanh quãng 5 của chủ âm
    cur = max(lo, min(hi, cur))
    bars = []
    for bi in range(8):
        r = chords[bi]
        ctones = {r % 7, (r + 2) % 7, (r + 4) % 7}
        # đường cong: nửa đầu đi lên, nửa sau đi xuống, câu B (ô 4-7) cao hơn một chút
        lift = 1 if bi in (4, 5) else 0
        row = []
        step_dir = 1 if (bi % 4) < 2 else -1
        for i, ch in enumerate(plan[bi]):
            if ch != "x":
                row.append(".")
                continue
            strong = i in (0, 8)
            last_bar = bi == 7
            if last_bar and i == 0:
                cur = r + 7 if r + 7 <= hi else r
            elif strong:
                cands = [d for d in range(lo, hi + 1) if d % 7 in ctones]
                cur = min(cands, key=lambda d: (abs(d - (cur + lift)), rnd.random()))
            else:
                mv = rnd.choice([1, 1, 1, 2, -1, 0]) * step_dir
                if rnd.random() < 0.18:
                    mv = -mv
                cur = max(lo, min(hi, cur + mv))
            row.append(format(cur, "x"))
        line = "".join(row)
        if bi == 7:  # kết: câu cuối dừng ở chủ âm, nốt dài
            tonic = max(lo, (cur // 7) * 7)
            line = format(min(hi, tonic), "x") + "." * 15
        bars.append(line)
    return bars


def build(zone, kind):
    z = ZONES[zone]
    bt = z["battle"]
    scale = SCALES[z["scale"]]
    seed = z["seed"]
    if kind == "battle":
        lead_bars = make_lead(z, z["rhy"], seed, z["lo"], z["hi"])
        tr = dict(bpm=bt["bpm"], root=z["root"], scale=scale, swing=0.0, chords=z["chords"],
                  padWave=bt["pad"]["wave"], padGain=bt["pad"]["gain"], padCut=bt["pad"]["cut"], reverb=bt["reverb"],
                  arp=bt["arp"], lead=dict(**bt["lead"], octave=12, bars=lead_bars), harm=dict(bt["harm"]),
                  bass=bt["bass"], drums=bt["drums"], fill=True,
                  form=["pabd", "pabdl", "pabdl", "pabdlh", "pabdl", "pabdlh", "pabdlh", "palhbd"])
    elif kind == "boss":
        lead_bars = make_lead(z, "drive", seed + 1000, z["lo"] + 1, z["hi"] + 1)
        lead = dict(bt["lead"])
        lead.update(wave="sawtooth", gain=max(lead["gain"], 0.15), cut=2600, vib=0)
        drums = dict(kick="x..xx..xx..xx..x", snare="....x.......x...", hat="xxxxxxxxxxxxxxxx", shaker="")
        tr = dict(bpm=bt["bpm"] + 18, root=z["root"] - 5, scale=SCALES["harmin"] if zone in ("water", "light", "heart") else scale,
                  swing=0.0, chords=[0, 0, 5, 4, 0, 5, 1, 4] if zone != "fire" else [0, 1, 0, 6, 0, 1, 6, 1],
                  padWave="sawtooth", padGain=0.075, padCut=1400, reverb=0.3,
                  arp=dict(wave="sawtooth", gain=0.10, cut=2400, pattern="0.12.1.20.12.1.2"),
                  lead=dict(**lead, octave=12, bars=lead_bars), harm=dict(wave="square", gain=0.05, cut=1700, below=2),
                  bass=dict(wave="sawtooth", gain=0.32, cut=420, pattern="0.0.0.0.0.0.0.0."), drums=drums, fill=True,
                  form=["pabd", "pabdl", "pabdl", "pabdlh", "pabdl", "pabdlh", "pabdlh", "pabdlh"])
    else:  # map: êm, thưa, không trống nặng
        m = z["map"]
        lead_bars = make_lead(z, "calm", seed + 2000, z["lo"], z["hi"], sparse=True)
        tr = dict(bpm=m["bpm"], root=z["root"], scale=scale, swing=0.0, chords=z["chords"],
                  padWave="sawtooth", padGain=0.075, padCut=1000, padAttack=0.9, reverb=0.6,
                  arp=dict(wave=m["wave"], gain=0.13, cut=2800, pattern=m["arp"], len=2.6, partials=[[1, 1], [2.0, 0.2]]),
                  lead=dict(wave="sine", gain=0.30, octave=12, cut=3000, vib=12, maxLen=8, attack=0.04, bars=lead_bars),
                  bass=dict(wave="triangle", gain=0.34, pattern="0...............", cut=600),
                  drums=dict(kick="", snare="", hat="", shaker="x...x...x...x..." if zone in ("wood", "heart") else ""),
                  form=["pa", "palb", "palb", "palb", "palb", "palbh", "palbh", "palb"])
        tr["harm"] = dict(wave="triangle", gain=0.08)
    return tr


def hub():
    scale = SCALES["dorian"]
    z = dict(chords=[0, 5, 3, 4, 0, 5, 3, 4], root=57, lo=3, hi=12)
    bars = make_lead(z, "flow", 5, 3, 12)
    return dict(bpm=84, root=57, scale=scale, swing=0.0, chords=z["chords"], padWave="sawtooth", padGain=0.07, padCut=1100, padAttack=0.6, reverb=0.55,
                arp=dict(wave="triangle", gain=0.15, cut=2600, pattern="0.1.2.1.3.2.1.2.", partials=[[1, 1], [2.0, 0.15]]),
                lead=dict(wave="sine", gain=0.32, octave=12, cut=3200, vib=12, bars=bars), harm=dict(wave="triangle", gain=0.09),
                bass=dict(wave="triangle", gain=0.36, pattern="0.......0.....0."),
                drums=dict(kick="", snare="", hat="....x.......x...", shaker="x.x.x.x.x.x.x.x."),
                form=["pa", "palb", "palb", "palbh", "palb", "palbh", "palbh", "palb"])


def main():
    cfg = json.loads(FILE.read_text(encoding="utf-8"))
    tracks = {k: v for k, v in cfg["tracks"].items() if k in ("battle", "boss")}  # giữ bản cũ làm dự phòng
    tracks = {"hub": hub(), **tracks}
    for zone in ZONES:
        tracks[f"map_{zone}"] = build(zone, "map")
        tracks[f"battle_{zone}"] = build(zone, "battle")
        tracks[f"boss_{zone}"] = build(zone, "boss")
    cfg["tracks"] = tracks
    FILE.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(tracks)} bài")


if __name__ == "__main__":
    main()
