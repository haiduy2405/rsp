#!/usr/bin/env python3
"""Cắt/chuyển SFX CC0 (adbertiser-sfx) thành mp3 mono trong www/assets/audio và sinh data/audio.json#samples.
Dùng: python3 tools/build-audio.py /đường/dẫn/adbertiser-sfx/sounds"""
import json, subprocess, sys, os
src = sys.argv[1] if len(sys.argv) > 1 else '/tmp/snd/adbertiser-sfx/sounds'
out = 'www/assets/audio'
# tên: (file, độ dài tối đa s, gain, rate)
M = {
 'pick': ('ui/tap_1', .25, .8, 1),
 'move': ('ding/bell_small_1', .3, .5, 1),
 'move2': ('ding/bell_small_1', .3, .5, 1.122),
 'move3': ('ding/bell_small_1', .3, .5, 1.26),
 'drop': ('pop/pop_soft_2', .3, .7, 1),
 'match': ('pop/pop_2', .35, .8, 1),
 'preview': ('magic/shimmer_1', 1.0, .7, 1),
 'combo': ('ding/chime_up_1', .8, .8, 1),
 'hit': ('impact/punch_1', .5, .9, 1),
 'hurt': ('impact/thud_1', .6, .9, 1),
 'heal': ('magic/twinkle', 1.0, .7, 1),
 'skill': ('magic/magic_wand_1', 1.2, .8, 1),
 'kill': ('impact/impact_1', .8, .9, 1),
 'finale': ('impact/boom_1', 1.5, 1, 1),
 'whoosh': ('whoosh/whoosh_fast_1', .6, .7, 1),
 'fanfare': ('stinger/tada', 3.0, .9, 1),
 'win': ('stinger/success_jingle_1', 3.0, .9, 1),
 'lose': ('stinger/fail_jingle', 2.5, .8, 1),
 'ui': ('ui/click_soft_1', .2, .7, 1),
 'back': ('ui/ui_back', .3, .7, 1),
 'summon': ('magic/reveal_glow_1', 2.0, .8, 1),
 'rare': ('ding/level_up_1', 1.8, .9, 1),
 'reveal': ('magic/sparkle_1', 1.0, .7, 1),
 'coin': ('money/coin_1', .6, .8, 1),
 'coin2': ('money/coin_2', .6, .8, 1),
 'chestShake': ('impact/thud_2', .5, .9, 1.3),
 'chestOpen': ('stinger/reveal_stinger', 2.0, .9, 1),
}
samples = {}
tot = 0
for k, (f, d, g, r) in M.items():
    o = f'{out}/{k}.mp3'
    subprocess.run(['ffmpeg','-y','-v','error','-i',f'{src}/{f}.wav','-t',str(d),'-ac','1','-af',f'afade=t=out:st={max(0,d-.05)}:d=0.05,loudnorm=I=-18:TP=-2','-ar','44100','-b:a','56k',o],check=True)
    tot += os.path.getsize(o)
    samples[k] = {'url': f'assets/audio/{k}.mp3', 'gain': g, 'rate': r}
p = 'www/js/data/audio.json'
j = json.load(open(p)); j['samples'] = samples
json.dump(j, open(p,'w'), ensure_ascii=False, indent=1)
print(len(M), 'file', tot//1024, 'KB')
