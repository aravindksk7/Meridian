// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof openCommandPalette === 'function' && !!window.__CM);
  await page.waitForSelector('#mermaidOutput svg');
}

test.describe('Command palette', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('Ctrl+K opens the palette and focuses search', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.locator('#commandPalette')).toHaveClass(/vis/);
    await expect(page.locator('#commandInput')).toBeFocused();
  });

  test('search spans commands, templates and diagram nodes', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.fill('#commandInput','microservices template');
    await expect(page.locator('#commandList')).toContainText('Load Microservices template');
    await page.fill('#commandInput','API Gateway');
    await expect(page.locator('#commandList .command-item')).toContainText('API Gateway');
  });

  test('keyboard navigation executes a panel command', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.fill('#commandInput','Open Layers panel');
    await page.keyboard.press('Enter');
    await expect(page.locator('#commandPalette')).not.toHaveClass(/vis/);
    await expect(page.locator('#layersPanel')).toHaveClass(/vis/);
  });

  test('node commands select and navigate to the matching node', async ({ page }) => {
    const label=await page.evaluate(() => [...parser.entities.values()].find(entity=>!groupVisualFor(parser,entity.id)).label);
    const display=label.replace(/_/g,' ');
    await page.keyboard.press('Control+k');await page.fill('#commandInput',label);
    const nodeItem=page.locator('.command-item',{hasText:display}).last();await nodeItem.click();
    const selected=await page.evaluate(() => parser.entities.get(selectedNodeId)?.label);
    expect(selected).toBe(label);
  });

  test('template commands load templates', async ({ page }) => {
    await page.keyboard.press('Control+k');await page.fill('#commandInput','Load Three Tier template');await page.keyboard.press('Enter');
    await expect.poll(()=>page.evaluate(()=>$input.value)).toContain('3-Tier Web Application');
  });

  test('export and settings actions are executable', async ({ page }) => {
    await page.keyboard.press('Control+k');await page.fill('#commandInput','Open settings');await page.keyboard.press('Enter');
    await expect(page.locator('#settingsModal')).not.toHaveClass(/hidden/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+k');await page.fill('#commandInput','Export SVG');
    const download=page.waitForEvent('download');await page.keyboard.press('Enter');expect((await download).suggestedFilename()).toMatch(/\.svg$/);
  });

  test('Escape closes without executing a command', async ({ page }) => {
    const before=await page.evaluate(()=>$input.value);await page.keyboard.press('Control+k');await page.fill('#commandInput','Load Cloud template');await page.keyboard.press('Escape');
    await expect(page.locator('#commandPalette')).not.toHaveClass(/vis/);expect(await page.evaluate(()=>$input.value)).toBe(before);
  });
});
