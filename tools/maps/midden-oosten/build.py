# Builds the Midden-Oosten map data (frame units of the sheet) from Natural Earth, warped to fit the worksheet
import json, sys, numpy as np
sys.path.insert(0, '/root/topo/mo')
from geo import geom_to_frame, pt, to_frame
from shapely.geometry import shape, box, Point, Polygon, MultiPolygon, LineString, MultiLineString, mapping
from shapely.ops import unary_union, linemerge
from shapely import maximum_inscribed_circle
W, H = 1000.0, 1300.0
FR = box(-2, -2, W + 2, H + 2)
LL = box(15, -2, 78, 52)                         # lon/lat area that covers the frame
D = json.load(open('/root/topo/data/ne_10m_admin_0_countries.geojson'))
LIST = {'ARM': 'armenie', 'AZE': 'azerbeidzjan', 'GEO': 'georgie', 'IRQ': 'irak', 'IRN': 'iran', 'ISR': 'israel', 'YEM': 'jemen',
        'JOR': 'jordanie', 'KWT': 'koeweit', 'LBN': 'libanon', 'SAU': 'saudiarabie', 'SYR': 'syrie', 'TUR': 'turkije'}
WHITE = {'PSX'}                                  # white on the sheet but not on the list
MERGE = {'CYN': 'CYP', 'SOL': 'SOM', 'KAB': 'KAZ', 'BRT': 'EGY'}   # draw as one country, like the sheet
def clean(g, minarea=1.5):
    g = g.buffer(0)
    ps = [p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and p.area > minarea]
    ps = [Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area > minarea]) for p in ps]
    return unary_union(ps) if ps else Polygon()
countries = {}
for f in D['features']:
    a3 = f['properties']['ADM0_A3']; a3 = MERGE.get(a3, a3)
    g = shape(f['geometry']).buffer(0)
    if not g.intersects(LL): continue
    gf = geom_to_frame(g.intersection(LL)).buffer(0)
    gf = gf.simplify(0.3).buffer(0).intersection(FR)
    if gf.is_empty: continue
    countries[a3] = unary_union([countries[a3], gf]) if a3 in countries else gf
countries = {k: clean(v) for k, v in countries.items()}
countries = {k: v for k, v in countries.items() if not v.is_empty}
land = unary_union(list(countries.values())).buffer(0)
print('countries', len(countries), 'land area', round(land.area))
# Borders: shared country edges; coast: the land outline
allb = unary_union([g.boundary for g in countries.values()])
coast = land.boundary
borders = allb.difference(coast.buffer(0.35))
grey = unary_union([g for k, g in countries.items() if k not in LIST and k not in WHITE])
white = unary_union([countries[k] for k in WHITE if k in countries])
# Waters: frame minus land, split by sea
water = FR.difference(land)
def ll_poly(coords): return geom_to_frame(Polygon(coords), 0.2).buffer(0)
red_ll = Polygon([(31, 31), (36, 31), (36, 28), (42.5, 17), (43.6, 12.75), (43.3, 12.4), (42.4, 12.0), (31, 22)])
pg_ll = Polygon([(46, 32), (53, 32), (56.4, 27.3), (56.3, 26.35), (56.0, 24.5), (51, 22), (46, 27)])
seas_ll = {
    'middellandsezee': box(10, 30.5, 37, 41.5).difference(box(26.7, 40.3, 45, 48)),
    'zwartezee': box(27.3, 41.15, 42, 47.5).difference(box(34.8, 45.25, 40, 48)),
    'kaspischezee': box(46, 36, 56, 48),
    'rodezee': red_ll,
    'perzischegolf': pg_ll,
    'indischeoceaan': box(42.5, -5, 80, 27.3).difference(pg_ll).difference(red_ll),
}
seas = {}
for k, p in seas_ll.items():
    g = water.intersection(geom_to_frame(p, 0.2).buffer(0))
    seas[k] = unary_union([q for q in getattr(g, 'geoms', [g]) if q.geom_type == 'Polygon' and q.area > 20])
    print('sea', k, round(seas[k].area))
# Lakes (Natural Earth 50m), the larger ones
L = json.load(open('/root/topo/data/ne_50m_lakes.geojson'))
lakes = []
for f in L['features']:
    g = shape(f['geometry']).buffer(0)
    if not g.intersects(LL): continue
    gf = geom_to_frame(g.intersection(LL), 0.02).buffer(0).intersection(FR)
    if gf.area > 6 and land.buffer(1).contains(gf.representative_point()): lakes.append(gf.simplify(0.3))
lakes = unary_union(lakes)
# Rivers
RV = json.load(open('/root/topo/data/ne_50m_rivers_lake_centerlines.geojson'))
def river(names):
    ls = [geom_to_frame(shape(f['geometry']), 0.05) for f in RV['features'] if f['properties'].get('name') in names]
    g = linemerge(unary_union(ls)) if ls else LineString()
    return g.intersection(FR).simplify(0.4)
euphrates = river({'Euphrates', 'Al Furat', 'Firat'})
tigris = river({'Tigris', 'Dicle', 'Shatt al Arab'})
suez = river({'Suez Canal'})
print('rivers', round(euphrates.length), round(tigris.length), round(suez.length))
# Label points
INSET = box(665, -200, 948, 126)
VIS = box(4, 4, W - 4, H - 4).difference(INSET)
def lab(g):
    v = g.intersection(VIS)
    if v.is_empty: return None
    if v.geom_type != 'Polygon': v = max([p for p in getattr(v, 'geoms', []) if p.geom_type == 'Polygon'], key=lambda p: p.area)
    c = maximum_inscribed_circle(v, 0.5).coords[0]
    return [round(c[0], 1), round(c[1], 1)]
CITIES = {'ankara': (32.85, 39.93), 'bagdad': (44.36, 33.31), 'damaskus': (36.29, 33.51), 'jeruzalem': (35.21, 31.77), 'mekka': (39.83, 21.42), 'teheran': (51.39, 35.69)}
cities = {k: pt(*v) for k, v in CITIES.items()}
cityzone = unary_union([Point(p).buffer(22) for p in cities.values()])
labels = {LIST[k]: lab(countries[k].difference(cityzone) if not countries[k].difference(cityzone).is_empty else countries[k]) for k in LIST}
labels.update({k: lab(g) for k, g in seas.items()})
# Seas: put the name in the open part (lon/lat), so it is not squeezed in a corner
SEA_LAB = {'middellandsezee': (31.0, 33.4), 'zwartezee': (34.5, 43.3), 'kaspischezee': (50.8, 41.6), 'rodezee': (37.2, 23.2), 'perzischegolf': (51.0, 27.6), 'indischeoceaan': (61.0, 16.5)}
labels.update({k: pt(*v) for k, v in SEA_LAB.items()})
labels['eufraat'] = pt(41.6, 34.6)
# Small countries close together: names placed by hand (lon/lat) so they overlap less, and not on a river
LAND_LAB = {'azerbeidzjan': (49.9, 40.45), 'israel': (35.0, 30.3),
            'libanon': (35.95, 34.3), 'irak': (42.4, 32.8), 'syrie': (38.6, 35.2)}
labels.update({k: pt(*v) for k, v in LAND_LAB.items()})
# Jordan: the upper part, so the name does not touch Israël's
labels['jordanie'] = lab(countries['JOR'].intersection(box(298, 0, W, 575)))
# Armenia is small and next to Azerbaijan: name on its west side
labels['armenie'] = lab(countries['ARM'].intersection(box(0, 0, 500, H)))
labels['suezkanaal'] = pt(32.25, 30.95)
def d_poly(g, tol=0.0):
    s = ''
    for p in getattr(g, 'geoms', [g]):
        if p.geom_type != 'Polygon' or p.is_empty: continue
        for ring in [p.exterior] + list(p.interiors):
            c = np.round(np.array(ring.coords)[:-1], 1); s += 'M' + 'L'.join(f'{x:g},{y:g}' for x, y in c) + 'Z'
    return s
def d_lines(g):
    s = ''
    for l in getattr(g, 'geoms', [g]):
        if l.geom_type == 'LineString' and l.length > 0.4:
            c = np.round(np.array(l.coords), 1); s += 'M' + 'L'.join(f'{x:g},{y:g}' for x, y in c)
        elif l.geom_type in ('MultiLineString', 'GeometryCollection'): s += d_lines(l)
    return s
out = {
    'W': W, 'H': H, 'title': 'Midden-Oosten', 'style': {'sea': 'specks', 'grey': 'light'},
    'insetBox': {'x': 670, 'y': -57, 'w': 273, 'h': 178},
    'base': {'grey': d_poly(grey), 'white': d_poly(white), 'land': d_poly(land), 'borders': d_lines(borders), 'heavy': '', 'dashed': '',
             'lakes': d_poly(lakes), 'decor': [d_lines(tigris)]},
    'areaFill': {},
    'countries': {LIST[k]: d_poly(countries[k]) for k in LIST},
    'states': {},
    'waters': {k: d_poly(g) for k, g in seas.items()},
    'lines': {'eufraat': d_lines(euphrates), 'suezkanaal': d_lines(suez)},
    'cities': cities, 'carets': {}, 'labels': labels, 'scalebar': None,
    'credit': 'Kaart: <a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>',
}
json.dump(out, open('/root/topo/mo/mo_map.json', 'w'))
print('labels', labels)
print('size KB', round(len(json.dumps(out)) / 1024), {k: len(v) // 1024 for k, v in out['base'].items() if isinstance(v, str)})
