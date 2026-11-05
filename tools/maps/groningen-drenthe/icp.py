# Fits sheet (rectified frame) <- lon/lat as poly3(stereographic(lon, lat)), with ICP on the drawn lines + control points
import json, numpy as np, math, sys
from shapely.geometry import shape, box, LineString, MultiLineString
from shapely.ops import unary_union
R = json.load(open('gd/rect.json')); K, X0, Y0 = R['K'], R['x0'], R['y0']; HH, WW = R['shape']
dt = np.fromfile('gd/rect_dt.f32', np.float32).reshape(HH, WW)
iy = np.fromfile('gd/rect_iy.i16', np.int16).reshape(HH, WW); ix = np.fromfile('gd/rect_ix.i16', np.int16).reshape(HH, WW)
LON0, LAT0 = 6.6, 53.0
BASE = sys.argv[3] if len(sys.argv) > 3 else 'merc'
def stereo(lon, lat):  # base projection; a degree-4 polynomial on top takes up the bending of the photographed page
    if BASE == 'miller':
        return 1000 * np.radians(lon - LON0), -1250 * (np.log(np.tan(np.pi / 4 + 0.4 * np.radians(lat))) - math.log(math.tan(math.pi / 4 + 0.4 * math.radians(LAT0))))
    return 1000 * np.radians(lon - LON0), -1000 * (np.log(np.tan(np.pi / 4 + np.radians(lat) / 2)) - math.log(math.tan(math.pi / 4 + math.radians(LAT0) / 2)))
# coast (OpenStreetMap), canals, the NL-DE border and province borders on land
O = json.load(open('gd/osm.geojson'))
BB = box(5.95, 52.45, 7.45, 53.70)
segs = []
for f in O['features']:
    p, g = f['properties'], shape(f['geometry'])
    if p.get('natural') == 'coastline': segs.append((g.exterior if g.geom_type == 'Polygon' else g).intersection(BB))
    elif p.get('waterway') == 'canal' and p.get('name') in ('Eemskanaal', 'Van Starkenborghkanaal', 'Winschoterdiep', 'Noord-Willemskanaal', 'Drentsche Hoofdvaart', 'Prinses Margrietkanaal'): segs.append(g)
A1 = {f['properties']['shapeName']: shape(f['geometry']).buffer(0) for f in json.load(open('data/nl/nld_adm1.geojson'))['features']}
nl = unary_union(list(A1.values()))
east = box(6.95, 52.45, 7.45, 53.24)   # the land border with Germany
segs.append(nl.boundary.intersection(east))
lines = unary_union(segs)
pts = []
for l in getattr(lines, 'geoms', [lines]):
    n = max(2, int(l.length / 0.004)); pts += [l.interpolate(i / n, normalized=True).coords[0] for i in range(n + 1)]
P = np.array(pts); print('line points', len(P))
GCP = np.array(json.load(open('gd/gcp.json')))  # u, v, lon, lat
def feats(x, y, deg):
    x, y = x / 1000, y / 1000
    return np.stack([x ** i * y ** j for i in range(deg + 1) for j in range(deg + 1 - i)], 1)
px, py = stereo(P[:, 0], P[:, 1]); gx, gy = stereo(GCP[:, 2], GCP[:, 3])
def apply(c, x, y, deg): F = feats(x, y, deg); return F @ c[0], F @ c[1]
# start: affine from the control points
deg = 1
F = feats(gx, gy, 1); c = [np.linalg.lstsq(F, GCP[:, 0], rcond=None)[0], np.linalg.lstsq(F, GCP[:, 1], rcond=None)[0]]
inside = lambda u, v: (u > 8) & (u < 992) & (v > 8) & (v < R['Hr'] - 8) & ~((u > 690) & (v < 140)) & ~((u > 750) & (v > R['Hr'] - 60))
DEGMAX = int(sys.argv[1]) if len(sys.argv) > 1 else 4
WG = float(sys.argv[2]) if len(sys.argv) > 2 else 8
sched = [(14, 1), (10, 1), (8, 2), (6, 2), (5, 3), (4, 3)] + [(3.5, min(4, DEGMAX))] * 4 + [(3, DEGMAX)] * 6 + [(2.5, DEGMAX)] * 6
for it, (cut, d_) in enumerate(sched):
    u, v = apply(c, px, py, deg)
    m = inside(u, v); X = np.clip(np.round((u - X0) * K).astype(int), 0, WW - 1); Y = np.clip(np.round((v - Y0) * K).astype(int), 0, HH - 1)
    d = dt[Y, X] / K; ok = m & (d < cut)
    tu, tv = ix[Y, X] / K + X0, iy[Y, X] / K + Y0
    deg = d_
    Fl = feats(px[ok], py[ok], deg); Fg = feats(gx, gy, deg); wg = WG
    Fa = np.vstack([Fl, Fg * wg])
    c = [np.linalg.lstsq(Fa, np.r_[tu[ok], GCP[:, 0] * wg], rcond=None)[0], np.linalg.lstsq(Fa, np.r_[tv[ok], GCP[:, 1] * wg], rcond=None)[0]]
    dm = np.sort(d[m]); tm = dm[:int(len(dm) * 0.85)].mean()
    gu, gv = apply(c, gx, gy, deg); ge = np.hypot(gu - GCP[:, 0], gv - GCP[:, 1])
    print(it, 'deg', deg, 'used', ok.sum(), 'trimmed mean', round(tm, 2), 'median', round(float(np.median(dm)), 2), 'gcp rms', round(float(np.sqrt((ge ** 2).mean())), 2))
print('gcp residuals', np.round(ge, 1))
# local scale at the centre: derivative of the mapping
h = 1.0; cx, cy = stereo(6.6, 53.0)
ux1, vx1 = apply(c, np.array([cx + h]), np.array([cy]), deg); ux0, vx0 = apply(c, np.array([cx - h]), np.array([cy]), deg)
uy1, vy1 = apply(c, np.array([cx]), np.array([cy + h]), deg); uy0, vy0 = apply(c, np.array([cx]), np.array([cy - h]), deg)
sx = math.hypot(ux1[0] - ux0[0], vx1[0] - vx0[0]) / 2; sy = math.hypot(uy1[0] - uy0[0], vy1[0] - vy0[0]) / 2
print('scale x', round(sx, 4), 'y', round(sy, 4), 'ratio y/x', round(sy / sx, 4))
json.dump({'base': BASE, 'lon0': LON0, 'lat0': LAT0, 'deg': deg, 'cu': c[0].tolist(), 'cv': c[1].tolist(), 'ratio': sy / sx}, open(f'gd/warp{DEGMAX}.json', 'w'))
