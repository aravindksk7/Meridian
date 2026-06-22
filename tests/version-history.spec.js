// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof captureVersionSnapshot === 'function' && !!window.__CM);
  await page.waitForSelector('#mermaidOutput svg');
}

async function saveSnapshot(page,name='Baseline') {
  await page.click('#versionHistoryBtn');await page.fill('#versionName',name);await page.click('#versionSave');
}

test.describe('Version history', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('creates named snapshots with source, settings and sanitized visual preview', async ({ page }) => {
    await saveSnapshot(page);
    const history=await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_version_history_v1')));
    expect(history).toHaveLength(1);expect(history[0].name).toBe('Baseline');expect(history[0].input).toContain('API_Gateway');expect(history[0].svg).toMatch(/^<svg/);
    expect(history[0].svg).not.toMatch(/<script|\son\w+=|javascript:/i);
  });

  test('renders snapshot names as text rather than HTML', async ({ page }) => {
    await saveSnapshot(page,'<img src=x onerror=alert(1)>');
    await expect(page.locator('#versionList')).toContainText('<img src=x onerror=alert(1)>');await expect(page.locator('#versionList img')).toHaveCount(0);
  });

  test('opens a side-by-side visual comparison using blob images', async ({ page }) => {
    await saveSnapshot(page,'Before');await page.click('[data-version-action="compare"]');
    await expect(page.locator('#versionCompareModal')).toHaveClass(/vis/);await expect(page.locator('#versionLeftImage')).toHaveAttribute('src',/^blob:/);await expect(page.locator('#versionRightImage')).toHaveAttribute('src',/^blob:/);
    await expect(page.locator('#versionLeftLabel')).toHaveText('Before');await expect(page.locator('#versionRightLabel')).toHaveText('Current');
  });

  test('restores source and creates a reversible pre-restore checkpoint', async ({ page }) => {
    const original=await page.evaluate(()=>$input.value);await saveSnapshot(page,'Original');
    await page.evaluate(() => {$input.value='app:Changed';onInput();});await page.waitForTimeout(700);
    await page.click('[data-version-action="restore"]');await expect.poll(()=>page.evaluate(()=>$input.value)).toBe(original);
    const names=await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_version_history_v1')).map(item=>item.name));expect(names).toContain('Before restoring Original');
  });

  test('deletes snapshots', async ({ page }) => {
    await saveSnapshot(page);await page.click('[data-version-action="delete"]');expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_version_history_v1')))).toEqual([]);await expect(page.locator('#versionList')).toContainText('No snapshots yet');
  });

  test('snapshot history persists across reload', async ({ page }) => {
    await saveSnapshot(page,'Persisted version');await page.reload();await page.waitForFunction(() => !!window.__CM);await page.click('#versionHistoryBtn');await expect(page.locator('#versionList')).toContainText('Persisted version');
  });

  test('malformed persisted records are rejected and history is capped', async ({ page }) => {
    const state=await page.evaluate(() => {localStorage.setItem('meridian_version_history_v1',JSON.stringify([{name:42,input:null},...Array.from({length:55},(_,index)=>({name:`V${index}`,input:'app:A'}))]));_versionHistoryLoaded=false;return versionHistoryLoad();});
    expect(state).toHaveLength(50);expect(state[0].name).toBe('V5');
  });
});
