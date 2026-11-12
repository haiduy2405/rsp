#!/usr/bin/env python3
"""Nén nhạc nền CC0 của Juhani Junkala (JRPG Music Pack #1/#2/#3/#5) thành mp3 nhỏ và ghi bảng ghép vào data/audio.json (mục "music").
Nguồn (ogg giải nén) KHÔNG nằm trong repo; truyền thư mục chứa p1/ p2/ p3/ p5/ :
  python3 tools/build-music.py /tmp/jr
Bài nào có trong "music" thì trình phát dùng file; thiếu/lỗi tải thì rơi về bài tự sinh cùng tên (data/audio.json -> tracks)."""
import json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/jr')
OUT = ROOT / 'www/assets/music'
FILES = {  # slug: (đường dẫn trong SRC, hệ số âm lượng so với bài chuẩn)
    'town1': 'p2/Town1 - Home Town.ogg', 'town2': 'p2/Town2 - Where Time Stands Still.ogg',
    'town3': 'p2/Town3 - Sunshine Coast.ogg', 'town4': 'p2/Town4 - Bazaar.ogg',
    'expl1': 'p1/Exploration1 - Grasslands.ogg', 'expl2': 'p1/Exploration2 - Military Base.ogg',
    'expl3': "p1/Exploration3 - Tha'el Mines.ogg", 'expl4': 'p1/Exploration4 - Prairie Nights.ogg',
    'expl5': 'p1/Exploration5 - Sneaking Around.ogg', 'expl6': 'p1/Exploration6 - Tropical Island.ogg',
    'evil1': 'p3/Evil1 - Ancient Evil Awakens.ogg', 'evil2': 'p3/Evil2 - Catacombs.ogg',
    'evil3': 'p3/Evil3 - Apocalypse.ogg', 'evil4': "p3/Evil4 - Witch's Lair.ogg", 'evil5': 'p3/Evil5 - Whispers From Beyond.ogg',
    'act1': 'p5/Action1 - Encounter With The Witches.ogg', 'act2': 'p5/Action2 - Army Approaching.ogg', 'act3': 'p5/Action3 - Preparing For Battle.ogg',
}
# tên bài trong game -> slug. Bài không nhắc tới (wish, victory, defeat) giữ bản tự sinh.
MAP = {
    'hub': 'town1', 'title': 'expl2', 'tutorial': 'expl1', 'camp': 'town2', 'shop': 'town4', 'summon': 'evil5', 'mystery': 'expl5',
    'map_water': 'expl6', 'map_fire': 'expl3', 'map_wood': 'expl4', 'map_light': 'town3', 'map_dark': 'evil2', 'map_heart': 'town2',
    'battle_water': 'act1', 'battle_fire': 'act2', 'battle_wood': 'act3', 'battle_light': 'act1', 'battle_dark': 'act2', 'battle_heart': 'act3',
    'boss_water': 'evil1', 'boss_fire': 'evil3', 'boss_wood': 'evil4', 'boss_light': 'evil1', 'boss_dark': 'evil3', 'boss_heart': 'evil4',
    'battle': 'act2', 'boss': 'evil3',
}
OUT.mkdir(parents=True, exist_ok=True)
for slug, rel in FILES.items():
    dst = OUT / f'{slug}.mp3'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(SRC / rel), '-af', 'loudnorm=I=-20:TP=-2:LRA=9', '-ac', '2', '-ar', '44100',
                    '-c:a', 'libmp3lame', '-b:a', '56k', '-joint_stereo', '1', str(dst)], check=True)
    print(slug, round(dst.stat().st_size / 1e6, 2), 'MB')
cfgp = ROOT / 'www/js/data/audio.json'
cfg = json.loads(cfgp.read_text(encoding='utf-8'))
cfg['music'] = {name: {'url': f'assets/music/{slug}.mp3', 'gain': 1} for name, slug in MAP.items()}
cfgp.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('tổng', round(sum(p.stat().st_size for p in OUT.glob('*.mp3')) / 1e6, 1), 'MB;', len(MAP), 'bài ghép')
