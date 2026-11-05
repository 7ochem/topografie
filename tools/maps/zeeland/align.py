# Aligns the projected geodata (geo_frame.json, frame units) to the lines on the rectified photo: affine, ICP with trimming
import json, numpy as np
from scipy import ndimage as nd
from shapely.geometry import shape, Polygon, box, MultiLineString, LineString
from shapely.ops import unary_union
r = np.load('rect_ratio.npy'); R = json.load(open('rect.json')); K = R['K']; X0, Y0 = R['x0'], R['y0']
G = json.load(open('geo_frame.json'))
dark = r < 0.72
dark = nd.binary_opening(dark, np.ones((2, 2)))
# where the map can be compared: inside the frame, not the inset or scale bar
valid = box(4, 4, 996, 1279).difference(box(700, -200, 960, 130)).difference(box(730, 1220, 1000, 1283))
dist, (iy, ix) = nd.distance_transform_edt(~dark, return_indices=True)
nld, bel = shape(G['land']['NLD']).buffer(0), shape(G['land']['BEL']).buffer(0)
zl = shape(G['adm1']['Zeeland']).buffer(0)
other = unary_union([shape(G['adm1'][k]).buffer(0) for k in ['Zuid-Holland', 'Noord-Brabant']] + [bel])
coast = nld.boundary.intersection(zl.buffer(3)).difference(other.buffer(4)).intersection(valid)
pts = []
for g in getattr(coast, 'geoms', [coast]):
    n = max(2, int(g.length)); pts += [g.interpolate(i / n, normalized=True).coords[0] for i in range(n)]
P = np.array(pts); print('points', len(P))
A = np.eye(3)
def nearest(Q):
    py, px = (Q[:, 1] - Y0) * K, (Q[:, 0] - X0) * K
    ok = (py >= 0) & (py < r.shape[0] - 1) & (px >= 0) & (px < r.shape[1] - 1)
    yy, xx = np.clip(py.round().astype(int), 0, r.shape[0] - 1), np.clip(px.round().astype(int), 0, r.shape[1] - 1)
    tgt = np.c_[ix[yy, xx] / K + X0, iy[yy, xx] / K + Y0]
    return tgt, ok
for it, cut in enumerate([12, 10, 8, 6, 5, 4, 4, 3, 3, 3]):
    Q = (A[:2, :2] @ P.T).T + A[:2, 2]
    tgt, ok = nearest(Q)
    d = np.hypot(*(tgt - Q).T); m = ok & (d < cut)
    # solve affine: tgt = M @ [p,1]
    Xm = np.c_[P[m], np.ones(m.sum())]
    sol, *_ = np.linalg.lstsq(Xm, tgt[m], rcond=None)
    A = np.eye(3); A[:2, :2] = sol[:2].T; A[:2, 2] = sol[2]
    print(it, 'used', m.sum(), 'mean d', round(float(d[m].mean()), 2), 'median all', round(float(np.median(d)), 2))
print(np.round(A, 4))
json.dump({'A': A.tolist()}, open('align.json', 'w'))
