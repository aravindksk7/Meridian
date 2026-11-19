// Every template / architecture view renders without errors in both themes,
// and the NL parser changes did not alter how template text is understood.
const { test, expect } = require('@playwright/test');
const { openApp, setTheme } = require('./helpers');

for (const theme of ['dark', 'light']) {
  test(`all templates and views render cleanly in ${theme} theme`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = await openApp(page, { theme });
    const names = await page.evaluate(() => ({
      templates: Object.keys(TEMPLATES),
      views: typeof ARCHITECTURE_VIEWS === 'object' ? Object.keys(ARCHITECTURE_VIEWS) : [],
    }));
    expect(names.templates.length).toBeGreaterThan(3);
    const failures = [];
    const run = async (kind, name) => {
      await page.evaluate(([k, n]) => (k === 'tpl' ? loadTemplate(n) : loadArchitectureView(n)), [kind, name]);
      await page.waitForTimeout(350);
      await page.waitForFunction(() => !document.querySelector('#previewStatus')?.textContent.includes('…'));
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => ({
        err: !!document.querySelector('#mermaidOutput .render-err'),
        svg: !!document.querySelector('#mermaidOutput svg'),
        status: document.getElementById('previewStatus').textContent,
      }));
      if (r.err || !r.svg) failures.push(`${kind}:${name} → ${JSON.stringify(r)}`);
    };
    for (const n of names.templates) await run('tpl', n);
    for (const n of names.views) await run('view', n);
    expect(failures, failures.join('\n')).toEqual([]);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('template relationships are parsed the same as their arrow syntax implies', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => Object.entries(TEMPLATES).map(([name, text]) => {
    const p = new SmartParser();
    p.parse(text, 'LR');
    const arrowLines = text.split('\n').filter(l => /\s(?:-->|--[^>]*-->|->|<-+>|>>)\s/.test(l) && !/^\s*(\/\/|#)/.test(l)).length;
    return { name, rels: p.relationships.length, arrowLines, issues: p.parseIssues.filter(i => i.code === 'INVALID_ARROW').length };
  }));
  r.forEach(t => {
    expect(t.issues, t.name).toBe(0);
    expect(t.rels, t.name).toBeGreaterThanOrEqual(Math.min(t.arrowLines, 1));
  });
});

test('no page errors while toggling theme repeatedly', async ({ page }) => {
  const errors = await openApp(page);
  for (let i = 0; i < 4; i++) await setTheme(page, i % 2 ? 'dark' : 'light');
  await expect(page.locator('#mermaidOutput svg g.node').first()).toBeVisible();
  expect(errors, errors.join(' | ')).toEqual([]);
});

// Minimap clone must keep Mermaid's id-scoped theme CSS; without it every
// node fell back to the SVG default black fill ("dark shadow" map).
for (const theme of ['light', 'dark']) {
  test(`minimap nodes use the same fill as the live preview (${theme})`, async ({ page }) => {
    await openApp(page, { theme });
    await page.evaluate(() => { $input.value = 'app:Web --> app:Api\napp:Api --> db:Store'; });
    await page.waitForSelector('#minimapSvgHost svg g.node');
    const fills = await page.evaluate(() => {
      const f = sel => getComputedStyle(document.querySelector(sel)).fill;
      return { main: f('#mermaidOutput svg g.node rect.label-container'), map: f('#minimapSvgHost svg g.node rect.label-container') };
    });
    expect(fills.map).not.toBe('rgb(0, 0, 0)');
    expect(fills.map).toBe(fills.main);
  });
}
