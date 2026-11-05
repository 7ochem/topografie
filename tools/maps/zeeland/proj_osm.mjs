// Projects the OSM layers (lon/lat) into the frame of the Zeeland sheet, same projection as the game map
import * as d3 from 'd3-geo'; import fs from 'fs';
const rd = f => JSON.parse(fs.readFileSync(f));
const fit = rd('zl/fit_stereo.json'), fr = rd('zl/frame2.json');
const k = fr.k;
const proj = d3.geoStereographic().rotate([-fit.p[0], -fit.p[1], fit.p[2]]).angle(fr.angle).scale(1000 * k).translate([-fr.x0 * k, -fr.y0 * k]);
const P = c => typeof c[0] === 'number' ? proj(c).map(v => +v.toFixed(3)) : c.map(P);
const L = rd('osm/osm_ll.json');
const out = Object.fromEntries(Object.entries(L).map(([key, g]) => [key, { type: g.type, coordinates: P(g.coordinates) }]));
fs.writeFileSync('osm/osm_frame.json', JSON.stringify(out));
