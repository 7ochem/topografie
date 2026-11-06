# Map scripts

These scripts made the map data in `public/maps/`. They are a record of how each map was built, not a ready-to-run
pipeline: they ran in a separate workspace, and the paths still point there (`data/`, `node_modules/`, a work
folder per map, sometimes `/root/topo/...`). The output went to `build/mapdata_<id>.json`; that file was then
copied to `public/maps/<id>.json`. Use them as the starting point for a new map and fix the paths on the way.

## Install

From this folder (`tools/maps/`):

```
pyenv install --skip-existing     # Python version from .python-version
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
npm install                       # d3-geo, topojson, world-atlas (package.json)
```

## Source data (not in the repo)

| Data | Where | Used for |
|---|---|---|
| Natural Earth 10m countries, 50m lakes, rivers, admin-1 | naturalearthdata.com | World maps |
| world-atlas (Natural Earth 50m/110m as TopoJSON) | npm `world-atlas` | Noord- & Midden-Amerika, insets |
| geo-maps countries-land 10m/100m | npm `@geo-maps/countries-land-10m` | NL/BE/DE land outline |
| geoBoundaries NLD ADM1, ADM2 | geoboundaries.org | Dutch provinces and municipalities |
| CBS provinces 2023 | cartomap / CBS | Inset of the Netherlands |
| OpenStreetMap coast, water, canals | Overpass API (query below) | Zeeland, Groningen & Drenthe |

Overpass query (change the box: south, west, north, east), run on overpass-turbo.eu, export as GeoJSON:

```
[out:json][timeout:180];
(
  way["natural"="coastline"](S,W,N,E);
  way["natural"="water"]["water"~"^(lake|reservoir|canal|river|lagoon)$"](S,W,N,E);
  relation["natural"="water"]["water"~"^(lake|reservoir|canal|river|lagoon)$"](S,W,N,E);
  way["natural"="water"]["name"](S,W,N,E);
  relation["natural"="water"]["name"](S,W,N,E);
  way["waterway"="canal"]["name"](S,W,N,E);
);
out geom;
```

## Per map

- `noord-midden-amerika/`: stereographic projection fitted to the city dots and lines of the photo
  (`fit.mjs`, `chamfer.mjs`), mountain carets traced from the photo (`carets.mjs`), `build.mjs` writes the data.
- `zeeland/`: frame and projection from the photo (`frame.mjs`, `rect.py`, `align.py`), OpenStreetMap land and
  water (`osm1.py`, `proj_osm.mjs`, `osm2.py`), inset (`inset.py`, `final.mjs`).
- `midden-oosten/`: `rect.py` (photo to frame), `icp.py` (warp: Mercator + polynomial, fitted to lines and
  control points in `gcp.json`), `geo.py` (lon/lat to frame), `build.py`, `final.mjs` (inset).
- `groningen-drenthe/`: same steps as Midden-Oosten, with OpenStreetMap and geoBoundaries data;
  the 16 city dots are the control points.

The `*.json` files next to the scripts are the fitted parameters (frame corners, control points, warp),
so a map can be rebuilt without fitting again.
