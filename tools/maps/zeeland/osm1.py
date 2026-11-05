# OSM: coastline -> land polygons (land is left of the coastline direction), minus the larger waters. lon/lat.
import json, math
from shapely.geometry import shape, box, LineString, Point, mapping, Polygon
from shapely.ops import unary_union, polygonize, linemerge
from shapely import prepared
d = json.load(open('osm/osm-zeeland.geojson'))
BB = box(3.20, 51.10, 4.40, 52.00)
coast, waters = [], []
for f in d['features']:
    p, g = f['properties'], shape(f['geometry'])
    if p.get('natural') == 'coastline':
        coast.append(g.exterior if g.geom_type == 'Polygon' else g)
    elif p.get('natural') == 'water':
        waters.append((g.buffer(0), p.get('name'), p.get('water')))
lines = unary_union([c.intersection(BB) for c in coast] + [BB.exterior])
faces = list(polygonize(lines))
print('faces', len(faces))
# sample points just left (land) and right (water) of each coastline segment
eps = 0.0003
landp, waterp = [], []
for c in coast:
    cs = list(c.coords)
    for (x0, y0), (x1, y1) in zip(cs[:-1], cs[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 2 * eps: continue
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L   # left normal (lon/lat, y up)
        landp.append(Point(mx + nx * eps, my + ny * eps)); waterp.append(Point(mx - nx * eps, my - ny * eps))
from shapely.strtree import STRtree
lt, wt = STRtree(landp), STRtree(waterp)
land = []
for fc in faces:
    pf = prepared.prep(fc)
    nl = sum(1 for i in lt.query(fc) if pf.contains(landp[i]))
    nw = sum(1 for i in wt.query(fc) if pf.contains(waterp[i]))
    if nl > nw: land.append(fc)
land = unary_union(land)
print('land area deg2', round(land.area, 4))
k = (111.32 * math.cos(math.radians(51.55))) * 111.32
big = [(g, n, w) for g, n, w in waters if g.area * k > 0.15]
print('waters kept', len(big), 'of', len(waters))
wat = unary_union([g for g, n, w in big])
land2 = land.difference(wat)
named = {n: unary_union([g for g, nn, w in waters if nn == n]) for n in ['Oosterschelde', 'Grevelingenmeer']}
json.dump({'land': mapping(land2), 'water': mapping(wat), 'oosterschelde': mapping(named['Oosterschelde']), 'grevelingen': mapping(named['Grevelingenmeer'])}, open('osm/osm_ll.json', 'w'))
for nm, pt in {'grevelingen': (3.95, 51.75), 'veersemeer': (3.80, 51.545), 'oosterschelde': (3.85, 51.60), 'walcheren': (3.58, 51.52), 'schouwen': (3.85, 51.68)}.items():
    print(nm, 'land' if land2.contains(Point(*pt)) else 'water')
