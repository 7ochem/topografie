// Projects the geodata into the frame of the Zeeland sheet (same projection as the game map), no clipping
import * as d3 from 'd3-geo'; import fs from 'fs';
const rd = f => JSON.parse(fs.readFileSync(f));
const fit = rd('zl/fit_stereo.json'), fr = rd('zl/frame2.json');
const k = fr.k;
const proj = d3.geoStereographic().rotate([-fit.p[0], -fit.p[1], fit.p[2]]).angle(fr.angle).scale(1000 * k).translate([-fr.x0 * k, -fr.y0 * k]);
const P = c => typeof c[0] === 'number' ? proj(c).map(v => +v.toFixed(2)) : c.map(P);
const geo = g => ({ type: g.type, coordinates: P(g.coordinates) });
const inBB = g => { const b = d3.geoBounds({ type: 'Feature', geometry: g }); return b[1][0] > 3.0 && b[0][0] < 4.9 && b[1][1] > 51.0 && b[0][1] < 52.1; };
const out = { land: {}, adm1: {}, adm2: {} };
for (const f of rd('data/nl/land_clip.geojson').features) out.land[f.properties.A3] = geo(f.geometry);
for (const f of rd('data/nl/nld_adm1.geojson').features) if (inBB(f.geometry)) out.adm1[f.properties.shapeName] = geo(f.geometry);
for (const f of rd('data/nl/nld_adm2.geojson').features) if (inBB(f.geometry)) out.adm2[f.properties.shapeName] = geo(f.geometry);
out.waters = Object.fromEntries(Object.entries(rd('zl/layers.json').waters).map(([k, g]) => [k, geo(g)]));
out.cities = Object.fromEntries(Object.entries({
  breskens: [3.556, 51.397], domburg: [3.497, 51.564], goes: [3.889, 51.504], hulst: [4.053, 51.280], middelburg: [3.611, 51.499],
  terneuzen: [3.828, 51.336], veere: [3.667, 51.548], vlissingen: [3.573, 51.442], yerseke: [4.050, 51.492], zierikzee: [3.917, 51.650],
}).map(([id, ll]) => [id, proj(ll)]));
fs.writeFileSync('zl2/geo_frame.json', JSON.stringify(out));
console.log(Object.keys(out.adm1), Object.keys(out.adm2).length);
// Inverse for later: frame -> lon/lat is proj.invert
