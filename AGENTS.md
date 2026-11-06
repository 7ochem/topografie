# Topografie oefenen

Web game to practise school topography at home. One lesson pack = one school worksheet: same names list, map
styled like the printed sheet (children and parents recognise it). Users: children 9-12, laptop or phone/tablet.
Site = `public/`, published to GitHub Pages by GitHub Actions on push to `main`. No build step, no framework,
no browser dependencies.

## Run and test

- Setup: `npm install && npx playwright install chromium` (Playwright = only dependency, test only).
- `npm start` serves `public/` at http://localhost:8000. `file://` fails (map data is fetched).
- `npm test` (`tools/test/smoke.spec.js`): per map, only its data loaded, every name hit on its own spot,
  a Wat is dit? round, a Proeftoets; plus phone size. Run after every change. Not covered: hover, highlight rings.
- Test/debug hooks, keep: `window.__topo` (`hitsAt`, `state`, `BY`, `M`, `view`, `upp`), `window.__topoShell`.

## Files

| Path | What |
|---|---|
| `public/index.html` | Markup only: start screen `#chooser`, game `#app`, help overlay `#help` |
| `public/css/topo.css` | All styles; colours as `:root` variables; map art from "Map art" |
| `public/js/packs.js` | Lesson packs (names lists); `PACKS` = start screen order, map file, thumbnail |
| `public/js/game.js` | Globals `storeKey`, `isStarted`, `esc` (shared with shell); `runGame(PACK, M, signal)` = one open map, all listeners removed when `signal` aborts |
| `public/js/shell.js` | Start screen, map fetch (cached per visit), open/close pack |
| `public/maps/<id>.json` | Map data of one pack. Generated: never edit by hand |
| `public/maps/<id>-thumb.svg` | Start screen card picture |
| `.github/workflows/pages.yml` | Pages deploy (Settings → Pages → Source: GitHub Actions) |
| `tools/serve.mjs` | Static server (`npm start`, test) |
| `tools/maps/` | Scripts that made each map; setup in its README |

Gitignored, never commit: worksheet photos (`fotos/`), `osm-*.geojson`, other source data. Worksheets are
copyrighted: never commit them or images made from them.

## Lesson pack (`public/js/packs.js`)

```js
const PACK_XX = {
  id: 'groningen-drenthe',         // also map file name and storage key
  series: 'Nederland',             // start screen group, in order: 'Nederland', 'Europa', 'De Wereld'
  chapter: '3',                    // worksheet number
  title: 'Groningen & Drenthe',
  quizZoom: 2,                     // optional: Wat is dit? zoom on the asked item (busy maps)
  cats: [{ id: 'provincie', plural: 'Provincies', single: 'Provincie' }, ...],   // sheet order
  items: [{ id, name, cat, kind, lp?, aliases?, alsoExact?, carets? }, ...],
};
```

- `name`: exactly as on the sheet, odd spellings included ("Perzische golf").
- `kind` sets drawing and hit testing: areas `country`, `state`, `sea`; lines `river`, `canal`;
  `city` (dot); `mtn` (carets).
- `lp`: city label side `l`/`r`/`t`/`b`.
- Only the list name counts. Never add other names (local language: Köln, Schwarzwald; English; other Dutch)
  without asking the user. Some older packs still have such `aliases`.
- `aliases`: also right, with note "Op je lijst heet dit: …". Only on user request.
- `alsoExact`: official spelling when the sheet differs ("Zwarte woud" vs "Zwarte Woud"); right even with "streng".
- Shared names allowed (Groningen: province and city). The 4 options never repeat a name; typing it is right for both.

## Map data (`public/maps/<id>.json`)

Coordinates in frame units: frame 1000 wide, `H` high; inset may stick out above it.

```
W, H, title, credit (small HTML line, bottom left)
style: { sea: 'stipple' | 'plain' | 'specks', grey: 'light', inset: 'light' }
inset?: { x, y, w, h, land, na }           overview map; `na` = region in dark. Omit when the sheet has none
base:  { grey, white, land, ink?, borders, heavy, dashed, dotted?, lakes, decor[], dots? }
         grey/white = land not on the list; land = coastline (`ink` = extra drawn lines);
         heavy = national border; dashed = province borders; dotted = outline of a list area the sheet
         does not draw (Hondsrug); decor = extra rivers/canals; dots = unnamed city dots ([[x, y], ...], decoration)
areaFill: { <id>: 'grey' }                 list items drawn grey, not white (neighbour provinces, countries)
countries, states, waters, lines: { <id>: svg path }   list items
cities: { <id>: [x, y] }, carets: { <key>: [[x, y], ...] }, labels: { <id>: [x, y] }
scalebar: { x, y, len, label, tick?, mid?, textDy? } | null
```

## Game rules

- Modes: Bekijken (explore, list, switches Namen/Kleuren), Wat is dit? (choose from 4 or type), Waar ligt…?
  (point on map), Proeftoets (10 numbers on map, type names), Voortgang.
- Star: 3 in a row right without hint, in Wat is dit? or Proeftoets (not Waar ligt…?). Mistake or
  "Ik weet het niet" resets the row to 0.
- Round: all unstarred items (random, equal weight), filled up with starred ones, shuffled.
- Hints: Wat is dit? choose: strike 2 names; typing: first 2 letters, then choose from 4; then "Ik weet het niet"
  shows the answer and the item returns later in the round. Waar ligt…?: zoom, blink, "Ik weet het niet".
- Spelling per pack: "streng" (default De Wereld) = exact incl. capitals, spelling mistake = half point off in
  Proeftoets; "soepel" (default otherwise) = small mistake ok.
- Right without mistake: auto-advance after 1.5 s (4 s with new star). Taps in the first 0.45 s after a panel
  change are ignored (double taps).
- Star colours only in Bekijken (Kleuren) and Voortgang, never in quiz modes.
- Open pack: Bekijken when new, Voortgang once started. Help overlay per mode, Ok button.
- Emoji feedback (default on, switchable): above the name, 90% opacity; warm = bang, cold = shiver.
- Progress: `localStorage` `topo:player1:<pack id>:v1` (items, prefs); `player1` reserves multi-player.
  Old keys `topo:<id>:v1` migrate once.

## Conventions

- Game text: Dutch, for children, short plain sentences. Fixed words: Bekijken, Wat is dit?, Waar ligt…?,
  Proeftoets, Voortgang, Geef een hint, Ik weet het niet, Nog een keer, Aanpassen, Instellingen, Namen, Kleuren.
- Code, comments, names: English. Plain JS, classic `defer` scripts.
- Laptop and touch: hover only adds; laptop keys 1-4, H, Enter, +, -, 0, Esc.
- Map must look like the sheet: black lines on white, light grey neighbours (never dark), same frame, inset,
  scale bar. Water always specks or stipple, never plain white. Big lakes (IJsselmeer, Markermeer, Bodensee):
  cut from land so they get the sea pattern; dikes between them as lines (Duitsland). `base.lakes` (light grey):
  small lakes only.

## Adding a map

Always from photos of the worksheet. Never trace the map from the photo: build from open data, fit to the photo.

1. User photographs map page and names list (from above, whole page, good light); uploads in chat or puts in `fotos/`.
2. Add the pack to `public/js/packs.js`: exact names, categories in sheet order, chapter, series. Unclear on photo:
   ask the user.
3. Note from the map photo what to copy:
   - title, frame aspect ratio, inset (position, dark region), scale bar, if present;
   - white land (topic) vs grey (neighbours); water specks or stipple;
   - line types: coast, national border (heavy), province borders (dashed), canals, rivers;
   - city dots: best control points for the fit. Dots not on the list (often 1-3): keep as `base.dots`
     (decoration, no game role);
   - list names the sheet does not draw (Hondsrug): propose a dotted outline.
4. Choose data (table below). From Claude Code on the user's laptop OSM works: send a User-Agent header; use
   `maps.mail.ru/osm/tools/overpass/api/interpreter` when `overpass-api.de` is busy; single areas (mountain
   range, nature park) via Nominatim `lookup` with `polygon_geojson=1`. No network: have the user run the
   Overpass query (below).
5. Build and fit (`tools/maps/`, setup in its README): `rect.py` rectifies the photo to the frame (corners, then
   bent-page correction); `icp.py` fits data to drawn lines and dots (Mercator + small polynomial warp);
   `build.py` builds land, list areas, waters, label points; `final.mjs` the inset.
6. Write `public/maps/<id>.json` and `<id>-thumb.svg`, add to `PACKS`, set `credit`.
7. Check: `npm test`, no label overlap with Namen on, side-by-side with the photo, phone size. Show the user
   screenshots before done; ask about anything that differs from the sheet.

### Open data

`credit` names every source used.

| Data | Good for | Not for | Credit |
|---|---|---|---|
| Natural Earth (10m countries, 50m lakes/rivers, admin-1; npm `world-atlas`) | World/continent maps: countries, coasts, big lakes/rivers, US states | Detail inside a country: small islands, canals, Dutch coast | Public domain; still "Kaart: Natural Earth" |
| OSM via Overpass (coastline, water, canals) | Regional maps: detailed coast, Wadden islands, lakes, named canals/rivers | Borders (use geoBoundaries) | Required: "© OpenStreetMap-bijdragers", linked to openstreetmap.org/copyright (ODbL) |
| geoBoundaries NLD (ADM1 provinces, ADM2 municipalities) | Province borders; areas from municipalities (Walcheren, Zuid-Beveland) | Coastline (coarse) | "geoBoundaries" (CC BY) |
| geoBoundaries DEU (ADM1 states, ADM3 districts) | German states; areas from districts (Ruhrgebiet, Sauerland) | Coastline | "geoBoundaries (BKG)" (dl-de/by-2-0) |
| OSM areas via Nominatim | Mountain areas for carets (Harz, Schwarzwald, nature parks) | | "© OpenStreetMap-bijdragers" |
| CBS/Kadaster provinces | Netherlands inset | Detailed maps | "CBS/Kadaster" |
| geo-maps countries-land (npm `@geo-maps/countries-land-10m`/`-100m`) | NL/BE/DE land outline without OSM; country map coasts and borders (Duitsland) | Island/estuary detail; fill its lake holes and border gaps through lakes | OSM credit |

### Overpass query for the user (overpass-turbo.eu)

Instructions to give the user:

1. Open https://overpass-turbo.eu. Slow or "duplicate_query": wait, or Instellingen → Algemeen → Server
   (e.g. `https://overpass.private.coffee/api/interpreter`).
2. Paste the query with the map box (S, W, N, E in degrees: sheet frame plus margin), click Uitvoeren; with much
   data, choose to continue.
3. Exporteren → GeoJSON → download to repo root as `osm-<pack id>.geojson`.

```
[out:json][timeout:180];
(
  way["natural"="coastline"](S,W,N,E);
  way["natural"="water"]["water"~"^(lake|reservoir|canal|river|lagoon)$"](S,W,N,E);
  relation["natural"="water"]["water"~"^(lake|reservoir|canal|river|lagoon)$"](S,W,N,E);
  way["natural"="water"]["name"](S,W,N,E);
  relation["natural"="water"]["name"](S,W,N,E);
  way["waterway"="canal"]["name"](S,W,N,E);
);
out geom;
```

Land = left of coastline direction. Keep only lakes and canals the sheet shows (no ditches, ponds); canals as
single lines.
