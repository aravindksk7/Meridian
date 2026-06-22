// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('AI / RAG App template', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4321/meridian.html');
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 12000 }
    );
  });

  test('AI / RAG App button exists in the template picker', async ({ page }) => {
    await page.click('#tplPickerBtn');
    await page.waitForSelector('#tplPicker.vis', { timeout: 3000 });
    const btn = page.locator('.tpl-item', { hasText: 'AI / RAG App' });
    await expect(btn).toBeVisible();
  });

  test('loading the aiApp template populates the editor', async ({ page }) => {
    await page.evaluate(() => loadTemplate('aiApp'));
    const code = await page.evaluate(() => $input.value);
    expect(code.trim().length).toBeGreaterThan(200);
    // Key components
    expect(code).toContain('LangChain');
    expect(code).toContain('RAG_Pipeline');
    expect(code).toContain('Pinecone');
    expect(code).toContain('Embeddings');
    expect(code).toContain('OpenAI_GPT');
    expect(code).toContain('Claude');
    expect(code).toContain('Langfuse');
  });

  test('aiApp template references AI icons', async ({ page }) => {
    await page.evaluate(() => loadTemplate('aiApp'));
    const code = await page.evaluate(() => $input.value);
    expect(code).toContain('[icon: ai-');
  });

  test('aiApp template parses to multiple entities and relationships', async ({ page }) => {
    await page.evaluate(() => loadTemplate('aiApp'));
    const result = await page.evaluate(() => ({
      entities:      parser.entities.size,
      relationships: parser.relationships.length,
      domains:       parser.domains.size,
    }));
    expect(result.entities,      'Should have many entities').toBeGreaterThan(15);
    expect(result.relationships, 'Should have many relationships').toBeGreaterThan(10);
    expect(result.domains,       'Should have multiple domains').toBeGreaterThan(4);
  });

  test('aiApp template renders without error', async ({ page }) => {
    await page.evaluate(() => loadTemplate('aiApp'));
    await page.waitForFunction(
      () => {
        const svg = document.querySelector('#mermaidOutput svg');
        return svg && svg.querySelectorAll('.edgePaths path').length > 0;
      },
      { timeout: 8000 }
    );
    const errorCount = await page.locator('.render-err').count();
    expect(errorCount).toBe(0);
  });

  test('clicking the template picker button loads the AI template', async ({ page }) => {
    await page.click('#tplPickerBtn');
    await page.waitForSelector('#tplPicker.vis', { timeout: 3000 });
    await page.locator('.tpl-item', { hasText: 'AI / RAG App' }).click();

    // Picker closes
    await expect(page.locator('#tplPicker')).not.toHaveClass(/vis/);

    const code = await page.evaluate(() => $input.value);
    expect(code).toContain('LangChain');
  });
});
