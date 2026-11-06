# Builds the Duitsland map data (frame units of the sheet), warped to fit the worksheet (see icp.py):
# countries, coast and borders from geo-maps countries-land (OpenStreetMap), IJsselmeer and Markermeer from OpenStreetMap,
# the Bodensee and the rivers from Natural Earth,
# Bavaria and the Ruhr area from geoBoundaries (BKG), the mountain areas from OpenStreetMap (via Nominatim).
# Writes public/maps/duitsland.json. Run from tools/maps/ after prep.py and icp.py: .venv/bin/python duitsland/build.py
import json, sys, numpy as np
from pathlib import Path
HERE = Path(__file__).parent; ROOT = HERE.parents[2]; WORK = HERE.parent / 'work' / 'duitsland'; DATA = HERE.parent / 'work' / 'data'
sys.path.insert(0, str(HERE))
from geo import geom_to_frame, pt
from shapely.geometry import shape, box, Point, Polygon, LineString
from shapely.ops import unary_union, linemerge, nearest_points, polygonize
from shapely import maximum_inscribed_circle
W, H = 1000.0, float(json.load(open(HERE / 'rect.json'))['Hr'])
FR = box(-2, -2, W + 2, H + 2)
VIEW = box(1.5, 44.5, 17.5, 56.5)   # lon/lat, a bit more than the frame
polys = lambda g: [p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and not p.is_empty]
fill = lambda g: unary_union([Polygon(p.exterior) for p in polys(g)])   # without holes: the sheet draws no small lakes
def clean(g, minarea=1.5):
    ps = [p for p in polys(g) if p.area > minarea]
    return unary_union(ps) if ps else Polygon()
to_f = lambda g, simp=0.002: geom_to_frame(g.simplify(simp), 0.02).buffer(0)
# Lakes the sheet shows: the IJsselmeer and the Markermeer (OpenStreetMap, via Nominatim) and the Bodensee (Natural Earth).
# They are speckled water like the sea: holes in the land. The buffer takes away the thin dikes, which are drawn as lines.
IJM = {r['osm_id']: Polygon(shape(r['geojson']).exterior) for r in json.load(open(DATA / 'ijsselmeer_nominatim.json'))}
ij, mm = IJM[945096], IJM[49368]
# The border lakes around Flevoland (Gooimeer to Ketelmeer, Overpass): the sheet draws Flevoland as an island
def osm_area(rel):
    outer = [LineString([(p['lon'], p['lat']) for p in m['geometry']]) for m in rel['members'] if m['type'] == 'way' and m.get('role') != 'inner']
    return unary_union(list(polygonize(unary_union(outer))))
randmeren = [osm_area(e) for e in json.load(open(DATA / 'randmeren_osm.json'))['elements'] if e['type'] == 'relation']
bodensee = [shape(f['geometry']) for f in json.load(open(DATA / 'ne_10m_lakes.geojson'))['features'] if f['properties'].get('name') == 'Bodensee']
lakes = clean(unary_union([to_f(l) for l in [ij, mm] + randmeren + bodensee]).buffer(0.4).intersection(FR), 4).simplify(0.3)
# Countries (A3 codes of geo-maps), cut to the frame and without the lakes
G = {k: shape(g) for k, g in json.load(open(WORK / 'countries_ll.json')).items()}   # made by prep.py
# The Houtribdijk (between IJsselmeer and Markermeer) and the Afsluitdijk (between IJsselmeer and Waddenzee)
sea_ll = VIEW.difference(unary_union([fill(g) for g in G.values()]))
dikes = geom_to_frame(unary_union([ij.exterior.intersection(mm.buffer(0.004)), ij.exterior.intersection(sea_ll.buffer(0.004))]), 0.01).simplify(0.3)
ctry = {k: clean(fill(to_f(fill(g.intersection(VIEW)))).intersection(FR).difference(lakes).simplify(0.3)) for k, g in G.items()}
land = unary_union(list(ctry.values()))
print({k: round(v.area) for k, v in ctry.items()})
LIST = {'belgie': 'BEL', 'denemarken': 'DNK', 'duitsland': 'DEU', 'frankrijk': 'FRA', 'italie': 'ITA', 'luxemburg': 'LUX', 'nederland': 'NLD',
        'oostenrijk': 'AUT', 'polen': 'POL', 'slovenie': 'SVN', 'tsjechie': 'CZE', 'zwitserland': 'CHE'}
# Sweden, Liechtenstein, Croatia, and the gaps between countries (lakes with a border through them, like the
# Lake of Geneva) except the lakes the sheet shows
gaps = clean(fill(land).difference(land).difference(lakes.buffer(0.5)), 4)
other = unary_union([g for k, g in ctry.items() if k not in LIST.values()] + [gaps])
land = unary_union([land, gaps])
de = ctry['DEU']
# National borders: each shared border once (the outline of one of the two neighbours)
keys = sorted(ctry); bl = []
for i, a in enumerate(keys):
    for b in keys[i + 1:]:
        if not ctry[a].is_empty and not ctry[b].is_empty and ctry[a].buffer(1).intersects(ctry[b]):
            bl.append(ctry[a].boundary.intersection(ctry[b].buffer(0.6)))
borders = unary_union(bl).intersection(box(0.5, 0.5, W - 0.5, H - 0.5))
# Bavaria and the Ruhr area (the 15 districts of the Regionalverband Ruhr); their borders inside Germany are dashed
A1 = {f['properties']['shapeName']: shape(f['geometry']) for f in json.load(open(DATA / 'deu_adm1.geojson'))['features']}
A3 = {f['properties']['shapeName']: shape(f['geometry']) for f in json.load(open(DATA / 'deu_adm3.geojson'))['features']}
RUHR = ['Duisburg', 'Essen', 'Mülheim an der Ruhr', 'Oberhausen', 'Bottrop', 'Gelsenkirchen', 'Bochum', 'Dortmund', 'Hagen', 'Hamm', 'Herne']
ruhr_ll = unary_union([A3[n + ', Kreisfreie Stadt'].buffer(0.0005) for n in RUHR] + [A3[n].buffer(0.0005) for n in ('Wesel', 'Recklinghausen', 'Unna', 'Ennepe-Ruhr-Kreis')]).buffer(-0.0005)
bav = clean(to_f(A1['Bayern']).intersection(de))
ruhr = clean(to_f(ruhr_ll, 0.004).intersection(de)).simplify(0.4)
dashed = unary_union([bav.boundary.difference(de.boundary.buffer(1.2)), ruhr.boundary]).simplify(0.3)
# Rivers (Natural Earth): Rhine with the Alpine Rhine up to the end of the sheet's line, and the Dutch branches the sheet draws
RV = [f for fn in ('ne_10m_rivers_lake_centerlines.geojson', 'ne_10m_rivers_europe.geojson') for f in json.load(open(DATA / fn))['features']]
water_free = land.difference(lakes).buffer(0.4)
def river(names, cut=None):
    g = unary_union([shape(f['geometry']).intersection(VIEW) for f in RV if f['properties'].get('name') in names])
    if cut is not None: g = g.difference(cut)
    g = geom_to_frame(g, 0.02).intersection(water_free).intersection(box(0, 0, W, H))
    g = unary_union(g)
    return linemerge(g) if g.geom_type == 'MultiLineString' else g
rijn = river({'Rhein', 'Rhine', 'Rhin', 'Nederrijn', 'Lek', 'Waal'}, cut=unary_union([box(5.0, 44.0, 9.3, 47.4), box(9.3, 44.0, 10.5, 47.05)])).simplify(0.3)
elbe = river({'Elbe'}).simplify(0.3)
moezel = river({'Mosel', 'Moselle'}).simplify(0.3)
saar = river({'Sarre', 'Saar'}).simplify(0.3)
CITIES = {'aken': (6.084, 50.776), 'berlijn': (13.405, 52.520), 'bonn': (7.100, 50.734), 'bremen': (8.807, 53.079), 'dortmund': (7.466, 51.514),
          'dresden': (13.738, 51.050), 'duisburg': (6.762, 51.435), 'dusseldorf': (6.776, 51.228), 'essen': (7.012, 51.456), 'frankfurt': (8.682, 50.111),
          'hamburg': (9.993, 53.551), 'hannover': (9.732, 52.375), 'keulen': (6.958, 50.938), 'leipzig': (12.374, 51.340), 'magdeburg': (11.628, 52.120),
          'munchen': (11.576, 48.137), 'neurenberg': (11.077, 49.452), 'stuttgart': (9.182, 48.776)}
cities = {k: pt(*v) for k, v in CITIES.items()}
dots = [pt(4.900, 52.373)]   # Amsterdam: a dot on the sheet, not on the names list
cityzone = unary_union([Point(p).buffer(14) for p in list(cities.values()) + dots])
# Mountain areas: the Harz and the Black Forest as drawn regions in OpenStreetMap (via Nominatim); the Sauerland as its
# districts Hochsauerlandkreis, Märkischer Kreis and Olpe (geoBoundaries); the Eifel as its nature parks Hohes Venn-Eifel,
# Südeifel, Rhein-Ahr-Eifel and the district Vulkaneifel (OpenStreetMap), south of the Cologne lowland (50.55° N).
# Carets on a regular grid inside each area, like the sheet; never traced from the photo.
NOM = {r['osm_id']: shape(r['geojson']).buffer(0) for fn in ('ranges_nominatim.json', 'vulkaneifel_nominatim.json') for r in json.load(open(DATA / fn))}
RANGES = {'harz': NOM[3734731], 'zwartewoud': NOM[3255371],
          'sauerland': unary_union([A3[n] for n in ('Hochsauerlandkreis', 'Märkischer Kreis', 'Olpe')]),
          'eifel': unary_union([NOM[i] for i in (334377, 16756102, 16732933, 62615)]).intersection(box(5.0, 49.0, 8.0, 50.55))}
keep_free = unary_union([cityzone, ruhr.buffer(3), rijn.buffer(4), moezel.buffer(4), de.boundary.buffer(4)])
def carets(area, step=14.0, rowh=11.0):
    inner = area.difference(keep_free).buffer(-1.5)
    x0, y0, x1, y1 = area.bounds; rng = np.random.default_rng(7); out = []
    for j, y in enumerate(np.arange(y0 + rowh / 2, y1, rowh)):
        for x in np.arange(x0 + (step / 2 if j % 2 else 0), x1, step):
            p = (x + rng.uniform(-1.5, 1.5), y + rng.uniform(-1.0, 1.0))
            if inner.contains(Point(p)): out.append([round(p[0], 1), round(p[1], 1)])
    return out
areas = {k: to_f(g, 0.003).intersection(de) for k, g in RANGES.items()}
car = {k: carets(a) for k, a in areas.items()}
print('carets', {k: len(v) for k, v in car.items()})
# Label points
VIS = box(4, 4, W - 4, H - 4)
def lab(g, avoid=cityzone):
    v = g.intersection(VIS).difference(avoid)
    if v.is_empty: v = g.intersection(VIS)
    if v.geom_type != 'Polygon': v = max(polys(v), key=lambda p: p.area)
    c = maximum_inscribed_circle(v, 0.5).coords[0]
    return [round(c[0], 1), round(c[1], 1)]
def on_line(g, lon, lat):
    p = nearest_points(g, Point(pt(lon, lat)))[0]; return [round(p.x, 1), round(p.y, 1)]
labels = {k: lab(ctry[a]) for k, a in LIST.items()}
# The Ruhr area's name goes in its northern part, above the names of its three cities
ruhr_north = ruhr.intersection(box(0, 0, W, min(cities[k][1] for k in ('duisburg', 'essen', 'dortmund')) - 40)).difference(rijn.buffer(14))
labels.update({'beieren': lab(bav), 'ruhrgebied': lab(ruhr_north),
               'rijn': on_line(rijn, 8.42, 49.25), 'elbe': on_line(elbe, 11.1, 53.15), 'moezel': on_line(moezel, 6.95, 49.92)})
def d_poly(g):
    s = ''
    for p in polys(g):
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
    'W': W, 'H': H, 'title': 'Duitsland', 'style': {'sea': 'specks'},
    # the two dikes go with the borders: the same thin line as the coast
    'base': {'grey': d_poly(other), 'white': '', 'land': d_poly(land), 'borders': d_lines(borders) + d_lines(dikes),
             'heavy': '', 'dashed': d_lines(dashed), 'lakes': '', 'decor': [d_lines(saar)], 'dots': dots},
    # Germany and the Netherlands are white on the sheet, the other countries grey
    'areaFill': {k: 'grey' for k in LIST if k not in ('duitsland', 'nederland')},
    'countries': {k: d_poly(ctry[a]) for k, a in LIST.items()},
    'states': {'beieren': d_poly(bav), 'ruhrgebied': d_poly(ruhr)},
    'waters': {},
    'lines': {'rijn': d_lines(rijn), 'elbe': d_lines(elbe), 'moezel': d_lines(moezel)},
    'cities': cities, 'carets': car, 'labels': labels,
    'scalebar': None,
    'credit': '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-bijdragers</a>, '
              '<a href="https://www.naturalearthdata.com" target="_blank" rel="noopener">Natural Earth</a>, geoBoundaries (BKG)',
}
json.dump(out, open(ROOT / 'public' / 'maps' / 'duitsland.json', 'w'), separators=(',', ':'), ensure_ascii=False)
print('labels', labels)
print('size KB', round(len(json.dumps(out)) / 1024))
