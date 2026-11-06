# Shared: lon/lat -> sheet frame (rectified), using the fitted warp (warp_final.json from icp.py)
import json, math, numpy as np
from pathlib import Path
from shapely.ops import transform
from shapely import segmentize
Wp = json.load(open(Path(__file__).parent / 'warp_final.json'))
CU, CV = np.array(Wp['cu']), np.array(Wp['cv'])
def base(lon, lat):   # the same base projection as in icp.py
    L0, P0 = Wp['lon0'], Wp['lat0']
    if Wp.get('base') == 'lcc':
        p1, p2, p0 = np.radians(48.0), np.radians(54.0), np.radians(P0)
        t = lambda p: np.tan(np.pi / 4 + p / 2)
        n = math.log(math.cos(p1) / math.cos(p2)) / math.log(t(p2) / t(p1)); F = math.cos(p1) * t(p1) ** n / n
        rho, rho0 = F / t(np.radians(lat)) ** n, F / t(p0) ** n; a = n * np.radians(lon - L0)
        return 1000 * rho * np.sin(a), -1000 * (rho0 - rho * np.cos(a))
    return 1000 * np.radians(lon - L0), -1000 * (np.log(np.tan(np.pi / 4 + np.radians(lat) / 2)) - math.log(math.tan(math.pi / 4 + math.radians(P0) / 2)))
def feats(x, y, deg):
    x, y = x / 1000, y / 1000
    return np.stack([x ** i * y ** j for i in range(deg + 1) for j in range(deg + 1 - i)], 1)
def to_frame(lon, lat):
    lon, lat = np.atleast_1d(np.asarray(lon, float)), np.atleast_1d(np.asarray(lat, float))
    x, y = base(lon, lat); F = feats(x, y, Wp['deg']); return F @ CU, F @ CV
def geom_to_frame(g, seg=0.05):
    g = segmentize(g, seg)
    return transform(lambda x, y, z=None: to_frame(x, y), g)
def pt(lon, lat):
    u, v = to_frame(lon, lat); return [round(float(u[0]), 1), round(float(v[0]), 1)]
