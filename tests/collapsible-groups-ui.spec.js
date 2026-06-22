// @ts-check
const { test, expect } = require('@playwright/test');

const GROUP_CODE = `env:Production {
  app:Frontend
  db:Database
}

app:Frontend --> db:Database`;

async function waitReady(page, clearStorage = true) {
  if (clearStorage) await page.addInitScript(() => localStorage.clear());
  await page.goto('http://localhost:4321/meridian.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
    { timeout: 12000 }
  );
}

async function loadGroupDiagram(page) {
  await page.evaluate((src) => { $input.value = src; }, GROUP_CODE);
  await page.waitForFunction(
    () => document.querySelector('#mermaidOutput svg g.cluster') &&
      document.querySelector('#mermaidOutput svg .meridian-group-toggle[data-action="collapse"]'),
    { timeout: 8000 }
  );
}

async function clickGroupToggle(page, action) {
  await page.locator(`#mermaidOutput svg .meridian-group-toggle[data-action="${action}"]`).first().click({ force: true });
}

test.describe('Colorful collapsible subgraphs', () => {
  test('expanded groups are styled and expose a collapse control', async ({ page }) => {
    await waitReady(page);
    await loadGroupDiagram(page);

    const state = await page.evaluate(() => ({
      hasColorStyle: /style ENV_Production fill:[^,\n]+,stroke:[^,\n]+,stroke-width:3px/.test(lastCode),
      collapseControls: document.querySelectorAll('#mermaidOutput svg .meridian-group-toggle[data-action="collapse"]').length,
      groupId: document.querySelector('#mermaidOutput svg g.cluster')?.getAttribute('data-meridian-group-id'),
    }));

    expect(state.hasColorStyle).toBe(true);
    expect(state.collapseControls).toBeGreaterThanOrEqual(1);
    expect(state.groupId).toBe('ENV_Production');
  });

  test('collapse and expand controls work in the live preview', async ({ page }) => {
    await waitReady(page);
    await loadGroupDiagram(page);

    await clickGroupToggle(page, 'collapse');
    await page.waitForFunction(
      () => _collapsedGroups.has('ENV_Production') &&
        document.querySelector('#mermaidOutput svg .meridian-group-toggle[data-action="expand"]'),
      { timeout: 8000 }
    );

    const collapsed = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('meridian_collapsed_v1') || '[]');
      return {
        code: lastCode,
        saved,
        expandControls: document.querySelectorAll('#mermaidOutput svg .meridian-group-toggle[data-action="expand"]').length,
        collapseControls: document.querySelectorAll('#mermaidOutput svg .meridian-group-toggle[data-action="collapse"]').length,
      };
    });

    expect(collapsed.code).toContain('▶ Production (2 nodes)');
    expect(collapsed.code).toMatch(/style ENV_Production fill:[^,\n]+,stroke:[^,\n]+,stroke-width:3px/);
    expect(collapsed.saved).toContain('ENV_Production');
    expect(collapsed.expandControls).toBeGreaterThanOrEqual(1);
    expect(collapsed.collapseControls).toBe(0);

    await clickGroupToggle(page, 'expand');
    await page.waitForFunction(
      () => !_collapsedGroups.has('ENV_Production') &&
        document.querySelector('#mermaidOutput svg .meridian-group-toggle[data-action="collapse"]'),
      { timeout: 8000 }
    );

    const expanded = await page.evaluate(() => ({
      code: lastCode,
      saved: JSON.parse(localStorage.getItem('meridian_collapsed_v1') || '[]'),
      collapseControls: document.querySelectorAll('#mermaidOutput svg .meridian-group-toggle[data-action="collapse"]').length,
    }));

    expect(expanded.code).toContain('subgraph ENV_Production');
    expect(expanded.saved).not.toContain('ENV_Production');
    expect(expanded.collapseControls).toBeGreaterThanOrEqual(1);
  });

  test('collapsed state restores on initial load and shows an expand control', async ({ page }) => {
    await page.addInitScript((src) => {
      localStorage.setItem('smartMermaid_v2', JSON.stringify({
        input: src,
        type: 'LR',
        theme: 'dark',
        split: '45%',
        zoom: 1,
      }));
      localStorage.setItem('meridian_collapsed_v1', JSON.stringify(['ENV_Production']));
    }, GROUP_CODE);
    await waitReady(page, false);

    await page.waitForFunction(
      () => _collapsedGroups.has('ENV_Production') &&
        document.querySelector('#mermaidOutput svg .meridian-group-toggle[data-action="expand"]'),
      { timeout: 8000 }
    );

    expect(await page.evaluate(() => lastCode.includes('▶ Production (2 nodes)'))).toBe(true);
  });
});
