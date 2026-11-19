// Exports (SVG / PNG / GIF / copy), share URLs, embed mode, project
// export / import and the diagram library.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { openApp, setInput, stats } = require('./helpers');

const DIAGRAM = 'app:Web --> app:Api\napp:Api --sql--> db:Store';

async function download(page, trigger) {
  const [dl] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const file = await dl.path();
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(file) };
}

test.describe('image exports', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, DIAGRAM); });

  test('SVG export is a valid SVG containing every node label', async ({ page }) => {
    const { name, bytes } = await download(page, () => page.click('#downloadSvg'));
    expect(name).toBe('diagram.svg');
    const svg = bytes.toString('utf8');
    expect(svg.startsWith('<svg')).toBe(true);
    for (const label of ['Web', 'Api', 'Store', 'sql']) expect(svg).toContain(label);
  });

  test('PNG export produces a non-empty PNG image', async ({ page }) => {
    const { name, bytes } = await download(page, () => page.click('#downloadPng'));
    expect(name).toMatch(/\.png$/);
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.length).toBeGreaterThan(2000);
  });

  test('GIF export produces a GIF89a file', async ({ page }) => {
    test.setTimeout(90_000);
    const { name, bytes } = await download(page, () => page.click('#downloadGif'));
    expect(name).toMatch(/\.gif$/);
    expect(bytes.subarray(0, 6).toString()).toBe('GIF89a');
  });

  test('copy menu copies Mermaid code, fenced code and an embed snippet', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const clip = () => page.evaluate(() => navigator.clipboard.readText());
    await page.click('#copyBtn');
    await expect.poll(clip).toMatch(/^flowchart LR/);
    await page.click('#copyDropBtn');
    await expect(page.locator('#copyMenu')).toBeVisible();
    await page.click("#copyMenu [onclick=\"doCopy('fences')\"]");
    await expect.poll(clip).toMatch(/^```mermaid\r?\nflowchart LR/);
    expect((await clip()).trim().endsWith('```')).toBe(true);
    await page.click('#copyDropBtn');
    await page.click("#copyMenu [onclick=\"doCopy('embed')\"]");
    await expect.poll(clip).toMatch(/^<iframe src=".*#d:.*&embed=1"/);
  });
});

test.describe('share URLs and embed mode', () => {
  test('Share writes the diagram into the URL and the URL restores it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openApp(page);
    await setInput(page, DIAGRAM);
    await page.selectOption('#diagramType', 'TD');
    await page.click('#shareBtn');
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/^#d:/);
    const url = await page.evaluate(() => location.href);
    const fresh = await context.newPage();
    await fresh.goto(url);
    await fresh.waitForSelector('#mermaidOutput svg g.node');
    expect(await fresh.evaluate(() => $input.value)).toBe(DIAGRAM);
    await expect(fresh.locator('#diagramType')).toHaveValue('TD');
    expect((await stats(fresh)).nodes).toBe(3);
  });

  test('embed mode shows only the diagram', async ({ page }) => {
    await openApp(page);
    await setInput(page, DIAGRAM);
    const url = await page.evaluate(() => buildShareUrl() + '&embed=1');
    await page.goto(url);
    await page.reload(); // hash-only navigation does not reload the app
    await page.waitForSelector('#mermaidOutput svg g.node');
    await expect(page.locator('#leftPanel')).toBeHidden();
    await expect(page.locator('body > header')).toBeHidden();
    expect((await stats(page)).nodes).toBe(3);
  });
});

test.describe('project files', () => {
  test('export .meridian.json then import it into a clean app restores text, type, layout and colours', async ({ page }, info) => {
    await openApp(page);
    await setInput(page, DIAGRAM);
    await page.selectOption('#diagramType', 'TD');
    await page.evaluate(() => { _entityColors = { APP_Web: '#123456' }; _entityColorsLoaded = true; entityColorSave(); });
    await page.click('#exportProjectBtn');
    const { name, bytes } = await download(page, () => page.click('[data-project-export="json"]'));
    expect(name).toMatch(/\.meridian\.json$/);
    const bundle = JSON.parse(bytes.toString('utf8'));
    expect(bundle.input).toBe(DIAGRAM);
    expect(bundle.type).toBe('TD');
    expect(bundle.entityColors.APP_Web).toBe('#123456');

    const file = path.join(info.outputDir, 'project.meridian.json');
    fs.mkdirSync(info.outputDir, { recursive: true });
    fs.writeFileSync(file, bytes);
    await openApp(page);
    await page.setInputFiles('#projectFileInput', file);
    await expect.poll(() => page.evaluate(() => $input.value)).toBe(DIAGRAM);
    await expect(page.locator('#diagramType')).toHaveValue('TD');
    expect(await page.evaluate(() => _entityColors.APP_Web)).toBe('#123456');
  });

  test('.mmd bundle round-trips through import', async ({ page }, info) => {
    await openApp(page);
    await setInput(page, DIAGRAM);
    await page.click('#exportProjectBtn');
    const { name, bytes } = await download(page, () => page.click('[data-project-export="mmd"]'));
    expect(name).toMatch(/\.mmd$/);
    expect(bytes.toString('utf8')).toMatch(/^%% meridian-project: /);
    const file = path.join(info.outputDir, 'p.mmd');
    fs.mkdirSync(info.outputDir, { recursive: true });
    fs.writeFileSync(file, bytes);
    await openApp(page);
    await page.setInputFiles('#projectFileInput', file);
    await expect.poll(() => page.evaluate(() => $input.value)).toBe(DIAGRAM);
  });

  test('importing an invalid file shows an error and keeps the current diagram', async ({ page }, info) => {
    await openApp(page);
    await setInput(page, DIAGRAM);
    const file = path.join(info.outputDir, 'bad.meridian.json');
    fs.mkdirSync(info.outputDir, { recursive: true });
    fs.writeFileSync(file, '{ not json');
    await page.setInputFiles('#projectFileInput', file);
    await expect(page.locator('#toast')).toContainText(/fail|invalid|could not|error/i);
    expect(await page.evaluate(() => $input.value)).toBe(DIAGRAM);
  });
});

test.describe('diagram library', () => {
  test('save, list, open and delete diagrams', async ({ page }) => {
    await openApp(page);
    await setInput(page, DIAGRAM);
    await page.click('#libBtn');
    await expect(page.locator('#libraryModal')).toBeVisible();
    await expect(page.locator('#libList')).toContainText('No saved diagrams');
    await page.fill('#libNameInput', 'Checkout flow');
    await page.click('#libSaveBtn');
    await expect(page.locator('#libList')).toContainText('Checkout flow');
    await page.click('#libClose');

    await setInput(page, 'app:Other');
    await page.click('#libBtn');
    await page.locator('#libList .lib-item', { hasText: 'Checkout flow' }).locator('.lib-item-open').click();
    await expect(page.locator('#libraryModal')).toBeHidden();
    await expect.poll(() => page.evaluate(() => $input.value)).toBe(DIAGRAM);

    await page.click('#libBtn');
    page.once('dialog', d => d.accept());
    await page.locator('#libList .lib-item-del').first().click();
    await expect(page.locator('#libList')).toContainText('No saved diagrams');
  });

  test('saved diagrams survive a reload', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => { document.getElementById('libNameInput').value = 'Persisted'; libSaveCurrent(); });
    await page.reload();
    await page.waitForSelector('#mermaidOutput svg');
    await page.click('#libBtn');
    await expect(page.locator('#libList')).toContainText('Persisted');
  });
});

test('autosave restores the last diagram, type and zoom after reload', async ({ page }) => {
  await openApp(page);
  await setInput(page, DIAGRAM);
  await page.selectOption('#diagramType', 'TD');
  await page.evaluate(() => setZoom(1.5));
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('#mermaidOutput svg g.node');
  expect(await page.evaluate(() => $input.value)).toBe(DIAGRAM);
  await expect(page.locator('#diagramType')).toHaveValue('TD');
  await expect(page.locator('#zoomDisplay')).toHaveText('150%');
});
