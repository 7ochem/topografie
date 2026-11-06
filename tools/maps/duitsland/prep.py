# Cuts the countries around Germany out of geo-maps countries-land-100m (OpenStreetMap coast and borders)
# and repairs their geometry, once, for icp.py and build.py.
# Source: npm @geo-maps/countries-land-100m, unpacked to work/data/gm/ (see tools/maps/README.md).
# Run from tools/maps/: .venv/bin/python duitsland/prep.py
import json
from pathlib import Path
from shapely.geometry import shape, box, mapping
from shapely import make_valid
HERE = Path(__file__).parent; WORK = HERE.parent / 'work' / 'duitsland'; DATA = HERE.parent / 'work' / 'data'
BB = box(2.0, 45.0, 17.5, 56.3)
COUNTRIES = ('NLD', 'BEL', 'LUX', 'FRA', 'DEU', 'DNK', 'SWE', 'POL', 'CZE', 'AUT', 'CHE', 'LIE', 'ITA', 'SVN', 'HRV')
out = {}
for f in json.load(open(DATA / 'gm' / 'package' / 'map.geo.json'))['features']:
    a3 = f['properties']['A3']
    if a3 not in COUNTRIES: continue
    g = make_valid(shape(f['geometry'])).intersection(BB)
    g = make_valid(g)
    polys = [p for p in getattr(g, 'geoms', [g]) if p.geom_type in ('Polygon', 'MultiPolygon')]
    out[a3] = mapping(polys[0] if len(polys) == 1 else make_valid(shape({'type': 'MultiPolygon', 'coordinates': [c for p in polys for c in (mapping(p)['coordinates'] if p.geom_type == 'MultiPolygon' else [mapping(p)['coordinates']])]})))
    print(a3, round(shape(out[a3]).area, 3))
json.dump(out, open(WORK / 'countries_ll.json', 'w'))
