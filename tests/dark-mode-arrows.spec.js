// @ts-check
const { test, expect } = require('@playwright/test');

const SIMPLE_DIAGRAM = `app:Frontend --> app:Backend
app:Backend --> db:Database`;

test.describe('Dark mode arrow visibility', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4321/meridian.html');
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 12000 }
    );
  });

  async function getEdgeStrokeColors(page) {
    return page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      if (!svg) return [];
      return [...svg.querySelectorAll('.edgePaths path')].map(p => {
        const computed = window.getComputedStyle(p);
        return {
          inline: p.style.stroke,
          computed: computed.stroke,
        };
      });
    });
  }

  async function loadDiagram(page, code) {
    await page.evaluate((src) => { $input.value = src; }, code);
    await page.waitForFunction(
      () => {
        const svg = document.querySelector('#mermaidOutput svg');
        return svg && svg.querySelectorAll('.edgePaths path').length > 0;
      },
      { timeout: 8000 }
    );
  }

  // ── Dark mode defaults ────────────────────────────────────────────────────

  test('mermaidTheme selector defaults to "dark" on fresh load in dark app mode', async ({ page }) => {
    // Clear any saved state so we test the default
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 12000 }
    );
    const mermaidTheme = await page.evaluate(() =>
      document.getElementById('mermaidTheme').value
    );
    const appTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme')
    );
    // App should start in dark mode; mermaid theme should NOT be the light 'default'
    if (appTheme === 'dark') {
      expect(mermaidTheme).not.toBe('default');
    }
  });

  // ── Edge color: must be visually distinguishable from the dark canvas ─────

  test('edge paths have non-black stroke color in dark mode', async ({ page }) => {
    // Force dark app theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    await loadDiagram(page, SIMPLE_DIAGRAM);
    const edges = await getEdgeStrokeColors(page);
    expect(edges.length, 'No edges found in SVG').toBeGreaterThan(0);

    for (const { computed } of edges) {
      // The computed stroke should NOT be near-black (#333 = rgb(51,51,51))
      // Dark canvas bg is #111827 (rgb(17,24,39)); #333 is invisible on it.
      const isNearBlack = computed && (
        computed === 'rgb(51, 51, 51)' ||
        computed === '#333333' ||
        computed === '#333'
      );
      expect(isNearBlack, `Edge stroke "${computed}" is near-black and invisible in dark mode`).toBe(false);
    }
  });

  // ── Theme toggle: Mermaid theme syncs and diagram re-renders ─────────────

  test('toggling from dark to light app theme switches mermaid theme to default and re-renders', async ({ page }) => {
    // Ensure we start in dark mode with dark mermaid theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.getElementById('mermaidTheme').value = 'dark';
    });

    await loadDiagram(page, SIMPLE_DIAGRAM);

    // Click theme toggle (dark → light)
    await page.click('#themeToggle');
    await page.waitForTimeout(1500); // allow re-render

    const appTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const mermaidTheme = await page.evaluate(() => document.getElementById('mermaidTheme').value);

    expect(appTheme).toBe('light');
    expect(mermaidTheme).toBe('default');
  });

  test('toggling from light to dark app theme switches mermaid theme to dark and re-renders', async ({ page }) => {
    // Start in light mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.getElementById('mermaidTheme').value = 'default';
    });

    await loadDiagram(page, SIMPLE_DIAGRAM);

    // Click theme toggle (light → dark)
    await page.click('#themeToggle');
    await page.waitForTimeout(1500);

    const appTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const mermaidTheme = await page.evaluate(() => document.getElementById('mermaidTheme').value);

    expect(appTheme).toBe('dark');
    expect(mermaidTheme).toBe('dark');
  });

  // ── Manual Mermaid theme selection not overridden by toggle ──────────────

  test('non-default mermaid theme (forest) is not changed by app theme toggle', async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.getElementById('mermaidTheme').value = 'forest';
    });

    await loadDiagram(page, SIMPLE_DIAGRAM);
    await page.click('#themeToggle'); // dark → light
    await page.waitForTimeout(500);

    const mermaidTheme = await page.evaluate(() => document.getElementById('mermaidTheme').value);
    expect(mermaidTheme).toBe('forest'); // unchanged
  });
});
