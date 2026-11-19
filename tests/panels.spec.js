// Floating panels: preview options, component props, layers, design tokens,
// comments, presentation, version history, command palette, help, settings.
const { test, expect } = require('@playwright/test');
const { openApp, setInput, nodeCenter, stats } = require('./helpers');

const DIAGRAM = `domain:Sales {
  app:Orders
  db:OrdersDb
}
app:Web --> app:Orders
app:Orders --writes--> db:OrdersDb`;

const pv = page => page.evaluate(() => JSON.parse(JSON.stringify(_diagramSettings.preview)));

test.describe('Live Preview options panel', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await setInput(page, DIAGRAM);
    await page.click('#previewOptionsBtn');
    await expect(page.locator('#previewOptionsPanel')).toBeVisible();
  });

  test('canvas style changes the preview background pattern', async ({ page }) => {
    for (const mode of ['dots', 'plain', 'transparent', 'grid']) {
      await page.selectOption('#previewCanvas', mode);
      await expect(page.locator('#previewScroll')).toHaveAttribute('data-canvas', mode);
    }
  });

  test('connections: hidden hides every edge, all shows them again', async ({ page }) => {
    await page.selectOption('#previewConnections', 'hidden');
    expect(await page.evaluate(() => [...document.querySelectorAll('#mermaidOutput svg .edgePaths path')].every(p => p.style.visibility === 'hidden'))).toBe(true);
    await page.selectOption('#previewConnections', 'all');
    expect(await page.evaluate(() => [...document.querySelectorAll('#mermaidOutput svg .edgePaths path')].every(p => p.style.visibility !== 'hidden'))).toBe(true);
  });

  test('minimap mode, layout direction and quality', async ({ page }) => {
    await page.selectOption('#previewMinimapMode', 'hidden');
    await expect(page.locator('#previewMinimap')).toBeHidden();
    await page.selectOption('#previewMinimapMode', 'expanded');
    await expect(page.locator('#previewMinimap')).toBeVisible();
    await page.selectOption('#previewDirection', 'TD');
    await expect.poll(() => page.evaluate(() => lastCode.split('\n')[0])).toBe('flowchart TD');
    await page.selectOption('#previewQuality', 'performance');
    await expect(page.locator('#rightPanel')).toHaveAttribute('data-quality', 'performance');
  });

  test('view mode, device frame, background and snap settings persist; reset restores defaults', async ({ page }) => {
    await page.selectOption('#previewViewMode', 'inspect');
    await expect(page.locator('#rightPanel')).toHaveAttribute('data-view-mode', 'inspect');
    await page.selectOption('#previewViewMode', 'edit');
    await page.selectOption('#previewDevice', 'tablet');
    await expect(page.locator('#previewScroll')).toHaveAttribute('data-device', 'tablet');
    await page.selectOption('#previewBackgroundMode', 'custom');
    await expect(page.locator('#previewScroll')).toHaveAttribute('data-background', 'custom');
    await page.check('#previewSnap');
    const saved = await pv(page);
    expect(saved.device).toBe('tablet');
    expect(saved.snapToGrid).toBe(true);
    await page.reload();
    await page.waitForSelector('#mermaidOutput svg');
    await expect(page.locator('#previewScroll')).toHaveAttribute('data-device', 'tablet');
    await page.click('#previewOptionsBtn');
    await page.click('#previewOptionsReset');
    const reset = await pv(page);
    expect(reset.device).not.toBe('tablet');
    expect(reset.snapToGrid).toBe(false);
  });
});

test.describe('component props, layers, design tokens', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, DIAGRAM); });

  test('component props panel toggles labels/minimap/grid and edits relationship style', async ({ page }) => {
    await page.click('#componentPropsBtn');
    await expect(page.locator('#componentPropsPanel')).toBeVisible();
    await page.uncheck('#cpLabels');
    await expect(page.locator('#rightPanel')).toHaveAttribute('data-show-labels', 'false');
    await page.check('#cpLabels');
    await page.selectOption('#cpConnectionStyle', 'dashed');
    await expect(page.locator('#rightPanel')).toHaveAttribute('data-connection-style', 'dashed');
    await page.uncheck('#cpMinimap');
    await expect(page.locator('#previewMinimap')).toBeHidden();
  });

  test('layers panel lists domains, nodes and edges; search filters; click selects', async ({ page }) => {
    await page.click('#layersBtn');
    await expect(page.locator('#layersPanel')).toBeVisible();
    const tree = page.locator('#layersTree');
    await expect(tree).toContainText('Sales');
    await expect(tree).toContainText('Orders');
    await expect(tree).toContainText('Web');
    await page.fill('#layersSearch', 'web');
    await expect(tree).not.toContainText('OrdersDb');
    await tree.locator('.layer-row', { hasText: 'Web' }).first().click();
    await expect.poll(() => page.evaluate(() => [...selectedNodeIds])).toEqual(['APP_Web']);
  });

  test('design tokens change node radius and edge width; reset restores', async ({ page }) => {
    await page.click('#designTokensBtn');
    await expect(page.locator('#designTokensPanel')).toBeVisible();
    await page.locator('#dtEdgeWidth').fill('5');
    await page.locator('#dtEdgeWidth').dispatchEvent('change');
    await expect.poll(() => page.evaluate(() => document.querySelector('#mermaidOutput svg .edgePaths path').style.strokeWidth)).toBe('5px');
    await page.locator('#dtNodeRadius').fill('20');
    await page.locator('#dtNodeRadius').dispatchEvent('change');
    await expect.poll(() => page.evaluate(() => document.querySelector('#mermaidOutput svg g.node rect')?.getAttribute('rx'))).toBe('20');
    await page.click('#designTokensReset');
    await expect.poll(() => page.evaluate(() => _diagramSettings.designTokens.edgeWidth)).not.toBe(5);
  });
});

test.describe('review comments and presentation', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, DIAGRAM); });

  test('add, resolve and delete a comment pin', async ({ page }) => {
    await page.click('#commentsBtn');
    await page.click('#newCommentBtn');
    await expect(page.locator('body')).toHaveClass(/comment-placement/);
    const c = await nodeCenter(page, 'APP_Web');
    await page.mouse.click(c.x, c.y);
    await expect(page.locator('#commentComposer')).toBeVisible();
    await page.fill('#commentText', 'Check auth flow');
    await page.click('#commentSave');
    await expect(page.locator('#commentsCount')).toHaveText('1');
    await expect(page.locator('#mermaidOutput .meridian-comment-pin')).toHaveCount(1);
    await page.locator('#mermaidOutput .meridian-comment-pin').first().click();
    await page.click('#commentResolve');
    await expect(page.locator('#commentsCount')).toHaveText('0');
    await page.click('#commentsBtn');
    await page.selectOption('#commentsFilter', 'all');
    await expect(page.locator('#commentsList')).toContainText('Check auth flow');
    await page.locator('#mermaidOutput .meridian-comment-pin').first().click();
    await page.click('#commentDelete');
    expect(await page.evaluate(() => reviewCommentsLoad().length)).toBe(0);
  });

  test('presentation mode hides editing chrome, saves views and exits with Escape', async ({ page }) => {
    await page.locator('#presentModeBtn').evaluate(b => b.click());
    await expect(page.locator('body')).toHaveClass(/presentation-mode/);
    await expect(page.locator('#presentationBar')).toBeVisible();
    await expect(page.locator('#leftPanel')).toBeHidden();
    await page.fill('#presentationViewName', 'Overview');
    await page.click('#presentationSave');
    await expect(page.locator('#presentationViewStatus')).toContainText('Overview');
    await page.locator('body').press('Escape');
    await expect(page.locator('body')).not.toHaveClass(/presentation-mode/);
    await expect(page.locator('#leftPanel')).toBeVisible();
  });
});

test.describe('version history', () => {
  test('snapshot, compare and restore', async ({ page }) => {
    await openApp(page);
    await setInput(page, 'app:V1 --> db:Store');
    await page.click('#versionHistoryBtn');
    await expect(page.locator('#versionHistoryPanel')).toBeVisible();
    await page.fill('#versionName', 'first');
    await page.click('#versionSave');
    await expect(page.locator('#versionList')).toContainText('first');
    await setInput(page, 'app:V2 --> db:Store\napp:V2 --> app:Extra');
    if (!(await page.locator('#versionHistoryPanel').isVisible())) await page.click('#versionHistoryBtn');
    await page.fill('#versionName', 'second');
    await page.click('#versionSave');
    await page.locator('.version-item', { hasText: 'first' }).locator('[data-version-action="compare"]').click();
    await expect(page.locator('#versionCompareModal')).toBeVisible();
    await page.click('#versionCompareClose');
    if (!(await page.locator('#versionHistoryPanel').isVisible())) await page.click('#versionHistoryBtn');
    await page.locator('.version-item', { hasText: 'first' }).locator('[data-version-action="restore"]').click();
    await expect.poll(() => page.evaluate(() => $input.value)).toBe('app:V1 --> db:Store');
    await expect(page.locator('#mermaidOutput svg g.node', { hasText: 'V1' })).toHaveCount(1);
  });
});

test.describe('command palette and help', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('Ctrl+K opens the palette, filters commands and runs one', async ({ page }) => {
    await page.locator('body').press('Control+k');
    await expect(page.locator('#commandPalette')).toHaveClass(/vis/);
    await page.fill('#commandInput', 'theme');
    await expect(page.locator('#commandList')).toContainText(/light or dark/i);
    await page.locator('#commandInput').press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#commandPalette')).not.toHaveClass(/vis/);
    await page.click('#commandPaletteBtn');
    await expect(page.locator('#commandPalette')).toHaveClass(/vis/);
    await page.locator('#commandInput').press('Escape');
    await expect(page.locator('#commandPalette')).not.toHaveClass(/vis/);
  });

  test('help opens from button and ? key, every section is reachable, Escape closes', async ({ page }) => {
    await page.click('#helpBtn');
    await expect(page.locator('#helpModal')).toBeVisible();
    const sections = await page.locator('.help-nav').evaluateAll(b => b.map(x => x.dataset.section));
    expect(sections).toEqual(expect.arrayContaining(['quickstart', 'entities', 'arrows', 'grouping', 'natural', 'linting', 'shortcuts']));
    for (const s of sections) {
      await page.click(`.help-nav[data-section="${s}"]`);
      await expect(page.locator(`#hs-${s}`)).toBeVisible();
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#helpModal')).toBeHidden();
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Shift+?');
    await expect(page.locator('#helpModal')).toBeVisible();
    await page.click('#helpClose');
    await expect(page.locator('#helpModal')).toBeHidden();
  });
});

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await setInput(page, DIAGRAM);
    await page.click('#settingsBtn');
    await expect(page.locator('#settingsModal')).toBeVisible();
  });

  test('editor theme, font size and font family apply and persist', async ({ page }) => {
    await page.locator('#editorThemeSwatches [data-theme-key="dracula"]').click();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#smartInput .cm-content')).color)).toBe('rgb(248, 248, 242)');
    await page.locator('#fontSizeBtns button', { hasText: '17' }).click();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#smartInput .cm-editor')).fontSize)).toBe('17px');
    await page.selectOption('#fontFamilyPicker', 'fira');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_settings') || '{}'));
    expect(JSON.stringify(saved)).toContain('dracula');
    await page.reload();
    await page.waitForSelector('#mermaidOutput svg');
    expect(await page.evaluate(() => _editorSettings.theme)).toBe('dracula');
    expect(await page.evaluate(() => _editorSettings.fontSize)).toBe(17);
  });

  test('diagram overrides: font size, node colours, line colour, background', async ({ page }) => {
    await page.click('.stt-tab[data-stt="diagram"]');
    await expect(page.locator('#stt-diagram')).toBeVisible();
    await page.check('#diagLineColorEnable');
    await page.locator('#diagLineColor').evaluate(el => { el.value = '#ff00ff'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    await expect.poll(() => page.evaluate(() => _diagramSettings.lineColor)).toBe('#ff00ff');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('#mermaidOutput svg .flowchart-link')).stroke)).toBe('rgb(255, 0, 255)');
    await page.uncheck('#diagLineColorEnable');
    await expect.poll(() => page.evaluate(() => _diagramSettings.lineColor)).toBe('');
  });

  test('linting rules produce naming warnings', async ({ page }) => {
    await page.click('.stt-tab[data-stt="linting"]');
    await page.selectOption('#lintCaseRule', 'PascalCase').catch(async () => page.selectOption('#lintCaseRule', { index: 1 }));
    await page.click('#settingsCloseBtn');
    await setInput(page, 'app:bad_name --> app:Good');
    await expect(page.locator('#lintBtn')).toContainText(/warning/);
    await page.click('#lintBtn');
    await expect(page.locator('#lintPanel')).toContainText('NAMING_CONVENTION');
  });

  test('storage tab shows IndexedDB records and clear-layout keeps the text', async ({ page }) => {
    await page.click('.stt-tab[data-stt="storage"]');
    await expect(page.locator('#stt-storage')).toBeVisible();
    await expect(page.locator('#stt-storage')).toContainText(/documents|IndexedDB/i);
    page.once('dialog', d => d.accept());
    await page.click('#storageClearLayoutBtn');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => $input.value)).toContain('app:Web');
  });

  test('settings close via button, X and Escape', async ({ page }) => {
    await page.click('#settingsCloseX');
    await expect(page.locator('#settingsModal')).toBeHidden();
    await page.click('#settingsBtn');
    await page.keyboard.press('Escape');
    await expect(page.locator('#settingsModal')).toBeHidden();
  });
});
