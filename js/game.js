// Progress is stored per player. There is one player for now; the key leaves room for more players in one browser.
const PLAYER = 'player1';
function storeKey(packId) {
  const key = `topo:${PLAYER}:${packId}:v1`, old = `topo:${packId}:v1`;
  try {
    // Move progress saved before there were players
    if (localStorage.getItem(key) === null && localStorage.getItem(old) !== null) {
      localStorage.setItem(key, localStorage.getItem(old));
      localStorage.removeItem(old);
    }
  } catch (e) { /* storage blocked */ }
  return key;
}

// Runs one lesson pack. Everything it attaches is removed again when `signal` aborts (switching packs).
function runGame(PACK, MAP, signal, restore) {
'use strict';
const on = (el, ev, fn, o = {}) => el.addEventListener(ev, fn, { ...o, signal });

/* ---------- Basics ---------- */
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const ITEMS = PACK.items;
const BY = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const CAT = Object.fromEntries(PACK.cats.map(c => [c.id, c]));
const PALETTE = ['#f29e9e', '#f6cf5f', '#9fd39a', '#93c5ea', '#c6afe6', '#f6b98a', '#86d0c4', '#e3cf98', '#f0a6cf', '#b7d97a'];
ITEMS.forEach((it, i) => { it.color = PALETTE[i % PALETTE.length]; });
const STORE = storeKey(PACK.id);
const FINE = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Shows a word as the button it refers to, e.g. [Namen tonen]
const UI = t => `<span class="ui">${t}</span>`;
const KEY = t => `<span class="key">${t}</span>`;
const dots = n => `<span class="streak">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const joinNl = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' en ' + a[a.length - 1];

/* ---------- Progress (per device, localStorage) ---------- */
function load() {
  try { const v = JSON.parse(localStorage.getItem(STORE) || 'null'); if (v && v.items) return v; } catch (e) { /* storage blocked */ }
  return { items: {}, prefs: {} };
}
let prog = load();
function save() { try { localStorage.setItem(STORE, JSON.stringify(prog)); } catch (e) { /* storage blocked */ } }
const stat = id => prog.items[id] || (prog.items[id] = { box: 1, streak: 0, seen: 0, good: 0, bad: 0 });
const streakOf = id => (prog.items[id] ? prog.items[id].streak : 0);
const isMastered = id => streakOf(id) >= 3;
const prefs = (mode, def) => (prog.prefs[mode] = Object.assign({}, def, prog.prefs[mode] || {}));

/* ---------- Map drawing ---------- */
const svg = $('#map');
const M = MAP;
const FULL_Y = Math.min(-78, M.inset.y - 12);
const FULL = { x: -14, y: FULL_Y, w: M.W + 28, h: M.H + 14 - FULL_Y };
const CITY_IDS = ITEMS.filter(i => i.kind === 'city').map(i => i.id);

// Seeded random so the stipple looks the same every time
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function stipple(n, size, r) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${(rnd() * size).toFixed(2)}" cy="${(rnd() * size).toFixed(2)}" r="${r}"/>`;
  return s;
}

// Short wiggly strokes, like the grey texture on the Nederland sheets
function squiggles(n, size) {
  let s = '';
  for (let i = 0; i < n; i++) {
    let x = 0.8 + rnd() * (size - 1.6), y = 0.8 + rnd() * (size - 1.6), a = rnd() * Math.PI * 2;
    s += `M${x.toFixed(2)},${y.toFixed(2)}`;
    for (let k = 0; k < 3; k++) { a += (rnd() - 0.5) * 2.2; x += Math.cos(a) * 0.7; y += Math.sin(a) * 0.7; s += `L${x.toFixed(2)},${y.toFixed(2)}`; }
  }
  return `<path d="${s}"/>`;
}
// Water with sparse specks (Nederland sheets): small dots and short dashes on white paper
function specks(n, size) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = (0.6 + rnd() * (size - 1.2)).toFixed(2), y = (0.6 + rnd() * (size - 1.2)).toFixed(2);
    s += rnd() < 0.6 ? `<circle cx="${x}" cy="${y}" r="${(0.28 + rnd() * 0.2).toFixed(2)}"/>`
      : `<rect x="${x}" y="${y}" width=".42" height="${(0.8 + rnd() * 0.7).toFixed(2)}" rx=".2"/>`;
  }
  return s;
}

function buildMap() {
  const { W, H } = M;
  const b = M.base, st = M.style || {};
  const seaPat = st.sea === 'specks'
    ? `<pattern id="pSea" width="90" height="90" patternUnits="userSpaceOnUse"><rect width="90" height="90" fill="var(--paper)"/><g fill="#a4a39c">${specks(230, 90)}</g></pattern>`
    : `<pattern id="pSea" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="var(--sea)"/><g fill="var(--stip)">${stipple(11, 12, 0.45)}</g></pattern>`;
  const greyPat = st.grey === 'light'
    ? `<pattern id="pGrey" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#e9e8e3"/><g fill="none" stroke="#a3a29b" stroke-width=".34" stroke-linecap="round" stroke-linejoin="round">${squiggles(225, 60)}</g></pattern>`
    : `<pattern id="pGrey" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="var(--greyland)"/><g fill="#8f8e87">${stipple(16, 12, 0.45)}</g></pattern>`;
  let s = `<defs>
    ${seaPat}
    ${greyPat}
    <clipPath id="clipF"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>
    <path id="caretSym" d="M-2.9,1.5L0,-1.5L2.9,1.5"/>
  </defs>
  <text class="maptitle" x="4" y="-24">${esc(M.title)}</text>
  <g clip-path="url(#clipF)">
    <rect class="sea${M.style && M.style.sea === 'plain' ? ' plain' : ''}" x="0" y="0" width="${W}" height="${H}"/>`;
  for (const id of Object.keys(M.waters)) s += `<path class="watr" id="it-${id}" d="${M.waters[id]}"/>`;
  s += `<path class="greyc" d="${b.grey}"/><path class="land" d="${b.white}"/>`;
  // Areas on the list: white like the sheet, or grey (the sheet greys out land outside the topic)
  for (const [id, d] of Object.entries(M.countries)) s += `<path class="${(M.areaFill && M.areaFill[id]) === 'grey' ? 'greyc' : 'land'} ctry" id="it-${id}" style="--c:${BY[id].color}" d="${d}"/>`;
  for (const [id, d] of Object.entries(M.states)) s += `<path class="st" id="it-${id}" style="--c:${BY[id].color}" d="${d}"/>`;
  s += `<path class="lakes" d="${b.lakes}"/>
    <path class="coast" d="${b.ink || b.land}"/>
    <path class="borders" d="${b.borders}"/>
    <path class="heavy" d="${b.heavy || ''}"/>
    <path class="dashed" d="${b.dashed}"/>
    <path class="dotted" d="${b.dotted || ''}"/>`;
  for (const d of b.decor || []) s += `<path class="river" d="${d}"/>`;
  for (const it of ITEMS.filter(i => i.kind === 'river' || i.kind === 'canal')) s += `<path class="${it.kind}" id="it-${it.id}" d="${M.lines[it.id]}"/>`;
  for (const it of ITEMS.filter(i => i.kind === 'mtn')) {
    s += `<g class="mtn" id="it-${it.id}">` + M.carets[it.carets].map(p => `<use href="#caretSym" class="caret" x="${p[0]}" y="${p[1]}"/>`).join('') + '</g>';
  }
  for (const id of CITY_IDS) { const p = M.cities[id]; s += `<circle class="city" id="it-${id}" cx="${p[0]}" cy="${p[1]}" r="3.4"/>`; }
  if (M.scalebar) {
    const sb = M.scalebar, x2 = sb.x + sb.len, tk = sb.tick || 5, mid = sb.mid || 4, ty = sb.y - (sb.textDy || 9);
    s += `<g class="scalebar"><path d="M${sb.x},${sb.y - tk}V${sb.y}H${x2}V${sb.y - tk}M${(sb.x + x2) / 2},${sb.y}V${sb.y - mid}"/><text x="${sb.x}" y="${ty}" text-anchor="middle">0</text><text x="${x2}" y="${ty}" text-anchor="middle">${esc(sb.label)}</text></g>`;
  }
  s += `<g id="hov"></g><g id="fx"></g><g id="labels" class="labels"></g><g id="nums"></g></g>
  <rect class="frame" x="0" y="0" width="${W}" height="${H}"/>
  <g id="inset" class="${st.inset === 'light' ? 'light' : ''}" transform="translate(${M.inset.x},${M.inset.y})">
    <rect class="inset-bg" width="${M.inset.w}" height="${M.inset.h}"/>
    <path class="inset-land" d="${M.inset.land}"/><path class="inset-na" d="${M.inset.na}"/>
  </g>`;
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = s;
}
buildMap();
$('#credit').innerHTML = M.credit || '';
const elOf = id => svg.getElementById ? svg.getElementById('it-' + id) : document.getElementById('it-' + id);

/* ---------- Geometry helpers ---------- */
const caretsOf = id => M.carets[BY[id].carets];
function centroid(pts) { let x = 0, y = 0; pts.forEach(p => { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; }
function labelPoint(id) {
  const it = BY[id];
  if (it.kind === 'city') return M.cities[id];
  if (it.kind === 'mtn') return centroid(caretsOf(id));
  return M.labels[id];
}
function bboxOf(id) {
  const it = BY[id];
  if (it.kind === 'city') { const p = M.cities[id]; return { x: p[0], y: p[1], w: 0, h: 0 }; }
  let pts;
  if (it.kind === 'mtn') pts = caretsOf(id);
  if (pts) {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  const b = elOf(id).getBBox();
  const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(M.W, b.x + b.width), y1 = Math.min(M.H, b.y + b.height);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

/* ---------- Hit testing (canvas Path2D works in every browser) ---------- */
const hctx = (() => { const c = document.createElement('canvas'); c.width = M.W; c.height = Math.ceil(M.H); return c.getContext('2d'); })();
const P2 = {};
for (const [id, d] of Object.entries(M.countries)) P2[id] = new Path2D(d);
for (const [id, d] of Object.entries(M.states)) P2[id] = new Path2D(d);
for (const [id, d] of Object.entries(M.waters)) P2[id] = new Path2D(d);
for (const [id, d] of Object.entries(M.lines || {})) P2[id] = new Path2D(d);
const LAND = new Path2D(M.base.land);
const idsOf = kind => ITEMS.filter(i => i.kind === kind).map(i => i.id);
const CANAL_IDS = idsOf('canal'), RIVER_IDS = idsOf('river');
// Smaller waters first, so a sea that overlaps a big ocean area wins
const SEA_IDS = idsOf('sea').map(id => { const b = elOf(id).getBBox(); return { id, a: b.width * b.height }; }).sort((p, q) => p.a - q.a).map(o => o.id);

// Returns item ids under a map point, most specific first
function hitsAt(x, y) {
  const u = upp();
  const res = [];
  let best = null;
  for (const id of CITY_IDS) {
    const p = M.cities[id]; const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < Math.max(5, 16 * u) && (!best || d < best.d)) best = { id, d };
  }
  if (best) res.push(best.id);
  hctx.lineCap = 'round'; hctx.lineJoin = 'round';
  hctx.lineWidth = Math.max(8, 22 * u);
  for (const id of CANAL_IDS) if (hctx.isPointInStroke(P2[id], x, y)) res.push(id);
  hctx.lineWidth = Math.max(5, 16 * u);
  for (const id of RIVER_IDS) if (hctx.isPointInStroke(P2[id], x, y)) res.push(id);
  for (const it of ITEMS.filter(i => i.kind === 'mtn')) {
    if (caretsOf(it.id).some(p => Math.hypot(p[0] - x, p[1] - y) < Math.max(9, 10 * u))) res.push(it.id);
  }
  for (const id of Object.keys(M.states)) if (hctx.isPointInPath(P2[id], x, y)) res.push(id);
  for (const id of Object.keys(M.countries)) if (hctx.isPointInPath(P2[id], x, y)) res.push(id);
  if (!hctx.isPointInPath(LAND, x, y)) {
    for (const id of SEA_IDS) if (hctx.isPointInPath(P2[id], x, y)) { res.push(id); break; }
  }
  return res;
}

/* ---------- View: pan & zoom ---------- */
const view = { cx: FULL.x + FULL.w / 2, cy: FULL.y + FULL.h / 2, s: 1 };
let anim = null, rafPending = false;
const box = () => svg.getBoundingClientRect();
const fitScale = () => { const z = box(); return Math.min(z.width / FULL.w, z.height / FULL.h) || 1; };
const upp = () => 1 / view.s; // map units per screen pixel
function clampView() {
  const f = fitScale();
  view.s = Math.min(Math.max(view.s, f), f * 14);
  const z = box(); const hw = z.width / 2 / view.s, hh = z.height / 2 / view.s;
  const x0 = FULL.x, x1 = FULL.x + FULL.w, y0 = FULL.y, y1 = FULL.y + FULL.h;
  view.cx = hw * 2 >= FULL.w ? (x0 + x1) / 2 : Math.min(Math.max(view.cx, x0 + hw), x1 - hw);
  view.cy = hh * 2 >= FULL.h ? (y0 + y1) / 2 : Math.min(Math.max(view.cy, y0 + hh), y1 - hh);
}
function applyView() {
  clampView();
  const z = box(); const w = z.width / view.s, h = z.height / view.s;
  if (!w || !h) return;
  svg.setAttribute('viewBox', `${(view.cx - w / 2).toFixed(2)} ${(view.cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
  scaleDeps();
}
function scheduleView() { if (rafPending) return; rafPending = true; requestAnimationFrame(() => { rafPending = false; applyView(); }); }
function animateTo(cx, cy, s, ms = 450) {
  if (anim) cancelAnimationFrame(anim.raf);
  if (REDUCED) { Object.assign(view, { cx, cy, s }); applyView(); return; }
  const from = { ...view }, t0 = performance.now();
  // Interpolate the zoom in log space so it feels even
  const step = t => {
    const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    view.cx = from.cx + (cx - from.cx) * e; view.cy = from.cy + (cy - from.cy) * e;
    view.s = Math.exp(Math.log(from.s) + (Math.log(s) - Math.log(from.s)) * e);
    applyView();
    if (k < 1) anim.raf = requestAnimationFrame(step); else anim = null;
  };
  anim = { raf: requestAnimationFrame(step) };
}
function fitAll(animate = true) {
  const s = fitScale(), cx = FULL.x + FULL.w / 2, cy = FULL.y + FULL.h / 2;
  if (animate) animateTo(cx, cy, s); else { Object.assign(view, { cx, cy, s }); applyView(); }
}
function focusItem(id, minSize = 380, jitter = 0) {
  const b = bboxOf(id), z = box();
  const w = Math.max(b.w * 1.5, minSize), h = Math.max(b.h * 1.5, minSize);
  const s = Math.min(z.width / w, z.height / h);
  const jx = (Math.random() - .5) * jitter * w, jy = (Math.random() - .5) * jitter * h;
  animateTo(b.x + b.w / 2 + jx, b.y + b.h / 2 + jy, s);
}
// Is the item fully on screen now? Parts outside the sheet do not count.
// edge: part of the screen at each side that does not count as "in view" (0.2 = keep the item out of the outer 20%)
function inView(id, edge = 0) {
  const b = bboxOf(id), z = box();
  const w = z.width / view.s, h = z.height / view.s;
  const mx = Math.max(24 * upp(), edge * w), my = Math.max(24 * upp(), edge * h);
  const x0 = Math.max(b.x, FULL.x), x1 = Math.min(b.x + b.w, FULL.x + FULL.w);
  const y0 = Math.max(b.y, FULL.y), y1 = Math.min(b.y + b.h, FULL.y + FULL.h);
  return x0 - mx >= view.cx - w / 2 && x1 + mx <= view.cx + w / 2 && y0 - my >= view.cy - h / 2 && y1 + my <= view.cy + h / 2;
}
// No automatic zooming in: the child keeps the overview. Only zoom out when the item is off screen.
function ensureVisible(id) { if (!inView(id)) fitAll(); }
// Light zoom on the asked item, with enough map around it to keep the context.
// Keeps the view when the item is already well on screen at that zoom (or closer), so the map does not jump around.
// Near the top or bottom of the screen is not good enough: then the map moves to it.
function softFocus(id, factor) {
  const f = fitScale(), want = f * factor;
  if (view.s >= want * 0.95 && inView(id, 0.3)) return;
  const b = bboxOf(id), z = box();
  // Large items (Canada, an ocean) get less zoom so they fit
  const fitB = Math.min(z.width / Math.max(b.w * 1.15, 1), z.height / Math.max(b.h * 1.15, 1));
  animateTo(b.x + b.w / 2, b.y + b.h / 2, Math.max(f, Math.min(want, fitB)));
}
function zoomBy(f) { animateTo(view.cx, view.cy, view.s * f, 250); }
const toMap = (px, py) => { const z = box(); return { x: view.cx + (px - z.width / 2) / view.s, y: view.cy + (py - z.height / 2) / view.s }; };

// Things whose size should stay constant on screen
function scaleDeps() {
  const u = upp();
  const r = Math.max(3.4, 2.8 * u).toFixed(2);
  CITY_IDS.forEach(id => elOf(id).setAttribute('r', r));
  const k = Math.max(1, u * 0.9);
  ['pSea', 'pGrey'].forEach(p => svg.getElementById(p).setAttribute('patternTransform', `scale(${k.toFixed(3)})`));
  // The small world map belongs to the sheet; it would cover Greenland when zoomed in
  svg.getElementById('inset').style.opacity = view.s > fitScale() * 1.3 ? '0' : '1';
  renderFx();
  renderHover();
  renderLabels();
  renderNums();
}

// Pointer gestures: drag to pan, pinch / wheel to zoom, short tap to select
const ptrs = new Map();
let gest = null;
on(svg, 'pointerdown', e => {
  svg.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
  if (ptrs.size === 1) gest = { type: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cy: view.cy, t: performance.now(), moved: false };
  else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], z = box();
    gest = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: view.s, mp: toMap((a.x + b.x) / 2 - z.left, (a.y + b.y) / 2 - z.top) };
  }
});
on(svg, 'pointermove', e => {
  if (!ptrs.has(e.pointerId) || !gest) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const z = box();
  if (gest.type === 'pinch' && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()];
    view.s = gest.s0 * Math.hypot(a.x - b.x, a.y - b.y) / gest.d0;
    clampView();
    view.cx = gest.mp.x - ((a.x + b.x) / 2 - z.left - z.width / 2) / view.s;
    view.cy = gest.mp.y - ((a.y + b.y) / 2 - z.top - z.height / 2) / view.s;
    scheduleView();
  } else if (gest.type === 'pan') {
    const dx = e.clientX - gest.sx, dy = e.clientY - gest.sy;
    if (Math.hypot(dx, dy) > 7) gest.moved = true;
    if (gest.moved) { svg.classList.add('dragging'); view.cx = gest.cx - dx / view.s; view.cy = gest.cy - dy / view.s; scheduleView(); }
  }
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId);
  if (gest && gest.type === 'pan' && !gest.moved && ptrs.size === 0 && e.type === 'pointerup' && performance.now() - gest.t < 800) {
    const z = box(); const p = toMap(e.clientX - z.left, e.clientY - z.top);
    onMapTap(p.x, p.y);
  }
  if (ptrs.size === 1) { const [a] = [...ptrs.values()]; gest = { type: 'pan', sx: a.x, sy: a.y, cx: view.cx, cy: view.cy, t: 0, moved: true }; }
  else if (ptrs.size === 0) { gest = null; svg.classList.remove('dragging'); }
}
on(svg, 'pointerup', endPtr);
on(svg, 'pointercancel', endPtr);
let padUntil = 0; // keeps one touchpad gesture (incl. its momentum) on the same behaviour
on(svg, 'wheel', e => {
  e.preventDefault();
  if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
  const z = box(), px = e.clientX - z.left, py = e.clientY - z.top, m = toMap(px, py);
  // Touchpad two-finger scroll pans the map. A mouse wheel, and a touchpad pinch (sent with ctrlKey), zoom.
  if (!e.ctrlKey && e.deltaMode === 0) {
    const looksLikePad = e.deltaX !== 0 || !Number.isInteger(e.deltaY) || (typeof e.wheelDeltaY === 'number' && e.wheelDeltaY === -3 * e.deltaY);
    if (looksLikePad) padUntil = performance.now() + 250;
    if (performance.now() < padUntil) {
      view.cx += e.deltaX / view.s; view.cy += e.deltaY / view.s;
      scheduleView();
      return;
    }
  }
  view.s *= Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : e.deltaMode ? 0.05 : 0.0015));
  clampView();
  view.cx = m.x - (px - z.width / 2) / view.s; view.cy = m.y - (py - z.height / 2) / view.s;
  scheduleView();
}, { passive: false });
// Safari sends a touchpad pinch as gesture events (on touch screens the pointer pinch above handles it)
let gs = null;
on(svg, 'gesturestart', e => {
  if (ptrs.size) return;
  e.preventDefault();
  const z = box(); gs = { s: view.s, px: e.clientX - z.left, py: e.clientY - z.top };
  gs.m = toMap(gs.px, gs.py);
});
on(svg, 'gesturechange', e => {
  if (!gs) return;
  e.preventDefault();
  const z = box();
  view.s = gs.s * e.scale; clampView();
  view.cx = gs.m.x - (gs.px - z.width / 2) / view.s; view.cy = gs.m.y - (gs.py - z.height / 2) / view.s;
  scheduleView();
});
on(svg, 'gestureend', e => { if (gs) { e.preventDefault(); gs = null; } });
// Double-click zooms in on that spot (shift: out). Not in Waar ligt, where a click is an answer.
on(svg, 'dblclick', e => {
  if (state.mode === 'waar') return;
  const z = box(), px = e.clientX - z.left, py = e.clientY - z.top, m = toMap(px, py), f = fitScale();
  const s = Math.min(Math.max(view.s * (e.shiftKey ? 0.5 : 2), f), f * 14);
  animateTo(m.x - (px - z.width / 2) / s, m.y - (py - z.height / 2) / s, s, 300);
});
$('#zin').onclick = () => zoomBy(1.7);
$('#zout').onclick = () => zoomBy(1 / 1.7);
$('#zfit').onclick = () => fitAll();
let lastFit = true;
const ro = new ResizeObserver(() => {
  const wasFit = view.s <= fitScale() * 1.02 || lastFit;
  lastFit = false;
  if (wasFit) fitAll(false); else applyView();
});
ro.observe($('#mapwrap'));
signal.addEventListener('abort', () => ro.disconnect());

/* ---------- Map state: coloured-in, highlights, labels ---------- */
// hl = what the map points at right now: { id, style: 'q' | 'sel', blink }
let hl = null;
const solLabels = new Set();
function refreshDone() {
  for (const it of ITEMS) { const el = elOf(it.id); if (el) el.classList.toggle('done', isMastered(it.id)); }
  $('#stars').textContent = `${ITEMS.filter(i => isMastered(i.id)).length} / ${ITEMS.length}`;
}
function setHl(next) {
  if (hl) { const el = elOf(hl.id); el && el.classList.remove('q', 'sel', 'blink'); }
  hl = next;
  if (hl) {
    const el = elOf(hl.id);
    if (el) { el.classList.add(hl.style); if (hl.blink) { el.classList.remove('blink'); void el.getBBox(); el.classList.add('blink'); } }
  }
  renderFx();
}
function renderFx() {
  const g = svg.getElementById('fx');
  if (!hl) { g.innerHTML = ''; return; }
  const u = upp(), it = BY[hl.id];
  let s = '';
  if (it.kind === 'city') { const p = M.cities[it.id]; s = `<circle class="ring" cx="${p[0]}" cy="${p[1]}" r="${(11 * u).toFixed(2)}"/>`; }
  else if (it.kind === 'river') s = `<path class="qline" d="${M.lines[it.id]}"/>`;
  else if (it.kind === 'canal') { s = `<path class="qline" d="${M.lines[it.id]}"/>`; const p = M.labels[it.id]; s += `<circle class="ring" cx="${p[0]}" cy="${p[1]}" r="${(14 * u).toFixed(2)}"/>`; }
  else if (it.kind === 'mtn') s = '<g class="mtnhi">' + caretsOf(it.id).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="9"/>`).join('') + '</g>';
  else if (it.kind === 'sea' && hl.style === 'q') { const p = M.labels[it.id]; s = `<circle class="qmark" cx="${p[0]}" cy="${p[1]}" r="${(13 * u).toFixed(2)}"/><text class="qmark-t" x="${p[0]}" y="${p[1]}" style="font-size:${(15 * u).toFixed(2)}px">?</text>`; }
  g.innerHTML = s;
  g.classList.toggle('blink', !!hl.blink);
  if (hl.blink) { g.style.animation = 'none'; void g.getBBox(); g.style.animation = ''; }
}
/* Mouse hover (laptop): highlight + name in Verkennen, matching cursor per mode */
let hoverId = null;
function setHover(id) {
  if (id === hoverId) return;
  if (hoverId) { const el = elOf(hoverId); el && el.classList.remove('hov'); }
  hoverId = id;
  if (id && ['country', 'state', 'sea'].includes(BY[id].kind)) elOf(id).classList.add('hov');
  renderHover();
}
function renderHover() {
  const g = svg.getElementById('hov');
  if (!g) return;
  if (!hoverId) { g.innerHTML = ''; return; }
  const u = upp(), it = BY[hoverId];
  let s = '';
  if (it.kind === 'city') { const p = M.cities[it.id]; s = `<circle class="hring" cx="${p[0]}" cy="${p[1]}" r="${(9 * u).toFixed(2)}"/>`; }
  else if (it.kind === 'river') s = `<path class="hline" d="${M.lines[it.id]}"/>`;
  else if (it.kind === 'canal') { const p = M.labels[it.id]; s = `<path class="hline" d="${M.lines[it.id]}"/><circle class="hring" cx="${p[0]}" cy="${p[1]}" r="${(12 * u).toFixed(2)}"/>`; }
  else if (it.kind === 'mtn') s = '<g class="mtnhov">' + caretsOf(it.id).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="9"/>`).join('') + '</g>';
  g.innerHTML = s;
}
const tipEl = $('#tip');
function showTip(id, cx, cy) {
  if (!id) { tipEl.hidden = true; return; }
  const it = BY[id], wrap = $('#mapwrap').getBoundingClientRect();
  tipEl.innerHTML = `${esc(it.name)}<small>${esc(CAT[it.cat].single)}</small>`;
  tipEl.hidden = false;
  let x = cx - wrap.left + 14, y = cy - wrap.top + 16;
  if (x + tipEl.offsetWidth > wrap.width - 8) x = cx - wrap.left - tipEl.offsetWidth - 10;
  if (y + tipEl.offsetHeight > wrap.height - 8) y = cy - wrap.top - tipEl.offsetHeight - 10;
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
}
let hoverPos = null, hoverRaf = 0;
function doHover() {
  hoverRaf = 0;
  if (!hoverPos) return;
  const z = box(), p = toMap(hoverPos.x - z.left, hoverPos.y - z.top), m = state.mode;
  if (m === 'verkennen' && helpEl.hidden) {
    const hits = hitsAt(p.x, p.y);
    setHover(hits[0] || null);
    showTip(hits[0], hoverPos.x, hoverPos.y);
    svg.dataset.cur = hits.length ? 'pointer' : '';
  } else {
    setHover(null); showTip(null);
    const r = state.rounds.waar;
    svg.dataset.cur = m === 'waar' && r && !r.over && r.cur && !r.cur.done && !state.setupOpen.waar ? 'crosshair' : '';
  }
}
on(svg, 'pointermove', e => {
  if (e.pointerType !== 'mouse' || ptrs.size) return;
  hoverPos = { x: e.clientX, y: e.clientY };
  if (!hoverRaf) hoverRaf = requestAnimationFrame(doHover);
});
on(svg, 'pointerleave', () => { hoverPos = null; setHover(null); showTip(null); });

let showAllLabels = false;
const colorsOn = () => prog.prefs.colors !== false;
// Stars colour the map only in Bekijken (switch Kleuren) and Voortgang; in the quizzes the colours would give away or confuse
function applyColors() { svg.classList.toggle('colors', (state.mode === 'verkennen' && colorsOn()) || state.mode === 'voortgang'); }
function renderLabels() {
  const g = svg.getElementById('labels');
  const u = upp(), fs = 12.5 * u;
  const ids = showAllLabels ? ITEMS.map(i => i.id) : [...solLabels];
  let s = '';
  for (const id of ids) {
    const it = BY[id], [x, y] = labelPoint(id);
    const cls = ({ land: 'lc', provincie: 'lc', staat: 'ls', water: 'lw', plaats: 'lp', gebied: 'lg' }[it.cat] || 'lp') + (solLabels.has(id) && !showAllLabels ? ' sol' : '');
    let ax = x, ay = y + fs * 0.35, anchor = 'middle';
    // In the checked Proeftoets the number sits on the spot, so the name goes just below it
    const tr = state.mode === 'toets' && state.rounds.toets;
    const numbered = tr && tr.graded && tr.items.includes(id);
    if (it.kind === 'city' && !numbered) {
      const off = Math.max(3.4, 2.8 * u) + 5 * u;
      if (it.lp === 'r') { ax = x + off; anchor = 'start'; }
      if (it.lp === 'l') { ax = x - off; anchor = 'end'; }
      if (it.lp === 't') ay = y - off - fs * 0.15;
      if (it.lp === 'b') ay = y + off + fs * 0.8;
    } else if (numbered) {
      ay = (it.kind === 'city' ? y : y + 10.5 * u) + 6 * u + fs * 0.8;
    }
    const name = it.cat === 'land' || it.cat === 'provincie' ? it.name.toUpperCase() : it.name;
    if (anchor === 'middle') {
      // Keep area names inside the frame (e.g. a province that only shows as a strip at the edge)
      const half = fs * (name === name.toUpperCase() ? 0.36 : 0.3) * name.length;
      ax = Math.min(Math.max(ax, half + 3 * u), M.W - half - 3 * u);
    }
    s += `<text class="${cls}" x="${ax.toFixed(1)}" y="${ay.toFixed(1)}" text-anchor="${anchor}" style="font-size:${fs.toFixed(2)}px;stroke-width:${(3.2 * u).toFixed(2)}px">${esc(name)}</text>`;
  }
  g.innerHTML = s;
}

/* ---------- Toast ---------- */
let toastT = 0;
function toast(msg, ms = 1800) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- Emoji feedback (can be switched off in the settings) ---------- */
const EMO = {
  perfect: ['😄', '🎉', '🥳', '🙌', '💪', '🤩', '😎', '👏', '🔥', '✨'],
  helped: ['🙂', '👍', '😅', '👌', '😊'],
  star: ['🌟', '⭐', '🏆', '🎊', '🎉', '🥇'],
  wrong: ['😬', '🙈', '🤔', '😕'],
  shown: ['😢', '😭', '🙈', '💀'],
  round: ['🏆', '🎉', '🥳', '🎊'],
  warm: ['🔥'],
  cold: ['🥶'],
};
const emojiOn = () => prog.prefs.emoji !== false;
const pickEmo = k => EMO[k][Math.floor(Math.random() * EMO[k].length)];
const emoHtml = ch => (ch ? `<span class="emo" aria-hidden="true">${ch}</span>` : '');
const fxLayer = $('#fxl');
// Screen position (inside the map box) of a map point, kept away from the edges
function screenOf(mx, my) {
  const z = box();
  const x = (mx - view.cx) * view.s + z.width / 2, y = (my - view.cy) * view.s + z.height / 2;
  const k = emoK();
  return { x: Math.min(Math.max(x, 45 * k), z.width - 45 * k), y: Math.min(Math.max(y, 65 * k), z.height - 40 * k) };
}
// Where the name of an item shows on the map (the emoji go just above it)
function itemScreen(id) {
  const lp = labelPoint(id);
  if (lp) return screenOf(...lp);
  const b = bboxOf(id);
  return screenOf(b.x + b.w / 2, b.y + b.h / 2);
}
// Emoji are bigger on a laptop screen
const emoK = () => (box().width >= 700 ? 1.6 : 1.25);
// above: the emoji sits above the point, so the name on the map stays readable (below it when there is no room)
function spawnEmo(ch, x, y, size, above = false) {
  size = Math.round(size * emoK());
  const s = document.createElement('span');
  s.className = 'fxemo'; s.textContent = ch; s.style.fontSize = size + 'px';
  let top = y - size / 2;
  if (above) { const gap = 12; top = y - gap - size; if (top < 4) top = y + gap + 4; }
  s.style.left = (x - size / 2) + 'px'; s.style.top = top + 'px';
  s.center = { x, y: top + size / 2 };
  fxLayer.appendChild(s);
  return s;
}
// Keep the last frame until the element is removed (otherwise it flashes back to its start for a moment)
const FWD = { fill: 'forwards' };
const done = (s, ms) => { if (REDUCED || !s.animate) { setTimeout(() => s.remove(), ms); return true; } return false; };
// Happy: pops up with a bounce and floats away
function popHappy(ch, p) {
  const s = spawnEmo(ch, p.x, p.y, 72, true);
  if (done(s, 2000)) return s.center;
  s.animate([
    { transform: 'scale(0) rotate(-20deg)', opacity: 0 },
    { transform: 'scale(1.35) rotate(8deg)', opacity: 1, offset: .15 },
    { transform: 'scale(1) rotate(0)', opacity: 1, offset: .28 },
    { transform: 'scale(1) rotate(0)', opacity: 1, offset: .72 },
    { transform: 'translateY(-60px) scale(.9)', opacity: 0 },
  ], { duration: 2400, easing: 'ease-out', ...FWD }).onfinish = () => s.remove();
  return s.center;
}
// Sad: drops in, shakes, sinks away
function popSad(ch, p) {
  const s = spawnEmo(ch, p.x, p.y, 64, true);
  if (done(s, 2000)) return;
  s.animate([
    { transform: 'translateY(-40px)', opacity: 0 },
    { transform: 'translateY(0)', opacity: 1, offset: .13 },
    { transform: 'translateX(-8px) rotate(-6deg)', offset: .2 },
    { transform: 'translateX(8px) rotate(6deg)', offset: .27 },
    { transform: 'translateX(-5px) rotate(-3deg)', offset: .34 },
    { transform: 'translateX(0) rotate(0)', opacity: 1, offset: .42 },
    { transform: 'translateX(0) rotate(0)', opacity: 1, offset: .75 },
    { transform: 'translateY(14px)', opacity: 0 },
  ], { duration: 2400, easing: 'ease-in-out', ...FWD }).onfinish = () => s.remove();
}
// Warm (close by): a bang. Big punch-in, a flash ring and short sparks
function bangWarm(ch, p) {
  const s = spawnEmo(ch, p.x, p.y, 76, true);
  if (done(s, 2000)) return;
  const c = s.center, k = emoK(), ring = document.createElement('span');
  ring.className = 'fxring'; ring.style.width = ring.style.height = (80 * k) + 'px';
  ring.style.left = (c.x - 40 * k) + 'px'; ring.style.top = (c.y - 40 * k) + 'px';
  fxLayer.appendChild(ring);
  ring.animate([{ transform: 'scale(.2)', opacity: .9 }, { transform: 'scale(1.8)', opacity: 0 }], { duration: 550, easing: 'ease-out', ...FWD }).onfinish = () => ring.remove();
  s.animate([
    { transform: 'scale(0)', opacity: 0 },
    { transform: 'scale(1.7)', opacity: 1, offset: .1 },
    { transform: 'scale(.9)', offset: .2 },
    { transform: 'scale(1.05)', offset: .28 },
    { transform: 'scale(1)', opacity: 1, offset: .75 },
    { transform: 'scale(1.1) translateY(-20px)', opacity: 0 },
  ], { duration: 2100, easing: 'ease-out', ...FWD }).onfinish = () => s.remove();
  for (let i = 0; i < 8; i++) {
    const sp = spawnEmo(i % 2 ? '✨' : '🔥', c.x, c.y, 20);
    const a = i / 8 * Math.PI * 2, d = (70 + Math.random() * 20) * k;
    sp.animate([
      { transform: 'translate(0,0) scale(.4)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(1)`, opacity: 0 },
    ], { duration: 700, easing: 'cubic-bezier(.1,.8,.3,1)', ...FWD }).onfinish = () => sp.remove();
  }
}
// Cold (far away): shiver. Fast small trembling, then it fades
function shiverCold(ch, p) {
  const s = spawnEmo(ch, p.x, p.y, 64, true);
  if (done(s, 2000)) return;
  const k = [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: .07 }];
  for (let i = 0; i < 20; i++) k.push({ transform: `translateX(${i % 2 ? 3 : -3}px)`, opacity: 1, offset: .08 + i * .038 });
  k.push({ transform: 'translateX(0)', opacity: 0 });
  s.animate(k, { duration: 2400, easing: 'linear', ...FWD }).onfinish = () => s.remove();
}
// A new question: emoji of the last one fade out fast, so they do not point at the wrong place
function clearEmo() {
  fxLayer.querySelectorAll('.fxemo, .fxring').forEach(s => {
    if (REDUCED || !s.animate) { s.remove(); return; }
    // fade out from where it is now (read before stopping the running animation)
    const cs = getComputedStyle(s), from = { opacity: cs.opacity, transform: cs.transform };
    if (s.getAnimations) s.getAnimations().forEach(a => a.cancel());
    s.animate([from, { opacity: 0, transform: from.transform }], { duration: 250, ...FWD }).onfinish = () => s.remove();
  });
}
// Star or a perfect round: a burst of emoji flying out
function burst(kind, p, n = 14) {
  for (let i = 0; i < n; i++) {
    const s = spawnEmo(pickEmo(kind), p.x, p.y, 26 + Math.random() * 22);
    if (done(s, 1000)) continue;
    const a = Math.random() * Math.PI * 2, d = (90 + Math.random() * 120) * emoK();
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d - 60;
    s.animate([
      { transform: 'translate(0,0) scale(.3) rotate(0)', opacity: 1 },
      { transform: `translate(${dx * .7}px,${dy * .7}px) scale(1) rotate(${(Math.random() - .5) * 180}deg)`, opacity: 1, offset: .5 },
      { transform: `translate(${dx}px,${dy + 80}px) scale(.8) rotate(${(Math.random() - .5) * 360}deg)`, opacity: 0 },
    ], { duration: 1900 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.4,1)', ...FWD }).onfinish = () => s.remove();
  }
}

/* ---------- Learning logic ---------- */
// A round: first the names without a star, picked at random with no preference between them (all of them when they fit).
// The rest is filled at random with names that have a star. Mixed up, so the names with a star are not all at the end.
// (The box per name is still kept up to date, but not used for picking.)
function pickQueue(pool, n) {
  const todo = shuffle(pool.filter(id => !isMastered(id))).slice(0, n);
  const known = shuffle(pool.filter(isMastered)).slice(0, n - todo.length);
  return shuffle(todo.concat(known));
}
// outcome: perfect | helped | wrongfix | fail. Returns true when a star was just earned.
function applyOutcome(id, outcome) {
  const s = stat(id), before = s.streak >= 3;
  s.seen++;
  if (outcome === 'perfect') { s.streak++; s.box = Math.min(4, s.box + 1); s.good++; }
  if (outcome === 'helped') { s.good++; }
  if (outcome === 'wrongfix') { s.streak = 0; s.good++; s.bad++; }
  if (outcome === 'fail') { s.streak = 0; s.box = 1; s.bad++; }
  save(); refreshDone();
  return !before && s.streak >= 3;
}
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
// Spelling: 'streng' = exactly right incl. capitals, a spelling mistake costs half a point (like in class);
// 'soepel' = a small mistake is fine when it clearly looks like the name. Default: strict for De Wereld, lenient otherwise.
const spelling = () => prog.prefs.spelling || (PACK.series === 'De Wereld' ? 'streng' : 'soepel');
// Edit distance where swapping two neighbouring letters counts as one mistake
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
// "Looks like it": same first letter, and 1 mistake allowed from 6 letters, 2 from 10 letters
function closeTo(text, name) {
  const a = norm(name), b = norm(text);
  return a.length >= 6 && a[0] === b[0] && lev(a, b) <= (a.length >= 10 ? 2 : 1);
}
// Another name on the list (not one with the same name: Groningen is a province and a city)
const isOtherName = (text, it) => ITEMS.some(o => o !== it && o.name !== it.name && norm(o.name) === norm(text));
// Proeftoets: points per answer
function gradeTyped(text, it) {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  if (!t) return { pts: 0, kind: 'leeg' };
  if (t === it.name || (it.alsoExact || []).includes(t)) return { pts: 1, kind: 'ok' };
  if ((it.aliases || []).some(a => norm(a) === norm(t))) return { pts: 1, kind: 'ok', note: `Op je lijst heet dit: <b>${esc(it.name)}</b>.` };
  if (isOtherName(t, it)) return { pts: 0, kind: 'fout' };
  if (norm(t) !== norm(it.name) && !closeTo(t, it.name)) return { pts: 0, kind: 'fout' };
  if (spelling() === 'streng') return { pts: 0.5, kind: 'spel', note: `Spelfout, halve punt eraf. Zo schrijf je het: <b>${esc(it.name)}</b>.` };
  return { pts: 1, kind: 'ok', note: `Bijna goed! Zo schrijf je het: <b>${esc(it.name)}</b>.` };
}
// Wat is dit? (typing): practice, so capitals and accents never make it wrong; small typos only with 'soepel'
function checkTyped(text, it) {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t === it.name || (it.alsoExact || []).includes(t)) return { ok: true };
  if (norm(t) === norm(it.name)) return { ok: true, note: `Let op de schrijfwijze: <b>${esc(it.name)}</b>.` };
  if ((it.aliases || []).some(a => norm(a) === norm(t))) return { ok: true, note: `Op je lijst heet dit: <b>${esc(it.name)}</b>.` };
  if (spelling() === 'soepel' && !isOtherName(t, it) && closeTo(t, it.name)) return { ok: true, note: `Bijna goed! Zo schrijf je het: <b>${esc(it.name)}</b>.` };
  return { ok: false };
}
// Hint 1 when typing: first two letters, the rest as blanks
function patternHtml(name) {
  let n = 0, s = '';
  for (const ch of name) {
    if (/\s/.test(ch)) { s += '<span class="gap"></span>'; continue; }
    if (ch === '-') { s += '-'; continue; }
    s += n < 2 ? esc(ch) : '_';
    n++;
  }
  return s;
}
function makeOpts(id) {
  const it = BY[id];
  const GROUP = { country: 'area', state: 'area', mtn: 'area', sea: 'water', river: 'water', canal: 'water', city: 'point' };
  // Never two buttons with the same name (Groningen is both a province and a city)
  const others = ITEMS.filter(i => i.id !== id && i.name !== it.name);
  const pool = [];
  const add = list => { for (const i of shuffle(list)) if (pool.length < 3 && !pool.includes(i) && !pool.some(q => q.name === i.name)) pool.push(i); };
  add(others.filter(i => i.cat === it.cat));
  add(others.filter(i => i.cat !== it.cat && GROUP[i.kind] === GROUP[it.kind]));
  add(others.filter(i => GROUP[i.kind] !== GROUP[it.kind]));
  return shuffle([id, ...pool.map(i => i.id)]);
}

/* ---------- App state ---------- */
const state = { mode: 'verkennen', sel: null, selAlso: [], rounds: {}, setupOpen: {}, resetAsk: false, sumHl: null };
const allCats = PACK.cats.map(c => c.id);
const P = {
  wat: prefs('wat', { type: 'mc', cats: allCats, len: 10 }),
  waar: prefs('waar', { cats: allCats, len: 10 }),
  toets: prefs('toets', { cats: allCats }),
};
const TOETS_N = 10;
// Go on by itself after a right answer (never after a mistake); longer when a star was earned
const AUTO_MS = 1500, AUTO_STAR_MS = 4000;
const autoOn = () => prog.prefs.auto !== false;
// One line: how ready for the test, from the stars
function readiness() {
  const n = ITEMS.filter(i => isMastered(i.id)).length, p = n / ITEMS.length;
  const lead = `${n} van de ${ITEMS.length} namen hebben een ster.`;
  if (p >= 1) return `${lead} Je bent klaar voor de toets!`;
  if (p >= 0.8) return `${lead} Bijna klaar voor de toets.`;
  if (p >= 0.5) return `${lead} Goed op weg. Oefen vooral de namen zonder ster.`;
  if (p > 0) return `${lead} Je bent begonnen. Blijf oefenen met Wat is dit?.`;
  return 'Nog geen sterren. Begin met Bekijken en daarna Wat is dit?.';
}
const verdictHtml = txt => `<div class="verdict"><b>Klaar voor de toets?</b> ${txt}</div>`;
const poolOf = cats => ITEMS.filter(i => cats.includes(i.cat)).map(i => i.id);

/* ---------- Uitleg per modus (overlay) ---------- */
// Example of one name's dots, used in the explanation
const demo = (n, star = false) => `<span class="track">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}<b class="${star ? 'on' : ''}">★</b></span>`;
function legend(title, rows, note = '', sub = '') {
  const two = rows.every(r => !r[1]); // rows without a "before → after" step
  return `<div class="legend"><div class="legend-t">${title}</div>${sub ? `<p class="legend-s">${sub}</p>` : ''}<div class="lgrid${two ? ' two' : ''}">${rows.map(([from, to, txt]) =>
    two ? `${from}<span>${txt}</span>` : `${from}<span class="arr">→</span>${to}<span>${txt}</span>`).join('')}</div>${note ? `<p class="muted" style="margin:6px 0 0">${note}</p>` : ''}</div>`;
}
// A random short name from the list, used as the example in the explanation (works for any lesson pack)
function exampleName() {
  const sorted = ITEMS.map(i => i.name).sort((a, b) => a.length - b.length);
  const short = sorted.filter(n => n.length <= 7);
  const pool = short.length >= 3 ? short : sorted.slice(0, 5);
  return esc(pool[Math.floor(Math.random() * pool.length)]);
}
// Each text has a touch version (t) and a mouse/touchpad version (p); the page shows the one that fits the device
// Each text has a touch version (t) and a mouse/touchpad version (p); a function is filled in when the help opens
const HELP = {
  verkennen: { title: 'Bekijken', lead: 'Hier leer je de kaart kennen. Er zijn geen punten te halen.', items: [
    { t: 'Tik op de kaart of op een naam in de lijst. Je ziet dan wat het is en waar het ligt.',
      p: 'Ga met de muis over de kaart of over een naam in de lijst. Je ziet dan wat het is en waar het ligt.' },
    `Met ${UI('Namen')} zet je alle namen op de kaart.`,
    { t: `Zoomen: knijp met twee vingers of gebruik ${UI('+')} en ${UI('−')}. Verschuiven: slepen.`,
      p: 'Zoomen: muiswiel, knijpen op het touchpad of dubbelklikken. Verschuiven: slepen, of met twee vingers schuiven.' },
    `Met ${UI('Kleuren')} zie je wat je al kent: dat heeft een ster <span class="starred">★</span> en is ingekleurd op de kaart.`,
  ] },
  wat: { title: 'Wat is dit?', lead: 'Er licht iets op op de kaart. Weet jij hoe het heet?', items: [
    'Kies uit 4 namen, of typ de naam zelf. Dat kies je voordat je begint.',
    { t: `Weet je het niet? Tik op ${UI('Geef een hint')}. Bij kiezen worden er 2 namen weggestreept. Bij typen zie je eerst de eerste 2 letters, daarna kies je uit 4 namen.`,
      p: `Weet je het niet? Klik op ${UI('Geef een hint')} of druk op ${KEY('H')}. Bij kiezen worden er 2 namen weggestreept. Bij typen zie je eerst de eerste 2 letters, daarna kies je uit 4 namen.` },
    `Weet je het dan nog niet? Met ${UI('Ik weet het niet')} zie je het antwoord. Die vraag komt in dezelfde ronde nog een keer terug.`,
    { p: `Kiezen kan ook met de toetsen ${KEY('1')} t/m ${KEY('4')}. Met ${KEY('Enter')} ga je naar de volgende vraag.` },
    () => autoOn() ? 'Goed zonder fout? Dan gaat het spel na 1,5 seconde zelf verder.' : '',
  ], after: () => { const n = exampleName(); return legend('Elke naam krijgt zijn eigen ster', [
    [demo(0), demo(1), `<b>${n}</b> goed zonder hint: er komt een bolletje bij.`],
    [demo(2), demo(3, true), `<b>${n}</b> voor de 3e keer achter elkaar goed: een ster! Bij ${UI('Bekijken')} is ${n} dan ingekleurd.`],
    [demo(2), demo(2), `<b>${n}</b> goed met een hint: blijft gelijk.`],
    [demo(2), demo(0), `<b>${n}</b> eerst fout, of ${UI('Ik weet het niet')}: weer bij 0.`],
  ], '', `Bijvoorbeeld voor <b>${n}</b>:`); } },
  waar: { title: 'Waar ligt…?', lead: 'Je krijgt een naam. Wijs de plek aan op de kaart.', items: [
    { t: 'Tik de plek aan. Mis? Dan zie je wat je aantikte. Probeer het nog eens.',
      p: 'Klik op de plek. Mis? Dan zie je waar je op klikte. Probeer het nog eens.' },
    { t: `Met ${UI('Geef een hint')} zoomt de kaart eerst in. Daarna gaat het goede antwoord knipperen. Met ${UI('Ik weet het niet')} zie je waar het ligt.`,
      p: `Met ${UI('Geef een hint')} of ${KEY('H')} zoomt de kaart eerst in. Daarna gaat het goede antwoord knipperen. Met ${UI('Ik weet het niet')} zie je waar het ligt. Met ${KEY('Enter')} ga je naar de volgende.` },
    () => autoOn() ? 'Goed zonder fout? Dan gaat het spel na 1,5 seconde zelf verder.' : '',
    `Hier krijg je geen bolletjes of sterren. Op de toets moet je de namen weten, dus oefen ook met ${UI('Wat is dit?')}.`,
  ] },
  toets: { title: 'Proeftoets', lead: 'Oefen zoals op de echte toets.', items: [
    `Op de kaart staan ${TOETS_N} nummers. Schrijf bij elk nummer de naam.`,
    { t: 'Tik op een nummer op de kaart om naar die regel te gaan.',
      p: `Klik op een nummer op de kaart om naar die regel te gaan. Met ${KEY('Enter')} ga je naar de volgende regel.` },
    { t: `Klaar? Tik op ${UI('Nakijken')}. Je ziet dan je score en de goede antwoorden.`, p: `Klaar? Klik op ${UI('Nakijken')}. Je ziet dan je score en de goede antwoorden.` },
    () => spelling() === 'streng'
      ? `Spelling staat op <b>streng</b>: alles moet precies goed, ook de hoofdletters. Een spelfout is een halve punt eraf, net als in de klas. Je zet dit om bij ${UI('Instellingen')}.`
      : `Spelling staat op <b>soepel</b>: een kleine spelfout mag, als het er duidelijk op lijkt. Je ziet dan hoe je het schrijft. Je zet dit om bij ${UI('Instellingen')}.`,
    'Een goed antwoord geeft die naam een bolletje erbij, net als bij Wat is dit?.',
  ] },
  voortgang: { title: 'Voortgang', lead: 'Hier zie je hoeveel je al kent.', items: [
    { t: 'Tik op een naam om te zien waar het ligt.', p: 'Klik op een naam om te zien waar het ligt.' },
    'De voortgang wordt bewaard op dit apparaat, in deze browser.',
  ], before: legend('Achter elke naam', [
    [demo(2), '', '2 keer achter elkaar goed. Nog 1 keer voor een ster.'],
    [demo(3, true), '', 'Een ster: deze ken je. Hij is ingekleurd op de kaart.'],
  ]) },
};
const helpEl = $('#help');
let helpReturn = null;
function openHelp(mode) {
  const h = HELP[mode];
  if (!h) return;
  $('#helpT').textContent = h.title;
  const items = h.items.map(t => typeof t === 'string' ? t : typeof t === 'function' ? t() : (FINE ? t.p : t.t)).filter(Boolean);
  $('#helpB').innerHTML = `<p class="lead">${h.lead}</p>${h.before || ''}<ul>${items.map(t => `<li>${t}</li>`).join('')}</ul>${typeof h.after === 'function' ? h.after() : (h.after || '')}`;
  helpReturn = document.activeElement;
  helpEl.hidden = false;
  $('#help .help-card').focus({ preventScroll: true });
}
function closeHelp() {
  if (helpEl.hidden) return;
  helpEl.hidden = true;
  if (helpReturn && helpReturn.focus) helpReturn.focus({ preventScroll: true });
}
// Close with the cross, the Ok button or by clicking outside the card
on(helpEl, 'click', e => { if (e.target === helpEl || e.target.closest('#helpX, #helpOk')) closeHelp(); });
/* Keyboard shortcuts (laptop) */
on(document, 'keydown', e => {
  if (e.key === 'Escape') { closeHelp(); return; }
  if (!helpEl.hidden) { if (e.key === 'Enter') { e.preventDefault(); closeHelp(); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  const k = e.key.toLowerCase();
  if (k === '+' || k === '=') { zoomBy(1.7); return; }
  if (k === '-' || k === '_') { zoomBy(1 / 1.7); return; }
  if (k === '0') { fitAll(); return; }
  const m = state.mode, r = state.rounds[m];
  const quiz = m === 'wat' || m === 'waar' || m === 'toets';
  const inRound = quiz && r && !r.over && r.cur && !state.setupOpen[m];
  if (k === 'enter') {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; // the button handles it
    if (inRound && r.cur.done) { e.preventDefault(); nextQuestion(r); }
    else if (quiz && (!r || state.setupOpen[m])) { e.preventDefault(); state.setupOpen[m] = false; startRound(m); }
    return;
  }
  if (!inRound) return;
  const c = r.cur;
  if (m === 'wat' && !c.done && c.opts && (P.wat.type === 'mc' || c.asMc) && /^[1-4]$/.test(k)) {
    const id = c.opts[+k - 1];
    if (id && !c.gone.includes(id) && !c.wrongOpts.includes(id)) answerWat(r, id);
    return;
  }
  if (k === 'h' && !c.done && (m === 'wat' || m === 'waar')) { (m === 'waar' ? hintWaar : hintWat)(r); return; }
});

function setMode(mode, showHelp = false) {
  state.mode = mode;
  setHover(null); showTip(null); svg.dataset.cur = '';
  document.querySelectorAll('#modes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  $('#scorego').setAttribute('aria-pressed', String(mode === 'voortgang'));
  showAllLabels = mode === 'verkennen' && !!prog.prefs.labels;
  applyColors();
  solLabels.clear();
  setHl(null);
  state.sumHl = null;
  const r = state.rounds[mode];
  if (mode === 'verkennen' && state.sel) setHl({ id: state.sel, style: 'sel' });
  if (mode === 'toets' && r && r.graded) r.items.forEach(id => solLabels.add(id));
  if (r && r.cur && !r.over) showQuestion(r, false);
  else if (mode !== 'verkennen') fitAll();
  renderLabels();
  renderNums();
  render();
  if (showHelp) openHelp(mode);
}
on($('#modes'), 'click', e => { const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode, true); });
on($('#scorebtn'), 'click', () => setMode('voortgang', true));
on($('#scorego'), 'click', () => setMode('voortgang', true));

/* ---------- Rounds ---------- */
function startRound(mode, ids) {
  let queue;
  if (ids) queue = shuffle(ids.slice());
  else if (mode === 'toets') { startToets(); return; }
  else {
    const pool = poolOf(P[mode].cats);
    queue = pickQueue(pool, P[mode].len === 0 ? pool.length : P[mode].len);
  }
  if (!queue.length) { toast('Er is niets om te oefenen met deze keuze'); return; }
  const r = { mode, queue, i: 0, tally: { perfect: 0, helped: 0, wrongfix: 0, fail: 0 }, res: {}, stars: [], reins: {}, over: false };
  state.rounds[mode] = r;
  nextQuestion(r, true);
}
function nextQuestion(r, first) {
  clearTimeout(r.autoT); r.autoT = null;
  if (!first) r.i++;
  solLabels.clear();
  clearEmo();
  if (r.i >= r.queue.length) {
    r.over = true; r.cur = null; state.sumHl = null; setHl(null); renderLabels(); fitAll(); render();
    const all = Object.values(r.res);
    if (emojiOn() && all.length && all.every(o => o === 'perfect')) {
      const z = box(); const p = { x: z.width / 2, y: z.height / 2 };
      burst('round', popHappy(pickEmo('round'), p), 18);
    }
    return;
  }
  const id = r.queue[r.i];
  r.cur = { id, hint: 0, wrong: 0, done: false, outcome: null, opts: null, gone: [], wrongOpts: [], fb: null, typed: '', asMc: false };
  if (r.mode === 'wat' && P.wat.type === 'mc') r.cur.opts = makeOpts(id);
  showQuestion(r, true);
  render();
  lastSwap = performance.now();
  if (r.mode === 'wat' && P.wat.type === 'typen') { const inp = $('#ans'); inp && inp.focus({ preventScroll: true }); }
}
function showQuestion(r, zoom) {
  const c = r.cur;
  if (r.mode === 'waar') {
    setHl(c.done ? { id: c.id, style: 'q' } : null);
    if (zoom) fitAll();
  } else {
    setHl({ id: c.id, style: 'q' });
    // Busy maps zoom in a little; otherwise a new round starts with the whole map and the view the child chose stays
    if (PACK.quizZoom > 1) softFocus(c.id, PACK.quizZoom);
    else if (zoom && r.i === 0) fitAll();
    else ensureVisible(c.id);
  }
  if (c.done) solLabels.add(c.id);
  renderLabels();
}
function finish(r, outcome) {
  const c = r.cur;
  c.done = true; c.outcome = outcome;
  r.tally[outcome]++;
  // Per name the summary keeps the worst result of this round (a shown answer stays shown, even if it went well later)
  const RANK = { perfect: 0, helped: 1, wrongfix: 1, fail: 2 };
  if (!(c.id in r.res) || RANK[outcome] > RANK[r.res[c.id]]) r.res[c.id] = outcome;
  if (r.mode !== 'waar') {
    c.star = applyOutcome(c.id, outcome);
    if (c.star) r.stars.push(c.id);
    // A shown answer comes back a few questions later (max twice per round)
    if (outcome === 'fail' && r.mode === 'wat') {
      r.reins[c.id] = (r.reins[c.id] || 0) + 1;
      if (r.reins[c.id] <= 2) r.queue.splice(Math.min(r.i + 3, r.queue.length), 0, c.id);
    }
  }
  c.fbEmo = null;
  c.emo = null;
  if (emojiOn()) {
    const p = itemScreen(c.id);
    if (c.star) { c.emo = pickEmo('star'); burst('star', popHappy(c.emo, p)); }
    else if (outcome === 'perfect') { c.emo = pickEmo('perfect'); popHappy(c.emo, p); }
    else if (outcome === 'fail') { c.emo = pickEmo('shown'); popSad(c.emo, p); }
    else { c.emo = pickEmo('helped'); popHappy(c.emo, p); }
  }
  solLabels.add(c.id);
  setHl({ id: c.id, style: 'q' });
  // Right without a mistake: go on by itself after a moment (the bar on the Volgende button shows it)
  c.autoMs = 0;
  if (autoOn() && (r.mode === 'wat' || r.mode === 'waar') && (outcome === 'perfect' || outcome === 'helped')) {
    c.autoMs = c.star ? AUTO_STAR_MS : AUTO_MS;
    clearTimeout(r.autoT);
    r.autoT = setTimeout(() => {
      r.autoT = null;
      if (signal.aborted || state.mode !== r.mode || state.rounds[r.mode] !== r || r.cur !== c || state.setupOpen[r.mode] || !helpEl.hidden) return;
      nextQuestion(r);
    }, c.autoMs);
  }
  renderLabels();
  render();
  lastSwap = performance.now();
  const nb = $('#btn-next'); if (nb) { nb.focus({ preventScroll: true }); nb.scrollIntoView({ block: 'nearest' }); }
}
function outcomeFor(c) { return c.wrong > 0 ? 'wrongfix' : c.hint > 0 ? 'helped' : 'perfect'; }

function answerWat(r, id) {
  const c = r.cur;
  if (c.done) return;
  if (id === c.id) { finish(r, outcomeFor(c)); return; }
  if (!c.wrongOpts.includes(id)) c.wrongOpts.push(id);
  c.wrong++;
  c.fb = { cls: 'bad', html: 'Nog niet goed. Probeer het nog eens of neem een hint.' };
  wrongEmo(c);
  render();
}
function wrongEmo(c) {
  c.fbEmo = null;
  if (!emojiOn()) return;
  c.fbEmo = pickEmo('wrong');
  popSad(c.fbEmo, itemScreen(c.id));
}
function submitTyped(r, text) {
  const c = r.cur;
  if (c.done || !text.trim()) return;
  const res = checkTyped(text, BY[c.id]);
  if (res.ok) { c.note = res.note; finish(r, outcomeFor(c)); return; }
  c.wrong++;
  c.fb = { cls: 'bad', html: `<b>${esc(text.trim())}</b> is niet goed. Probeer het nog eens of neem een hint.` };
  wrongEmo(c);
  c.typed = text;
  render();
  const inp = $('#ans'); if (inp) { inp.focus({ preventScroll: true }); inp.select(); }
}
function hintWat(r) {
  const c = r.cur;
  if (c.done) return;
  const typing = P.wat.type === 'typen' && !c.asMc;
  if (typing) {
    if (c.hint === 0) { c.hint = 1; c.fb = null; render(); const inp = $('#ans'); inp && inp.focus({ preventScroll: true }); return; }
    if (c.hint === 1) { c.hint = 2; c.asMc = true; c.opts = makeOpts(c.id); c.fb = null; render(); return; }
  } else if (c.hint === 0) {
    // Remove two wrong options
    const wrong = c.opts.filter(o => o !== c.id && !c.wrongOpts.includes(o) && !c.gone.includes(o));
    shuffle(wrong).slice(0, 2).forEach(o => c.gone.push(o));
    c.hint++; c.fb = null; render(); return;
  }
  c.hint++;
  finish(r, 'fail');
}
function hintWaar(r) {
  const c = r.cur;
  if (c.done) return;
  c.hint++;
  if (c.hint === 1) { focusItem(c.id, 340, 0.45); c.fb = { cls: 'info', html: 'Ingezoomd: het ligt ergens in dit stuk van de kaart.' }; }
  else if (c.hint === 2) { setHl({ id: c.id, style: 'q', blink: true }); c.fb = { cls: 'info', html: 'Kijk goed: het knippert op de kaart.' }; }
  else { ensureVisible(c.id); finish(r, 'fail'); return; }
  render();
}
/* ---------- Proeftoets ---------- */
function startToets(ids) {
  const pool = ids || poolOf(P.toets.cats);
  const items = shuffle(pool.slice()).slice(0, TOETS_N);
  if (!items.length) { toast('Er is niets om te oefenen met deze keuze'); return; }
  state.rounds.toets = { mode: 'toets', items, answers: {}, graded: null, warned: false, active: 0, over: false };
  solLabels.clear(); setHl(null); renderLabels();
  fitAll();
  renderNums();
  render();
  const inp = $('#t0'); inp && inp.focus({ preventScroll: true });
}
// Where a number goes: next to a city dot, otherwise where the name would go
function numPoint(id) {
  const it = BY[id], u = upp();
  if (it.kind === 'city') { const p = M.cities[id]; return { x: p[0] + 13 * u, y: p[1] - 13 * u, dot: p }; }
  const p = labelPoint(id); return { x: p[0], y: p[1] };
}
function renderNums() {
  const g = svg.getElementById('nums');
  if (!g) return;
  const r = state.rounds.toets;
  if (state.mode !== 'toets' || !r || state.setupOpen.toets) { g.innerHTML = ''; return; }
  const u = upp();
  g.innerHTML = r.items.map((id, i) => {
    const p = numPoint(id), res = r.graded && r.graded[i];
    const cls = 'num' + (r.active === i && !r.graded ? ' act' : '') + (res ? ' g-' + (res.pts === 1 ? 'ok' : res.pts ? 'half' : 'bad') : '');
    const lead = p.dot ? `<line x1="${p.dot[0]}" y1="${p.dot[1]}" x2="${p.x}" y2="${p.y}"/>` : '';
    return `<g class="${cls}" data-i="${i}">${lead}<circle cx="${p.x}" cy="${p.y}" r="${(10.5 * u).toFixed(2)}"/><text x="${p.x}" y="${p.y}" style="font-size:${(12 * u).toFixed(2)}px">${i + 1}</text></g>`;
  }).join('');
}
const fmtPts = v => (Math.floor(v) ? String(Math.floor(v)) : (v % 1 ? '' : '0')) + (v % 1 ? '½' : '');
function gradeToets(r) {
  r.graded = r.items.map(id => gradeTyped(r.answers[id], BY[id]));
  r.score = r.graded.reduce((a, g) => a + g.pts, 0);
  r.stars = [];
  r.items.forEach((id, i) => {
    const pts = r.graded[i].pts;
    if (applyOutcome(id, pts === 1 ? 'perfect' : pts ? 'helped' : 'fail')) r.stars.push(id);
  });
  r.items.forEach(id => solLabels.add(id));
  renderLabels(); renderNums(); render();
  if (emojiOn()) {
    const z = box(), p = { x: z.width / 2, y: z.height / 2 }, pct = r.score / r.items.length;
    if (pct === 1) { burst('round', popHappy(pickEmo('round'), p), 18); }
    else if (pct >= 0.8) popHappy(pickEmo('perfect'), p);
    else if (pct >= 0.55) popHappy(pickEmo('helped'), p);
    else popSad(pickEmo('shown'), p);
  }
  panel.scrollTop = 0;
}

function onMapTap(x, y) {
  if (state.mode === 'toets') {
    // A tap on a number jumps to its answer line
    const r = state.rounds.toets;
    if (!r || r.graded || state.setupOpen.toets) return;
    let best = null;
    r.items.forEach((id, i) => { const p = numPoint(id), d = Math.hypot(p.x - x, p.y - y) * view.s; if (d < 22 && (!best || d < best.d)) best = { i, d }; });
    if (best) { const inp = $('#t' + best.i); inp && inp.focus(); }
    return;
  }
  const hits = hitsAt(x, y);
  if (state.mode === 'verkennen') {
    if (!hits.length) { state.sel = null; state.selAlso = []; setHl(null); render(); toast('Hier ligt niets van je lijst'); return; }
    state.sel = hits[0]; state.selAlso = hits.slice(1);
    setHl({ id: hits[0], style: 'sel' });
    render(); return;
  }
  if (state.mode === 'waar') {
    const r = state.rounds.waar;
    if (!r || r.over || !r.cur || r.cur.done) return;
    const c = r.cur;
    if (hits.includes(c.id)) { finish(r, outcomeFor(c)); return; }
    c.wrong++;
    let msg = hits.length ? `Dat is <b>${esc(BY[hits[0]].name)}</b>.` : 'Daar ligt het niet.';
    // Close = within 80 screen pixels of the place (its box for areas and lines)
    const b = bboxOf(c.id);
    const gap = Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w)), Math.max(b.y - y, 0, y - (b.y + b.h))) * view.s;
    const warm = gap < 80;
    if (warm) msg += ' Je zit dichtbij!';
    c.fbEmo = null;
    if (emojiOn()) {
      msg = (warm ? '<b>Warm!</b> ' : '<b>Koud!</b> ') + msg;
      c.fbEmo = pickEmo(warm ? 'warm' : 'cold');
      (warm ? bangWarm : shiverCold)(c.fbEmo, screenOf(x, y));
    }
    c.fb = { cls: 'bad', html: msg + ' Probeer het nog eens.' };
    render();
  }
}

/* ---------- Panel rendering ---------- */
const panel = $('#panel');
// Time of the last change between question and answer in the panel (for the tap guard)
let lastSwap = 0;
const K = t => `<span class="kbd">${t}</span>`;
const catChip = it => `<span class="chip cat">${esc(CAT[it.cat].single)}</span>`;
// Three dots that lead to a star: the progress of one item
function trackHtml(id) {
  const star = isMastered(id), n = star ? 3 : Math.min(3, streakOf(id));
  return `<span class="track" aria-hidden="true">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}<b class="${star ? 'on' : ''}">★</b></span>`;
}
function trackText(id) {
  const name = `<b>${esc(BY[id].name)}</b>`, n = Math.min(3, streakOf(id));
  if (isMastered(id)) return `${name} heeft al een ster.`;
  if (n === 0) return `${name}: nog 3 keer achter elkaar goed, dan krijgt het een ster.`;
  return `${name}: ${n} keer achter elkaar goed. Nog ${3 - n} keer, dan krijgt het een ster.`;
}
const starLine = (id, pre = '') => `<div class="starline">${trackHtml(id)}<span>${pre}${trackText(id)}</span></div>`;
// Where the item changed colour on the map
function colouredWhere(id) {
  const it = BY[id], n = esc(it.name);
  const b = UI('Bekijken');
  if (it.kind === 'city') return `Bij ${b} is de stip van ${n} nu groen.`;
  if (it.kind === 'river' || it.kind === 'canal') return `Bij ${b} is ${n} nu blauw.`;
  if (it.kind === 'sea') return `Bij ${b} is ${n} nu lichtblauw.`;
  if (it.kind === 'mtn') return `Bij ${b} zijn de bergtekentjes van ${n} nu bruin.`;
  return `Bij ${b} is ${n} nu ingekleurd.`;
}
function streakHtml(id) {
  if (isMastered(id)) return '<span class="starred" title="Ster: 3 keer achter elkaar goed">★</span>';
  const n = Math.min(3, streakOf(id));
  return `<span class="streak" title="${n} van 3 keer achter elkaar goed">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
}
function catToggles(sel, act) {
  return `<div class="toggles">${PACK.cats.map(c => `<button data-act="${act}" data-cat="${c.id}" aria-pressed="${sel.includes(c.id)}">${esc(c.plural)} <span class="muted">${ITEMS.filter(i => i.cat === c.id).length}</span></button>`).join('')}</div>`;
}
function lenToggles(cur, act) {
  return `<div class="toggles">${[[10, '10 vragen'], [20, '20 vragen'], [0, 'Alles']].map(([v, l]) => `<button data-act="${act}" data-len="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
}

function render() {
  const m = state.mode;
  if (m === 'verkennen') return renderVerkennen();
  if (m === 'voortgang') return renderVoortgang();
  const r = state.rounds[m];
  if (!r || state.setupOpen[m]) return renderSetup(m);
  if (r.over) return renderSummary(r);
  if (m === 'wat') return renderWat(r);
  if (m === 'waar') return renderWaar(r);
  if (m === 'toets') return renderToets(r);
}

function renderVerkennen() {
  const id = state.sel, it = id && BY[id];
  let info = '';
  if (it) {
    info = `<div class="row"><div class="big">${esc(it.name)}</div>${catChip(it)}</div>${starLine(id)}`;
    if (state.selAlso.length) info += `<div class="row muted">Hier ligt ook: ${state.selAlso.map(o => `<button class="chip" data-act="pick" data-id="${o}">${esc(BY[o].name)}</button>`).join(' ')}</div>`;
  } else {
    info = FINE
      ? '<p class="muted" style="margin:0">Ga met de muis over de kaart of over een naam om te zien wat het is en waar het ligt.</p>'
      : '<p class="muted" style="margin:0">Tik op de kaart of op een naam om te zien wat het is en waar het ligt. Knijp om te zoomen.</p>';
  }
  panel.innerHTML = `
    <div class="row between"><span class="eyebrow">Bekijken</span>
      <span class="row" style="gap:6px">${toggleHtml('labels', 'Namen', showAllLabels)}${toggleHtml('colors', 'Kleuren', colorsOn())}</span></div>
    ${info}
    ${sheetHtml(false)}`;
}
// On/off switch, e.g. for Namen and Kleuren in Bekijken
const toggleHtml = (act, label, on) => `<button class="tgl" role="switch" data-act="${act}" aria-checked="${on}"><span class="tgl-track"><span class="tgl-knob"></span></span>${label}</button>`;
function sheetHtml(progressView) {
  return `<div class="sheet">${PACK.cats.map(c => `<div><h3>${esc(c.plural.toUpperCase())}</h3><ul>${ITEMS.filter(i => i.cat === c.id).map(i =>
    `<li><button data-act="pick" data-id="${i.id}" aria-current="${state.sel === i.id && !progressView}"><span>${esc(i.name)}</span><span class="st">${progressView ? streakHtml(i.id) : (isMastered(i.id) ? '<span class="starred">★</span>' : '')}</span></button></li>`).join('')}</ul></div>`).join('')}</div>`;
}

function renderSetup(m) {
  const p = P[m];
  let body = '';
  if (m === 'wat') {
    body = `<p class="qtitle">Wat is dit?</p>
      <p class="muted" style="margin:0">Er licht iets op de kaart op. Weet jij hoe het heet?</p>
      <div class="row"><span class="seg"><button data-act="type" data-type="mc" aria-pressed="${p.type === 'mc'}">Kies uit 4</button><button data-act="type" data-type="typen" aria-pressed="${p.type === 'typen'}">Zelf typen</button></span></div>
      ${catToggles(p.cats, 'cat')}${lenToggles(p.len, 'len')}`;
  } else if (m === 'waar') {
    body = `<p class="qtitle">Waar ligt…?</p>
      <p class="muted" style="margin:0">Je krijgt een naam en ${FINE ? 'klikt' : 'tikt'} de plek aan op de kaart. Dit telt niet mee voor je sterren.</p>
      ${catToggles(p.cats, 'cat')}${lenToggles(p.len, 'len')}`;
  } else {
    body = `<p class="qtitle">Proeftoets</p>
      <p class="muted" style="margin:0">${TOETS_N} vragen, zoals op de echte toets. Op de kaart staan nummers; je schrijft bij elk nummer de naam.</p>
      ${catToggles(p.cats, 'cat')}`;
  }
  const spellRow = `<div class="setrow"><span>Spelling</span><span class="seg"><button data-act="spell" data-v="streng" aria-pressed="${spelling() === 'streng'}">Streng</button><button data-act="spell" data-v="soepel" aria-pressed="${spelling() === 'soepel'}">Soepel</button></span>
      <span class="muted">${spelling() === 'streng' ? 'Alles precies goed, ook hoofdletters. In de Proeftoets is een spelfout een halve punt eraf.' : 'Een kleine spelfout mag, als het er duidelijk op lijkt.'}</span></div>`;
  if (m === 'toets' || (m === 'wat' && p.type === 'typen')) body += spellRow;
  body += `<div class="row" style="gap:6px">${m === 'wat' || m === 'waar' ? toggleHtml('auto', 'Automatisch verder', autoOn()) : ''}${toggleHtml('emoji', "Emoji's", emojiOn())}</div>`;
  const canBack = state.rounds[m] && !state.rounds[m].over;
  panel.innerHTML = `${body}<div class="row"><button class="btn primary" data-act="go">Start</button>${canBack ? '<button class="btn ghost" data-act="resume">Terug naar de ronde</button>' : ''}</div>`;
}

function progressLine(r) {
  const t = r.tally;
  return `<div class="row between"><div class="pl"><span class="eyebrow">Vraag ${Math.min(r.i + 1, r.queue.length)} van ${r.queue.length}</span>
    <span class="live">Goed <b>${t.perfect}</b> · Met hulp <b>${t.helped + t.wrongfix}</b> · Fout <b>${t.fail}</b></span></div>
    <button class="btn ghost" data-act="setup" style="padding:4px 10px;font-size:13px">Instellingen</button></div>`;
}
function feedbackHtml(r) {
  const c = r.cur, it = BY[c.id];
  if (!c.done) return c.fb ? `<div class="fb ${c.fb.cls}">${emoHtml(c.fbEmo)}${c.fb.html}</div>` : '';
  const counts = r.mode !== 'waar';
  const name = `<b>${esc(it.name)}</b>`, note = c.note ? ' ' + c.note : '';
  let msg = c.outcome === 'fail'
    ? `<div class="fb info result">${emoHtml(c.emo)}<span>Het is ${name}.</span></div>`
    : `<div class="fb good result">${emoHtml(c.emo)}<span>${c.outcome === 'perfect' ? 'Goed zo!' : 'Goed!'} Het is ${name}.${note}</span></div>`;
  if (counts) {
    if (c.star) {
      msg += `<div class="starline won">${trackHtml(c.id)}<span><b>${esc(it.name)} heeft nu een ster!</b> Je had het 3 keer achter elkaar goed. ${colouredWhere(c.id)}</span></div>`;
    } else {
      const why = {
        perfect: '',
        helped: 'Met een hint telt het niet mee. ',
        wrongfix: 'Je had eerst een fout, dus je begint weer bij 0. ',
        fail: `Je wist het nog niet, dus je begint weer bij 0.${r.mode === 'wat' ? ' Deze vraag komt zo nog een keer terug.' : ''} `,
      }[c.outcome];
      msg += starLine(c.id, why);
    }
  }
  const bar = c.autoMs && r.autoT ? `<span class="autobar" style="animation-duration:${c.autoMs}ms"></span>` : '';
  return msg + `<div class="row nextrow"><button class="btn primary nextbtn" id="btn-next" data-act="next">Volgende${K('Enter')}${bar}</button></div>`;
}

// Hint button with what it will do. label null = last step: show the answer
function hintHtml(label, text) {
  const main = label ? `<span aria-hidden="true">💡</span> ${label}` : 'Ik weet het niet';
  return `<div class="row"><button class="btn hintbtn ${label ? 'hint' : 'giveup'}" data-act="hint"><span class="hb-main">${main}${K('H')}</span><span class="hb-sub">${text}</span></button></div>`;
}
function renderWat(r) {
  const c = r.cur, it = BY[c.id];
  const typing = P.wat.type === 'typen' && !c.asMc;
  let ask = '';
  if (!c.done) {
    if (typing) {
      ask = (c.hint >= 1 ? `<div class="pattern" aria-label="Hint: begint met ${esc([...it.name].slice(0, 2).join(''))}, ${[...it.name].filter(ch => /[^\s-]/.test(ch)).length} letters">${patternHtml(it.name)}</div>` : '') +
        `<form class="answer" data-act="typed" autocomplete="off"><input id="ans" type="text" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" placeholder="Typ de naam" value="${esc(c.typed)}" aria-label="Jouw antwoord"><button class="btn primary" type="submit">Check</button></form>`;
    } else {
      ask = `<div class="opts">${c.opts.map(o => `<button data-act="opt" data-id="${o}" class="${c.gone.includes(o) ? 'gone' : ''} ${c.wrongOpts.includes(o) ? 'wrong' : ''}" ${c.gone.includes(o) || c.wrongOpts.includes(o) ? 'disabled' : ''}>${K(c.opts.indexOf(o) + 1)}${esc(BY[o].name)}</button>`).join('')}</div>`;
    }
    if (typing) ask += hintHtml(c.hint === 0 ? 'Geef een hint' : 'Geef nog een hint', c.hint === 0 ? 'Je ziet de eerste 2 letters.' : 'Je kiest dan uit 4 namen.');
    else if (!c.asMc && c.hint === 0) ask += hintHtml('Geef een hint', 'Er worden 2 namen weggestreept.');
    else ask += hintHtml(null, 'Dan laten we het antwoord zien.');
  }
  panel.innerHTML = `${progressLine(r)}
    <div class="row"><p class="qtitle">Wat is dit?</p>${catChip(it)}</div>
    ${ask}${feedbackHtml(r)}`;
}
function renderWaar(r) {
  const c = r.cur, it = BY[c.id];
  const hint = [['Geef een hint', 'De kaart zoomt in op het goede stuk.'], ['Geef nog een hint', 'Het goede antwoord gaat knipperen.'], [null, 'Dan laten we zien waar het ligt.']][Math.min(c.hint, 2)];
  panel.innerHTML = `${progressLine(r)}
    <div class="row"><p class="qtitle">Waar ligt ${esc(it.name)}?</p>${catChip(it)}</div>
    ${c.done ? '' : `<p class="muted" style="margin:0">${FINE ? 'Klik' : 'Tik'} de plek aan op de kaart.</p>${hintHtml(...hint)}`}
    ${feedbackHtml(r)}`;
}
function renderToets(r) {
  const head = `<div class="row between"><span class="eyebrow">${r.items.length} vragen · spelling ${spelling()}</span><button class="btn ghost" data-act="setup" style="padding:4px 10px;font-size:13px">Instellingen</button></div>`;
  if (!r.graded) {
    const empty = r.items.filter(id => !(r.answers[id] || '').trim()).length;
    panel.innerHTML = `${head}
      <p class="qtitle">Proeftoets</p>
      <p class="muted" style="margin:0">Schrijf bij elk nummer de naam.</p>
      <form class="tlist" data-act="toetsform" autocomplete="off">${r.items.map((id, i) => `<label class="trow"><span class="tnum">${i + 1}</span>
        <input id="t${i}" data-ti="${i}" type="text" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="${i < r.items.length - 1 ? 'next' : 'done'}" value="${esc(r.answers[id] || '')}" aria-label="Antwoord ${i + 1}"></label>`).join('')}</form>
      ${r.warned && empty ? `<div class="fb info">Je hebt nog ${empty === 1 ? '1 lege regel' : empty + ' lege regels'}. Een lege regel telt als fout.</div>` : ''}
      <div class="row"><button class="btn primary" id="btn-grade" data-act="grade">${r.warned && empty ? 'Toch nakijken' : 'Nakijken'}</button></div>`;
    return;
  }
  const n = r.items.length, pct = r.score / n;
  const msg = pct === 1 ? 'Alles goed! Je bent klaar voor de toets.' : pct >= 0.8 ? 'Bijna klaar voor de toets.' : pct >= 0.55 ? 'Goed op weg. Oefen je fouten nog een keer.' : 'Nog even oefenen. Begin met Bekijken.';
  const wrong = r.items.filter((id, i) => r.graded[i].pts < 1);
  const stars = r.stars.map(id => BY[id].name);
  panel.innerHTML = `${head}
    <p class="qtitle">Nagekeken${pct === 1 && emojiOn() ? ' <span class="emo-t" aria-hidden="true">🏆</span>' : ''}</p>
    <div class="scorebox"><span>Score</span><b>${fmtPts(r.score)}</b><span>van ${n}</span></div>
    ${verdictHtml(msg)}
    ${stars.length ? `<div class="starline won"><span class="starred" style="font-size:20px">★</span><span><b>${stars.length === 1 ? 'Nieuwe ster' : 'Nieuwe sterren'} voor ${esc(joinNl(stars))}!</b></span></div>` : ''}
    <ol class="tlist graded">${r.items.map((id, i) => {
      const g = r.graded[i], cls = g.pts === 1 ? 'ok' : g.pts ? 'half' : 'bad';
      const mark = g.pts === 1 ? '✓' : g.pts ? '½' : '✗';
      const typed = (r.answers[id] || '').trim();
      const fix = g.pts < 1 ? (g.note || `Het is <b>${esc(BY[id].name)}</b>.`) : (g.note || '');
      return `<li class="trow ${cls}"><span class="tnum">${i + 1}</span><span class="tans">${typed ? esc(typed) : '<span class="muted">leeg</span>'}${fix ? `<small>${fix}</small>` : ''}</span><span class="tmark" aria-label="${g.pts} punt">${mark}</span></li>`;
    }).join('')}</ol>
    <div class="row">
      ${wrong.length ? `<button class="btn primary" data-act="practice-toets">Oefen je fouten in Wat is dit?</button>` : ''}
      <button class="btn ${wrong.length ? 'ghost' : 'primary'}" data-act="go">Nog een keer</button>
      <button class="btn ghost" data-act="setup">Aanpassen</button>
    </div>`;
  r.practice = wrong;
}
// Round summary: a name lights up on the map (hover on a laptop, tap to keep it)
function sumLight(id) {
  solLabels.clear();
  if (id) { setHl({ id, style: 'sel' }); solLabels.add(id); ensureVisible(id); } else setHl(null);
  renderLabels();
}
on(panel, 'mouseover', e => {
  const b = e.target.closest('[data-act="sumhl"]');
  if (b && FINE) sumLight(b.dataset.id);
});
on(panel, 'mouseout', e => {
  const b = e.target.closest('[data-act="sumhl"]');
  if (b && FINE && !b.contains(e.relatedTarget)) sumLight(state.sumHl || null);
});
function renderSummary(r) {
  // Group the names by how they went (last answer per name)
  const by = { perfect: [], helped: [], fail: [] };
  Object.entries(r.res).forEach(([id, o]) => by[o === 'wrongfix' ? 'helped' : o].push(id));
  const labels = { perfect: 'In één keer goed', helped: 'Goed met een hint of na een fout', fail: 'Antwoord bekeken' };
  const groups = ['perfect', 'helped', 'fail'].filter(k => by[k].length).map(k => `
    <div class="sumgroup"><div class="sumhead"><span class="sw sw-${k}"></span>${labels[k]} <span class="muted">(${by[k].length})</span></div>
      <div class="chips">${by[k].map(id => `<button class="chip sumchip" data-act="sumhl" data-id="${id}" aria-pressed="${state.sumHl === id}">${esc(BY[id].name)}${isMastered(id) ? ' <span class="starred">★</span>' : ''}</button>`).join('')}</div></div>`).join('');
  const practice = by.helped.concat(by.fail);
  const pNames = practice.map(id => BY[id].name);
  const practiceLabel = practice.length <= 3 ? `Oefen ${esc(joinNl(pNames))} nog een keer` : `Oefen deze ${practice.length} nog een keer`;
  const stars = r.stars.map(id => BY[id].name);
  const starsHtml = stars.length ? `<div class="starline won"><span class="starred" style="font-size:20px">★</span><span><b>${stars.length === 1 ? 'Nieuwe ster' : 'Nieuwe sterren'} voor ${esc(joinNl(stars))}!</b> Bij ${UI('Bekijken')} ${stars.length === 1 ? 'is die' : 'zijn die'} nu ingekleurd.</span></div>` : '';
  const canPractice = practice.length && r.mode !== 'waar';
  const allGood = emojiOn() && !by.helped.length && !by.fail.length && by.perfect.length;
  panel.innerHTML = `<p class="qtitle">Ronde klaar${allGood ? ' <span class="emo-t" aria-hidden="true">🏆</span>' : ''}</p>
    <p class="muted" style="margin:0">${FINE ? 'Ga met de muis over een naam of klik erop' : 'Tik op een naam'} om te zien waar het ligt.</p>
    ${starsHtml}
    ${groups}
    ${verdictHtml(readiness())}
    <div class="row">
      ${canPractice ? `<button class="btn primary" data-act="practice">${practiceLabel}</button>` : ''}
      <button class="btn ${canPractice ? 'ghost' : 'primary'}" data-act="go">Nog een keer</button>
      <button class="btn ghost" data-act="setup">Aanpassen</button>
    </div>`;
  r.practice = practice;
}
function renderVoortgang() {
  const rows = PACK.cats.map(c => {
    const ids = ITEMS.filter(i => i.cat === c.id).map(i => i.id), n = ids.filter(isMastered).length;
    return `<span>${esc(c.plural)}</span><div class="bar"><i style="width:${100 * n / ids.length}%"></i></div><b>${n}/${ids.length}</b>`;
  }).join('');
  const total = ITEMS.filter(i => isMastered(i.id)).length;
  panel.innerHTML = `<div class="row between"><p class="qtitle">Voortgang</p><span class="chip"><span class="starred">★</span> ${total} / ${ITEMS.length}</span></div>
    ${verdictHtml(readiness())}
    <div class="prog">${rows}</div>
    <p class="muted" style="margin:0">Achter elke naam staan bolletjes: ${dots(2)} betekent 2 keer achter elkaar goed. Bij 3 keer krijgt die naam een ster <span class="starred">★</span> en kleurt hij in op de kaart. ${UI('Wat is dit?')} en de ${UI('Proeftoets')} tellen mee, en alleen zonder hint.</p>
    ${sheetHtml(true)}
    <div class="row">${state.resetAsk
      ? '<span>Alle sterren en reeksen wissen?</span><button class="btn bad" data-act="reset-yes">Ja, wissen</button><button class="btn ghost" data-act="reset-no">Annuleren</button>'
      : '<button class="btn ghost" data-act="reset-ask">Voortgang wissen</button>'}</div>`;
}

/* ---------- Panel events ---------- */
on(panel, 'click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'FORM') return;
  const act = b.dataset.act, m = state.mode, r = state.rounds[m];
  if (act === 'pick') {
    const id = b.dataset.id;
    if (m === 'voortgang') { state.sel = id; setMode('verkennen'); focusItem(id, 320); return; }
    state.sel = id; state.selAlso = [];
    setHl({ id, style: 'sel' }); focusItem(id, 320); render(); return;
  }
  if (act === 'sumhl') {
    state.sumHl = state.sumHl === b.dataset.id ? null : b.dataset.id;
    sumLight(state.sumHl);
    panel.querySelectorAll('[data-act="sumhl"]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.id === state.sumHl)));
    return;
  }
  if (act === 'labels') { showAllLabels = !showAllLabels; prog.prefs.labels = showAllLabels; save(); renderLabels(); render(); return; }
  if (act === 'colors') { prog.prefs.colors = !colorsOn(); save(); applyColors(); render(); return; }
  if (act === 'emoji') { prog.prefs.emoji = !emojiOn(); save(); render(); return; }
  if (act === 'type') { P.wat.type = b.dataset.type; save(); render(); return; }
  if (act === 'spell') { prog.prefs.spelling = b.dataset.v; save(); render(); return; }
  if (act === 'auto') { prog.prefs.auto = !autoOn(); save(); render(); return; }
  if (act === 'grade') {
    const empty = r.items.filter(id => !(r.answers[id] || '').trim()).length;
    if (empty && !r.warned) { r.warned = true; render(); $('#btn-grade').focus(); return; }
    gradeToets(r); return;
  }
  if (act === 'practice-toets') { const ids = r.practice; setMode('wat', false); state.setupOpen.wat = false; startRound('wat', ids); openHelp('wat'); return; }
  if (act === 'cat') {
    const p = P[m], c = b.dataset.cat;
    p.cats = p.cats.includes(c) ? p.cats.filter(x => x !== c) : allCats.filter(x => p.cats.includes(x) || x === c);
    if (!p.cats.length) p.cats = [c];
    save(); render(); return;
  }
  if (act === 'len') { P[m].len = +b.dataset.len; save(); render(); return; }
  if (act === 'go') { state.setupOpen[m] = false; startRound(m); return; }
  if (act === 'resume') { state.setupOpen[m] = false; if (m === 'toets') { renderNums(); render(); return; } showQuestion(r, true); render(); return; }
  if (act === 'setup') { state.setupOpen[m] = true; if (r) { clearTimeout(r.autoT); r.autoT = null; } renderNums(); render(); return; }
  // Ignore taps right after the panel changed: they were meant for the button that was there before
  if ((act === 'next' || act === 'opt') && performance.now() - lastSwap < 450) return;
  if (act === 'next') { nextQuestion(r); return; }
  if (act === 'opt') { answerWat(r, b.dataset.id); return; }
  if (act === 'hint') { (m === 'waar' ? hintWaar : hintWat)(r); return; }
  if (act === 'practice') { state.setupOpen.wat = false; startRound('wat', r.practice); return; }
  if (act === 'reset-ask') { state.resetAsk = true; render(); return; }
  if (act === 'reset-no') { state.resetAsk = false; render(); return; }
  if (act === 'reset-yes') { prog.items = {}; save(); state.resetAsk = false; refreshDone(); render(); toast('Voortgang gewist'); return; }
});
on(panel, 'pointerover', e => {
  if (e.pointerType !== 'mouse' || state.mode !== 'verkennen') return;
  const b = e.target.closest('[data-act=pick]');
  setHover(b ? b.dataset.id : null);
});
on(panel, 'pointerleave', () => { if (state.mode === 'verkennen') setHover(null); });
on(panel, 'submit', e => {
  e.preventDefault();
  if (state.mode === 'toets') return;
  const r = state.rounds.wat; const inp = $('#ans');
  if (r && inp) submitTyped(r, inp.value);
});
on(panel, 'input', e => {
  if (e.target.id === 'ans') { const r = state.rounds.wat; if (r && r.cur) r.cur.typed = e.target.value; }
  if (e.target.dataset.ti !== undefined) { const r = state.rounds.toets; if (r) r.answers[r.items[+e.target.dataset.ti]] = e.target.value; }
});
// Proeftoets: Enter goes to the next line; the number of the line being filled in lights up on the map
on(panel, 'keydown', e => {
  if (e.key !== 'Enter' || e.target.dataset.ti === undefined) return;
  e.preventDefault();
  const next = $('#t' + (+e.target.dataset.ti + 1));
  if (next) next.focus(); else { const gb = $('#btn-grade'); gb && gb.focus(); }
});
on(panel, 'focusin', e => {
  if (e.target.dataset.ti === undefined) return;
  const r = state.rounds.toets; if (!r) return;
  r.active = +e.target.dataset.ti; renderNums();
});

/* ---------- Boot ---------- */
function boot(data) {
  try {
    if (data && data.rounds) { state.rounds = data.rounds; state.sel = data.sel || null; }
  } catch (e) { /* ignore */ }
  document.getElementById('chap').textContent = PACK.chapter;
  document.getElementById('ptitle').textContent = PACK.title;
  document.getElementById('pseries').textContent = 'Topografie ' + PACK.series;
  svg.setAttribute('aria-label', 'Topografiekaart ' + PACK.title);
  refreshDone();
  fitAll(false);
  const restored = !!(data && data.mode);
  // Already practised on this map: start at Voortgang, so you see where you are; new maps start with Bekijken
  const started = Object.values(prog.items).some(it => it && it.seen > 0);
  const mode = restored && ['verkennen', 'wat', 'waar', 'toets', 'voortgang'].includes(data.mode) ? data.mode : (started ? 'voortgang' : 'verkennen');
  setMode(mode, !restored);
}
boot(restore || {});
window.__topo = { hitsAt, state, BY, M, view, upp };
return { snapshot: () => ({ mode: state.mode, rounds: state.rounds, sel: state.sel }) };
}
