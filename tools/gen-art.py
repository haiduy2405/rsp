#!/usr/bin/env python3
"""Sinh art tạm thời (vector -> webp) cho toàn bộ asset trong manifest. Tất định, không cần mạng.
Dùng: python3 tools/gen-art.py   (cần rsvg-convert + Pillow). SVG gốc lưu ở art-src/.
Muốn thay art: ghi đè file webp cùng tên trong www/assets/ rồi chạy node tools/check-assets.js --write."""
import json, os, subprocess, io, math
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(ROOT, 'www', 'assets')
S = os.path.join(ROOT, 'art-src')
for d in ('characters', 'orbs', 'bg', 'ui'):
    os.makedirs(os.path.join(A, d), exist_ok=True)
    os.makedirs(os.path.join(S, d), exist_ok=True)

EL = [  # (màu chính, tối, sáng, tên)
    ('#3b9cff', '#0d2a5c', '#a9d8ff'), ('#ff5a3c', '#5a1408', '#ffc3a8'), ('#4cc46a', '#0f3a1c', '#b8f0c4'),
    ('#ffd84a', '#5a4306', '#fff2b0'), ('#9a5cff', '#240d52', '#d8c0ff'), ('#ff7fb0', '#5a1236', '#ffd0e4')]

def render(svg, path_svg, path_webp, w, h, quality=82):
    open(path_svg, 'w', encoding='utf8').write(svg)
    png = subprocess.run(['rsvg-convert', '-w', str(w), '-h', str(h), path_svg], capture_output=True, check=True).stdout
    im = Image.open(io.BytesIO(png)).convert('RGBA')
    im.save(path_webp, 'WEBP', quality=quality, method=6)

# ---------- ngọc ----------
def orb_svg(e):
    c, dk, lt = EL[e]
    shapes = {
        0: '<path d="M128 22 C170 80 214 112 214 160 A86 86 0 0 1 42 160 C42 112 86 80 128 22Z"',
        1: '<path d="M128 18 C150 70 214 96 200 178 C192 222 160 238 128 238 C96 238 64 222 56 178 C48 130 96 108 104 70 C116 90 124 70 128 18Z"',
        2: '<rect x="36" y="36" width="184" height="184" rx="46"',
        3: '<path d="M128 14 L226 128 L128 242 L30 128Z"',
        4: '<path d="M128 16 L214 66 L214 190 L128 240 L42 190 L42 66Z"',
        5: '<path d="M128 232 C40 170 22 112 56 70 C88 36 120 56 128 86 C136 56 168 36 200 70 C234 112 216 170 128 232Z"',
    }
    inner = {
        0: '<path d="M128 70 C146 100 168 118 168 146 A40 40 0 0 1 88 146 C88 118 110 100 128 70Z" fill="%s" opacity=".35"/>' % lt,
        1: '<path d="M128 90 C140 120 168 130 160 170 C156 196 140 204 128 204 C116 204 100 196 96 170 C92 146 120 136 128 90Z" fill="%s" opacity=".5"/>' % lt,
        2: '<path d="M128 56 C170 80 190 130 128 200 C66 130 86 80 128 56Z M128 80 L128 190" fill="%s" opacity=".45" stroke="%s" stroke-width="5"/>' % (lt, dk),
        3: '<path d="M128 56 L176 128 L128 200 L80 128Z" fill="%s" opacity=".5"/>' % lt,
        4: '<circle cx="128" cy="128" r="50" fill="%s" opacity=".6"/><path d="M128 78 A50 50 0 0 1 128 178 A25 25 0 0 1 128 128 A25 25 0 0 0 128 78Z" fill="%s" opacity=".7"/>' % (dk, lt),
        5: '<path d="M128 190 C84 150 76 118 96 100 C112 86 124 98 128 112 C132 98 144 86 160 100 C180 118 172 150 128 190Z" fill="%s" opacity=".5"/>' % lt,
    }
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><defs>
<radialGradient id="g" cx="38%" cy="32%" r="80%"><stop offset="0" stop-color="{lt}"/><stop offset=".45" stop-color="{c}"/><stop offset="1" stop-color="{dk}"/></radialGradient></defs>
{shapes[e]} fill="url(#g)" stroke="#ffffff" stroke-width="7" stroke-linejoin="round"/>
{inner[e]}
<ellipse cx="96" cy="84" rx="26" ry="14" fill="#fff" opacity=".55" transform="rotate(-30 96 84)"/></svg>'''

for e in range(6):
    render(orb_svg(e), f'{S}/orbs/orb{e}.svg', f'{A}/orbs/orb{e}.webp', 256, 256)

# ---------- nhân vật ----------
# skin, hair, hairStyle, eye, outfit, outfit2, acc, prop, mood
C = {
 'thuy_tinh':   ('#e2b896','#2f7fd0','long','#2fd0c0','#1c4f8f','#cfe9ff','crown_coral','trident','stern'),
 'ran':         ('#d9b08c','#1a2a40','braid','#e8d060','#1f6fb5','#9bd0ff','scales','none','smirk'),
 'thetis':      ('#f0d0b4','#e8eef8','bun','#8fd0ff','#e8f0ff','#6fa8e8','shell','shield','calm'),
 'coc_kien_troi':('#9bc47a','#9bc47a','bald','#ffd84a','#6b8a3a','#3b6fb0','nonla_frog','drum','happy'),
 'thanh_giong': ('#e0b48e','#1a1410','pony','#2a1a10','#b83a22','#ffcf6b','headband','sword','fierce'),
 'hephaestus':  ('#c99068','#2a1a14','wild','#c86a2a','#5a3a2a','#ff8a3c','goggles','hammer','stern'),
 'surtr':       ('#a8452a','#ff7a2a','flame','#fff0c0','#3a2420','#ff5a1c','horns','sword','fierce'),
 'bennu':       ('#f0c8a0','#ff9a2a','crest','#ffd84a','#c8402a','#ffd84a','wings_fire','none','happy'),
 'son_tinh':    ('#b88a64','#4a3a24','wild','#6fa84a','#4a6a2a','#8a8a78','moss','staff','calm'),
 'mai_an_tiem': ('#d9a074','#2a2018','bun','#3a2a18','#7a5a3a','#d8d0b8','nonla','melon','happy'),
 'artemis':     ('#f0d0b0','#8a5a32','braid','#9ad0a0','#3f7a4a','#d8e8d0','halfmask','bow','calm'),
 'atalanta':    ('#d9a880','#b87a3a','short','#e8b030','#4cb060','#f0e8c0','headband_leaf','apple','happy'),
 'apollo':      ('#f4d4b4','#f0cc50','wavy','#ffc830','#f8f4e8','#ffd84a','laurel','lyre','happy'),
 'ra':          ('#c8905a','#d8a020','bald','#1a1a1a','#e8c040','#c8302a','sundisc_beak','staff','stern'),
 'eos':         ('#f8d8c0','#ff9a8a','long','#ffb060','#ffc8b0','#ffe8a0','sparkle','none','dreamy'),
 'heimdall':    ('#e8c8a8','#e8e8f0','short','#ffd84a','#e8e0c8','#d8a830','helm_wing','horn','stern'),
 'hel':         ('#c8d0d8','#1a1a28','long','#c8a0ff','#2a1a48','#6a4a9a','half_skull','none','sad'),
 'loki':        ('#ecc8a4','#16161c','sleek','#7ad870','#4a2a7a','#3fa05a','mask_smile','dagger','smirk'),
 'nyx':         ('#c8b8e0','#1a1442','long','#b090ff','#1a1650','#6a58c8','stars','none','calm'),
 'fenrir':      ('#b09a88','#8a8a98','wild','#e8c850','#4a4048','#8a7a70','ears_wolf','chain','fierce'),
 'co_tam':      ('#f4d4b8','#161214','long','#2a1a18','#f0a0b8','#fff0e8','lotus_pin','lotus','sad'),
 'freyja':      ('#f0cca8','#d89a40','braid','#d8901a','#e07a98','#e8b840','rose_crown','sword','smirk'),
 'eir':         ('#f0d0b4','#b8844c','braidring','#6aa890','#e8a8b8','#f0f4e8','scarf','flask','calm'),
 'orpheus':     ('#f0d0b0','#6a4a30','wavy','#5a4a38','#c89aa8','#e8d0a0','laurel_dry','lyre','sad'),
}

def hair_back(style, hc):
    if style in ('long','braid','braidring'):
        return f'<path d="M300 560 C260 900 280 1180 330 1260 L700 1260 C750 1180 770 900 724 560Z" fill="{hc}"/>'
    if style == 'wavy':
        return f'<path d="M310 580 C270 800 300 940 340 980 L690 980 C730 940 760 800 714 580Z" fill="{hc}"/>'
    if style == 'pony':
        return f'<path d="M640 470 C800 480 860 640 800 860 C780 760 740 640 690 600Z" fill="{hc}"/>'
    if style == 'flame':
        return f'<path d="M300 600 L250 360 L360 470 L420 250 L500 430 L560 230 L620 440 L720 320 L724 600Z" fill="{hc}"/>'
    if style == 'crest':
        return f'<path d="M330 560 L240 300 L400 440 L470 220 L540 440 L650 240 L700 450 L790 330 L700 600Z" fill="{hc}"/>'
    return ''

def hair_front(style, hc):
    top = f'<path d="M352 560 C340 360 440 320 512 320 C600 320 690 370 672 560 C640 480 580 440 512 440 C440 440 384 480 352 560Z" fill="{hc}"/>'
    if style in ('long','braid','braidring','wavy'):
        return f'<path d="M352 600 C330 420 430 330 512 330 C600 330 700 420 672 600 C650 500 580 430 512 430 C440 430 374 500 352 600Z" fill="{hc}"/>'
    if style == 'short': return top
    if style == 'sleek': return f'<path d="M352 580 C340 380 440 320 512 320 C610 320 690 380 672 580 C640 470 560 420 460 440 C420 450 380 500 352 580Z" fill="{hc}"/>'
    if style == 'bun': return top + f'<circle cx="512" cy="300" r="62" fill="{hc}"/>'
    if style == 'pony': return top
    if style == 'wild': return f'<path d="M340 580 L320 400 L400 430 L410 320 L480 390 L520 290 L570 390 L640 320 L650 430 L710 400 L684 580 C650 480 580 440 512 440 C440 440 374 480 340 580Z" fill="{hc}"/>'
    if style in ('flame','crest'): return f'<path d="M352 570 C360 440 440 400 512 400 C590 400 664 440 672 570 C640 490 580 460 512 460 C444 460 384 490 352 570Z" fill="{hc}"/>'
    return ''  # bald

def acc_svg(a, el, pal):
    c, dk, lt = pal
    o = ''
    if a.startswith('crown_coral'):
        o += f'<path d="M380 340 L400 250 L450 320 L512 220 L574 320 L624 250 L644 340Z" fill="#ff8a7a" stroke="#7a2a2a" stroke-width="8"/><circle cx="512" cy="262" r="16" fill="#fff" />'
    if a == 'scales':
        for i in range(6): o += f'<path d="M{420+i*34} 420 q17 24 34 0" fill="none" stroke="{c}" stroke-width="6"/>'
    if a == 'shell':
        o += f'<path d="M512 250 C440 250 410 310 420 350 L604 350 C614 310 584 250 512 250Z" fill="#ffe8e0" stroke="#d89a8a" stroke-width="8"/><path d="M512 250 L512 350 M470 262 L480 350 M554 262 L544 350" stroke="#d89a8a" stroke-width="6"/>'
    if a.startswith('nonla'):
        o += f'<path d="M290 440 L512 150 L734 440 C640 410 384 410 290 440Z" fill="#e8d4a0" stroke="#8a6a30" stroke-width="10"/><path d="M512 150 L400 420 M512 150 L624 420 M512 150 L512 420" stroke="#b8985a" stroke-width="5"/>'
    if a == 'nonla_frog':
        o += f'<circle cx="420" cy="470" r="44" fill="#9bc47a" stroke="#3b5a22" stroke-width="8"/><circle cx="604" cy="470" r="44" fill="#9bc47a" stroke="#3b5a22" stroke-width="8"/>'
    if a == 'headband':
        o += f'<path d="M352 480 C420 440 604 440 672 480 L672 520 C604 484 420 484 352 520Z" fill="#ffcf6b" stroke="#7a4a10" stroke-width="8"/>'
    if a == 'headband_leaf':
        o += f'<path d="M352 490 C420 456 604 456 672 490 L672 520 C604 490 420 490 352 520Z" fill="#4cb060"/><path d="M640 470 q50 -50 90 -20 q-40 50 -90 20Z" fill="#6fd080" stroke="#2a6a38" stroke-width="5"/>'
    if a == 'goggles':
        o += f'<rect x="372" y="440" width="280" height="60" rx="26" fill="#8a5a2a" stroke="#2a1a10" stroke-width="8"/><circle cx="440" cy="470" r="26" fill="#ffd8a0"/><circle cx="584" cy="470" r="26" fill="#ffd8a0"/>'
    if a == 'horns':
        o += f'<path d="M370 420 C320 360 330 270 380 230 C380 300 410 340 430 380Z M654 420 C704 360 694 270 644 230 C644 300 614 340 594 380Z" fill="#2a1a18" stroke="#ff7a2a" stroke-width="7"/>'
    if a == 'wings_fire':
        o += f'<path d="M300 900 C150 800 110 600 160 460 C220 580 280 640 340 720Z M724 900 C874 800 914 600 864 460 C804 580 744 640 684 720Z" fill="#ff7a2a" opacity=".85" stroke="#ffd84a" stroke-width="8"/>'
    if a == 'moss':
        o += f'<circle cx="400" cy="400" r="26" fill="#6fd080"/><circle cx="640" cy="380" r="20" fill="#4cb060"/><circle cx="440" cy="360" r="16" fill="#9be8a0"/>'
    if a == 'halfmask':
        o += f'<path d="M512 560 L512 740 C440 740 372 700 372 640 C372 580 440 560 512 560Z" fill="#e8e0d0" stroke="#7a6a50" stroke-width="7"/>'
    if a == 'laurel' or a == 'laurel_dry':
        col = '#8ac060' if a == 'laurel' else '#a89868'
        for i in range(7):
            o += f'<ellipse cx="{360+i*10}" cy="{520-i*22}" rx="22" ry="10" fill="{col}" transform="rotate({-50+i*8} {360+i*10} {520-i*22})"/><ellipse cx="{664-i*10}" cy="{520-i*22}" rx="22" ry="10" fill="{col}" transform="rotate({50-i*8} {664-i*10} {520-i*22})"/>'
    if a == 'sundisc_beak':
        o += f'<circle cx="512" cy="250" r="110" fill="#e8302a" stroke="#ffd84a" stroke-width="14"/><circle cx="512" cy="250" r="64" fill="#ffd84a"/><path d="M470 640 L512 720 L554 640Z" fill="#ffd84a" stroke="#7a5a10" stroke-width="6"/>'
    if a == 'sparkle':
        for (x,y,s) in ((380,330,26),(650,300,34),(540,230,22)):
            o += f'<path d="M{x} {y-s} L{x+s*0.3} {y-s*0.3} L{x+s} {y} L{x+s*0.3} {y+s*0.3} L{x} {y+s} L{x-s*0.3} {y+s*0.3} L{x-s} {y} L{x-s*0.3} {y-s*0.3}Z" fill="#fff2b0"/>'
    if a == 'helm_wing':
        o += f'<path d="M352 520 C352 400 440 340 512 340 C584 340 672 400 672 520 L640 500 C600 440 424 440 384 500Z" fill="#c8c0a8" stroke="#6a6048" stroke-width="8"/><path d="M352 470 C280 450 250 380 270 320 C300 380 340 400 372 410Z M672 470 C744 450 774 380 754 320 C724 380 684 400 652 410Z" fill="#f0f0f4" stroke="#6a6048" stroke-width="6"/>'
    if a == 'half_skull':
        o += f'<path d="M512 560 L512 760 C450 760 380 720 380 650 C380 590 440 560 512 560Z" fill="#d8dce0" opacity=".9"/><circle cx="450" cy="640" r="24" fill="#1a1a28"/><path d="M430 730 L430 700 M470 740 L470 700 M512 744 L512 704" stroke="#1a1a28" stroke-width="7"/>'
    if a == 'mask_smile':
        o += f'<path d="M360 560 C360 500 440 500 512 520 C584 500 664 500 664 560 C664 600 600 610 512 590 C424 610 360 600 360 560Z" fill="#f0e8d8" stroke="#2a1a3a" stroke-width="8" opacity=".95"/>'
    if a == 'stars':
        for (x,y) in ((400,380),(560,350),(640,430),(460,460),(520,300),(350,500)):
            o += f'<circle cx="{x}" cy="{y}" r="7" fill="#fff"/>'
        o += '<path d="M690 330 A70 70 0 1 0 690 470 A56 56 0 1 1 690 330Z" fill="#e8e0ff"/>'
    if a == 'ears_wolf':
        o += f'<path d="M340 470 L330 320 L450 410Z M684 470 L694 320 L574 410Z" fill="#8a8a98" stroke="#3a3a48" stroke-width="8"/>'
    if a == 'lotus_pin':
        o += f'<path d="M640 420 q20 -80 60 -80 q10 50 -60 80Z M640 420 q-10 -70 -60 -70 q-10 50 60 70Z M640 420 q40 -20 80 10 q-30 40 -80 -10Z" fill="#ffb8d0" stroke="#c0507a" stroke-width="5"/>'
    if a == 'rose_crown':
        for i in range(5): o += f'<circle cx="{392+i*60}" cy="{420-abs(2-i)*-14-30}" r="24" fill="#ff6a88" stroke="#8a1a3a" stroke-width="5"/>'
    if a == 'scarf':
        o += f'<path d="M352 560 C400 620 480 620 512 600 C560 620 640 620 672 560 L672 600 C620 660 400 660 352 600Z" fill="#6aa890"/>'
    return o

def prop_svg(p, pal):
    c, dk, lt = pal
    if p == 'trident': return '<g stroke="#2a1a10" stroke-width="8"><path d="M860 1536 L860 760" stroke="#cfe9ff" stroke-width="18"/><path d="M800 800 L800 720 M860 800 L860 700 M920 800 L920 720 M800 800 C800 830 920 830 920 800" fill="none" stroke="#cfe9ff" stroke-width="16"/></g>'
    if p == 'shield': return f'<circle cx="170" cy="1200" r="140" fill="{c}" stroke="#e8f0ff" stroke-width="16"/><path d="M60 1200 q55 -50 110 0 t110 0" fill="none" stroke="#e8f0ff" stroke-width="12"/>'
    if p == 'drum': return '<ellipse cx="180" cy="1230" rx="110" ry="40" fill="#e8d4a0" stroke="#6a4a20" stroke-width="10"/><path d="M70 1230 V1330 C70 1370 290 1370 290 1330 V1230" fill="#b8884a" stroke="#6a4a20" stroke-width="10"/>'
    if p == 'sword': return '<g stroke="#2a1a10" stroke-width="8"><path d="M860 1536 L860 760" stroke="#e8e8f0" stroke-width="26"/><rect x="810" y="1180" width="100" height="22" fill="#d8a830"/></g>'
    if p == 'hammer': return '<g stroke="#2a1a10" stroke-width="8"><path d="M860 1536 L860 880" stroke="#8a5a3a" stroke-width="24"/><rect x="780" y="780" width="160" height="110" rx="14" fill="#7a7a88"/></g>'
    if p == 'staff': return '<g stroke="#2a1a10" stroke-width="6"><path d="M860 1536 L860 700" stroke="#8a6a3a" stroke-width="20"/><circle cx="860" cy="680" r="42" fill="#ffd84a" stroke="#7a5a10"/></g>'
    if p == 'melon': return '<ellipse cx="190" cy="1180" rx="140" ry="110" fill="#4cb060" stroke="#1a5a28" stroke-width="10"/><path d="M110 1130 L270 1230" stroke="#2a8a40" stroke-width="12"/><path d="M130 1180 h120 v60 h-120Z" fill="#e83a3a" opacity="0"/><path d="M120 1180 C150 1260 240 1260 270 1180Z" fill="#e8403a"/>'
    if p == 'bow': return '<path d="M860 760 C1020 1000 1020 1260 860 1500" fill="none" stroke="#6a4a2a" stroke-width="16"/><path d="M860 760 L860 1500" stroke="#f0e8d0" stroke-width="4"/>'
    if p == 'apple': return '<circle cx="190" cy="1190" r="90" fill="#ffd84a" stroke="#a87a10" stroke-width="10"/><path d="M190 1100 q-10 -40 30 -50" fill="none" stroke="#4a6a2a" stroke-width="10"/>'
    if p == 'lyre': return '<g stroke="#7a5a10" stroke-width="12" fill="none"><path d="M120 1160 C100 1360 260 1420 300 1260 C320 1180 260 1130 230 1160"/><path d="M160 1200 V1400 M200 1190 V1400 M240 1190 V1400" stroke="#ffd84a" stroke-width="6"/></g>'
    if p == 'horn': return '<path d="M120 1160 C140 1300 260 1380 340 1300 C260 1330 190 1260 190 1160Z" fill="#e8e0c8" stroke="#7a6a40" stroke-width="10"/>'
    if p == 'dagger': return '<g stroke="#2a1a3a" stroke-width="7"><path d="M860 1400 L860 1000 L890 1000 Z" fill="#cfd8e8"/><rect x="830" y="1400" width="80" height="18" fill="#3fa05a"/></g>'
    if p == 'chain': return '<g fill="none" stroke="#b8b8c8" stroke-width="12">' + ''.join(f'<ellipse cx="{140+i*50}" cy="{1250+(i%2)*26}" rx="30" ry="18"/>' for i in range(5)) + '</g>'
    if p == 'lotus': return '<path d="M190 1290 q-60 -60 -30 -150 q50 40 30 150Z M190 1290 q60 -60 30 -150 q-50 40 -30 150Z M190 1290 q0 -100 0 -170 q70 70 0 170Z" fill="#ffb8d0" stroke="#c0507a" stroke-width="7"/><ellipse cx="190" cy="1300" rx="130" ry="26" fill="#4cb060"/>'
    if p == 'flask': return '<path d="M150 1130 h80 v80 L290 1330 C300 1360 280 1380 250 1380 H130 C100 1380 80 1360 90 1330 L150 1210Z" fill="#cfe8f0" stroke="#4a7a8a" stroke-width="10"/><path d="M110 1320 h160 l20 40 H90Z" fill="#6aa890"/>'
    return ''

def eyes_mouth(eye, mood):
    ey = 640
    sh = {'stern':-6,'fierce':-14,'smirk':-2,'calm':0,'happy':6,'sad':8,'dreamy':4}[mood]
    o = ''
    for cx, sign in ((440,-1),(584,1)):
        o += f'<ellipse cx="{cx}" cy="{ey}" rx="34" ry="{26 if mood!="dreamy" else 18}" fill="#fff" stroke="#1a1018" stroke-width="5"/><circle cx="{cx}" cy="{ey+2}" r="19" fill="{eye}"/><circle cx="{cx}" cy="{ey+2}" r="9" fill="#1a1018"/><circle cx="{cx+7}" cy="{ey-6}" r="6" fill="#fff"/>'
        o += f'<path d="M{cx-44} {ey-34-sh*sign*-1} L{cx+44} {ey-34+sh*sign*-1}" stroke="#1a1018" stroke-width="9" stroke-linecap="round"/>' if False else f'<path d="M{cx-46} {ey-36+sh*(1 if sign<0 else -1)} Q{cx} {ey-52} {cx+46} {ey-36+sh*(-1 if sign<0 else 1)}" fill="none" stroke="#1a1018" stroke-width="9" stroke-linecap="round"/>'
    m = {'stern':'M470 770 L554 770','fierce':'M466 780 Q512 760 558 780','smirk':'M470 770 Q520 790 560 758','calm':'M474 770 Q512 784 550 770','happy':'M456 758 Q512 818 568 758','sad':'M472 786 Q512 762 552 786','dreamy':'M480 772 Q512 790 544 772'}[mood]
    o += f'<path d="{m}" fill="none" stroke="#7a2a2a" stroke-width="8" stroke-linecap="round"/><path d="M512 690 q-8 28 6 34" fill="none" stroke="#00000033" stroke-width="6" stroke-linecap="round"/>'
    return o

def card_svg(cid, el, rar, c):
    pal = EL[el]
    skin, hair, hs, eye, out, out2, acc, prop, mood = c
    lc, dk, lt = pal
    star = ''
    bgmotif = {0:'<path d="M0 1100 q128 -60 256 0 t256 0 t256 0 t256 0 V1536 H0Z" fill="#ffffff" opacity=".07"/><path d="M0 1250 q128 -60 256 0 t256 0 t256 0 t256 0 V1536 H0Z" fill="#ffffff" opacity=".07"/>',
               1:'<path d="M100 1536 C140 1300 60 1200 140 1000 C200 1180 260 1200 220 1536Z M700 1536 C760 1300 680 1150 780 960 C860 1160 940 1300 880 1536Z" fill="#ffd84a" opacity=".12"/>',
               2:'<path d="M80 1536 C60 1300 120 1100 300 1000 C240 1200 260 1400 200 1536Z M840 1536 C900 1250 820 1100 700 1000 C760 1200 740 1400 800 1536Z" fill="#ffffff" opacity=".09"/>',
               3:''.join(f'<path d="M512 560 L{512+math.cos(a)*1400:.0f} {560+math.sin(a)*1400:.0f} L{512+math.cos(a+0.12)*1400:.0f} {560+math.sin(a+0.12)*1400:.0f}Z" fill="#fff" opacity=".10"/>' for a in [i*math.pi/6 for i in range(12)]),
               4:''.join(f'<circle cx="{(i*337)%1024}" cy="{(i*211)%900+80}" r="{3+i%4}" fill="#fff" opacity=".5"/>' for i in range(40)),
               5:''.join(f'<path d="M{x} {y+24} C{x-40} {y-8} {x-26} {y-34} {x} {y-14} C{x+26} {y-34} {x+40} {y-8} {x} {y+24}Z" fill="#fff" opacity=".12"/>' for x,y in ((120,300),(900,420),(180,1100),(860,1000),(500,150)))}[el]
    if rar >= 4:
        bgmotif += f'<circle cx="512" cy="640" r="330" fill="none" stroke="{lt}" stroke-width="{10 if rar==4 else 16}" opacity=".5"/>'
    if rar == 5:
        bgmotif += f'<circle cx="512" cy="640" r="400" fill="none" stroke="#ffd84a" stroke-width="6" opacity=".6"/>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1536"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{lc}"/><stop offset=".5" stop-color="{dk}"/><stop offset="1" stop-color="#0b0d1a"/></linearGradient>
<radialGradient id="gl" cx="50%" cy="42%" r="50%"><stop offset="0" stop-color="{lt}" stop-opacity=".75"/><stop offset="1" stop-color="{lt}" stop-opacity="0"/></radialGradient></defs>
<rect width="1024" height="1536" fill="url(#bg)"/><rect width="1024" height="1536" fill="url(#gl)"/>{bgmotif}
<g stroke="#1a1018" stroke-width="8" stroke-linejoin="round">
{prop_svg(prop, pal) if prop in ('trident','sword','hammer','staff','bow','dagger') else ''}
{hair_back(hs, hair)}
<path d="M120 1536 C130 1180 300 960 512 940 C724 960 894 1180 904 1536Z" fill="{out}"/>
<path d="M400 960 L512 1100 L624 960 C600 1000 424 1000 400 960Z" fill="{out2}"/>
<path d="M120 1536 C130 1280 190 1120 290 1030 C260 1180 260 1380 300 1536Z" fill="#00000030" stroke="none"/>
<path d="M300 1250 q212 90 424 0" fill="none" stroke="{out2}" stroke-width="14" opacity=".8"/>
<rect x="452" y="820" width="120" height="150" rx="40" fill="{skin}"/>
<ellipse cx="512" cy="640" rx="164" ry="196" fill="{skin}"/>
<path d="M512 444 C640 444 676 560 676 650 C676 760 600 836 512 836 C560 760 600 640 512 444Z" fill="#00000026" stroke="none"/>
{acc_svg(acc, el, pal) if acc in ('goggles','halfmask','mask_smile','half_skull') else ''}
{hair_front(hs, hair)}
{eyes_mouth(eye, mood)}
{acc_svg(acc, el, pal) if acc not in ('goggles','halfmask','mask_smile','half_skull') else ''}
{prop_svg(prop, pal) if prop not in ('trident','sword','hammer','staff','bow','dagger','none') else ''}
</g></svg>'''

chars = json.load(open(os.path.join(ROOT, 'www/js/data/characters.json'), encoding='utf8'))
for ch in chars:
    cid = ch['id']
    if ch.get('reserve'): continue
    svg = card_svg(cid, ch['element'], ch['rarity'], C[cid])
    render(svg, f'{S}/characters/{cid}_card.svg', f'{A}/characters/{cid}_card.webp', 1024, 1536, 80)
    # icon: cắt khuôn mặt
    icon = svg.replace('viewBox="0 0 1024 1536"', 'viewBox="212 250 600 600"')
    render(icon, f'{S}/characters/{cid}_icon.svg', f'{A}/characters/{cid}_icon.webp', 512, 512, 80)

# ---------- nền ----------
def stars(n, w, h, seed=7):
    o = ''
    s = seed
    for _ in range(n):
        s = (s * 1103515245 + 12345) & 0x7fffffff; x = s % w
        s = (s * 1103515245 + 12345) & 0x7fffffff; y = s % h
        s = (s * 1103515245 + 12345) & 0x7fffffff; r = 1 + s % 3
        o += f'<circle cx="{x}" cy="{y}" r="{r}" fill="#fff" opacity="{0.3+r*0.15:.2f}"/>'
    return o
hub = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><defs>
<linearGradient id="sp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05061a"/><stop offset="1" stop-color="#0d1a3a"/></linearGradient>
<radialGradient id="earth" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#6fc0ff"/><stop offset=".6" stop-color="#1c5fb0"/><stop offset="1" stop-color="#0a2250"/></radialGradient>
<radialGradient id="rim" cx="50%" cy="0%" r="50%"><stop offset="0" stop-color="#9be0ff" stop-opacity=".9"/><stop offset="1" stop-color="#9be0ff" stop-opacity="0"/></radialGradient></defs>
<rect width="1080" height="1920" fill="url(#sp)"/>{stars(120,1080,1500)}
<ellipse cx="540" cy="1750" rx="1100" ry="520" fill="url(#earth)"/><ellipse cx="540" cy="1260" rx="900" ry="140" fill="url(#rim)"/>
<path d="M300 1500 q80 -40 160 0 t200 -20" fill="none" stroke="#fff" stroke-width="14" opacity=".35"/>
<g fill="#15183a" stroke="#3a3f78" stroke-width="10"><path d="M0 0 H1080 V1920 H0Z M540 140 C300 140 120 380 120 800 V1500 H960 V800 C960 380 780 140 540 140Z" fill-rule="evenodd"/></g>
<g stroke="#3a3f78" stroke-width="8" fill="none"><path d="M540 140 V1500 M330 190 L330 1500 M750 190 L750 1500 M120 800 H960"/></g></svg>'''
render(hub, f'{S}/bg/hub.svg', f'{A}/bg/hub.webp', 1080, 1920, 78)
battle = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><defs>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0f55"/><stop offset=".3" stop-color="#16123a"/><stop offset="1" stop-color="#0a0b1e"/></linearGradient>
<radialGradient id="rift" cx="50%" cy="22%" r="42%"><stop offset="0" stop-color="#e8c0ff" stop-opacity=".9"/><stop offset=".4" stop-color="#9a5cff" stop-opacity=".5"/><stop offset="1" stop-color="#9a5cff" stop-opacity="0"/></radialGradient></defs>
<rect width="1080" height="1920" fill="url(#b)"/><rect width="1080" height="1920" fill="url(#rift)"/>{stars(80,1080,800,11)}
<path d="M500 620 L540 260 L580 620Z M440 700 L540 200 L640 700Z" fill="#05061a" opacity=".55"/>
<path d="M0 760 L180 640 L330 740 L520 600 L720 730 L900 630 L1080 740 V920 H0Z" fill="#0d0f2a" opacity=".85"/>
<rect y="920" width="1080" height="1000" fill="#0a0b1e" opacity=".55"/></svg>'''
render(battle, f'{S}/bg/battle.svg', f'{A}/bg/battle.webp', 1080, 1920, 78)
logo = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 512"><defs>
<linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset="1" stop-color="#ff9a4a"/></linearGradient>
<radialGradient id="r" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#c8a0ff" stop-opacity=".8"/><stop offset="1" stop-color="#c8a0ff" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="512" cy="256" rx="480" ry="200" fill="url(#r)"/>
<path d="M512 40 L560 150 L512 130 L464 150Z" fill="#e8c0ff" stroke="#fff" stroke-width="6"/>
<text x="512" y="270" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-weight="800" font-size="104" fill="url(#t)" stroke="#2a1050" stroke-width="10" paint-order="stroke">Thiên Tháp</text>
<text x="512" y="390" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-weight="800" font-size="104" fill="url(#t)" stroke="#2a1050" stroke-width="10" paint-order="stroke">Dị Điểm</text>
<text x="512" y="460" text-anchor="middle" font-family="DejaVu Sans, sans-serif" font-size="40" fill="#d8c8ff" letter-spacing="8">RIFT SPIRE: PANTHEON</text></svg>'''
render(logo, f'{S}/ui/logo.svg', f'{A}/ui/logo.webp', 1024, 512, 85)
print('xong')

# ---------- quái ----------
os.makedirs(os.path.join(A, 'monsters'), exist_ok=True)
os.makedirs(os.path.join(S, 'monsters'), exist_ok=True)

def eyes(x, y, gap=44, r=16, col='#fff', pupil='#1a1018', angry=False):
    o = ''
    for sx in (-1, 1):
        o += f'<circle cx="{x+sx*gap/2}" cy="{y}" r="{r}" fill="{col}" stroke="#1a1018" stroke-width="5"/><circle cx="{x+sx*gap/2+sx*2}" cy="{y+2}" r="{r*0.5}" fill="{pupil}"/>'
        if angry: o += f'<path d="M{x+sx*gap/2-sx*r-6} {y-r-6+(0 if sx<0 else 0)} L{x+sx*gap/2+sx*r+6} {y-r+4*(-sx)}" stroke="#1a1018" stroke-width="8" stroke-linecap="round"/>'
    return o

def mon(kind, e, big):
    c, dk, lt = EL[e]
    st = f'stroke="#1a1018" stroke-width="9" stroke-linejoin="round"'
    if kind == 'jelly':
        t = ''.join(f'<path d="M{190+i*44} 300 q-14 50 6 90 q14 30 -4 60" fill="none" stroke="{lt}" stroke-width="16" stroke-linecap="round"/>' for i in range(4))
        return t + f'<path d="M140 300 C120 120 392 120 372 300Z" fill="{c}" {st}/><ellipse cx="256" cy="200" rx="70" ry="30" fill="{lt}" opacity=".35"/>' + eyes(256, 270, 70, 20)
    if kind == 'crab':
        return f'<path d="M110 300 q-70 -80 10 -130 q30 40 20 90Z M402 300 q70 -80 -10 -130 q-30 40 -20 90Z" fill="{lt}" {st}/><ellipse cx="256" cy="320" rx="150" ry="100" fill="{c}" {st}/>' + ''.join(f'<path d="M{130+i*40} 400 l-20 50" stroke="#1a1018" stroke-width="10"/><path d="M{382-i*40} 400 l20 50" stroke="#1a1018" stroke-width="10"/>' for i in range(2)) + eyes(256, 290, 90, 20, angry=True)
    if kind == 'leviathan':
        return f'<path d="M40 280 C120 120 380 120 470 260 C380 400 120 420 40 280Z" fill="{c}" {st}/><path d="M440 260 L500 190 L490 330Z" fill="{dk}" {st}/><path d="M200 140 L250 60 L300 150Z" fill="{dk}" {st}/><path d="M60 300 q100 50 200 20" fill="none" stroke="#fff" stroke-width="8"/>' + ''.join(f'<path d="M{90+i*22} 292 l8 -22 l8 22Z" fill="#fff"/>' for i in range(6)) + eyes(170, 230, 40, 18, angry=True)
    if kind == 'serpent':
        return f'<path d="M90 420 C20 300 220 330 200 250 C180 170 360 200 340 130 C330 90 420 80 420 140 C420 200 300 230 320 280 C340 340 150 350 170 420Z" fill="{c}" {st}/><path d="M340 110 l40 -50 l30 60Z" fill="{lt}" {st}/>' + eyes(380, 126, 36, 12, col='#ffe066', angry=True) + f'<path d="M330 160 l-26 14 M330 160 l-12 24" stroke="#d22" stroke-width="6"/>'
    if kind == 'bat':
        return f'<path d="M256 250 C200 120 70 140 30 230 C80 220 110 260 130 320 C170 270 210 300 256 340 C302 300 342 270 382 320 C402 260 432 220 482 230 C442 140 312 120 256 250Z" fill="{dk}" {st}/><ellipse cx="256" cy="290" rx="62" ry="78" fill="{c}" {st}/><path d="M210 230 L196 160 L240 210Z M302 230 L316 160 L272 210Z" fill="{c}" {st}/>' + eyes(256, 270, 50, 15, col='#ffec99', angry=True) + f'<path d="M236 320 l10 18 l10 -18 l10 18 l10 -18" fill="#fff" stroke="#1a1018" stroke-width="4"/>'
    if kind == 'fiend':
        horns = f'<path d="M150 190 C100 120 130 60 180 40 C180 100 210 130 230 160Z M362 190 C412 120 382 60 332 40 C332 100 302 130 282 160Z" fill="{lt}" {st}/>'
        return horns + f'<path d="M60 512 C70 360 150 300 256 300 C362 300 442 360 452 512Z" fill="{dk}" {st}/><ellipse cx="256" cy="230" rx="112" ry="120" fill="{c}" {st}/>' + eyes(256, 215, 76, 20, col='#fff2a0', angry=True) + f'<path d="M206 290 q50 36 100 0" fill="#1a1018"/><path d="M216 290 l10 20 l10 -20 M276 290 l10 20 l10 -20" fill="#fff"/>'
    if kind == 'wolf':
        return f'<path d="M100 120 L130 220 L90 300 C110 420 200 460 256 450 C312 460 402 420 422 300 L382 220 L412 120 L320 180 C290 165 222 165 192 180Z" fill="{c}" {st}/><path d="M200 380 L256 440 L312 380 L256 360Z" fill="{lt}" {st}/><path d="M236 400 l8 22 l8 -22 M268 400 l8 22 l8 -22" fill="#fff"/><ellipse cx="256" cy="345" rx="26" ry="18" fill="#1a1018"/>' + eyes(256, 260, 120, 16, col='#ffe066', angry=True)
    if kind == 'mushroom':
        return f'<path d="M180 330 L170 450 Q256 490 342 450 L332 330Z" fill="{lt}" {st}/><path d="M50 340 C50 130 462 130 462 340Z" fill="{c}" {st}/>' + ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{lt}"/>' for x,y,r in ((150,260,26),(256,200,32),(360,270,24),(300,310,16))) + eyes(256, 385, 60, 15, angry=True)
    if kind == 'golem':
        return f'<path d="M130 470 L150 300 L100 220 L160 180 L256 250 L352 180 L412 220 L362 300 L382 470Z" fill="{dk}" {st}/><rect x="170" y="150" width="172" height="150" rx="30" fill="{c}" {st}/><path d="M150 160 q-30 -60 10 -100 M256 140 q0 -70 20 -90 M360 160 q30 -60 -10 -100" fill="none" stroke="{lt}" stroke-width="16" stroke-linecap="round"/>' + eyes(256, 220, 76, 17, col='#fff7a0', angry=True)
    if kind == 'wisp':
        return f'<path d="M256 40 C330 160 430 220 420 330 C410 430 330 480 256 480 C182 480 102 430 92 330 C82 220 182 160 256 40Z" fill="{c}" {st}/><path d="M256 150 C300 230 350 260 345 330 C340 390 300 420 256 420 C212 420 172 390 167 330 C162 260 212 230 256 150Z" fill="{lt}" opacity=".6"/>' + eyes(256, 330, 70, 20)
    if kind == 'bird':
        return f'<path d="M256 150 C340 150 360 250 330 330 C310 400 220 410 190 330 C160 250 180 150 256 150Z" fill="{c}" {st}/><path d="M190 260 C90 200 40 260 30 330 C90 330 130 360 190 340Z M322 260 C422 200 472 260 482 330 C422 330 382 360 322 340Z" fill="{lt}" {st}/><path d="M236 210 L256 250 L276 210Z" fill="#ffb347" {st}/><path d="M236 400 l-20 50 M276 400 l20 50" stroke="#1a1018" stroke-width="10"/>' + eyes(256, 190, 56, 12, angry=True)
    if kind == 'statue':
        return f'<circle cx="256" cy="130" r="100" fill="none" stroke="{lt}" stroke-width="14" opacity=".8"/><path d="M110 512 C110 360 170 300 256 300 C342 300 402 360 402 512Z" fill="#cfc9b8" {st}/><ellipse cx="256" cy="200" rx="86" ry="100" fill="#e2dccb" {st}/><rect x="196" y="190" width="40" height="16" fill="#1a1018"/><rect x="276" y="190" width="40" height="16" fill="#1a1018"/><path d="M200 340 L312 340" stroke="{c}" stroke-width="12"/>'
    if kind == 'ghost':
        return f'<path d="M110 460 L110 220 C110 70 402 70 402 220 L402 460 L350 410 L300 460 L256 410 L212 460 L162 410Z" fill="{c}" opacity=".92" {st}/>' + eyes(256, 230, 100, 28, col='#1a1018', pupil='#ffec99') + f'<ellipse cx="256" cy="320" rx="30" ry="40" fill="#1a1018"/>'
    if kind == 'flower':
        pet = ''.join(f'<ellipse cx="256" cy="130" rx="60" ry="100" fill="{c}" {st} transform="rotate({a} 256 256)"/>' for a in range(0, 360, 60))
        return f'<path d="M256 330 L256 500" stroke="#2f8a3c" stroke-width="22"/><path d="M256 430 q-80 -10 -110 -60 q70 -10 110 60Z" fill="#4cc46a" {st}/>' + pet + f'<circle cx="256" cy="256" r="86" fill="{lt}" {st}/>' + eyes(256, 250, 60, 15, angry=False) + f'<path d="M226 292 q30 24 60 0" fill="none" stroke="#1a1018" stroke-width="7"/>'
    if kind == 'hornet':
        return f'<ellipse cx="170" cy="200" rx="90" ry="50" fill="#fff" opacity=".7" {st}/><ellipse cx="342" cy="200" rx="90" ry="50" fill="#fff" opacity=".7" {st}/><ellipse cx="256" cy="320" rx="90" ry="130" fill="#ffd84a" {st}/><path d="M170 300 h172 M168 350 h176 M180 400 h152" stroke="#1a1018" stroke-width="22"/><path d="M256 450 l-14 50 l28 0Z" fill="#1a1018"/>' + eyes(256, 250, 60, 16, col='#ff7fb0', angry=True)
    if kind == 'swan':
        return f'<path d="M120 400 C100 330 190 330 256 360 C340 330 430 340 400 410 C330 470 190 470 120 400Z" fill="#fff" {st}/><path d="M200 380 C140 280 230 250 210 170 C200 110 290 90 310 140" fill="none" stroke="#fff" stroke-width="42" stroke-linecap="round"/><path d="M200 380 C140 280 230 250 210 170 C200 110 290 90 310 140" fill="none" stroke="#1a1018" stroke-width="8" stroke-linecap="round" opacity=".5"/><path d="M310 138 L360 150 L314 164Z" fill="#ff9a4a" {st}/>' + eyes(300, 130, 0, 10, angry=False) + f'<path d="M110 400 q-40 -60 0 -110 M404 400 q40 -60 0 -110" fill="none" stroke="{c}" stroke-width="14"/>'
    return ''

KIND = {'m_ember':'wisp','m_tide':'jelly','m_shade':'ghost','water_n1':'jelly','water_n2':'crab','water_e1':'leviathan','fire_n1':'serpent','fire_n2':'bat','fire_e1':'fiend','fire_b1':'fiend','wood_n1':'wolf','wood_n2':'mushroom','wood_e1':'golem','light_n1':'wisp','light_n2':'bird','light_e1':'statue','light_b1':'statue','dark_n1':'bat','dark_n2':'ghost','dark_e1':'fiend','heart_n1':'flower','heart_n2':'hornet','heart_e1':'swan','heart_b1':'flower'}
mons = json.load(open(os.path.join(ROOT, 'www/js/data/monsters.json'), encoding='utf8'))
mons = mons if isinstance(mons, list) else list(mons.values())
for m in mons:
    mid = m['id']; e = m['element']
    tier = 'boss' if mid.endswith('_b1') else 'elite' if mid.endswith('_e1') else 'normal'
    c, dk, lt = EL[e]
    aura = f'<circle cx="256" cy="260" r="240" fill="{lt}" opacity="{0.18 if tier=="elite" else 0.3}"/>' if tier != 'normal' else ''
    crown = '<path d="M180 30 L210 -10 L256 30 L302 -10 L332 30Z" fill="#ffd84a" stroke="#1a1018" stroke-width="7" transform="translate(0 40)"/>' if tier == 'boss' else ''
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{aura}<ellipse cx="256" cy="492" rx="150" ry="14" fill="#000" opacity=".3"/>{mon(KIND[mid], e, tier)}{crown}</svg>'
    render(svg, f'{S}/monsters/{mid}.svg', f'{A}/monsters/{mid}.webp', 512, 512, 82)
print('quái xong')
