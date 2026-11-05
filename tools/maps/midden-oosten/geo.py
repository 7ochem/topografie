# Shared: lon/lat -> sheet frame (rectified), using the fitted warp
import json, math, numpy as np
from shapely.ops import transform
from shapely import segmentize
Wp = json.load(open('/root/topo/mo/warp_final.json'))
CU, CV = np.array(Wp['cu']), np.array(Wp['cv'])
def base(lon, lat):
    L0, P0 = Wp['lon0'], Wp['lat0']
    if Wp.get('base') == 'miller':
        return 1000 * np.radians(lon - L0), -1250 * (np.log(np.tan(np.pi / 4 + 0.4 * np.radians(lat))) - math.log(math.tan(math.pi / 4 + 0.4 * math.radians(P0))))
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
