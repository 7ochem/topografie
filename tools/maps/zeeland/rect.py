# Rectify the new Zeeland photo into the game's frame coordinates (W=1000, H=1283.1)
# The page is a bit bent, so: homography from the 4 corners + a Coons-patch correction from the 4 measured edges
import json, numpy as np
from PIL import Image
from scipy import ndimage as nd
r = np.load('ratio.npy')
S = 2296 / 1125
def edge_v(xg, ys):  # x position of a vertical line, per y (displayed px)
    out = []
    for y in ys:
        Y, X = int(y * S), int(xg * S)
        seg = r[Y - 3:Y + 4, X - 30:X + 30].mean(0)
        if seg.min() < 0.75: out.append((y, (X - 30 + np.argmin(seg)) / S))
    return np.array(out)
def edge_h(yg, xs):
    out = []
    for x in xs:
        Y, X = int(yg * S), int(x * S)
        seg = r[Y - 30:Y + 30, X - 3:X + 4].mean(1)
        if seg.min() < 0.75: out.append((x, (Y - 30 + np.argmin(seg)) / S))
    return np.array(out)
L = edge_v(80, np.arange(445, 1640, 15))
R = edge_v(1025, np.arange(440, 1640, 15))
T = edge_h(431, np.r_[np.arange(90, 745, 15), np.arange(990, 1025, 5)])
B = edge_h(1646, np.arange(95, 1015, 15))
def robfit(a, deg):
    m = np.ones(len(a), bool)
    for _ in range(4):
        c = np.polyfit(a[m, 0], a[m, 1], deg); res = a[:, 1] - np.polyval(c, a[:, 0])
        m = np.abs(res) < max(0.6, 2.5 * np.std(res[m]))
    print('fit', deg, 'n', m.sum(), '/', len(a), 'rms', round(np.std(res[m]), 2))
    return c
# Edges as smoothed piecewise-linear curves (the page bends unevenly), straight extrapolation at the ends
def pw(a):
    a = a[np.argsort(a[:, 0])]
    y = nd.median_filter(a[:, 1], 5, mode='nearest'); y = nd.uniform_filter1d(y, 3, mode='nearest')
    x = a[:, 0]
    c0 = np.polyfit(x[:5], y[:5], 1); c1 = np.polyfit(x[-5:], y[-5:], 1)
    def f(q):
        q = np.asarray(q, float); out = np.interp(q, x, y)
        out = np.where(q < x[0], np.polyval(c0, q), out); return np.where(q > x[-1], np.polyval(c1, q), out)
    return f
cL, cR, cT, cB = pw(L), pw(R), pw(T), pw(B)
# corners: intersect
def corner(cv, ch, x0, y0):
    x, y = x0, y0
    for _ in range(20): y = float(ch(x)); x = float(cv(y))
    return np.array([x, y])
TL, TR = corner(cL, cT, 75, 431), corner(cR, cT, 1030, 423)
BL, BR = corner(cL, cB, 86, 1645), corner(cR, cB, 1027, 1648)
print('corners', TL, TR, BL, BR)
W, H = 1000, 1283.1
import cv2
Hm = cv2.getPerspectiveTransform(np.float32([[0, 0], [W, 0], [0, H], [W, H]]), np.float32([TL, TR, BL, BR]))
def hom(u, v):
    p = Hm @ np.array([u, v, np.ones_like(u)]); return p[0] / p[2], p[1] / p[2]
# residuals of the measured edges vs. the straight homography edges, as functions of u or v
uu = np.linspace(0, W, 201); vv = np.linspace(0, H, 201)
def res_h(c, v):  # along a horizontal edge at frame v: photo y measured - homography y
    hx, hy = hom(uu, np.full_like(uu, v)); return np.c_[np.zeros_like(uu), c(hx) - hy]
def res_v(c, u):
    hx, hy = hom(np.full_like(vv, u), vv); return np.c_[c(hy) - hx, np.zeros_like(vv)]
rT, rB, rL, rR = res_h(cT, 0), res_h(cB, H), res_v(cL, 0), res_v(cR, W)
print('max edge correction px', [round(float(np.abs(x).max()), 2) for x in (rT, rB, rL, rR)])
def frame_to_photo(u, v):  # arrays in frame units -> displayed photo px
    hx, hy = hom(u, v)
    s, t = u / W, v / H
    iu = np.interp(u, uu, np.arange(201)); iv = np.interp(v, vv, np.arange(201))
    def at(rr, i): return np.c_[np.interp(i, np.arange(201), rr[:, 0]), np.interp(i, np.arange(201), rr[:, 1])]
    d = (1 - t)[:, None] * at(rT, iu) + t[:, None] * at(rB, iu) + (1 - s)[:, None] * at(rL, iv) + s[:, None] * at(rR, iv)
    return hx + d[:, 0], hy + d[:, 1]
# rectified image at 2 px per frame unit, margin around the frame
K = 2; M0 = -30; M1y = -200
gx, gy = np.meshgrid(np.arange(M0, W + 30, 1 / K), np.arange(M1y, H + 30, 1 / K))
px, py = frame_to_photo(gx.ravel(), gy.ravel())
img = np.asarray(Image.open('photo.png').convert('L')).astype(np.float32)
rect = nd.map_coordinates(img, [py * S, px * S], order=1).reshape(gx.shape)
rat = nd.map_coordinates(r, [py * S, px * S], order=1).reshape(gx.shape)
np.save('rect_ratio.npy', rat)
Image.fromarray(np.clip(rat * 235, 0, 255).astype(np.uint8)).save('rect.png')
json.dump({'K': K, 'x0': M0, 'y0': M1y, 'shape': list(gx.shape)}, open('rect.json', 'w'))
print('rect', gx.shape)
