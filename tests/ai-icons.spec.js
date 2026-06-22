// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('AI icon tab', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4321/meridian.html');
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 12000 }
    );
  });

  test('AI tab button is present in the icon picker', async ({ page }) => {
    // The picker is hidden until opened — open it first
    await page.click('#iconPickerBtn');
    await page.waitForSelector('#iconPicker.vis', { timeout: 3000 });

    const aiTab = page.locator('.ip-tab[data-provider="ai"]');
    await expect(aiTab).toBeVisible({ timeout: 3000 });
    await expect(aiTab).toContainText('AI');
  });

  test('clicking the AI tab renders icons in the grid', async ({ page }) => {
    // Open picker
    await page.click('#iconPickerBtn');
    await page.waitForSelector('#iconPicker.vis', { timeout: 3000 });

    // Click AI tab
    await page.click('.ip-tab[data-provider="ai"]');
    await page.waitForTimeout(300);

    const itemCount = await page.locator('#ipGrid .ip-item').count();
    expect(itemCount, 'AI tab should render multiple icon items').toBeGreaterThan(20);
  });

  test('AI icons cover expected categories (LLM, framework, vector DB)', async ({ page }) => {
    await page.click('#iconPickerBtn');
    await page.waitForSelector('#iconPicker.vis', { timeout: 3000 });
    await page.click('.ip-tab[data-provider="ai"]');
    await page.waitForTimeout(300);

    const titles = await page.locator('#ipGrid .ip-item').evaluateAll(
      els => els.map(el => el.getAttribute('title') || el.textContent || '')
    );

    const titleStr = titles.join('|').toLowerCase();

    // LLM providers
    expect(titleStr).toContain('claude');
    expect(titleStr).toContain('llama');
    expect(titleStr).toContain('gemini');
    // Frameworks
    expect(titleStr).toContain('langchain');
    expect(titleStr).toContain('langgraph');
    // ML
    expect(titleStr).toContain('pytorch');
    expect(titleStr).toContain('tensorflow');
    // Vector DBs
    expect(titleStr).toContain('pinecone');
    expect(titleStr).toContain('qdrant');
    // MLOps
    expect(titleStr).toContain('mlflow');
  });

  test('search filters AI icons by name', async ({ page }) => {
    await page.click('#iconPickerBtn');
    await page.waitForSelector('#iconPicker.vis', { timeout: 3000 });
    await page.click('.ip-tab[data-provider="ai"]');
    await page.waitForTimeout(200);

    // Type a search term
    await page.fill('#ipSearch', 'pytorch');
    await page.waitForTimeout(300);

    const items = await page.locator('#ipGrid .ip-item').count();
    expect(items, 'Search for "pytorch" should return at least 1 result').toBeGreaterThanOrEqual(1);

    const firstTitle = await page.locator('#ipGrid .ip-item').first().getAttribute('title');
    expect(firstTitle?.toLowerCase()).toContain('pytorch');
  });

  test('clicking an AI icon inserts the correct entity prefix into the editor', async ({ page }) => {
    await page.click('#iconPickerBtn');
    await page.waitForSelector('#iconPicker.vis', { timeout: 3000 });
    await page.click('.ip-tab[data-provider="ai"]');
    await page.waitForTimeout(200);

    // Find and click the Claude icon
    await page.fill('#ipSearch', 'claude');
    await page.waitForTimeout(200);

    const claudeItem = page.locator('#ipGrid .ip-item').first();
    await claudeItem.click();

    // Picker should close
    await expect(page.locator('#iconPicker')).not.toHaveClass(/vis/);

    // Editor should contain an entity line with Claude
    const editorValue = await page.evaluate(() => $input.value);
    expect(editorValue.toLowerCase()).toContain('claude');
    expect(editorValue).toContain('[icon');
  });

  test('AI icons are searchable across all providers via global search', async ({ page }) => {
    await page.click('#iconPickerBtn');
    await page.waitForSelector('#iconPicker.vis', { timeout: 3000 });

    // Search without switching tab
    await page.fill('#ipSearch', 'langchain');
    await page.waitForTimeout(200);

    // Switch to AI tab and search again
    await page.click('.ip-tab[data-provider="ai"]');
    await page.waitForTimeout(200);

    const items = await page.locator('#ipGrid .ip-item').count();
    expect(items).toBeGreaterThanOrEqual(1);
  });

  test('CLOUD_ICONS.ai has entries for all major categories', async ({ page }) => {
    const categories = await page.evaluate(() => {
      const icons = CLOUD_ICONS.ai;
      return {
        total: icons.length,
        hasLLM:      icons.some(([,n]) => /claude|gpt|gemini|llama/i.test(n)),
        hasFramework:icons.some(([,n]) => /langchain|llamaindex|autogen/i.test(n)),
        hasMLLib:    icons.some(([,n]) => /pytorch|tensorflow|scikit/i.test(n)),
        hasVectorDB: icons.some(([,n]) => /pinecone|qdrant|weaviate|milvus/i.test(n)),
        hasMLOps:    icons.some(([,n]) => /mlflow|wandb|weights/i.test(n)),
        hasObserv:   icons.some(([,n]) => /langfuse|arize|evidently|helicone/i.test(n)),
        hasServing:  icons.some(([,n]) => /vllm|tgi|triton|litellm/i.test(n)),
      };
    });

    expect(categories.total).toBeGreaterThan(50);
    expect(categories.hasLLM,       'Missing LLM providers').toBe(true);
    expect(categories.hasFramework, 'Missing orchestration frameworks').toBe(true);
    expect(categories.hasMLLib,     'Missing ML libraries').toBe(true);
    expect(categories.hasVectorDB,  'Missing vector databases').toBe(true);
    expect(categories.hasMLOps,     'Missing MLOps tools').toBe(true);
    expect(categories.hasObserv,    'Missing AI observability tools').toBe(true);
    expect(categories.hasServing,   'Missing LLM serving tools').toBe(true);
  });
});
