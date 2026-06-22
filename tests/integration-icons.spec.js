// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('http://localhost:4321/meridian.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof CLOUD_ICONS !== 'undefined' && typeof $input !== 'undefined' && $input !== null,
    { timeout: 12000 }
  );
}

test.describe('Integration layer icons', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('general catalog includes integration and managed file transfer entries', async ({ page }) => {
    const state = await page.evaluate(() => {
      const entries = CLOUD_ICONS.general
        .filter(([, , , subcategory]) => subcategory === 'Integration')
        .map(([emoji, label, prefix]) => ({ emoji, label, prefix }));
      return {
        labels: entries.map(e => e.label),
        confluent: entries.find(e => e.label === 'Confluent Kafka'),
        crush: entries.find(e => e.label === 'CrushFTP'),
        count: entries.length,
      };
    });

    expect(state.count).toBeGreaterThanOrEqual(12);
    expect(state.labels).toEqual(expect.arrayContaining([
      'Confluent Kafka',
      'Kafka Connect',
      'Schema Registry',
      'CrushFTP',
      'SFTPGo',
      'FileZilla Server',
    ]));
    expect(state.confluent.prefix).toBe('interface:ConfluentKafka');
    expect(state.crush.prefix).toBe('ftp:CrushFTP');
  });

  test('search can insert an integration icon into Smart Input', async ({ page }) => {
    await page.click('#iconPickerBtn');
    await page.waitForSelector('#iconPicker.vis', { timeout: 3000 });
    await page.click('.ip-tab[data-provider="general"]');
    await page.fill('#ipSearch', 'CrushFTP');
    await page.click('#ipGrid .ip-item:has-text("CrushFTP")');

    const editorValue = await page.evaluate(() => $input.value);
    expect(editorValue).toContain('ftp:CrushFTP');
    expect(editorValue).toContain('[icon:');
  });
});
