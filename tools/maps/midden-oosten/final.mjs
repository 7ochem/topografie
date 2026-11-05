// Adds the inset world map (Middle East dark) and writes the game's map data for Midden-Oosten
import * as d3 from 'd3-geo'; import { geoRobinson } from 'd3-geo-projection'; import * as topo from 'topojson-client'; import fs from 'fs';
const rd = f => JSON.parse(fs.readFileSync(f));
const M = rd('mo/mo_map.json');
const b = M.insetBox; delete M.insetBox;
const w110 = rd('node_modules/world-atlas/countries-110m.json');
// ISO numeric: the 13 countries on the list + Palestine and the Gulf states
const ME = new Set(['051', '031', '268', '368', '364', '376', '887', '400', '414', '422', '682', '760', '792', '275', '048', '634', '784', '512']);
// Centred on 12°E like the sheet; the extent points sit just inside both sides of the date line opposite
const proj = geoRobinson().rotate([-12, 0]).fitExtent([[5, 5], [b.w - 5, b.h - 5]], { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[-167.9, 82], [-168.1, 82], [-167.9, -56], [-168.1, -56], [12, 82], [12, -56]] } });
const ip = d3.geoPath(proj).digits(1);
const f110 = topo.feature(w110, w110.objects.countries).features.filter(f => f.id !== '010');
M.style.inset = 'light';
M.inset = { ...b, land: ip({ type: 'FeatureCollection', features: f110.filter(f => !ME.has(f.id)) }), na: ip({ type: 'FeatureCollection', features: f110.filter(f => ME.has(f.id)) }) };
fs.writeFileSync('build/mapdata_mo.json', JSON.stringify(M));
console.log('size', (JSON.stringify(M).length / 1024).toFixed(0) + 'KB');
