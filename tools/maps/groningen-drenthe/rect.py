# Rectifies the Midden-Oosten photo to frame units (W=1000 wide, Hr tall, provisional aspect):
# homography from the 4 corners + a Coons-patch correction from the measured (slightly bent) edges.
import json, numpy as np, cv2
from PIL import Image
from scipy import ndimage as nd
r = np.load('ratio.npy'); S = r.shape[1] / 1125
C = json.load(open('frame_photo.json'))
TL, TR, BR, BL = [np.array(C[k]) for k in ('TL', 'TR', 'BR', 'BL')]
import sys
W, Hr = 1000.0, float(sys.argv[1]) if len(sys.argv) > 1 else 1300.0
Hm = cv2.getPerspectiveTransform(np.float32([[0, 0], [W, 0], [0, Hr], [W, Hr]]), np.float32([TL, TR, BL, BR]))
def hom(u, v):
    p = Hm @ np.array([u, v, np.ones_like(u)]); return p[0] / p[2], p[1] / p[2]
def scan(p, q, vertical, ts, win=8):
    out = []
    for t in ts:
        x, y = p + (q - p) * t; X, Y = int(x * S), int(y * S)
        if vertical:
            seg = r[Y - 2:Y + 3, X - int(win * S):X + int(win * S)].mean(0); k = np.argmin(seg)
            if seg[k] < 0.6: out.append((t, (X - int(win * S) + k) / S - x))
        else:
            seg = r[Y - int(win * S):Y + int(win * S), X - 2:X + 3].mean(1); k = np.argmin(seg)
            if seg[k] < 0.6: out.append((t, (Y - int(win * S) + k) / S - y))
    a = np.array(out)
    # robust smooth offset curve along the edge (offset from the straight corner-to-corner line)
    m = np.ones(len(a), bool)
    for _ in range(4):
        c = np.polyfit(a[m, 0], a[m, 1], 3); res = a[:, 1] - np.polyval(c, a[:, 0]); m = np.abs(res) < max(0.8, 2.5 * res[m].std())
    print('edge offsets max', round(float(np.abs(np.polyval(c, np.linspace(0, 1, 50))).max()), 2), 'rms', round(float(res[m].std()), 2))
    return c
ts = np.linspace(0.03, 0.97, 80)
cL = scan(TL, BL, True, ts); cR = scan(TR, BR, True, ts)
cT = scan(TL, TR, False, np.r_[np.linspace(0.03, 0.68, 50), np.linspace(0.97, 0.995, 4)]); cB = scan(BL, BR, False, ts)
def frame_to_photo(u, v):
    s, t = u / W, v / Hr
    hx, hy = hom(u, v)
    # offsets: left/right in x, top/bottom in y, blended (Coons) and with the corner values removed
    dl, dr = np.polyval(cL, t), np.polyval(cR, t)
    dtp, db = np.polyval(cT, s), np.polyval(cB, s)
    dx = (1 - s) * dl + s * dr - ((1 - s) * (1 - t) * np.polyval(cL, 0) + s * (1 - t) * np.polyval(cR, 0) + (1 - s) * t * np.polyval(cL, 1) + s * t * np.polyval(cR, 1))
    dy = (1 - t) * dtp + t * db - ((1 - s) * (1 - t) * np.polyval(cT, 0) + s * (1 - t) * np.polyval(cT, 1) + (1 - s) * t * np.polyval(cB, 0) + s * t * np.polyval(cB, 1))
    return hx + dx, hy + dy
K = 2; X0, Y0 = -30, -150
img = np.asarray(Image.open('map.png').convert('L')).astype(np.float32)
def sample(fu, fv):
    px, py = frame_to_photo(fu, fv); return nd.map_coordinates(r, [py * S, px * S], order=1)
# Second pass: measure the frame lines in the first rectification and stretch them onto the exact edges (Coons patch)
def measure(first):
    gx, gy = np.meshgrid(np.arange(X0, W + 30, 1 / K), np.arange(Y0, Hr + 30, 1 / K))
    rr = first(gx.ravel(), gy.ravel()).reshape(gx.shape)
    def edge(vertical, pos, along):
        out = []
        for a in along:
            if vertical:
                Y = int((a - Y0) * K); X = int((pos - X0) * K)
                prof = rr[Y - 20:Y + 21, X - 28:X + 29].mean(0)   # vertical smoothing favours the straight frame line
                k = int(np.argmin(prof)); out.append((a, pos - 14 + k / K, prof[k]))
            else:
                X = int((a - X0) * K); Y = int((pos - Y0) * K)
                prof = rr[Y - 28:Y + 29, X - 20:X + 21].mean(1)
                k = int(np.argmin(prof)); out.append((a, pos - 14 + k / K, prof[k]))
        a_ = np.array(out); m = a_[:, 2] < 0.8
        x, y = a_[m, 0], a_[m, 1]
        keep = np.ones(len(x), bool)
        for _ in range(5):
            c = np.polyfit(x[keep], y[keep], 3); res = y - np.polyval(c, x); keep = np.abs(res) < max(0.6, 2.5 * res[keep].std())
        print('edge', 'v' if vertical else 'h', pos, 'n', keep.sum(), '/', len(x), 'rms', round(float(res[keep].std()), 2), 'range', round(float(np.polyval(c, along).min() - pos), 1), round(float(np.polyval(c, along).max() - pos), 1))
        return c
    ts_v = np.arange(20, Hr - 20, 10.0); ts_u = np.arange(20, W - 20, 10.0)
    top_u = np.r_[np.arange(20, 690, 10.0), np.arange(975, W - 10, 5.0)]
    return edge(True, 0, ts_v), edge(True, W, ts_v), edge(False, 0, top_u), edge(False, Hr, ts_u)
first = lambda u, v: sample(u, v)
cl, cr, ct, cb = measure(first)
def final_to_first(u, v):
    s, t = u / W, v / Hr
    Lu, Ru = np.polyval(cl, v), np.polyval(cr, v)      # left/right edge u at this v
    Tv, Bv = np.polyval(ct, u), np.polyval(cb, u)      # top/bottom edge v at this u
    uu = Lu + s * (Ru - Lu)
    vv = Tv + t * (Bv - Tv)
    return uu, vv
gx, gy = np.meshgrid(np.arange(X0, W + 30, 1 / K), np.arange(Y0, Hr + 30, 1 / K))
fu, fv = final_to_first(gx.ravel(), gy.ravel())
px, py = frame_to_photo(fu, fv)
rat = nd.map_coordinates(r, [py * S, px * S], order=1).reshape(gx.shape)
json.dump({'cl': cl.tolist(), 'cr': cr.tolist(), 'ct': ct.tolist(), 'cb': cb.tolist()}, open('rect_pass2.json', 'w'))
np.save('rect_ratio.npy', rat.astype(np.float32))
Image.fromarray(np.clip(rat * 235, 0, 255).astype(np.uint8)).save('rect.png')
json.dump({'K': K, 'x0': X0, 'y0': Y0, 'W': W, 'Hr': Hr, 'shape': list(gx.shape)}, open('rect.json', 'w'))
# line mask in rectified space: long dark components only (no grey texture)
dark = rat < 0.62
# dashed lines (province borders): close the gaps first, so the dashes form one long component
lab, n = nd.label(nd.binary_closing(dark, np.ones((3, 3)), iterations=4) & ~nd.binary_erosion(np.ones_like(dark), iterations=1) | dark, np.ones((3, 3))); sz = np.bincount(lab.ravel())
ext = np.zeros(n + 1)
for i, sl in enumerate(nd.find_objects(lab), 1):
    if sl is not None: ext[i] = max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start)
keep = (sz >= 200) & (ext >= 40); keep[0] = False
lines = keep[lab] & dark
# only inside the frame, not the inset box or the title
fm = np.zeros_like(lines)
fm[int((6 - Y0) * K):int((Hr - 6 - Y0) * K), int((6 - X0) * K):int((W - 6 - X0) * K)] = True
lines &= fm
Image.fromarray((~lines * 255).astype(np.uint8)).save('rect_lines.png')
dt, (iy, ix) = nd.distance_transform_edt(~lines, return_indices=True)
dt.astype(np.float32).tofile('rect_dt.f32'); iy.astype(np.int16).tofile('rect_iy.i16'); ix.astype(np.int16).tofile('rect_ix.i16')
# the city dots in rect coordinates
dd = nd.binary_opening(rat < 0.5, np.ones((4, 4))); l2, n2 = nd.label(dd)
dots = []
for i, sl in enumerate(nd.find_objects(l2), 1):
    m = l2[sl] == i; a = m.sum(); h, w_ = m.shape
    if 25 <= a <= 200 and max(h, w_) < 1.6 * min(h, w_) and a > 0.55 * h * w_:
        cy, cx = nd.center_of_mass(m)
        u, v = (cx + sl[1].start) / K + X0, (cy + sl[0].start) / K + Y0
        if 0 < u < W and 0 < v < Hr: dots.append([round(u, 1), round(v, 1), int(a)])
print('dots', dots)
json.dump(dots, open('rect_dots.json', 'w'))
