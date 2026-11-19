// Single light/dark theme source + visibility of lines and text in both themes.
const { test, expect } = require('@playwright/test');
const { openApp, setInput, setTheme, installContrast } = require('./helpers');

const SAMPLE = `env:Production {
  app:API_Gateway
  app:User_Service
}
db:UserDB
server:Nginx --HTTPS--> app:API_Gateway
app:API_Gateway --REST--> app:User_Service
app:User_Service --> db:UserDB
API_Gateway calls Billing`;

test.describe('single theme function', () => {
  test('one toggle drives app, diagram and editor theme', async ({ page }) => {
    await openApp(page);
    // The old per-diagram Light/Dark select is gone — only one theme control remains.
    await expect(page.locator('#mermaidTheme')).toHaveCount(0);
    await expect(page.locator('#themeToggle')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => currentDiagramTheme())).toBe('dark');

    await page.click('#themeToggle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#themeLabel')).toHaveText('Light');
    expect(await page.evaluate(() => currentDiagramTheme())).toBe('default');
    expect(await page.evaluate(() => activeEditorPreset().dark)).toBe(false);

    await page.click('#themeToggle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => activeEditorPreset().dark)).toBe(true);
  });

  test('theme persists across reload and is applied before first paint', async ({ page }) => {
    await openApp(page);
    await setTheme(page, 'light');
    await page.reload();
    await page.waitForSelector('#mermaidOutput svg');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#themeLabel')).toHaveText('Light');
  });

  test('component props theme select and command palette use the same function', async ({ page }) => {
    await openApp(page);
    await page.click('#componentPropsBtn');
    await page.selectOption('#cpTheme', 'light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.keyboard.press('Escape');
    await page.evaluate(() => commandPaletteItems().find(c => c.id === 'settings-theme').run());
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#cpTheme')).toHaveValue('dark');
  });

  test('custom line colour from settings still wins over the theme default', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => { _diagramSettings.lineColor = '#ff0000'; renderDiagram(lastCode); });
    await page.waitForTimeout(500);
    const stroke = await page.evaluate(() => getComputedStyle(document.querySelector('#mermaidOutput svg .flowchart-link')).stroke);
    expect(stroke).toBe('rgb(255, 0, 0)');
  });
});

for (const theme of ['dark', 'light']) {
  test.describe(`visibility in ${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await openApp(page, { theme });
      await setInput(page, SAMPLE);
      await installContrast(page);
    });

    test('edges, arrowheads and edge labels contrast with the canvas', async ({ page }) => {
      const r = await page.evaluate(() => {
        const bg = __bgOf(document.getElementById('previewScroll'));
        const edges = [...document.querySelectorAll('#mermaidOutput svg .flowchart-link')];
        const edgeContrast = edges.map(p => __contrast(__parseColor(getComputedStyle(p).stroke), bg));
        const markers = [...document.querySelectorAll('#mermaidOutput svg marker path')].filter(p => getComputedStyle(p).fill !== 'none');
        const markerContrast = markers.map(p => __contrast(__parseColor(getComputedStyle(p).fill), bg));
        const labels = [...document.querySelectorAll('#mermaidOutput svg .edgeLabel span, #mermaidOutput svg .edgeLabel p')].filter(s => s.textContent.trim());
        const labelContrast = labels.map(s => __contrast(__parseColor(getComputedStyle(s).color), __bgOf(s)));
        return { edges: edges.length, edgeMin: Math.min(...edgeContrast), markerMin: Math.min(...markerContrast), labels: labels.length, labelMin: Math.min(...labelContrast) };
      });
      expect(r.edges).toBeGreaterThan(2);
      expect(r.edgeMin).toBeGreaterThanOrEqual(3);
      expect(r.markerMin).toBeGreaterThanOrEqual(3);
      expect(r.labels).toBeGreaterThan(0);
      expect(r.labelMin).toBeGreaterThanOrEqual(4.5);
    });

    test('node and group labels are readable', async ({ page }) => {
      const r = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('#mermaidOutput svg g.node').forEach(node => {
          const shape = node.querySelector('rect, path, polygon, circle, ellipse');
          const label = [...node.querySelectorAll('span, p, text')].find(n => n.textContent.trim());
          if (!shape || !label) return;
          const fill = __parseColor(getComputedStyle(shape).fill);
          const color = __parseColor(label.namespaceURI === 'http://www.w3.org/2000/svg' ? getComputedStyle(label).fill : getComputedStyle(label).color);
          if (fill && color) out.push(__contrast(color, fill.a < 1 ? __blend(fill, __bgOf(document.getElementById('previewScroll'))) : fill));
        });
        const clusterLabels = [...document.querySelectorAll('#mermaidOutput svg .cluster-label span, #mermaidOutput svg .cluster-label p')].filter(s => s.textContent.trim());
        const cl = clusterLabels.map(s => {
          const rect = s.closest('.cluster').querySelector('rect');
          const fill = __parseColor(getComputedStyle(rect).fill);
          const bg = fill && fill.a > 0 ? __blend(fill, __bgOf(document.getElementById('previewScroll'))) : __bgOf(document.getElementById('previewScroll'));
          return __contrast(__parseColor(getComputedStyle(s).color), bg);
        });
        return { nodes: out.length, nodeMin: Math.min(...out), clusters: cl.length, clusterMin: Math.min(...cl) };
      });
      expect(r.nodes).toBeGreaterThan(3);
      expect(r.nodeMin).toBeGreaterThanOrEqual(4.5);
      expect(r.clusters).toBeGreaterThan(0);
      expect(r.clusterMin).toBeGreaterThanOrEqual(4.5);
    });

    test('editor text, gutter and syntax tokens are readable', async ({ page }) => {
      const r = await page.evaluate(() => {
        const content = document.querySelector('#smartInput .cm-content');
        const bg = __bgOf(content);
        const tokens = [...content.querySelectorAll('.cm-line span')].filter(s => s.textContent.trim().length > 1);
        const tokenMin = Math.min(...tokens.map(s => __contrast(__parseColor(getComputedStyle(s).color), bg)));
        const text = __contrast(__parseColor(getComputedStyle(content).color), bg);
        const gutter = document.querySelector('#smartInput .cm-lineNumbers .cm-gutterElement:not([style*="hidden"])');
        const gutterC = gutter ? __contrast(__parseColor(getComputedStyle(gutter).color), __bgOf(gutter)) : 99;
        return { text, tokenMin, tokens: tokens.length, gutterC };
      });
      expect(r.text).toBeGreaterThanOrEqual(4.5);
      expect(r.tokens).toBeGreaterThan(3);
      expect(r.tokenMin).toBeGreaterThanOrEqual(3);
      expect(r.gutterC).toBeGreaterThanOrEqual(3);
    });

    test('app chrome text is readable (header, preview toolbar, status bar)', async ({ page }) => {
      const bad = await page.evaluate(() => {
        const roots = ['body > header', 'body > header + div', '#leftPanel > div:first-child', '#previewHeader', 'footer'];
        const issues = [];
        roots.forEach(sel => document.querySelectorAll(sel).forEach(root => {
          root.querySelectorAll('*').forEach(el => {
            const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
            if (!own) return;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (!r.width || !r.height || cs.visibility === 'hidden' || +cs.opacity === 0) return;
            if (el.closest('button:disabled, [disabled]')) return;
            const c = __contrast(__parseColor(cs.color), __bgOf(el));
            if (c < 3) issues.push(`${sel} ${el.tagName}#${el.id}.${String(el.className).slice(0, 40)} "${el.textContent.trim().slice(0, 24)}" ${c.toFixed(2)}`);
          });
        }));
        return issues;
      });
      expect(bad, bad.join('\n')).toEqual([]);
    });

    test('sequence and class diagrams keep visible lines and text', async ({ page }) => {
      for (const type of ['sequence', 'class']) {
        await page.selectOption('#diagramType', type);
        await page.waitForTimeout(500);
        await page.waitForSelector('#mermaidOutput svg');
        const r = await page.evaluate(() => {
          const bg = __bgOf(document.getElementById('previewScroll'));
          const lines = [...document.querySelectorAll('#mermaidOutput svg line, #mermaidOutput svg path.relation, #mermaidOutput svg .messageLine0, #mermaidOutput svg .messageLine1')]
            .map(l => __parseColor(getComputedStyle(l).stroke)).filter(c => c && c.a > 0);
          const texts = [...document.querySelectorAll('#mermaidOutput svg text.messageText, #mermaidOutput svg .nodeLabel, #mermaidOutput svg text.actor')]
            .filter(t => t.textContent.trim());
          const textMin = Math.min(...texts.map(t => {
            // SVG text is painted by its tspans (Mermaid colours actor names there)
            const painted = t.querySelector('tspan') || t;
            const col = __parseColor(t.namespaceURI === 'http://www.w3.org/2000/svg' ? getComputedStyle(painted).fill : getComputedStyle(t).color);
            const box = t.closest('g')?.querySelector('rect');
            const f = box && __parseColor(getComputedStyle(box).fill);
            const back = t.classList.contains('messageText') || !f || f.a === 0 ? bg : __blend(f, bg);
            return __contrast(col, back);
          }));
          return { lines: lines.length, lineMin: Math.min(...lines.map(c => __contrast(c, bg))), texts: texts.length, textMin };
        });
        expect(r.lines, type).toBeGreaterThan(0);
        expect(r.lineMin, type).toBeGreaterThanOrEqual(3);
        expect(r.texts, type).toBeGreaterThan(0);
        expect(r.textMin, type).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
}

// Dark theme used to blend every pastel classDef toward navy, so all entity
// types ended up the same ash grey. Each type must keep its own colour.
test('dark theme keeps entity types distinguishable', async ({ page }) => {
  await openApp(page, { theme: 'dark' });
  await setInput(page, 'env:Prod{app:Web}\napp:Web --> db:Store\nserver:Box --> ftp:Drop\ninterface:Api --> config:Cfg');
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const lum = c => { const [r, g, b] = c.match(/\d+/g).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    const nodes = [...document.querySelectorAll('#mermaidOutput svg g.node')].map(g => {
      const type = ['app', 'db', 'server', 'ftp', 'interface', 'config'].find(t => g.classList.contains(t));
      const shapes = [...g.querySelectorAll('rect, path, polygon, circle, ellipse')].filter(s => !s.closest('.label, foreignObject, image'));
      return { type, fills: shapes.map(s => getComputedStyle(s).fill).filter(f => f.startsWith('rgb')) };
    });
    const cluster = getComputedStyle(document.querySelector('#mermaidOutput svg g.cluster rect')).fill;
    return { nodes: nodes.map(n => ({ ...n, lums: n.fills.map(lum) })), clusterLum: lum(cluster) };
  });
  const primary = info.nodes.map(n => n.fills[0]);
  expect(new Set(primary).size).toBe(info.nodes.length); // every type differs
  for (const n of info.nodes) for (const l of n.lums) expect(l, `${n.type} has a light fill on dark canvas`).toBeLessThan(0.45);
  expect(info.clusterLum).toBeLessThan(0.45);
});
