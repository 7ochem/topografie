// Builds projected map geometry for the Noord- & Midden-Amerika pack.
// Projection was fitted to the photo of the paper map (stereographic, see fit_stereo.json).
import * as d3 from 'd3-geo';
import { geoRobinson } from 'd3-geo-projection';
import * as topo from 'topojson-client';
import * as topoServer from 'topojson-server';
import * as topoSimp from 'topojson-simplify';
import fs from 'fs';

const rd = f => JSON.parse(fs.readFileSync(f));
const fit = rd('build/fit_stereo.json');
const carets = rd('build/carets_ll.json');

// Frame of the paper map in fitted projection units (scale 1000)
const F = { x0: -292, y0: -440.5, x1: 291, y1: 334 };
const W = 1000;
const k = W / (F.x1 - F.x0);
const H = +((F.y1 - F.y0) * k).toFixed(1);

const proj = d3.geoStereographic()
  .rotate([-fit.p[0], -fit.p[1], fit.p[2]])
  .scale(1000 * k)
  .translate([-F.x0 * k, -F.y0 * k])
  .clipExtent([[-2, -2], [W + 2, H + 2]]);
const path = d3.geoPath(proj).digits(1);
const pt = ll => proj(ll).map(v => +v.toFixed(1));

// Rewind GeoJSON (RFC7946 counter-clockwise) polygons for d3's spherical convention
function rewind(f) {
  if (!f.geometry) return f;
  if (d3.geoArea(f) > 2 * Math.PI) {
    const g = f.geometry;
    const rev = rings => rings.map(r => r.slice().reverse());
    if (g.type === 'Polygon') g.coordinates = rev(g.coordinates);
    if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(rev);
  }
  return f;
}

// --- Countries (Natural Earth 50m via world-atlas)
let w = rd('node_modules/world-atlas/countries-50m.json');
w = topoSimp.presimplify(w, topoSimp.sphericalTriangleArea);
w = topoSimp.simplify(w, topoSimp.quantile(w, 0.45));
const countries = topo.feature(w, w.objects.countries).features;
const LIST = { '124': 'canada', '192': 'cuba', '304': 'groenland', '320': 'guatemala', '332': 'haiti', '484': 'mexico', '558': 'nicaragua', '840': 'vs' };
const WHITE_EXTRA = new Set(['388', '044']); // Jamaica, Bahamas are white on the paper map too
const countryPaths = {};
let greyD = '', whiteD = '';
for (const c of countries) {
  const d = path(c);
  if (!d) continue;
  if (LIST[c.id]) countryPaths[LIST[c.id]] = d;
  else if (WHITE_EXTRA.has(c.id)) whiteD += d;
  else greyD += d;
}
const borders = path(topo.mesh(w, w.objects.countries, (a, b) => a !== b));
const landD = path(topo.feature(w, w.objects.land));

// --- Lakes: only the larger ones, like the paper map
const lakes = rd('data/ne_50m_lakes.geojson').features.map(rewind)
  .filter(f => d3.geoArea(f) * 6371 ** 2 > 2400);
const lakesD = lakes.map(f => path(f)).filter(Boolean).join('');

// --- Rivers
const rivers = rd('data/ne_50m_rivers_lake_centerlines.geojson').features;
const riv = name => path({ type: 'FeatureCollection', features: rivers.filter(f => f.properties.name === name) });
const riverD = {
  mississippi: riv('Mississippi'),
  riogrande: riv('Rio Grande'),
  missouri: riv('Missouri'),
  ohio: riv('Ohio'),
  stlawrence: riv('St. Lawrence'),
};

// --- US states (Natural Earth 50m admin-1)
const adm = rd('data/ne_50m_admin_1_states_provinces_lakes.geojson').features
  .filter(f => f.properties.adm0_a3 === 'USA').map(rewind);
const byName = n => adm.find(f => f.properties.name === n);
const statePaths = { alaska: path(byName('Alaska')), florida: path(byName('Florida')), texas: path(byName('Texas')) };
// Dashed borders between these states and their US neighbours (as on the paper: California, Texas, Florida)
const stTopo = topoServer.topology({ s: { type: 'FeatureCollection', features: adm } }, 1e6);
const DASHED = new Set(['California', 'Texas', 'Florida']);
const dashedD = path(topo.mesh(stTopo, stTopo.objects.s, (a, b) => a !== b && (DASHED.has(a.properties.name) || DASHED.has(b.properties.name))));

// --- Hand-drawn polygons (lon/lat), projected planar with densification
// Projection without clipExtent for manual rings
const projNoClip = d3.geoStereographic().rotate([-fit.p[0], -fit.p[1], fit.p[2]]).scale(1000 * k).translate([-F.x0 * k, -F.y0 * k]);
function ring(ringLL, close = true) {
  const P = [];
  const n0 = close ? ringLL.length : ringLL.length - 1;
  for (let i = 0; i < n0; i++) {
    const a = ringLL[i], b = ringLL[(i + 1) % ringLL.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5));
    for (let j = 0; j < n; j++) P.push(projNoClip([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]));
  }
  if (!close) P.push(projNoClip(ringLL[ringLL.length - 1]));
  return 'M' + P.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + (close ? 'Z' : '');
}
const waters = {
  grote: ring([[-200, -5], [-200, 54], [-180, 51.5], [-166, 53.5], [-158, 56], [-150, 59.5], [-142, 60.5], [-136, 59], [-130, 55], [-126, 50], [-124, 44], [-122, 36], [-116, 29], [-108, 21], [-98, 15], [-90, 12.5], [-86, 10.5], [-82, 7.5], [-79, 7.5], [-77, 6], [-77, -5]]),
  atlantisch: ring([[-81, 24.5], [-80.3, 27], [-80.5, 31], [-77, 34], [-75.5, 36], [-74, 39.5], [-70.5, 41.3], [-69.5, 43.5], [-66, 44.5], [-62, 45], [-59, 47], [-55.5, 51.5], [-57, 54], [-60, 57], [-64, 60.5], [-62, 63], [-55, 65.5], [-45, 65.8], [-35, 66], [-15, 66], [-5, 55], [-5, 10], [-59.5, 10], [-60.5, 13], [-61.5, 16], [-62.5, 17.8], [-64.5, 18.7], [-67, 18.8], [-69, 19.9], [-71.5, 20.1], [-73.5, 20.3], [-74.5, 20.8], [-75.5, 21.6], [-78, 23], [-80, 23.4]]),
  caribisch: ring([[-87.3, 21.6], [-85, 21.9], [-84.4, 21.6], [-82, 21.4], [-78, 20.5], [-74.3, 20], [-72.8, 18.2], [-70, 17.9], [-67.5, 17.8], [-64.5, 17.9], [-62, 17.3], [-61.4, 15.5], [-61.2, 13.5], [-61.6, 11], [-64, 10.5], [-70, 11.8], [-72, 11.5], [-75.5, 10.5], [-77, 8.5], [-79.5, 9.5], [-81.5, 9], [-83.5, 10.5], [-83.7, 13], [-83.3, 15], [-86, 16], [-88.3, 16], [-88, 18.5], [-87.5, 20.5]]),
};
const canalLL = [[-79.92, 9.37], [-79.9, 9.25], [-79.84, 9.14], [-79.72, 9.1], [-79.64, 9.03], [-79.6, 8.98], [-79.55, 8.94]];
const canalD = ring(canalLL, false);

// --- Cities
const CITIES = {
  chicago: [-87.63, 41.88], denver: [-104.99, 39.74], detroit: [-83.05, 42.33], havana: [-82.37, 23.11],
  houston: [-95.37, 29.76], losangeles: [-118.24, 34.05], mexicostad: [-99.13, 19.43], miami: [-80.19, 25.76],
  monterrey: [-100.32, 25.69], montreal: [-73.57, 45.50], neworleans: [-90.07, 29.95], newyork: [-74.01, 40.71],
  ottawa: [-75.70, 45.42], sanfrancisco: [-122.42, 37.77], toronto: [-79.38, 43.65], vancouver: [-123.12, 49.28],
  washington: [-77.04, 38.91],
};
const cityPts = Object.fromEntries(Object.entries(CITIES).map(([id, ll]) => [id, pt(ll)]));

// --- Mountains (carets traced from the paper map)


const NN = 34;
// Drop isolated detections (a wiggle of a river line was picked up as a caret)
const caretPts = Object.fromEntries(Object.entries(carets).map(([kk, list]) => {
  const P = list.map(ll => pt(ll));
  const keep = P.filter((p, i) => P.some((q, j) => j !== i && Math.hypot(p[0] - q[0], p[1] - q[1]) < NN));
  if (keep.length !== P.length) console.log('dropped carets', kk, P.filter(p => !keep.includes(p)));
  return [kk, keep];
}));

// --- Label anchors (lon/lat)
const LABELS = {
  canada: [-103, 58.5], cuba: [-78.2, 21.1], groenland: [-41, 73], guatemala: [-90.4, 15.5], haiti: [-72.6, 18.95],
  mexico: [-102.5, 24.5], nicaragua: [-85.1, 13], vs: [-99, 40.5], alaska: [-153, 64.5], florida: [-81.6, 28.6],
  texas: [-99.3, 31.4], atlantisch: [-69.5, 31.5], caribisch: [-75.5, 14.8], grote: [-134, 32], mississippi: [-91.3, 33.5],
  panamakanaal: [-79.73, 9.15], riogrande: [-102.6, 29.4],
};
const labelPts = Object.fromEntries(Object.entries(LABELS).map(([id, ll]) => [id, pt(ll)]));

// --- Inset world map
const w110 = rd('node_modules/world-atlas/countries-110m.json');
const NA = new Set(['124', '840', '484', '304', '192', '320', '332', '558', '214', '388', '044', '084', '340', '222', '188', '591', '630', '780', '052', '028', '659', '662', '670', '308', '212', '533', '531', '136', '796', '092', '850', '060']);
const IW = 295, IH = 196;
const insetProj = geoRobinson().fitExtent([[6, 6], [IW - 6, IH - 6]], { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[-170, 84], [180, 84], [-170, -56], [180, -56]] } });
const ipath = d3.geoPath(insetProj).digits(1);
const f110 = topo.feature(w110, w110.objects.countries).features.filter(f => f.id !== '010');
const insetLand = ipath({ type: 'FeatureCollection', features: f110.filter(f => !NA.has(f.id)) });
const insetNA = ipath({ type: 'FeatureCollection', features: f110.filter(f => NA.has(f.id)) });

const out = {
  W, H,
  inset: { x: 647, y: -63, w: IW, h: IH, land: insetLand, na: insetNA },
  base: { grey: greyD, white: whiteD, borders, lakes: lakesD, land: landD, dashed: dashedD, rivers: riverD },
  countries: countryPaths, states: statePaths, waters, canal: canalD,
  cities: cityPts, carets: caretPts, labels: labelPts,
};
fs.writeFileSync('build/mapdata.json', JSON.stringify(out));
const sz = s => (JSON.stringify(s).length / 1024).toFixed(0) + 'KB';
console.log('H', H, 'total', sz(out), 'grey', sz(greyD), 'countries', sz(countryPaths), 'lakes', sz(lakesD), 'land', sz(landD), 'states', sz(statePaths), lakes.length, 'lakes');
console.log('rivers', Object.fromEntries(Object.entries(riverD).map(([a, b]) => [a, b ? b.length : 0])));
