# Finds the frame corners on the photo of the Duitsland sheet and makes the "ratio" image
# (grey value / local paper brightness, so the lines are dark and the paper is about 1 everywhere).
# Coordinates in frame_photo.json are photo pixels scaled to 1125 wide (the size the photo was studied at).
# Run from tools/maps/: .venv/bin/python duitsland/frame.py
import json, numpy as np
from pathlib import Path
from PIL import Image
from scipy import ndimage as nd
HERE = Path(__file__).parent; ROOT = HERE.parents[2]; WORK = HERE.parent / 'work' / 'duitsland'; WORK.mkdir(parents=True, exist_ok=True)
img = np.asarray(Image.open(ROOT / 'fotos' / 'duitsland-kaart.jpg').convert('L')).astype(np.float32)
bg = nd.maximum_filter(nd.uniform_filter(img, 9), 41); bg = nd.uniform_filter(bg, 61)
r = np.clip(img / np.maximum(bg, 1), 0, 1.2)
np.save(WORK / 'ratio.npy', r.astype(np.float32))
S = r.shape[1] / 1125
# Each frame edge: darkest spot of a smoothed profile around the rough position, then a straight line through them
def edge(vertical, rough, along, win=22):
    pts = []
    for a in along:
        A = int(a * S)
        if vertical:
            prof = r[A - 6:A + 7, int((rough - win) * S):int((rough + win) * S)].mean(0); k = int(np.argmin(prof)); pts.append((a, rough - win + k / S, prof[k]))
        else:
            prof = r[int((rough - win) * S):int((rough + win) * S), A - 6:A + 7].mean(1); k = int(np.argmin(prof)); pts.append((a, rough - win + k / S, prof[k]))
    p = np.array(pts); keep = p[:, 2] < 0.75
    for _ in range(5):
        c = np.polyfit(p[keep, 0], p[keep, 1], 1); res = p[:, 1] - np.polyval(c, p[:, 0]); keep &= np.abs(res) < max(1.0, 2.5 * res[keep].std())
    print('vertical' if vertical else 'horizontal', rough, 'n', keep.sum(), '/', len(p), 'rms', round(float(res[keep].std()), 2))
    return c
L = edge(True, 86, np.arange(320, 1560, 10)); R = edge(True, 1090, np.arange(320, 1560, 10))
T = edge(False, 266, np.arange(120, 1060, 10)); B = edge(False, 1598, np.arange(120, 1060, 10))
def cross(cv, ch):   # vertical line x = cv(y), horizontal line y = ch(x)
    y = 266.0
    for _ in range(20): x = np.polyval(cv, y); y = np.polyval(ch, x)
    return [round(float(x), 1), round(float(y), 1)]
C = {'TL': cross(L, T), 'TR': cross(R, T), 'BR': cross(R, B), 'BL': cross(L, B)}
print(C)
json.dump(C, open(HERE / 'frame_photo.json', 'w'))
