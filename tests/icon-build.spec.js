// @ts-check
// Smoke tests for the icon build pipeline (Phase 1).
// Verifies that CLOUD_ICONS in the running app matches the source JSON counts,
// that all entries have the correct shape, and that ICONIFY_OVERRIDES is populated.
const { test, expect } = require('@playwright/test');
const fs   = require('fs');
const path = require('path');

const ICONS_DIR = path.resolve(__dirname, '../icons-data');
const PROVIDERS = ['aws', 'gcp', 'azure', 'general', 'ai'];

// Load source counts from JSON files at test-collection time (synchronous, fine here)
const SOURCE_COUNTS = Object.fromEntries(
  PROVIDERS.map(p => [
    p,
    JSON.parse(fs.readFileSync(path.join(ICONS_DIR, `${p}.json`), 'utf8')).length,
  ])
);

test.describe('Icon build pipeline — CLOUD_ICONS', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4321/meridian.html');
    await page.waitForTimeout(8000);
    await page.waitForFunction(
      () => typeof CLOUD_ICONS !== 'undefined' && typeof ICONIFY_OVERRIDES !== 'undefined',
      { timeout: 15000 }
    );
  });

  for (const provider of PROVIDERS) {
    test(`CLOUD_ICONS.${provider} count matches icons-data/${provider}.json`, async ({ page }) => {
      const count = await page.evaluate(p => (CLOUD_ICONS[p] || []).length, provider);
      expect(count, `${provider} icon count`).toBe(SOURCE_COUNTS[provider]);
    });
  }

  test('every CLOUD_ICONS entry has exactly 4 string elements', async ({ page }) => {
    const badEntries = await page.evaluate(() => {
      const bad = [];
      for (const [provider, icons] of Object.entries(CLOUD_ICONS)) {
        icons.forEach((entry, i) => {
          if (!Array.isArray(entry) || entry.length !== 4 ||
              typeof entry[0] !== 'string' || typeof entry[1] !== 'string' ||
              typeof entry[2] !== 'string' || typeof entry[3] !== 'string') {
            bad.push(`${provider}[${i}]: ${JSON.stringify(entry)}`);
          }
        });
      }
      return bad;
    });
    expect(badEntries, 'Malformed entries').toEqual([]);
  });

  test('every entry prefix contains a colon', async ({ page }) => {
    const badPrefixes = await page.evaluate(() => {
      const bad = [];
      for (const [provider, icons] of Object.entries(CLOUD_ICONS)) {
        icons.forEach((entry, i) => {
          if (!entry[2] || !entry[2].includes(':')) {
            bad.push(`${provider}[${i}] prefix="${entry[2]}"`);
          }
        });
      }
      return bad;
    });
    expect(badPrefixes, 'Entries missing colon in prefix').toEqual([]);
  });

  test('ICONIFY_OVERRIDES has entries for all providers', async ({ page }) => {
    const hasEntries = await page.evaluate(() => {
      const keys = Object.keys(ICONIFY_OVERRIDES);
      return {
        aws:     keys.some(k => k.startsWith('aws-')),
        gcp:     keys.some(k => k.startsWith('gcp-')),
        azure:   keys.some(k => k.startsWith('azure-')),
        general: keys.some(k => !k.startsWith('aws-') && !k.startsWith('gcp-') && !k.startsWith('azure-') && !k.startsWith('ai-')),
        ai:      keys.some(k => k.startsWith('ai-')),
        total:   keys.length,
      };
    });
    expect(hasEntries.aws,     'ICONIFY_OVERRIDES has AWS entries').toBe(true);
    expect(hasEntries.gcp,     'ICONIFY_OVERRIDES has GCP entries').toBe(true);
    expect(hasEntries.azure,   'ICONIFY_OVERRIDES has Azure entries').toBe(true);
    expect(hasEntries.general, 'ICONIFY_OVERRIDES has General entries').toBe(true);
    expect(hasEntries.ai,      'ICONIFY_OVERRIDES has AI entries').toBe(true);
    expect(hasEntries.total,   'ICONIFY_OVERRIDES total entries').toBeGreaterThan(50);
  });

  test('total icon count across all providers matches source JSON total', async ({ page }) => {
    const runtimeTotal = await page.evaluate(() =>
      Object.values(CLOUD_ICONS).reduce((sum, arr) => sum + arr.length, 0)
    );
    const sourceTotal = Object.values(SOURCE_COUNTS).reduce((a, b) => a + b, 0);
    expect(runtimeTotal, 'Total runtime icon count').toBe(sourceTotal);
  });

});
