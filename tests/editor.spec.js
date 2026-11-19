// Smart Input editor, pickers, templates and editing shortcuts.
const { test, expect } = require('@playwright/test');
const { openApp, setInput, stats } = require('./helpers');

const editor = '#smartInput .cm-content';
const docText = page => page.evaluate(() => $input.value);

test.describe('Smart Input editor', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, 'app:A --> app:B'); });

  test('typing in the editor re-renders the live preview', async ({ page }) => {
    await page.click(editor);
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\napp:B --> db:C');
    await expect(page.locator('#mermaidOutput svg g.node')).toHaveCount(3);
    await expect(page.locator('#entityCount')).toContainText('3 nodes');
  });

  test('syntax highlighting marks type prefixes', async ({ page }) => {
    const colored = await page.evaluate(() => [...document.querySelectorAll('#smartInput .cm-line span')].filter(s => /^app:?$/.test(s.textContent) && getComputedStyle(s).color !== getComputedStyle(document.querySelector('#smartInput .cm-content')).color).length);
    expect(colored).toBeGreaterThan(0);
  });

  test('undo / redo buttons and Ctrl+Z / Ctrl+Y restore text', async ({ page }) => {
    await page.click(editor);
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\napp:X');
    await page.waitForTimeout(700);
    expect(await docText(page)).toContain('app:X');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    expect(await docText(page)).not.toContain('app:X');
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
    expect(await docText(page)).toContain('app:X');
    await page.click('#clearBtn');
    expect(await docText(page)).toBe('');
    await page.click('#undoBtn');
    await page.waitForTimeout(300);
    expect(await docText(page)).toContain('app:A');
    await page.click('#redoBtn');
    await page.waitForTimeout(300);
    expect(await docText(page)).toBe('');
  });

  test('Clear empties input and preview', async ({ page }) => {
    await page.click('#clearBtn');
    await expect(page.locator('#mermaidOutput svg')).toHaveCount(0);
    await expect(page.locator('#statusLeft')).toContainText('Ready');
  });

  test('Ctrl+/ toggles a line comment', async ({ page }) => {
    await page.click(editor);
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Control+/');
    await page.waitForTimeout(500);
    expect(await docText(page)).toMatch(/^\/\/app:A/);
    await expect(page.locator('#mermaidOutput svg')).toHaveCount(0);
    await page.keyboard.press('Control+/');
    await page.waitForTimeout(500);
    expect(await docText(page)).toBe('app:A --> app:B');
  });

  test('Tab indents inside the editor', async ({ page }) => {
    await page.click(editor);
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('Tab');
    expect(await docText(page)).toMatch(/^\s+app:A/);
  });

  test('autocomplete offers type prefixes and existing entities', async ({ page }) => {
    await page.click(editor);
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\nserv');
    await page.keyboard.press('Control+Space');
    const popup = page.locator('.cm-tooltip-autocomplete');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('server:');
    await expect(popup.locator('li[aria-selected="true"]')).toContainText('server:');
    await page.keyboard.press('Enter');
    expect(await docText(page)).toMatch(/\nserver:$/);
  });

  test('Ctrl+Enter forces a re-render', async ({ page }) => {
    await page.click(editor);
    await page.keyboard.press('Control+Enter');
    await expect(page.locator('#toast')).toContainText('Re-rendered');
  });

  test('inspector shows the entity under the cursor', async ({ page }) => {
    await page.click('#inspToggleBtn');
    await expect(page.locator('#inspectorPanel')).toHaveClass(/vis/);
    await page.click(editor);
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#inspName')).toHaveText('A');
    await expect(page.locator('#inspType')).toHaveText('app');
    await page.click('#inspToggleBtn');
    await expect(page.locator('#inspectorPanel')).not.toHaveClass(/vis/);
  });
});

test.describe('pickers and templates', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('entity shape picker inserts a typed prefix', async ({ page }) => {
    await setInput(page, 'app:A');
    await page.click('#shapePickerBtn');
    await expect(page.locator('#shapePicker')).toBeVisible();
    const cards = page.locator('#spGrid .sp-card');
    expect(await cards.count()).toBeGreaterThan(8);
    await cards.filter({ hasText: 'Database' }).first().click();
    await expect(page.locator('#shapePicker')).toBeHidden();
    expect(await docText(page)).toMatch(/(^|\n)db:/);
  });

  test('icon picker: providers, search, subcategory chips and insert', async ({ page }) => {
    await setInput(page, 'app:A');
    await page.click('#iconPickerBtn');
    await expect(page.locator('#iconPicker')).toBeVisible();
    for (const prov of ['aws', 'gcp', 'azure', 'general', 'ai']) {
      await page.click(`.ip-tab[data-provider="${prov}"]`);
      await expect(page.locator(`.ip-tab[data-provider="${prov}"]`)).toHaveClass(/active/);
      expect(await page.locator('#ipGrid .ip-item').count(), prov).toBeGreaterThan(5);
    }
    await page.click('.ip-tab[data-provider="aws"]');
    await page.fill('#ipSearch', 'lambda');
    const hits = page.locator('#ipGrid .ip-item');
    await expect(hits.first()).toBeVisible();
    const n = await hits.count();
    expect(n).toBeGreaterThan(0);
    await page.fill('#ipSearch', 'zzzz-no-such-service');
    await expect(page.locator('#ipGrid .ip-empty')).toBeVisible();
    await page.fill('#ipSearch', 'lambda');
    await hits.first().click();
    expect(await docText(page)).toMatch(/lambda/i);
    await expect(page.locator('#mermaidOutput svg g.node')).toHaveCount(2);
  });

  test('custom icon can be created from an SVG and appears in the Custom tab', async ({ page }) => {
    await page.click('#iconPickerBtn');
    await page.click('.ip-tab[data-provider="custom"]');
    await page.evaluate(() => toggleCustomIconForm());
    await page.fill('#ipCustomName', 'Widget');
    await page.fill('#ipCustomSvg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
    await page.evaluate(() => saveCustomIconFromForm());
    await expect(page.locator('#ipGrid .ip-item', { hasText: 'Widget' })).toBeVisible();
    expect(await page.evaluate(() => loadCustomIcons().length)).toBe(1);
  });

  test('every template in the Templates menu loads and renders', async ({ page }) => {
    test.setTimeout(180_000); // 11 full renders through the UI
    const items = await page.locator('#tplPicker [onclick^="loadTemplate"]').count();
    expect(items).toBeGreaterThan(8);
    for (let i = 0; i < items; i++) {
      await page.click('#tplPickerBtn');
      await expect(page.locator('#tplPicker')).toBeVisible();
      await page.locator('#tplPicker [onclick^="loadTemplate"]').nth(i).click();
      await page.waitForTimeout(500);
      const s = await stats(page);
      expect(s.error, `template #${i}`).toBe(false);
      await expect(page.locator('#mermaidOutput svg')).toHaveCount(1);
    }
  });

  test('architecture views menu loads each view', async ({ page }) => {
    const items = await page.locator('#viewPicker [onclick^="loadArchitectureView"]').count();
    expect(items).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < items; i++) {
      await page.click('#viewPickerBtn');
      await page.locator('#viewPicker [onclick^="loadArchitectureView"]').nth(i).click();
      await page.waitForTimeout(500);
      expect((await stats(page)).error).toBe(false);
      expect((await stats(page)).nodes).toBeGreaterThan(2);
    }
  });
});
