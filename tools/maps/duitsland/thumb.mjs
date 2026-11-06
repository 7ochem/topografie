// Start screen picture for Duitsland: Europe light, Germany dark, in the style of the insets of the other maps
// (the sheet itself has no inset). Natural Earth 50m via world-atlas. Run from tools/maps/: node duitsland/thumb.mjs
import * as d3 from 'd3-geo'; import * as topojson from 'topojson-client'; import fs from 'fs';
const w = JSON.parse(fs.readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url)));
const countries = topojson.feature(w, w.objects.countries).features;
const de = countries.find(f => f.properties.name === 'Germany');
const W = 234, H = 240;
// Conic like the sheet; Germany in the middle with its neighbours around it
const proj = d3.geoConicConformal().parallels([48, 54]).rotate([-10.4, 0]).fitExtent([[62, 52], [W - 62, H - 52]], de).clipExtent([[0, 0], [W, H]]);
const path = d3.geoPath(proj).digits(1);
const land = path({ type: 'FeatureCollection', features: countries.filter(f => f !== de) });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${land}" fill="#dedcd5" stroke="#6d6c66" stroke-width=".6"/>`
  + `<path d="${path(de)}" fill="#55544f" stroke="#2a2a27" stroke-width=".6"/></svg>\n`;
fs.writeFileSync(new URL('../../../public/maps/duitsland-thumb.svg', import.meta.url), svg);
console.log('size', (svg.length / 1024).toFixed(0) + 'KB');
