# Inset of the sheet: the Netherlands as one outline (IJsselmeer as water), Zeeland as islands
import json
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
prov = {f['properties']['statnaam']: shape(f['geometry']).buffer(0) for f in json.load(open('data/nl/provincie_2023.geojson'))['features']}
osm = {f['properties']['A3']: shape(f['geometry']).buffer(0) for f in json.load(open('data/nl/land_clip.geojson'))['features']}
zl = osm['NLD'].intersection(prov['Zeeland'].buffer(0.01)).buffer(0.002).buffer(-0.002)
rest = unary_union([g for k, g in prov.items() if k != 'Zeeland'])
nl = unary_union([rest, zl]).buffer(0.003).buffer(-0.003).simplify(0.004)
zl = zl.simplify(0.003)
json.dump({'nl': mapping(nl), 'zl': mapping(zl)}, open('zl2/inset_ll.json', 'w'))
print(nl.geom_type, round(nl.area, 3), zl.geom_type, round(zl.area, 4))
