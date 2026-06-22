// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__CM, null, { timeout: 12000 });
  await page.waitForSelector('#smartInput .cm-editor', { timeout: 12000 });
}

const BOARD_CODE = `domain:Product {
  app:Web_App
  interface:Public_API
}

domain:Platform {
  app:Canvas_Service
  db:Project_Store
  watcher:Telemetry
}

app:Web_App --> interface:Public_API
interface:Public_API --sync--> app:Canvas_Service
app:Canvas_Service --> db:Project_Store
watcher:Telemetry --> app:Canvas_Service`;

test.describe('Design Board renderer', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('diagram type option is registered', async ({ page }) => {
    const values = await page.evaluate(() => [...document.getElementById('diagramType').options].map(o => o.value));
    expect(values).toContain('design');
    expect(await page.evaluate(() => isSupportedDiagramType('design'))).toBe(true);
  });

  test('parser emits a rich SVG design board', async ({ page }) => {
    const result = await page.evaluate((src) => {
      const svg = parser.parse(src, 'design');
      return {
        startsWithSvg: svg.trim().startsWith('<svg'),
        hasRenderer: svg.includes('data-renderer="meridian-design-board"'),
        hasNodes: (svg.match(/class="node design-node"/g) || []).length,
        hasLanes: (svg.match(/class="design-lane"/g) || []).length,
        hasEdges: (svg.match(/class="design-edge"/g) || []).length,
      };
    }, BOARD_CODE);

    expect(result.startsWithSvg).toBe(true);
    expect(result.hasRenderer).toBe(true);
    expect(result.hasNodes).toBeGreaterThanOrEqual(5);
    expect(result.hasLanes).toBeGreaterThanOrEqual(2);
    expect(result.hasEdges).toBeGreaterThanOrEqual(4);
  });

  test('renders design board SVG in the preview without Mermaid errors', async ({ page }) => {
    await page.evaluate((src) => {
      document.getElementById('diagramType').value = 'design';
      $input.value = src;
    }, BOARD_CODE);

    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg[data-renderer="meridian-design-board"]') !== null,
      { timeout: 8000 }
    );

    const counts = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg[data-renderer="meridian-design-board"]');
      return {
        nodes: svg ? svg.querySelectorAll('g.node.design-node').length : 0,
        lanes: svg ? svg.querySelectorAll('.design-lane').length : 0,
        edges: svg ? svg.querySelectorAll('.edgePaths path').length : 0,
        status: document.getElementById('statusLeft').textContent,
        errors: document.querySelectorAll('.render-err').length,
      };
    });

    expect(counts.nodes).toBeGreaterThanOrEqual(5);
    expect(counts.lanes).toBeGreaterThanOrEqual(2);
    expect(counts.edges).toBeGreaterThanOrEqual(4);
    expect(counts.status).toContain('design board');
    expect(counts.errors).toBe(0);
  });

  test('Design Board template switches the app to design mode', async ({ page }) => {
    await page.evaluate(() => loadTemplate('designBoard'));
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg[data-renderer="meridian-design-board"]') !== null,
      { timeout: 8000 }
    );

    const state = await page.evaluate(() => ({
      type: document.getElementById('diagramType').value,
      input: $input.value,
      code: lastCode.slice(0, 120),
    }));

    expect(state.type).toBe('design');
    expect(state.input).toContain('Colorful Design Board');
    expect(state.code).toContain('meridian-design-board');
  });
});
