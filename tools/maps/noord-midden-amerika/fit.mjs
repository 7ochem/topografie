import * as d3 from 'd3-geo';
const dots = {
 'Vancouver':[319.0,1107.6,-123.12,49.28],'Montréal':[847.7,1151.5,-73.57,45.50],'Ottawa':[830.5,1169.3,-75.70,45.42],
 'Toronto':[796.5,1199.0,-79.38,43.65],'New York':[874.1,1233.8,-74.01,40.71],'Detroit':[758.7,1234.8,-83.05,42.33],
 'Chicago':[700.9,1250.4,-87.63,41.88],'Washington':[841.3,1273.7,-77.04,38.91],'Denver':[493.4,1299.7,-104.99,39.74],
 'San Francisco':[266.1,1300.7,-122.42,37.77],'Los Angeles':[307.2,1368.8,-118.24,34.05],'New Orleans':[702.6,1460.9,-90.07,29.95],
 'Houston':[622.0,1470.4,-95.37,29.76],'Miami':[856.5,1515.3,-80.19,25.76],'Monterrey':[548.3,1544.2,-100.32,25.69],
 'Havana':[838.4,1574.8,-82.37,23.11],'Mexico-Stad':[564.7,1663.5,-99.13,19.43]};
const pts = Object.values(dots);
function solve(A,b){const n=b.length;A=A.map((r,i)=>[...r,b[i]]);for(let i=0;i<n;i++){let m=i;for(let k=i+1;k<n;k++)if(Math.abs(A[k][i])>Math.abs(A[m][i]))m=k;[A[i],A[m]]=[A[m],A[i]];for(let k=0;k<n;k++){if(k===i)continue;const f=A[k][i]/A[i][i];for(let j=i;j<=n;j++)A[k][j]-=f*A[i][j];}}return A.map((r,i)=>r[n]/r[i]);}
function fitH(src,dst){ // least squares homography src->dst
  const AtA=Array.from({length:8},()=>Array(8).fill(0)),Atb=Array(8).fill(0);
  src.forEach(([x,y],i)=>{const [u,v]=dst[i];
    const rows=[[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]],rhs=[u,v];
    rows.forEach((r,k)=>{for(let a=0;a<8;a++){Atb[a]+=r[a]*rhs[k];for(let b=0;b<8;b++)AtA[a][b]+=r[a]*r[b];}});});
  return solve(AtA,Atb);}
function fitA(src,dst){ // affine
  const AtA=Array.from({length:3},()=>Array(3).fill(0)),bx=Array(3).fill(0),by=Array(3).fill(0);
  src.forEach(([x,y],i)=>{const r=[x,y,1];for(let a=0;a<3;a++){bx[a]+=r[a]*dst[i][0];by[a]+=r[a]*dst[i][1];for(let b=0;b<3;b++)AtA[a][b]+=r[a]*r[b];}});
  const p=solve(AtA,bx),q=solve(AtA,by);return [p[0],p[1],p[2],q[0],q[1],q[2],0,0];}
const applyH=(h,[x,y])=>{const w=h[6]*x+h[7]*y+1;return [(h[0]*x+h[1]*y+h[2])/w,(h[3]*x+h[4]*y+h[5])/w];};
const mk={
 lcc:p=>d3.geoConicConformal().parallels([p[1],p[2]]).rotate([-p[0],0]).scale(1000).translate([0,0]),
 aea:p=>d3.geoConicEqualArea().parallels([p[1],p[2]]).rotate([-p[0],0]).scale(1000).translate([0,0]),
 eqd:p=>d3.geoConicEquidistant().parallels([p[1],p[2]]).rotate([-p[0],0]).scale(1000).translate([0,0]),
 laea:p=>d3.geoAzimuthalEqualArea().rotate([-p[0],-p[1]]).scale(1000).translate([0,0]),
 stereo:p=>d3.geoStereographic().rotate([-p[0],-p[1]]).scale(1000).translate([0,0]),
};
function err(type,p,useH){const pr=mk[type](p);const src=pts.map(d=>pr([d[2],d[3]]));const dst=pts.map(d=>[d[0],d[1]]);
  const h=useH?fitH(src,dst):fitA(src,dst);let e=0;src.forEach((s,i)=>{const q=applyH(h,s);e+=(q[0]-dst[i][0])**2+(q[1]-dst[i][1])**2;});return {rms:Math.sqrt(e/src.length),h};}
function nm(f,x0,step=5,it=600){let s=[x0];for(let i=0;i<x0.length;i++){const x=[...x0];x[i]+=step;s.push(x);}let v=s.map(f);
 for(let k=0;k<it;k++){const o=v.map((_,i)=>i).sort((a,b)=>v[a]-v[b]);s=o.map(i=>s[i]);v=o.map(i=>v[i]);const n=x0.length;const c=Array(n).fill(0);for(let i=0;i<n;i++)for(let j=0;j<n;j++)c[j]+=s[i][j]/n;
  const r=c.map((ci,j)=>ci+(ci-s[n][j]));const fr=f(r);
  if(fr<v[0]){const e=c.map((ci,j)=>ci+2*(r[j]-ci));const fe=f(e);if(fe<fr){s[n]=e;v[n]=fe}else{s[n]=r;v[n]=fr}}
  else if(fr<v[n-1]){s[n]=r;v[n]=fr}
  else{const ct=c.map((ci,j)=>ci+0.5*(s[n][j]-ci));const fc=f(ct);if(fc<v[n]){s[n]=ct;v[n]=fc}else{for(let i=1;i<=n;i++){s[i]=s[i].map((x,j)=>s[0][j]+0.5*(x-s[0][j]));v[i]=f(s[i]);}}}}
 return [s[0],v[0]];}
for(const useH of [false,true]) for(const t of Object.keys(mk)){
  let best=null;for(const lon of [-110,-100,-90])for(const a of [20,40,60]){const x0=t.startsWith('l')&&t!=='lcc'||t==='stereo'?[lon,a+5,0]:[lon,a,a+20];
   const [x,v]=nm(p=>err(t,p,useH).rms,x0);if(!best||v<best[1])best=[x,v];}
  console.log(useH?'H':'A',t,best[0].map(v=>v.toFixed(2)).join(','),'rms',best[1].toFixed(2));
}
import fs from 'fs';
for(const [t,p] of [['lcc',[-93.75,22.69,51.89]],['laea',[-102.48,36.29,0]],['stereo',[-105.91,36.32,0]],['eqd',[-87.91,16.48,60.74]]]){
  fs.writeFileSync('build/H_'+t+'.json',JSON.stringify(err(t,p,true).h));}
