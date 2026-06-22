// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof enterPresentationMode === 'function' && !!window.__CM);
  await page.waitForSelector('#mermaidOutput svg');
}

test.describe('Presentation mode', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('hides editor chrome and expands the Live Preview canvas', async ({ page }) => {
    await page.click('#presentModeBtn');
    await expect(page.locator('body')).toHaveClass(/presentation-mode/);
    await expect(page.locator('#presentationBar')).toBeVisible();
    await expect(page.locator('#leftPanel')).toBeHidden();
    await expect(page.locator('#previewHeader')).toBeHidden();
    await expect(page.locator('body > header')).toBeHidden();
    await expect(page.locator('#rightPanel')).toHaveAttribute('data-view-mode','present');
  });

  test('saves a named viewport with zoom, scroll and selection', async ({ page }) => {
    await page.click('#presentModeBtn');
    await page.evaluate(() => { setZoom(1.5);const id=[...parser.entities.keys()].find(key=>!groupVisualFor(parser,key));selectNode(id);$previewScroll.scrollLeft=24;$previewScroll.scrollTop=18; });
    await page.fill('#presentationViewName','Overview');await page.click('#presentationSave');
    const views=await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_presentation_views_v1')));
    expect(views).toHaveLength(1);expect(views[0]).toMatchObject({name:'Overview',zoom:1.5});expect(views[0].selectedIds).toHaveLength(1);
    await expect(page.locator('#presentationViewStatus')).toContainText('Overview');
  });

  test('previous and next navigate saved views and restore zoom', async ({ page }) => {
    await page.click('#presentModeBtn');
    await page.evaluate(() => setZoom(.75));await page.fill('#presentationViewName','Wide');await page.click('#presentationSave');
    await page.evaluate(() => setZoom(1.5));await page.fill('#presentationViewName','Detail');await page.click('#presentationSave');
    await page.click('#presentationPrev');await expect(page.locator('#zoomDisplay')).toHaveText('75%');await expect(page.locator('#presentationViewStatus')).toContainText('Wide');
    await page.click('#presentationNext');await expect(page.locator('#zoomDisplay')).toHaveText('150%');await expect(page.locator('#presentationViewStatus')).toContainText('Detail');
  });

  test('fullscreen control and Escape return to editing', async ({ page }) => {
    await page.click('#presentModeBtn');await page.click('#presentationFullscreen');await expect(page.locator('body')).toHaveClass(/fullscreen-preview/);
    await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass(/presentation-mode/);await expect(page.locator('body')).not.toHaveClass(/fullscreen-preview/);
    await expect(page.locator('#leftPanel')).toBeVisible();await expect(page.locator('#rightPanel')).toHaveAttribute('data-view-mode','edit');
  });

  test('saved views persist across reload', async ({ page }) => {
    await page.click('#presentModeBtn');await page.fill('#presentationViewName','Persisted');await page.click('#presentationSave');
    expect(await page.evaluate(() => localStorage.getItem('meridian_presentation_views_v1'))).toContain('Persisted');
    await page.reload();
    expect(await page.evaluate(() => localStorage.getItem('meridian_presentation_views_v1'))).toContain('Persisted');
    expect(await page.evaluate(() => presentationViewsLoad().map(view => view.name))).toContain('Persisted');
    await page.waitForFunction(() => !!window.__CM);await page.evaluate(() => enterPresentationMode());await expect(page.locator('#presentationViewStatus')).toContainText('Persisted');
  });

  test('deleting a saved view updates storage and status', async ({ page }) => {
    await page.click('#presentModeBtn');await page.fill('#presentationViewName','Temporary');await page.click('#presentationSave');await page.click('#presentationDelete');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_presentation_views_v1')))).toEqual([]);await expect(page.locator('#presentationViewStatus')).toHaveText('No saved views');
  });
});
