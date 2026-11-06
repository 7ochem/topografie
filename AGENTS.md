# Topografie oefenen

A small web game to practise school topography (Dutch "topografie") at home. Each lesson pack follows one
school worksheet: the same names list and a map that looks like the printed sheet, so children and parents
recognise it. The site is everything in `public/`; a GitHub Actions workflow publishes that folder to
GitHub Pages on every push to `main`. No build step, no framework, no dependencies in the browser.

The users are children of about 9 to 12 years old, playing on a laptop or a phone/tablet.

## Run and test

- First time: `npm install && npx playwright install chromium` (Playwright is the only dependency, for the test).
- Local: `npm start` (serves `public/`), then open http://localhost:8000. Opening `public/index.html` as a file does not work,
  because the map data is fetched.
- Smoke test: `npm test` (Playwright, `tools/test/smoke.spec.js`). It opens every map, checks that only that
  map's data is loaded, that every name is hit on its own spot, plays a Wat is dit? round and a Proeftoets,
  and opens the game on a phone size. Run it after every change.
- `window.__topo` (the open game: `hitsAt`, `state`, `BY`, `M`, `view`, `upp`) and `window.__topoShell`
  exist for tests and debugging.

## Files

| Path | What |
|---|---|
| `public/index.html` | Markup only: start screen (`#chooser`), the game (`#app`), the help overlay (`#help`) |
| `public/css/topo.css` | All styles. Colours as variables on `:root`. Map art styles start at "Map art" |
| `public/js/packs.js` | The lesson packs (names lists) and `PACKS`: order of the start screen, map file, thumbnail |
| `public/js/game.js` | `runGame(PACK, MAP, signal)`: one open map. Everything it attaches is removed when `signal` aborts |
| `public/js/shell.js` | Start screen, fetching map data (cached per visit), opening and closing a pack |
| `public/maps/<id>.json` | Map data of one pack (see "Map data"). Generated, do not edit by hand |
| `public/maps/<id>-thumb.svg` | Small picture on the start screen card |
| `.github/workflows/pages.yml` | Publishes `public/` to GitHub Pages (Settings → Pages → Source: GitHub Actions) |
| `tools/serve.mjs` | Small static server (`npm start`, also used by the test) |
| `tools/test/smoke.spec.js` | The smoke test (`npm test`) |
| `tools/maps/` | Record of the scripts that made each map (see its README) |

Not in the repo (`.gitignore`): the photos of the worksheets (`fotos/`), the OpenStreetMap downloads
(`osm-*.geojson`) and other source data. The worksheets are copyrighted; never commit them or images made from them.

## Lesson pack (`public/js/packs.js`)

```js
const PACK_XX = {
  id: 'groningen-drenthe',         // also the map file name and the storage key
  series: 'Nederland',             // group on the start screen: 'De Wereld' or 'Nederland'
  chapter: '3',                    // number on the worksheet
  title: 'Groningen & Drenthe',
  quizZoom: 2,                     // optional: Wat is dit? zooms in this much on the asked item (busy maps)
  cats: [{ id: 'provincie', plural: 'Provincies', single: 'Provincie' }, ...],   // order as on the sheet
  items: [{ id, name, cat, kind, lp?, aliases?, alsoExact?, carets? }, ...],
};
```

- `name` is written exactly as on the worksheet (also odd spellings, like "Perzische golf").
- `kind` decides drawing and hit testing: `country` and `state` (areas), `sea`, `river`, `canal` (lines),
  `city` (dot), `mtn` (mountain carets).
- `lp`: where a city name goes (`l`, `r`, `t`, `b`).
- `aliases`: other names that count as right, with a note "Op je lijst heet dit: …".
- `alsoExact`: another spelling that is just as right, also with spelling "streng".
- Two items may have the same name (Groningen is a province and a city). The 4 options never show a name twice,
  and typing the shared name is right for both.

## Map data (`public/maps/<id>.json`)

All coordinates are in "frame units": the map frame is 1000 wide, `H` high; the inset may stick out above it.

```
W, H, title, credit (small HTML line at the bottom left of the map)
style: { sea: 'stipple' | 'plain' | 'specks', grey: 'light', inset: 'light' }
inset: { x, y, w, h, land, na }            small overview map; `na` is the region in dark
base:  { grey, white, land, ink?, borders, heavy, dashed, dotted?, lakes, decor[] }
         grey/white = land not on the list; land = coastline (or `ink` for extra drawn lines);
         heavy = national border; dashed = province borders; dotted = outline of an area the sheet does
         not draw (Hondsrug); decor = extra rivers and canals
areaFill: { <id>: 'grey' }                 list items drawn grey instead of white (neighbour provinces, countries)
countries, states, waters, lines: { <id>: svg path }   the items of the list
cities: { <id>: [x, y] }, carets: { <key>: [[x, y], ...] }, labels: { <id>: [x, y] }
scalebar: { x, y, len, label, tick?, mid?, textDy? } | null
```

## How the game works

- Modes: Bekijken (explore, list, switches Namen and Kleuren), Wat is dit? (choose from 4 or type),
  Waar ligt…? (point on the map), Proeftoets (10 numbers on the map, type the names), Voortgang.
- Stars: an item gets a star after 3 times in a row right without a hint, in Wat is dit? or the Proeftoets.
  Waar ligt…? does not count. A mistake or "Ik weet het niet" sets the row back to 0.
- A round: first all items without a star (random, no preference among them), filled up with starred items,
  then shuffled.
- Hints: Wat is dit? choose: 2 names struck out; typing: first 2 letters, then choose from 4; then
  "Ik weet het niet" shows the answer, and that item comes back later in the round.
  Waar ligt…?: zoom to the area, then blink, then "Ik weet het niet".
- Spelling: "streng" (default for De Wereld): exactly right including capitals, a spelling mistake is half a
  point off in the Proeftoets. "soepel" (default for Nederland): a small mistake is fine. Settable per pack.
- After a right answer without a mistake the game goes on by itself after 1.5 s (4 s with a new star).
  Taps in the first 0.45 s after the panel changes are ignored (children tapping twice).
- Colours for starred items only in Bekijken (switch Kleuren) and Voortgang; never in the quiz modes.
- Opening a pack: Bekijken when new, Voortgang when practice has started. Help overlay per mode, with an Ok button.
- Emoji feedback (on by default, can be switched off): above the name, 90% opacity; warm = bang, cold = shiver.
- Progress is stored per browser in `localStorage` under `topo:player1:<pack id>:v1` (items and prefs).
  The `player1` part is there for more players in one browser later. Old keys `topo:<id>:v1` are moved once.

## Conventions

- All text in the game is Dutch, written for children: short, plain sentences. Keep the existing words:
  Bekijken, Wat is dit?, Waar ligt…?, Proeftoets, Voortgang, Geef een hint, Ik weet het niet,
  Nog een keer, Aanpassen, Instellingen, Namen, Kleuren.
- Code, comments and names in English. Plain JavaScript (classic scripts, `defer`), no build step.
- Laptop and touch both matter: hover only adds, keyboard shortcuts on laptop (1-4, H, Enter, +, -, 0, Esc).
- The map must keep looking like the paper sheet: black lines on white, light grey neighbours (never dark),
  specks or stipple for water, same frame, inset and scale bar.
- Map data credits: OpenStreetMap (ODbL) needs "© OpenStreetMap-bijdragers"; geoBoundaries and CBS/Kadaster
  are named too. Natural Earth is public domain (named anyway).

## Adding a map

A new map always starts from photos of the paper worksheet. The map itself is never traced from the photo:
it is built from open map data and only fitted to the photo, so it looks like the sheet.

### Workflow with the user

1. The user takes two photos (straight from above, whole page, good light): the map page and the names list.
   They upload them in the chat or put them in `fotos/` (local only, in `.gitignore`).
2. Read the names list and add the pack to `public/js/packs.js`: exact names and categories in the order of the sheet,
   chapter number and series. Check spelling with the user when the photo is unclear.
3. Study the map photo and write down what the game must copy:
   - title, frame (aspect ratio), the inset (small overview map, position and what is dark in it), scale bar;
   - which land is white (the topic) and which is grey (neighbours), and how water looks (specks or stipple);
   - line types: coast, national border (heavy), province borders (dashed), canals and rivers;
   - the city dots (their positions are the best control points for the fit);
   - names on the list that the sheet does not draw (like the Hondsrug): propose a dotted outline.
4. Choose the data (table below). For OpenStreetMap the agent may have no network access to it; then give the
   user an Overpass query (see below) to run.
5. Build and fit (scripts in `tools/maps/`, setup in `tools/maps/README.md`):
   rectify the photo to the frame (`rect.py`: frame corners, then a correction for the bent page), fit the data
   to the drawn lines and the dots (`icp.py`: Mercator + a small polynomial warp), build the map data
   (`build.py`: land, list areas, waters, label points) and the inset (`final.mjs`).
6. Write `public/maps/<id>.json`, make `public/maps/<id>-thumb.svg`, add the pack to `PACKS`, set `credit` (see below).
7. Check: `npm test`, labels do not overlap with Namen on, the side-by-side picture with the photo, and the phone
   size. Show the user screenshots before calling it done; ask about anything that differs from the sheet.

### Open map data: which for what

| Data | Good for | Not good for | Credit (`credit` in the map data) |
|---|---|---|---|
| Natural Earth (10m countries, 50m lakes and rivers, admin-1; also npm `world-atlas`) | World and continent maps: countries, coasts, big lakes and rivers, US states | Detail inside a country: small islands, canals, Dutch coastline | Public domain; still shown as "Kaart: Natural Earth" |
| OpenStreetMap via Overpass (coastline, water, canals) | Dutch and other regional maps: detailed coast, Wadden islands, lakes, named canals and rivers | Borders (use geoBoundaries) | Required: "© OpenStreetMap-bijdragers", linked to openstreetmap.org/copyright (ODbL) |
| geoBoundaries (NLD ADM1 provinces, ADM2 municipalities) | Province borders, and areas built from municipalities (Walcheren, Zuid-Beveland) | Coastline (too coarse) | "geoBoundaries" (CC BY) |
| CBS / Kadaster provinces | The inset of the Netherlands | Detailed maps | "CBS/Kadaster" |
| geo-maps countries-land (npm `@geo-maps/countries-land-10m`) | Land outline of NL, BE, DE when OpenStreetMap is not available | Islands and estuaries in detail | Based on OpenStreetMap: use the OpenStreetMap credit |

Every source that is used is named in the `credit` line of that map. It shows small at the bottom left of the map.

### OpenStreetMap through overpass-turbo.eu

The user runs the query and saves the result; the agent cannot reach Overpass itself.

1. Open https://overpass-turbo.eu. If it is slow or gives "duplicate_query", wait a few minutes or pick another
   server under Instellingen → Algemeen → Server (for example `https://overpass.private.coffee/api/interpreter`).
2. Paste the query below with the box of the map (south, west, north, east in degrees; take the frame of the
   sheet plus a margin) and click Uitvoeren. A dialog appears while it runs; with a lot of data, choose to go on.
3. Exporteren → GeoJSON → download. Save it in the repo root as `osm-<pack id>.geojson`
   (local only, in `.gitignore`).

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

Land comes from the coastline (land lies left of its direction). Keep only the lakes and canals the sheet shows,
leave out ditches and small ponds, and draw canals as single lines like the sheet.
