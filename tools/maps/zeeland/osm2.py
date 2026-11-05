# Builds Zeeland map data from OpenStreetMap coast and water (frame units), same style and frame as the traced sheet
import json, numpy as np
from shapely.geometry import shape, box, Point, Polygon, MultiPolygon, LineString
from shapely.ops import unary_union
from shapely import affinity, maximum_inscribed_circle
A = np.array(json.load(open('zl2/align.json'))['A'])
G = json.load(open('zl2/geo_frame.json')); O = json.load(open('osm/osm_frame.json'))
W, H = 1000, 1283.1
aff = lambda g: affinity.affine_transform(g, [A[0, 0], A[0, 1], A[1, 0], A[1, 1], A[0, 2], A[1, 2]])
al = lambda g: aff(shape(g).buffer(0))
FR = box(-2, -2, W + 2, H + 2)
land = al(O['land']).intersection(FR)
# light generalisation, like a school map: drop details smaller than about 1 map unit (70 m)
# close water narrower than ~2 units (ditches, creeks, small canals), then drop land details narrower than ~1 unit
land = land.buffer(1.0, join_style=1).buffer(-1.0, join_style=1)
land = land.buffer(-0.5, join_style=1).buffer(0.5, join_style=1)
land = unary_union([p for p in getattr(land, 'geoms', [land]) if p.area > 6])
# Canals: the school map shows no Kanaal door Zuid-Beveland / Walcheren, and Gent-Terneuzen as one line.
# Fill them in, inside a corridor along their course (frame units, computed with osm/pts.mjs)
def corridor(pts, w): return aff(LineString(pts)).buffer(w)
# Canals = the narrow water inside a box around each canal (closing the land fills them)
CANALS = {
    'gentterneuzen': ((463, 1000, 560, H + 5), 7),  # east of the Braakman, which stays
    'zuidbeveland': ((640, 690, 740, 870), 6),
    'walcheren': ((230, 660, 350, 830), 3),
}
canal_water = {}
for k, (bx, rad) in CANALS.items():
    c = box(*bx)
    closed = land.buffer(rad, join_style=1).buffer(-rad, join_style=1).intersection(c)
    canal_water[k] = closed.difference(land)
    land = unary_union([land, closed])
    print('canal filled', k, round(canal_water[k].area))
GT_COURSE = [(506.5, 1000), (495.5, 1071.8), (486.5, 1121.4), (475.4, 1179.2), (464.3, 1237), (432.3, 1302.8)]
# Centre line of Gent-Terneuzen: middle of the canal water in horizontal cross-sections
cw = canal_water['gentterneuzen']; mid = []
gt = aff(LineString(GT_COURSE))
for v in np.arange(1004, H + 2, 2.0):
    cut = LineString([(300, v), (700, v)]).intersection(cw)
    segs = [g for g in getattr(cut, 'geoms', [cut]) if g.geom_type == 'LineString' and g.length > 0.3]
    if not segs: continue
    xg = gt.interpolate(gt.project(Point(500, v))).x
    s_ = min(segs, key=lambda g: abs(g.centroid.x - xg))
    if abs(s_.centroid.x - xg) < 25: mid.append((s_.centroid.x, v))
gt_line = LineString(mid).simplify(0.6) if len(mid) > 2 else None
print('gent-terneuzen line points', len(mid))
# small lakes and thin creeks inland are left out, like on the sheet
def keep_hole(r):
    h = Polygon(r)
    return h.area > 150 and not h.buffer(-2.5).is_empty
land = MultiPolygon([Polygon(p.exterior, [r for r in p.interiors if keep_hole(r)]) for p in getattr(land, 'geoms', [land])]).buffer(0)
land = land.simplify(0.35).buffer(0)
water = FR.difference(land)
adm = {k: al(G['adm1'][k]) for k in G['adm1']}
nlall = unary_union(list(adm.values()))
zh = land.intersection(adm['Zuid-Holland']); nb = land.intersection(adm['Noord-Brabant'])
# Belgium: land on the Belgian side of the border (not the gaps in the Dutch boundary data inside the country)
bel = al(G['land']['BEL']).buffer(4)
be = land.intersection(bel).difference(nlall)
# Zeeland gets the land in and right around its boundary (canals and harbours can fall outside the boundary data)
zeeland = land.intersection(adm['Zeeland'].buffer(4)).difference(unary_union([zh, nb, be]))
other = land.difference(unary_union([zeeland, zh, nb, be]))
clean = lambda g: unary_union([p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and p.area > 3])
zeeland, zh, nb, be, other = map(clean, (zeeland, zh, nb, be, other))
print('areas', {k: round(v.area) for k, v in dict(zeeland=zeeland, zh=zh, nb=nb, be=be, other=other).items()})
dots = {k: [round(v, 1) for v in (A[:2, :2] @ np.array(p) + A[:2, 2])] for k, p in G['cities'].items()}
# Gebieden from the municipalities
regions = {'walcheren': ['Vlissingen', 'Middelburg', 'Veere'], 'zuidbeveland': ['Borsele', 'Goes', 'Kapelle', 'Reimerswaal'], 'zeeuwsvlaanderen': ['Sluis', 'Terneuzen', 'Hulst']}
reg = {k: clean(zeeland.intersection(unary_union([al(G['adm2'][m]) for m in v]))) for k, v in regions.items()}
# keep only real pieces (Walcheren municipalities also hold bits of Noord-Beveland etc. via water borders)
for k in reg:
    ps = [p for p in getattr(reg[k], 'geoms', [reg[k]]) if p.area > 60]
    reg[k] = unary_union(ps)
# Waters: named OSM lakes, the rest of the water is sea, split at the mouth of the Westerschelde (Vlissingen - Breskens)
oost = al(O['oosterschelde']).intersection(water); grev = al(O['grevelingen']).intersection(water)
lakes = al(O['water'])
sea = water.difference(lakes.buffer(0.5))
ws_area = Polygon([(250, 812), (1100, 812), (1100, 1400), (213, 1400), (213, 888)])
waters = {'noordzee': sea.difference(ws_area), 'westerschelde': sea.intersection(ws_area), 'oosterschelde': oost, 'grevelingen': grev}
waters = {k: unary_union([p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and p.area > 20]) for k, g in waters.items()}
print('waters', {k: round(v.area) for k, v in waters.items()})
# Lines: all shores; heavy national border; dashed province borders of Zeeland
ink = land.boundary.intersection(box(0, 0, W, H))
# Dams and the Zeelandbrug as thin lines over the water (shortest crossing between the two shores)
from shapely.ops import nearest_points
pieces = list(getattr(land, 'geoms', [land]))
pick = lambda pt: min(pieces, key=lambda q: q.distance(Point(pt)))
schouwen = pick(dots['zierikzee'])
def cross(a, b, win):
    w = box(*win); p, q = nearest_points(a.intersection(w), b.intersection(w)); return LineString([p, q])
# Zeelandbrug: along its course (Zierikzee - Colijnsplaat), from shore to shore
zb = LineString([(615, 510), (549, 589)])
zb_w = zb.difference(land)
zb_seg = max(getattr(zb_w, 'geoms', [zb_w]), key=lambda g: g.length)
dams = [zb_seg]
nj_pt = aff(Point(396.6, 515.9))
nj = max([q for q in pieces if q is not schouwen and q.distance(nj_pt) < 12], key=lambda q: q.area)
south = min([q for q in pieces if q is not schouwen and q is not nj and q.centroid.y > nj.centroid.y], key=lambda q: q.distance(nj))
dams += [cross(schouwen, nj, (nj_pt.x - 60, nj_pt.y - 60, nj_pt.x + 60, nj_pt.y + 60)), cross(nj, south, (nj_pt.x - 60, nj_pt.y - 60, nj_pt.x + 60, nj_pt.y + 80))]
print('dams', [[tuple(round(c, 1) for c in xy) for xy in d_.coords] for d_ in dams], 'nj area', round(nj.area))
ink = unary_union([ink] + dams + ([gt_line] if gt_line else []))
border = nlall.boundary.intersection(be.buffer(1.5)).intersection(land.buffer(1))
dashed = unary_union([adm['Zeeland'].boundary.intersection(adm['Noord-Brabant'].buffer(1)), adm['Zeeland'].boundary.intersection(adm['Zuid-Holland'].buffer(1))]).intersection(box(0, 0, W, H))
# only on land and in the inland waters, not out into the North Sea
dashed = dashed.intersection(unary_union([land, al(O['water'])]).buffer(2))
INSET = box(708, -200, 950, 140); SB = box(712, 1215, 966, 1263)
VIS = box(4, 4, W - 4, H - 4).difference(INSET).difference(SB)
def lab(g):
    v = g.intersection(VIS)
    if v.is_empty: return None
    if v.geom_type != 'Polygon': v = max([p for p in getattr(v, 'geoms', []) if p.geom_type == 'Polygon'], key=lambda p: p.area)
    c = maximum_inscribed_circle(v, 0.5).coords[0]
    return [round(c[0], 1), round(c[1], 1)]
countries = {'zeeland': zeeland, 'zuidholland': zh, 'noordbrabant': nb, 'belgie': be}
cityzone = unary_union([Point(p).buffer(28) for p in dots.values()])
labels = {k: lab(g) for k, g in countries.items()}
labels.update({k: lab(g.difference(cityzone)) for k, g in reg.items()})
labels.update({k: lab(g) for k, g in waters.items()})
labels['oosterschelde'] = lab(waters['oosterschelde'].intersection(box(450, 500, 760, 700)))
labels['grevelingen'] = lab(waters['grevelingen'].intersection(box(500, 250, 760, 430)))
zp = [p for p in zeeland.geoms if p.buffer(3).contains(Point(dots['zierikzee']))]
if zp: labels['zeeland'] = lab(zp[0])
def d_poly(g, tol=0.5):
    g = g.simplify(tol).buffer(0); s = ''
    for p in getattr(g, 'geoms', [g]):
        if p.geom_type != 'Polygon' or p.is_empty: continue
        for ring in [p.exterior] + list(p.interiors):
            c = np.round(np.array(ring.coords)[:-1], 1); s += 'M' + 'L'.join(f'{x:g},{y:g}' for x, y in c) + 'Z'
    return s
def d_lines(g):
    s = ''
    for l in getattr(g, 'geoms', [g]):
        if l.geom_type == 'LineString' and l.length > 0.5:
            c = np.round(np.array(l.simplify(0.25).coords), 1); s += 'M' + 'L'.join(f'{x:g},{y:g}' for x, y in c)
        elif l.geom_type in ('MultiLineString', 'GeometryCollection'): s += d_lines(l)
    return s
out = {
    'W': W, 'H': H, 'title': 'Zeeland', 'style': {'sea': 'specks', 'grey': 'light'},
    'insetBox': {'x': 710, 'y': -128.5, 'w': 237.5, 'h': 267},
    'credit': '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bijdragers</a>, CBS/Kadaster, geoBoundaries',
    'base': {'grey': d_poly(other), 'white': '', 'land': d_poly(land), 'ink': d_lines(ink), 'borders': '', 'heavy': d_lines(border), 'dashed': d_lines(dashed), 'lakes': '', 'decor': []},
    'areaFill': {'zeeland': 'land', 'zuidholland': 'grey', 'noordbrabant': 'grey', 'belgie': 'grey'},
    'countries': {k: d_poly(g) for k, g in countries.items()},
    'states': {k: d_poly(g) for k, g in reg.items()},
    'waters': {k: d_poly(g) for k, g in waters.items()},
    'lines': {}, 'cities': dots, 'carets': {}, 'labels': labels,
    'scalebar': {'x': 727.0, 'y': 1256.0, 'len': 225.5, 'label': '15 km', 'tick': 12, 'mid': 5, 'textDy': 16},
}
json.dump(out, open('osm/osm_map.json', 'w'))
print('labels', labels); print('size KB', round(len(json.dumps(out)) / 1024))
