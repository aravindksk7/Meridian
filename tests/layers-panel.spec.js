// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof refreshLayersPanel === 'function' && !!window.__CM);
  await page.waitForSelector('#mermaidOutput svg');
}

async function setDiagram(page, source) {
  await page.evaluate((text) => {
    _layersCollapsed.clear(); localStorage.removeItem('meridian_layers_collapsed_v1');
    $input.value=text; parser.parse(text,'LR');
  }, source);
}

test.describe('Layers panel', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('shows groups, nodes, edges and annotations in one hierarchy', async ({ page }) => {
    await page.evaluate(() => {
      $input.value = 'domain:Platform {\napp:API\ndb:Database\n}\napp:API --queries--> db:Database';
      canvasLabelLoad(); _canvasLabels=[{id:'note-1',text:'Review boundary',x:20,y:20}]; canvasLabelSave();
      parser.parse($input.value,'LR');
    });
    await page.click('#layersBtn');
    await expect(page.locator('#layersPanel')).toHaveClass(/vis/);
    const text = await page.locator('#layersTree').innerText();
    expect(text.toLowerCase()).toContain('domains & groups');
    expect(text).toContain('Platform');
    expect(text).toContain('API');
    expect(text.toLowerCase()).toContain('edges');
    expect(text).toContain('API → Database');
    expect(text.toLowerCase()).toContain('annotations');
    expect(text).toContain('Review boundary');
  });

  test('search retains matching descendants and their parent hierarchy', async ({ page }) => {
    await setDiagram(page,'domain:Platform {\napp:Frontend\ndb:Database\n}');
    await page.click('#layersBtn');
    await page.fill('#layersSearch','database');
    await expect(page.locator('#layersTree')).toContainText('Database');
    await expect(page.locator('#layersTree')).not.toContainText('Frontend');
  });

  test('clicking a node layer selects its canvas node', async ({ page }) => {
    await setDiagram(page,'domain:Platform {\napp:Frontend\ndb:Database\n}');
    await page.click('#layersBtn');
    const database = page.locator('.layer-row[data-layer-kind="node"]', { hasText:'Database' }).first();
    await database.click();
    const state = await page.evaluate(() => ({ selected:selectedNodeId, active:document.querySelector('#layersTree .layer-row.active')?.dataset.layerId }));
    expect(state.selected).toContain('Database');
    expect(state.active).toBe(state.selected);
  });

  test('group disclosure collapses layer children and persists independently', async ({ page }) => {
    await page.evaluate(() => {
      $input.value='domain:Platform {\napp:API\ndb:Database\n}'; parser.parse($input.value,'LR'); onInput();
    });
    await page.waitForTimeout(800);
    await page.click('#layersBtn');
    const group = page.locator('.layer-row[data-layer-kind="group"]', { hasText:'Platform' });
    const groupId = await group.getAttribute('data-layer-id');
    await group.locator('.layer-disclosure').click();
    await expect(page.locator(`.layer-row[data-layer-kind="node"]`)).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_layers_collapsed_v1') || '[]'));
    expect(stored).toContain(groupId);
  });

  test('keyboard activation selects a layer row', async ({ page }) => {
    await setDiagram(page,'app:Frontend\ndb:Database\napp:Frontend --> db:Database');
    await page.click('#layersBtn');
    const row = page.locator('.layer-row[data-layer-kind="node"]').first();
    await row.focus(); await row.press('Enter');
    await expect(row).toHaveClass(/active/);
  });
});
