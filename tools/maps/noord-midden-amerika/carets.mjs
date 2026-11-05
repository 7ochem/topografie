import * as d3 from 'd3-geo'; import fs from 'fs';
const {p,H}=JSON.parse(fs.readFileSync('build/fit_stereo.json'));
const pr=d3.geoStereographic().rotate([-p[0],-p[1],p[2]]).scale(1000).translate([0,0]);
// invert homography
const M=[[H[0],H[1],H[2]],[H[3],H[4],H[5]],[H[6],H[7],1]];
const det=M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])+M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
const inv=[[ (M[1][1]*M[2][2]-M[1][2]*M[2][1])/det, -(M[0][1]*M[2][2]-M[0][2]*M[2][1])/det, (M[0][1]*M[1][2]-M[0][2]*M[1][1])/det],
 [-(M[1][0]*M[2][2]-M[1][2]*M[2][0])/det,(M[0][0]*M[2][2]-M[0][2]*M[2][0])/det,-(M[0][0]*M[1][2]-M[0][2]*M[1][0])/det],
 [(M[1][0]*M[2][1]-M[1][1]*M[2][0])/det,-(M[0][0]*M[2][1]-M[0][1]*M[2][0])/det,(M[0][0]*M[1][1]-M[0][1]*M[1][0])/det]];
const toProj=(x,y)=>{const v=inv.map(r=>r[0]*x+r[1]*y+r[2]);return [v[0]/v[2],v[1]/v[2]];};
const dots=[[319.0,1107.6],[847.7,1151.5],[830.5,1169.3],[796.5,1199.0],[874.1,1233.8],[758.7,1234.8],[700.9,1250.4],[841.3,1273.7],[493.4,1299.7]];
const zones={rocky:[[280,835,430,1125],[360,1125,500,1432]],sierra:[[285,1235,350,1360]],app:[[730,1085,950,1395]]};
const c=JSON.parse(fs.readFileSync('build/carets_px.json'));
const out={rocky:[],sierra:[],app:[]};
for(const [x,y] of c){ if(dots.some(d=>Math.hypot(d[0]-x,d[1]-y)<9))continue;
 for(const [k,zs] of Object.entries(zones)) if(zs.some(z=>x>=z[0]&&x<=z[2]&&y>=z[1]&&y<=z[3])){const ll=pr.invert(toProj(x,y));out[k].push(ll.map(v=>+v.toFixed(2)));break;}}
console.log(Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.length])));
fs.writeFileSync('build/carets_ll.json',JSON.stringify(out));
fs.writeFileSync('build/frame.json',JSON.stringify({proj:{type:'stereographic',rotate:[-p[0],-p[1],p[2]]},frame:[-294.5,-442,288,333]}));
