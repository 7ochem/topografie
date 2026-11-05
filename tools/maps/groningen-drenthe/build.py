# Builds the Groningen & Drenthe map data (frame units of the sheet) from OpenStreetMap + province borders,
# warped to fit the worksheet (see icp.py)
import json, sys, math, numpy as np
sys.path.insert(0, '/root/topo/gd')
from geo import geom_to_frame, pt, to_frame
from shapely.geometry import shape, box, Point, Polygon, MultiPolygon, LineString, MultiLineString, mapping
from shapely.ops import unary_union, linemerge, polygonize
from shapely import maximum_inscribed_circle, prepared
from shapely.strtree import STRtree
W, H = 1000.0, float(json.load(open('/root/topo/gd/rect.json'))['Hr'])
FR = box(-2, -2, W + 2, H + 2)
BB = box(5.95, 52.45, 7.45, 53.70)
O = json.load(open('/root/topo/gd/osm.geojson'))
coast, waters, canals = [], [], {}
for f in O['features']:
    p, g = f['properties'], shape(f['geometry'])
    if p.get('natural') == 'coastline':
        coast.append(g.exterior if g.geom_type == 'Polygon' else g)
    elif p.get('natural') == 'water' and g.geom_type in ('Polygon', 'MultiPolygon'):
        waters.append((g.buffer(0), p.get('name'), p.get('water')))
    elif p.get('waterway') in ('canal', 'river') and g.geom_type in ('LineString', 'MultiLineString'):
        canals.setdefault(p.get('name'), []).append(g)
# Land from the coastline (land is left of its direction)
faces = list(polygonize(unary_union([c.intersection(BB) for c in coast] + [BB.exterior])))
eps = 0.0003; landp, waterp = [], []
for c in coast:
    cs = list(c.coords)
    for (x0, y0), (x1, y1) in zip(cs[:-1], cs[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 2 * eps: continue
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2; nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        landp.append(Point(mx + nx * eps, my + ny * eps)); waterp.append(Point(mx - nx * eps, my - ny * eps))
lt, wt = STRtree(landp), STRtree(waterp)
land_ll = []
for fc in faces:
    pf = prepared.prep(fc)
    if sum(1 for i in lt.query(fc) if pf.contains(landp[i])) > sum(1 for i in wt.query(fc) if pf.contains(waterp[i])): land_ll.append(fc)
land_ll = unary_union(land_ll)
print('land', round(land_ll.area, 4), 'faces', len(faces))
k2 = (111.32 * math.cos(math.radians(53))) * 111.32
# The lakes the sheet shows (the Oldambtmeer is newer than the sheet, so it is left out)
LAKES = {'Lauwersmeer', 'Schildmeer', 'Hondshalstermeer', 'Leekstermeer', 'Paterswoldsemeer', 'Zuidlaardermeer', 'Beulakerwijde', 'Kleine Beulakerwijde',
         'Belterwijde', 'Bovenwijde', 'Schutsloterwijde', 'Burgumer Mar', 'De Leien', 'Großes Meer'}
lakes_ll = unary_union([g for g, n, w in waters if n in LAKES and w not in ('canal', 'river')])
land = geom_to_frame(land_ll.intersection(box(5.95, 52.45, 7.45, 53.70)), 0.002).buffer(0).intersection(FR)
lakes = geom_to_frame(lakes_ll.intersection(land_ll), 0.002).buffer(0).intersection(land)
# light generalisation like a school map
land = land.buffer(0.8, join_style=1).buffer(-0.8, join_style=1).buffer(-0.4, join_style=1).buffer(0.4, join_style=1)
land = unary_union([p for p in getattr(land, 'geoms', [land]) if p.area > 4]).simplify(0.35)
lakes = unary_union([p for p in getattr(lakes, 'geoms', [lakes]) if p.area > 8]).simplify(0.4)
sea = FR.difference(land)
# Provinces and Germany
A1 = {f['properties']['shapeName']: shape(f['geometry']).buffer(0) for f in json.load(open('/root/topo/data/nl/nld_adm1.geojson'))['features']}
adm = {k: geom_to_frame(A1[k].intersection(box(5.5, 52.2, 7.6, 53.8)).simplify(0.0008), 0.002).buffer(0).simplify(0.35) for k in ('Groningen', 'Drenthe', 'Fryslân', 'Overijssel', 'Flevoland', 'Gelderland')}
nl = unary_union(list(adm.values()))
def clean(g, minarea=3):
    ps = [p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and p.area > minarea]
    return unary_union(ps) if ps else Polygon()
prov = {k: clean(land.intersection(adm[k]).simplify(0.2)) for k in ('Groningen', 'Drenthe', 'Fryslân', 'Overijssel')}
germany = clean(land.difference(nl.buffer(0.6)))
other = clean(land.difference(unary_union(list(prov.values()) + [germany])), 60)
print({k: round(v.area) for k, v in prov.items()}, 'de', round(germany.area), 'other', round(other.area))
# Seas (lon/lat polygons, cut by the land)
SEAS = {
    'waddenzee': Polygon([(5.8, 53.2), (5.8, 53.47), (6.35, 53.505), (6.47, 53.54), (6.62, 53.548), (6.75, 53.56), (6.83, 53.45), (6.83, 53.2)]),
    'eems': Polygon([(6.83, 53.45), (6.75, 53.56), (7.3, 53.62), (7.3, 53.335), (7.09, 53.335), (7.03, 53.29), (6.93, 53.3)]),
    'dollard': Polygon([(7.03, 53.29), (7.09, 53.335), (7.35, 53.335), (7.35, 53.15), (7.0, 53.15)]),
}
seas = {k: clean(sea.intersection(geom_to_frame(p, 0.01).buffer(0)), 20) for k, p in SEAS.items()}
print('seas', {k: round(v.area) for k, v in seas.items()})
# Canals (centre lines): Eemskanaal on the list, the others as on the sheet
def canal(names):
    ls = [g for n in names for g in canals.get(n, [])]
    if not ls: print('no canal', names); return LineString()
    g = linemerge(unary_union([geom_to_frame(l, 0.002) for l in ls]))
    return g.intersection(FR).simplify(0.4)
eemskanaal = canal(['Eemskanaal'])
decor = [canal(['Van Starkenborghkanaal', 'Prinses Margrietkanaal']), canal(['Winschoterdiep']), canal(['Noord-Willemskanaal']), canal(['Drentsche Hoofdvaart']), canal(['Reitdiep'])]
# Hondsrug: a band along the ridge, Groningen to Emmen (lon/lat centre line, about 3 km each side)
ridge = geom_to_frame(LineString([(6.585, 53.19), (6.63, 53.13), (6.69, 53.07), (6.745, 53.01), (6.79, 52.94), (6.84, 52.87), (6.895, 52.80), (6.93, 52.75)]), 0.002)
u0, v0 = to_frame(6.7, 53.0); u1, v1 = to_frame(6.7 + 3 / (111.32 * math.cos(math.radians(53))), 53.0)
hondsrug = ridge.buffer(float(math.hypot(u1[0] - u0[0], v1[0] - v0[0])), cap_style=1).intersection(land).simplify(0.5)
CITIES = {'appingedam': (6.857, 53.321), 'assen': (6.563, 52.993), 'coevorden': (6.741, 52.661), 'delfzijl': (6.928, 53.330), 'emmen': (6.906, 52.786),
          'groningenstad': (6.566, 53.219), 'hoogeveen': (6.476, 52.722), 'klazienaveen': (6.993, 52.728), 'meppel': (6.196, 52.696), 'schoonebeek': (6.884, 52.662),
          'stadskanaal': (6.950, 52.990), 'terapel': (7.069, 52.877), 'veendam': (6.877, 53.106), 'westerbork': (6.607, 52.849), 'winschoten': (7.034, 53.144), 'zuidlaren': (6.681, 53.094)}
cities = {k: pt(*v) for k, v in CITIES.items()}
INSET = box(705, -200, 955, 140); SB = box(760, 1235, 975, 1290)
VIS = box(4, 4, W - 4, H - 4).difference(INSET).difference(SB)
def lab(g):
    v = g.intersection(VIS)
    if v.is_empty: return None
    if v.geom_type != 'Polygon': v = max([p for p in getattr(v, 'geoms', []) if p.geom_type == 'Polygon'], key=lambda p: p.area)
    c = maximum_inscribed_circle(v, 0.5).coords[0]
    return [round(c[0], 1), round(c[1], 1)]
cityzone = unary_union([Point(p).buffer(30) for p in cities.values()])
labels = {'groningen': lab(prov['Groningen'].difference(cityzone)), 'drenthe': pt(6.45, 52.86), 'fryslan': lab(prov['Fryslân']),
          'overijssel': lab(prov['Overijssel']), 'duitsland': lab(germany), 'hondsrug': pt(6.77, 52.97)}
labels.update({k: lab(g) for k, g in seas.items()})
labels['eemskanaal'] = pt(6.75, 53.27)
labels['eems'] = pt(7.0, 53.43)
def d_poly(g):
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
# Borders: dashed between the provinces (also through the Wadden, like the sheet), heavy along Germany on land
dashed = unary_union([adm['Groningen'].boundary.intersection(adm[o].buffer(1)) for o in ('Drenthe', 'Fryslân')] +
                     [adm['Drenthe'].boundary.intersection(adm[o].buffer(1)) for o in ('Fryslân', 'Overijssel')]).intersection(box(0, 0, W, H))
heavy = nl.boundary.intersection(germany.buffer(1.2)).intersection(land.buffer(0.5)).simplify(0.3)
out = {
    'W': W, 'H': H, 'title': 'Groningen en Drenthe', 'style': {'sea': 'specks', 'grey': 'light', 'inset': 'light'},
    'insetBox': {'x': 712, 'y': -127, 'w': 234, 'h': 260},
    'base': {'grey': d_poly(other), 'white': '', 'land': d_poly(land), 'borders': '', 'heavy': d_lines(heavy), 'dashed': d_lines(dashed),
             'lakes': d_poly(lakes), 'decor': [d_lines(d) for d in decor + [eemskanaal]],
             'dotted': d_poly(hondsrug)},   # the Hondsrug is not drawn on the sheet; a dotted outline shows where it is   # the Eemskanaal is drawn like the other canals
    'areaFill': {'fryslan': 'grey', 'overijssel': 'grey', 'duitsland': 'grey'},
    'countries': {'drenthe': d_poly(prov['Drenthe']), 'fryslan': d_poly(prov['Fryslân']), 'groningen': d_poly(prov['Groningen']), 'overijssel': d_poly(prov['Overijssel']), 'duitsland': d_poly(germany)},
    'states': {'hondsrug': d_poly(hondsrug)},
    'waters': {k: d_poly(g) for k, g in seas.items()},
    'lines': {'eemskanaal': d_lines(eemskanaal)},
    'cities': cities, 'carets': {}, 'labels': labels,
    'scalebar': {'x': 776.0, 'y': 1272.7, 'len': 179.7, 'label': '15 km', 'tick': 12, 'mid': 5, 'textDy': 16},
    'credit': '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bijdragers</a>, CBS/Kadaster, geoBoundaries',
}
json.dump(out, open('/root/topo/gd/gd_map.json', 'w'))
print('labels', labels)
print('size KB', round(len(json.dumps(out)) / 1024))
