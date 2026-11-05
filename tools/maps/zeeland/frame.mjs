// Frame of the Zeeland sheet: corner lon/lat, the angle that makes it level, and photo->frame mapping
import * as d3 from 'd3-geo'; import fs from 'fs';
const fit = JSON.parse(fs.readFileSync('zl/fit_stereo.json'));
const fr = JSON.parse(fs.readFileSync('zl/frame.json'));
const base = () => d3.geoStereographic().rotate([-fit.p[0], -fit.p[1], fit.p[2]]).scale(1000).translate([0, 0]);
const ll = Object.fromEntries(Object.entries(fr.proj).map(([k, v]) => [k, base().invert(v)]));
let best = null;
for (let a = -10; a <= 10; a += 0.01) {
  const pr = base().angle(a);
  const tl = pr(ll.TL), tr = pr(ll.TR), bl = pr(ll.BL), br = pr(ll.BR);
  const e = Math.abs(tl[1] - tr[1]) + Math.abs(bl[1] - br[1]) + Math.abs(tl[0] - bl[0]) + Math.abs(tr[0] - br[0]);
  if (!best || e < best.e) best = { a, e };
}
const pr = base().angle(best.a);
const P = Object.fromEntries(Object.entries(ll).map(([k, v]) => [k, pr(v)]));
const x0 = (P.TL[0] + P.BL[0]) / 2, x1 = (P.TR[0] + P.BR[0]) / 2, y0 = (P.TL[1] + P.TR[1]) / 2, y1 = (P.BL[1] + P.BR[1]) / 2;
console.log('angle', best.a.toFixed(2), 'err', best.e.toFixed(4), 'frame', x0, x1, y0, y1, 'aspect', (y1 - y0) / (x1 - x0));
// photo (displayed px) -> frame units, via the inverse homography
const H = fit.H, M = [[H[0], H[1], H[2]], [H[3], H[4], H[5]], [H[6], H[7], 1]];
const det = M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
const inv = [[(M[1][1] * M[2][2] - M[1][2] * M[2][1]) / det, -(M[0][1] * M[2][2] - M[0][2] * M[2][1]) / det, (M[0][1] * M[1][2] - M[0][2] * M[1][1]) / det],
  [-(M[1][0] * M[2][2] - M[1][2] * M[2][0]) / det, (M[0][0] * M[2][2] - M[0][2] * M[2][0]) / det, -(M[0][0] * M[1][2] - M[0][2] * M[1][0]) / det],
  [(M[1][0] * M[2][1] - M[1][1] * M[2][0]) / det, -(M[0][0] * M[2][1] - M[0][1] * M[2][0]) / det, (M[0][0] * M[1][1] - M[0][1] * M[1][0]) / det]];
const W = 1000, k = W / (x1 - x0);
const photoToFrame = (x, y) => { const v = inv.map(r => r[0] * x + r[1] * y + r[2]); const q = pr(base().invert([v[0] / v[2], v[1] / v[2]])); return [(q[0] - x0) * k, (q[1] - y0) * k]; };
const out = { angle: best.a, x0, y0, x1, y1, k, W, H: +((y1 - y0) * k).toFixed(1), cornersLL: ll,
  inset: [photoToFrame(722, 241), photoToFrame(921, 462)], scalebar: [photoToFrame(792, 1524), photoToFrame(1021, 1524)] };
fs.writeFileSync('zl/frame2.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({ H: out.H, inset: out.inset, scalebar: out.scalebar, ll }));
