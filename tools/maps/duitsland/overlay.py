# Check picture: the fitted open data (red) over the rectified photo, to compare by eye.
# Run from tools/maps/: .venv/bin/python duitsland/overlay.py [map json]   (without argument: coast and borders only)
import json, sys, numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
from shapely.geometry import shape
HERE = Path(__file__).parent; WORK = HERE.parent / 'work' / 'duitsland'
sys.path.insert(0, str(HERE))
from geo import to_frame
R = json.load(open(HERE / 'rect.json')); K, X0, Y0 = R['K'], R['x0'], R['y0']
im = Image.open(WORK / 'rect.png').convert('RGB'); d = ImageDraw.Draw(im)
px = lambda u, v: ((u - X0) * K, (v - Y0) * K)
if len(sys.argv) > 1:
    # the built map data: every path, the carets and the dots
    import re
    M = json.load(open(sys.argv[1]))
    def draw_d(dd, col):
        for part in re.findall(r'M[^M]+', dd or ''):
            c = [tuple(map(float, xy.split(','))) for xy in re.split('[LZ]', part[1:]) if xy]
            if part.endswith('Z'): c.append(c[0])
            d.line([px(*p) for p in c], fill=col, width=1)
    b = M['base']
    for k in ('land', 'borders', 'lakes'): draw_d(b[k], (230, 0, 0))
    draw_d(b['dashed'], (0, 140, 0))
    for dd in b['decor'] + list(M['lines'].values()): draw_d(dd, (0, 0, 230))
    for pts in M['carets'].values():
        for x, y in pts: a, c_ = px(x, y); d.line([(a - 6, c_ + 3), (a, c_ - 3), (a + 6, c_ + 3)], fill=(200, 0, 200), width=2)
    for x, y in list(M['cities'].values()) + b.get('dots', []): a, c_ = px(x, y); d.ellipse((a - 5, c_ - 5, a + 5, c_ + 5), outline=(0, 0, 255), width=2)
    im.save(WORK / 'overlay_map.png'); sys.exit()
G = {k: shape(g) for k, g in json.load(open(WORK / 'countries_ll.json')).items()}
for g in G.values():
    for p in getattr(g, 'geoms', [g]):
        for ring in [p.exterior] + list(p.interiors):
            c = np.array(ring.coords)
            if len(c) < 8: continue
            u, v = to_frame(c[:, 0], c[:, 1]); d.line([px(a, b) for a, b in zip(u, v)], fill=(230, 0, 0), width=1)
for u, v, lon, lat in json.load(open(HERE / 'gcp.json')):
    a, b = to_frame(lon, lat); x, y = px(a[0], b[0]); d.ellipse((x - 5, y - 5, x + 5, y + 5), outline=(0, 0, 255), width=2)
im.save(WORK / 'overlay.png')
im.resize((im.size[0] // 2, im.size[1] // 2)).save(WORK / 'overlay_half.png')
