// Adds the inset (the Netherlands, Groningen and Drenthe dark) and writes the game's map data for Groningen & Drenthe
import * as d3 from 'd3-geo'; import fs from 'fs';
const rd = f => JSON.parse(fs.readFileSync(f));
const M = rd('gd/gd_map.json');
const b = M.insetBox; delete M.insetBox;
const rewind = g => { const f = { type: 'Feature', geometry: g }; if (d3.geoArea(f) > 2 * Math.PI) { const rv = r => r.map(x => x.slice().reverse()); if (g.type === 'Polygon') g.coordinates = rv(g.coordinates); if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(rv); } return f; };
const IN = rd('zl2/inset_ll.json');   // the Netherlands as one outline (made for Zeeland)
const nlp = rd('data/nl/provincie_2023.geojson'); nlp.features.forEach(f => rewind(f.geometry));
const nlF = rewind(IN.nl);
const ip = d3.geoMercator().fitExtent([[8, 8], [b.w - 8, b.h - 8]], nlF);
const ipath = d3.geoPath(ip).digits(1);
M.inset = { ...b, land: ipath(nlF), na: ipath({ type: 'FeatureCollection', features: nlp.features.filter(f => ['Groningen', 'Drenthe'].includes(f.properties.statnaam)) }) };
fs.writeFileSync('build/mapdata_gd.json', JSON.stringify(M));
console.log('size', (JSON.stringify(M).length / 1024).toFixed(0) + 'KB');
