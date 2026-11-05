import * as d3 from 'd3-geo';
import * as topo from 'topojson-client';
import fs from 'fs';
const W=1125,Hh=2000;
const dt=new Float32Array(fs.readFileSync('build/dt.f32').buffer.slice(0));
const w=JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json'));
const land=topo.feature(w,w.objects.land);
const borders=topo.mesh(w,w.objects.countries,(a,b)=>a!==b);
// densify lon/lat points
const pts=[];
function addLines(geom){const walk=(c)=>{for(let i=1;i<c.length;i++){const [a,b]=[c[i-1],c[i]];const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/0.25));for(let k=0;k<n;k++)pts.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}};
 const g=geom.type==='Feature'?geom.geometry:geom;
 const polys=g.type==='MultiPolygon'?g.coordinates.flat():g.type==='Polygon'?g.coordinates:g.type==='MultiLineString'?g.coordinates:[g.coordinates];polys.forEach(walk);}
land.features.forEach(addLines);addLines(borders);
const sel=pts.filter(([x,y])=>x>-180&&x<-10&&y>4&&y<84);
const dots=[[319.0,1107.6,-123.12,49.28],[847.7,1151.5,-73.57,45.50],[830.5,1169.3,-75.70,45.42],[796.5,1199.0,-79.38,43.65],[874.1,1233.8,-74.01,40.71],[758.7,1234.8,-83.05,42.33],[700.9,1250.4,-87.63,41.88],[841.3,1273.7,-77.04,38.91],[493.4,1299.7,-104.99,39.74],[266.1,1300.7,-122.42,37.77],[307.2,1368.8,-118.24,34.05],[702.6,1460.9,-90.07,29.95],[622.0,1470.4,-95.37,29.76],[856.5,1515.3,-80.19,25.76],[548.3,1544.2,-100.32,25.69],[838.4,1574.8,-82.37,23.11],[564.7,1663.5,-99.13,19.43]];
const mk={
 lcc:p=>d3.geoConicConformal().parallels([p[1],p[2]]).rotate([-p[0],0]),
 aea:p=>d3.geoConicEqualArea().parallels([p[1],p[2]]).rotate([-p[0],0]),
 eqd:p=>d3.geoConicEquidistant().parallels([p[1],p[2]]).rotate([-p[0],0]),
 laea:p=>d3.geoAzimuthalEqualArea().rotate([-p[0],-p[1],p[2]]),
 stereo:p=>d3.geoStereographic().rotate([-p[0],-p[1],p[2]]),
 ortho:p=>d3.geoOrthographic().rotate([-p[0],-p[1],p[2]]).clipAngle(null),
 merc:p=>d3.geoMercator().rotate([-p[0],0,p[2]]),
};
const inside=(x,y)=>x>36&&x<1054&&y>492&&y<1923&&!(x>675&&x<985&&y<615);
function solve(A,b){const n=b.length;A=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let m=i;for(let k=i+1;k<n;k++)if(Math.abs(A[k][i])>Math.abs(A[m][i]))m=k;[A[i],A[m]]=[A[m],A[i]];for(let k=0;k<n;k++){if(k===i)continue;const f=A[k][i]/A[i][i];for(let j=i;j<=n;j++)A[k][j]-=f*A[i][j];}}return A.map((r,i)=>r[n]/r[i]);}
function fitH(src,dst){const AtA=Array.from({length:8},()=>Array(8).fill(0)),Atb=Array(8).fill(0);src.forEach(([x,y],i)=>{const [u,v]=dst[i];const rows=[[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]],rhs=[u,v];rows.forEach((r,k)=>{for(let a=0;a<8;a++){Atb[a]+=r[a]*rhs[k];for(let b=0;b<8;b++)AtA[a][b]+=r[a]*r[b];}});});return solve(AtA,Atb);}
const apH=(h,x,y)=>{const ww=h[6]*x+h[7]*y+1;return [(h[0]*x+h[1]*y+h[2])/ww,(h[3]*x+h[4]*y+h[5])/ww];};
function nm(f,x0,steps,it){const n=x0.length;let s=[x0];for(let i=0;i<n;i++){const x=[...x0];x[i]+=steps[i];s.push(x);}let v=s.map(f);
 for(let k=0;k<it;k++){const o=v.map((_,i)=>i).sort((a,b)=>v[a]-v[b]);s=o.map(i=>s[i]);v=o.map(i=>v[i]);const c=Array(n).fill(0);for(let i=0;i<n;i++)for(let j=0;j<n;j++)c[j]+=s[i][j]/n;
  const r=c.map((ci,j)=>ci+(ci-s[n][j]));const fr=f(r);
  if(fr<v[0]){const e=c.map((ci,j)=>ci+2*(r[j]-ci));const fe=f(e);if(fe<fr){s[n]=e;v[n]=fe}else{s[n]=r;v[n]=fr}}
  else if(fr<v[n-1]){s[n]=r;v[n]=fr}
  else{const ct=c.map((ci,j)=>ci+0.5*(s[n][j]-ci));const fc=f(ct);if(fc<v[n]){s[n]=ct;v[n]=fc}else{for(let i=1;i<=n;i++){s[i]=s[i].map((x,j)=>s[0][j]+0.5*(x-s[0][j]));v[i]=f(s[i]);}}}}
 const o=v.map((_,i)=>i).sort((a,b)=>v[a]-v[b]);return [s[o[0]],v[o[0]]];}
const type=process.argv[2]; const init=JSON.parse(process.argv[3]);
// Parameterise: projection params p(3) + 4 control points image coords (8) -> homography computed from 4 fixed projected anchors.
let pr0=mk[type](init).scale(1000).translate([0,0]);
const src0=dots.map(d=>pr0([d[2],d[3]]));
let H0=fitH(src0,dots.map(d=>[d[0],d[1]]));
// anchors in lon/lat
const anchors=[[-150,65],[-40,65],[-115,15],[-75,15]];
const A0=anchors.map(a=>{const q=pr0(a);return apH(H0,q[0],q[1]);});
function build(x){const p=x.slice(0,3);const pr=mk[type](p).scale(1000).translate([0,0]);const src=anchors.map(a=>pr(a));const dst=[0,1,2,3].map(i=>[x[3+2*i],x[4+2*i]]);
 // exact homography 4 pts
 const H=fitH(src,dst);return {pr,H};}
// fixed sample subset: points inside under initial
const sample=sel.filter(p=>{const q=pr0(p);const r=apH(H0,q[0],q[1]);return inside(r[0],r[1]);}).filter((_,i)=>i%2===0);
function score(x,verbose){const {pr,H}=build(x);let s=0,n=0;for(const p of sample){const q=pr(p);if(!q){s+=12;n++;continue;}const [u,v]=apH(H,q[0],q[1]);let d=12;if(u>=0&&u<W-1&&v>=0&&v<Hh-1){d=Math.min(12,dt[(v|0)*W+(u|0)]);} if(!inside(u,v))d=12; s+=d;n++;}
 let de=0;for(const d of dots){const q=pr([d[2],d[3]]);const [u,v]=apH(H,q[0],q[1]);de+=Math.hypot(u-d[0],v-d[1]);}
 if(verbose)console.log('chamfer',(s/n).toFixed(3),'dots',(de/dots.length).toFixed(2));
 return s/n+0.3*de/dots.length;}
let x=[...init.slice(0,3),...A0.flat()];
const steps=[3,3,3,...Array(8).fill(15)];
let best=nm(score,x,steps,1500);
for(let r=0;r<4;r++){best=nm(score,best[0],steps.map(s=>s/(2+r)),1500);}
score(best[0],true);
const {pr,H}=build(best[0]);
console.log(type,JSON.stringify(best[0].slice(0,3).map(v=>+v.toFixed(3))),best[1].toFixed(3));
fs.writeFileSync(`build/fit_${type}.json`,JSON.stringify({type,p:best[0].slice(0,3),H}));
