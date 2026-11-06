# Fits sheet (rectified frame) <- lon/lat as poly(Mercator(lon, lat)), with ICP on the drawn lines + control points.
# Same method as groningen-drenthe/icp.py. Lines: coasts and national borders (geo-maps countries-land, from
# OpenStreetMap); control points: the city dots in gcp.json (u, v, lon, lat).
# Run from tools/maps/ after rect.py: .venv/bin/python duitsland/icp.py [degree] [gcp weight]
import json, math, sys, numpy as np
from pathlib import Path
from shapely.geometry import shape, box
from shapely.ops import unary_union
HERE = Path(__file__).parent; WORK = HERE.parent / 'work' / 'duitsland'; DATA = HERE.parent / 'work' / 'data'
R = json.load(open(HERE / 'rect.json')); K, X0, Y0 = R['K'], R['x0'], R['y0']; HH, WW = R['shape']
dt = np.fromfile(WORK / 'rect_dt.f32', np.float32).reshape(HH, WW)
iy = np.fromfile(WORK / 'rect_iy.i16', np.int16).reshape(HH, WW); ix = np.fromfile(WORK / 'rect_ix.i16', np.int16).reshape(HH, WW)
LON0, LAT0 = 10.0, 51.0
BASE = sys.argv[3] if len(sys.argv) > 3 else 'lcc'
def merc(lon, lat):  # base projection; a polynomial on top takes up the rest of the sheet's projection and the page bend
    if BASE == 'lcc':   # Lambert conformal conic, standard parallels 48 and 54 (sphere)
        p1, p2, p0 = np.radians(48.0), np.radians(54.0), np.radians(LAT0)
        t = lambda p: np.tan(np.pi / 4 + p / 2)
        n = math.log(math.cos(p1) / math.cos(p2)) / math.log(t(p2) / t(p1)); F = math.cos(p1) * t(p1) ** n / n
        rho, rho0 = F / t(np.radians(lat)) ** n, F / t(p0) ** n; a = n * np.radians(lon - LON0)
        return 1000 * rho * np.sin(a), -1000 * (rho0 - rho * np.cos(a))
    return 1000 * np.radians(lon - LON0), -1000 * (np.log(np.tan(np.pi / 4 + np.radians(lat) / 2)) - math.log(math.tan(math.pi / 4 + math.radians(LAT0) / 2)))
G = {k: shape(g) for k, g in json.load(open(WORK / 'countries_ll.json')).items()}   # made by prep.py
# outer rings only (the holes are lakes and rivers the sheet does not draw), without the cut along the data box
BB = box(2.0, 45.0, 17.5, 56.3)
lines = unary_union([p.exterior for g in G.values() for p in getattr(g, 'geoms', [g])]).difference(BB.exterior.buffer(0.001))
pts = []
for l in getattr(lines, 'geoms', [lines]):
    if l.length < 0.05: continue   # tiny islands the sheet does not draw
    n = max(2, int(l.length / 0.01)); pts += [l.interpolate(i / n, normalized=True).coords[0] for i in range(n + 1)]
P = np.array(pts); print('line points', len(P))
GCP = np.array(json.load(open(HERE / 'gcp.json')))  # u, v, lon, lat
def feats(x, y, deg):
    x, y = x / 1000, y / 1000
    return np.stack([x ** i * y ** j for i in range(deg + 1) for j in range(deg + 1 - i)], 1)
px, py = merc(P[:, 0], P[:, 1]); gx, gy = merc(GCP[:, 2], GCP[:, 3])
def apply(c, x, y, deg): F = feats(x, y, deg); return F @ c[0], F @ c[1]
# start: affine from the control points
deg = 1
F = feats(gx, gy, 1); c = [np.linalg.lstsq(F, GCP[:, 0], rcond=None)[0], np.linalg.lstsq(F, GCP[:, 1], rcond=None)[0]]
inside = lambda u, v: (u > 8) & (u < 992) & (v > 8) & (v < R['Hr'] - 8)
DEGMAX = int(sys.argv[1]) if len(sys.argv) > 1 else 3
WG = float(sys.argv[2]) if len(sys.argv) > 2 else 8
sched = [(14, 1), (10, 1), (8, 2), (6, 2), (5, 3), (4, 3)] + [(3.5, min(4, DEGMAX))] * 4 + [(3, DEGMAX)] * 6 + [(2.5, DEGMAX)] * 6
for it, (cut, d_) in enumerate(sched):
    u, v = apply(c, px, py, deg)
    m = inside(u, v); X = np.clip(np.round((u - X0) * K).astype(int), 0, WW - 1); Y = np.clip(np.round((v - Y0) * K).astype(int), 0, HH - 1)
    d = dt[Y, X] / K; ok = m & (d < cut)
    tu, tv = ix[Y, X] / K + X0, iy[Y, X] / K + Y0
    deg = min(d_, DEGMAX)
    Fl = feats(px[ok], py[ok], deg); Fg = feats(gx, gy, deg); wg = WG
    Fa = np.vstack([Fl, Fg * wg])
    c = [np.linalg.lstsq(Fa, np.r_[tu[ok], GCP[:, 0] * wg], rcond=None)[0], np.linalg.lstsq(Fa, np.r_[tv[ok], GCP[:, 1] * wg], rcond=None)[0]]
    dm = np.sort(d[m]); tm = dm[:int(len(dm) * 0.85)].mean()
    gu, gv = apply(c, gx, gy, deg); ge = np.hypot(gu - GCP[:, 0], gv - GCP[:, 1])
    print(it, 'deg', deg, 'used', ok.sum(), 'trimmed mean', round(tm, 2), 'median', round(float(np.median(dm)), 2), 'gcp rms', round(float(np.sqrt((ge ** 2).mean())), 2))
print('gcp residuals', np.round(ge, 1))
# local scale at the centre: derivative of the mapping (y/x = 1 means the provisional frame height is right for Mercator)
h = 1.0; cx, cy = merc(LON0, LAT0)
ux1, vx1 = apply(c, np.array([cx + h]), np.array([cy]), deg); ux0, vx0 = apply(c, np.array([cx - h]), np.array([cy]), deg)
uy1, vy1 = apply(c, np.array([cx]), np.array([cy + h]), deg); uy0, vy0 = apply(c, np.array([cx]), np.array([cy - h]), deg)
sx = math.hypot(ux1[0] - ux0[0], vx1[0] - vx0[0]) / 2; sy = math.hypot(uy1[0] - uy0[0], vy1[0] - vy0[0]) / 2
print('scale x', round(sx, 4), 'y', round(sy, 4), 'ratio y/x', round(sy / sx, 4))
json.dump({'base': BASE, 'lon0': LON0, 'lat0': LAT0, 'deg': deg, 'cu': c[0].tolist(), 'cv': c[1].tolist(), 'ratio': sy / sx}, open(HERE / 'warp_final.json', 'w'))
