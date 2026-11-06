// Start screen: choose a map. Each map runs as its own game; going back stops it.
// The map data of a pack is fetched when the pack is opened (and kept for the rest of the visit).
(() => {
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const appEl = $('#app'), chooserEl = $('#chooser'), helpEl = $('#help');
const APP_HTML = appEl.innerHTML;
let current = null; // { id, ctrl, api }
const mapCache = {};    // url -> Promise of the map data
let opening = 0;        // the latest open request; an older one that finishes later is ignored
const loadMap = url => mapCache[url] || (mapCache[url] = fetch(url).then(r => {
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}).catch(e => { delete mapCache[url]; throw e; }));

// Stars on this device, and whether practice on this map has started (any question answered)
function starsOf(pack) {
  let n = 0, started = false;
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(pack.id)) || 'null');
    if (v && v.items) {
      n = pack.items.filter(i => v.items[i.id] && v.items[i.id].streak >= 3).length;
      started = Object.values(v.items).some(it => it && it.seen > 0);
    }
  } catch (e) { /* storage blocked */ }
  return { n, started };
}
function stop() {
  if (!current) return;
  current.ctrl.abort();
  current = null;
  helpEl.hidden = true;
}
async function openPack(id, restore) {
  const entry = PACKS.find(p => p.pack.id === id);
  if (!entry) { showChooser(); return; }
  const req = ++opening;
  const card = chooserEl.querySelector(`[data-pack="${id}"]`);
  if (card) card.classList.add('loading');
  let map;
  try { map = await loadMap(entry.map); } catch (e) {
    if (req !== opening) return;
    if (card) card.classList.remove('loading');
    if (chooserEl.hidden) showChooser();
    const msg = chooserEl.querySelector('.ch-error');
    if (msg) { msg.textContent = 'De kaart kon niet geladen worden. Controleer de internetverbinding en probeer het nog een keer.'; msg.hidden = false; }
    return;
  }
  if (req !== opening) return;
  stop();
  chooserEl.hidden = true;
  appEl.innerHTML = APP_HTML;
  appEl.hidden = false;
  const ctrl = new AbortController();
  $('#backbtn').addEventListener('click', showChooser, { signal: ctrl.signal });
  const api = runGame(entry.pack, map, ctrl.signal, restore);
  current = { id, ctrl, api };
}
function showChooser() {
  opening++;
  stop();
  appEl.hidden = true;
  appEl.innerHTML = '';
  const series = [...new Set(PACKS.map(p => p.pack.series))];
  chooserEl.innerHTML = `<div class="ch-head"><h1>Topografie</h1><p>Kies je kaart</p></div>
    <p class="ch-error" role="alert" hidden></p>
    ${series.map(s => `<section class="ch-group"><h2>${esc(s)}</h2><div class="ch-cards">${PACKS.filter(p => p.pack.series === s).map(({ pack, thumb }) => {
      const { n, started } = starsOf(pack), tot = pack.items.length;
      const hint = n === tot ? '<span class="ch-hint done">Alles heeft een ster!</span>'
        : `<span class="ch-hint">${started || n ? 'Ga verder met oefenen' : 'Begin met oefenen'}</span>`;
      return `<button class="ch-card" data-pack="${esc(pack.id)}">
        <img class="ch-inset" src="${esc(thumb)}" alt="" width="96" height="110">
        <span class="ch-txt"><span class="ch-num">${esc(pack.chapter)}</span><span class="ch-title">${esc(pack.title)}</span>
        <span class="ch-prog"><span class="starred">★</span> ${n} / ${tot}<span class="bar"><i style="width:${100 * n / tot}%"></i></span></span>${hint}</span>
      </button>`;
    }).join('')}</div></section>`).join('')}`;
  chooserEl.hidden = false;
}
chooserEl.addEventListener('click', e => { const b = e.target.closest('[data-pack]'); if (b) openPack(b.dataset.pack); });

showChooser();
window.__topoShell = { openPack, showChooser };
})();
