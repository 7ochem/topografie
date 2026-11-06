// Smoke test: opens every map and plays through it. Run with: npm test
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The packs on the start screen, in order: the map files listed in PACKS in public/js/packs.js
const PACK_IDS = [...readFileSync(new URL('../../public/js/packs.js', import.meta.url), 'utf8').matchAll(/map: 'maps\/([\w-]+)\.json'/g)].map(m => m[1]);

test('the start screen lists every map and loads no map data', async ({ page }) => {
  const mapRequests = [];
  page.on('request', r => { if (/\/maps\/[^/]+\.json$/.test(r.url())) mapRequests.push(r.url()); });
  await page.goto('/');
  await expect(page.locator('.ch-card')).toHaveCount(PACK_IDS.length);
  expect(await page.$$eval('[data-pack]', l => l.map(e => e.dataset.pack))).toEqual(PACK_IDS);
  expect(mapRequests).toEqual([]);
});

for (const id of PACK_IDS) {
  test.describe(id, () => {
    test.beforeEach(async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.errors = errors;
      await page.goto('/');
      await page.click(`[data-pack="${id}"]`);
      await page.locator('#map #labels').waitFor({ state: 'attached' });
      await page.keyboard.press('Escape');
    });
    test.afterEach(async ({ page }) => {
      expect(page.errors, 'no script errors').toEqual([]);
    });

    test('loads only its own map data, and every name is hit on its own spot', async ({ page }) => {
      const loaded = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => /\/maps\/[^/]+\.json$/.test(n)));
      expect(loaded.map(u => u.split('/').pop())).toEqual([`${id}.json`]);
      const missed = await page.evaluate(() => {
        const T = window.__topo, out = [];
        for (const [itemId, it] of Object.entries(T.BY)) {
          const pt = it.kind === 'city' ? T.M.cities[itemId] : it.kind === 'mtn' ? null : T.M.labels[itemId];
          if (pt && !T.hitsAt(pt[0], pt[1]).includes(itemId)) out.push(itemId);
        }
        return out;
      });
      expect(missed).toEqual([]);
    });

    test('a round of Wat is dit? can be played to the end, never with a name twice in the options', async ({ page }) => {
      await page.click('#modes [data-mode=wat]');
      await page.keyboard.press('Escape');
      await page.click('[data-act=type][data-type=mc]');
      await page.click('[data-act=go]');
      for (let i = 0; i < 40; i++) {
        const r = await page.evaluate(() => window.__topo.state.rounds.wat);
        if (r.over) break;
        const names = await page.evaluate(() => window.__topo.state.rounds.wat.cur.opts.map(o => window.__topo.BY[o].name));
        expect(new Set(names).size).toBe(names.length);
        await page.waitForTimeout(460);   // taps right after the panel changes are ignored on purpose
        await page.keyboard.press(String(r.cur.opts.indexOf(r.cur.id) + 1));
        await page.waitForTimeout(80);
        await page.keyboard.press('Enter');
      }
      expect(await page.evaluate(() => window.__topo.state.rounds.wat.over)).toBe(true);
    });

    test('a Proeftoets with all names right gets every point', async ({ page }) => {
      await page.click('#modes [data-mode=toets]');
      await page.keyboard.press('Escape');
      await page.click('[data-act=go]');
      const names = await page.evaluate(() => window.__topo.state.rounds.toets.items.map(i => window.__topo.BY[i].name));
      for (const [k, name] of names.entries()) await page.fill(`#t${k}`, name);
      await page.click('#btn-grade');
      expect(await page.evaluate(() => window.__topo.state.rounds.toets.score)).toBe(names.length);
    });
  });
}

test('the game works on a phone', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.click(`[data-pack="${PACK_IDS[PACK_IDS.length - 1]}"]`);
  await page.click('#helpX');
  await page.click('#modes [data-mode=wat]');
  await page.click('#helpX');
  await page.click('[data-act=go]');
  await expect(page.locator('[data-act=hint]')).toBeVisible();
  expect(errors).toEqual([]);
  await ctx.close();
});
