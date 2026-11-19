// Icon catalog: every picker icon resolves, inserts, renders and displays.
// Iconify is stubbed so the suite is offline-safe and never trips its rate
// limit; set ICONIFY_CHECK=1 to also verify every referenced icon exists
// upstream (one bulk request per icon set).
const { test, expect } = require('@playwright/test');
const { openApp, setInput } = require('./helpers');

const PROVIDERS = ['aws', 'gcp', 'azure', 'general', 'ai'];
const STUB_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#888"/></svg>';

async function stubIconify(page, { fail = false } = {}) {
  await page.route('https://api.iconify.design/**', route => fail
    ? route.fulfill({ status: 429, body: 'Too Many Requests' })
    : route.fulfill({ status: 200, contentType: 'image/svg+xml', body: STUB_SVG }));
}

const catalog = page => page.evaluate(providers => providers.flatMap(prov => staticIconItems(prov).map(item => {
  const p = new SmartParser();
  p.parse(iconInsertText(item));
  const ent = [...p.entities.values()][0];
  return { prov, id: item.id, emoji: item.emoji || '', nativeRef: item.nativeRef || '', entities: p.entities.size, render: ent ? iconImageUrlForEntityIcon(ent.icon) : null };
})), PROVIDERS);

test.describe('icon catalog', () => {
  test('every icon parses to one entity and resolves to an Iconify URL or an emoji', async ({ page }) => {
    await openApp(page);
    const items = await catalog(page);
    expect(items.length).toBeGreaterThan(1000);
    for (const prov of PROVIDERS) expect(items.filter(i => i.prov === prov).length, prov).toBeGreaterThan(100);
    const bad = items.filter(i => i.entities !== 1
      || (i.render && !/^https:\/\/api\.iconify\.design\/[a-z0-9-]+\/[a-z0-9-]+\.svg$/.test(i.render))
      || (!i.render && !i.emoji));
    expect(bad, JSON.stringify(bad.slice(0, 5))).toEqual([]);
    // emoji-only icons are only the generic "general" concepts
    expect(items.filter(i => !i.render && i.prov !== 'general').map(i => i.id)).toEqual([]);
  });

  test('every picker tab shows an image or emoji for each icon', async ({ page }) => {
    await stubIconify(page);
    await openApp(page);
    await page.click('#iconPickerBtn');
    for (const prov of PROVIDERS) {
      await page.click(`.ip-tab[data-provider="${prov}"]`);
      const r = await page.evaluate(async () => {
        const grid = document.getElementById('ipGrid');
        const imgs = [...grid.querySelectorAll('img.ip-preview-img')];
        imgs.forEach(i => { i.loading = 'eager'; });
        await Promise.all(imgs.map(i => i.decode().catch(() => {})));
        return {
          items: grid.querySelectorAll('.ip-item').length,
          lazy: imgs.every(i => i.hasAttribute('data-fallback')),
          broken: imgs.filter(i => !i.naturalWidth).map(i => i.closest('.ip-item').title),
          blank: [...grid.querySelectorAll('.ip-icon')].filter(d => !d.textContent.trim() && !d.querySelector('img,svg')).length,
        };
      });
      expect(r.items, prov).toBeGreaterThan(100);
      expect(r.lazy, prov).toBe(true);
      expect(r.broken, prov).toEqual([]);
      expect(r.blank, prov).toBe(0);
    }
  });

  test('failed icon downloads fall back to the emoji in the picker and hide in the diagram', async ({ page }) => {
    await stubIconify(page, { fail: true });
    await openApp(page);
    await setInput(page, 'app:Fn [icon: aws-lambda] --> db:Store');
    await expect.poll(() => page.evaluate(() => {
      const img = document.querySelector('#mermaidOutput svg g.node img, #mermaidOutput svg image');
      return img ? getComputedStyle(img).display : 'gone';
    })).toMatch(/none|gone/);
    await page.click('#iconPickerBtn');
    await page.click('.ip-tab[data-provider="aws"]');
    await page.evaluate(() => document.querySelectorAll('#ipGrid img.ip-preview-img').forEach(i => { i.loading = 'eager'; }));
    const first = page.locator('#ipGrid .ip-item').first().locator('.ip-icon');
    await expect(first.locator('img')).toHaveCount(0);
    await expect(first).not.toHaveText('');
  });

  for (const prov of PROVIDERS) {
    test(`every ${prov} icon renders as a node with its icon in one diagram`, async ({ page }) => {
      test.setTimeout(120_000);
      await stubIconify(page);
      await openApp(page);
      const text = await page.evaluate(p => staticIconItems(p).map((it, i) => iconInsertText(it).replace(/^(\w+):(\S+)/, `$1:$2_${i}`)).join('\n'), prov);
      const expected = await page.evaluate(p => staticIconItems(p).filter(it => it.nativeRef || it.url || it.svg).length, prov);
      const count = text.split('\n').length;
      await setInput(page, text);
      await expect(page.locator('#mermaidOutput svg g.node')).toHaveCount(count, { timeout: 60_000 });
      await expect(page.locator('#mermaidOutput')).not.toContainText('Maximum text size');
      const shown = await page.evaluate(async () => {
        const imgs = [...document.querySelectorAll('#mermaidOutput svg g.node img')];
        await Promise.all(imgs.map(i => i.decode().catch(() => {})));
        return { total: imgs.length, loaded: imgs.filter(i => i.naturalWidth > 0).length };
      });
      expect(shown.total).toBe(expected);
      expect(shown.loaded).toBe(expected);
    });
  }
});

test('every referenced Iconify icon exists upstream', async ({ page, request }) => {
  test.skip(!process.env.ICONIFY_CHECK, 'network check: set ICONIFY_CHECK=1');
  await openApp(page);
  const items = await catalog(page);
  const bySet = {};
  for (const i of items) {
    const m = (i.render || '').match(/iconify\.design\/([^/]+)\/([^/]+)\.svg$/);
    if (m) (bySet[m[1]] ||= new Set()).add(m[2]);
  }
  const missing = [];
  for (const [set, names] of Object.entries(bySet)) {
    const list = [...names];
    for (let i = 0; i < list.length; i += 80) {
      const chunk = list.slice(i, i + 80);
      const res = await request.get(`https://api.iconify.design/${set}.json?icons=${chunk.join(',')}`);
      expect(res.ok(), `${set} HTTP ${res.status()}`).toBe(true);
      const json = await res.json();
      const found = new Set([...Object.keys(json.icons || {}), ...Object.keys(json.aliases || {})]);
      chunk.filter(n => !found.has(n)).forEach(n => missing.push(`${set}:${n}`));
    }
  }
  expect(missing).toEqual([]);
});
