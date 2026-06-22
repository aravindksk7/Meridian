// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof onInput === 'function' && !!window.__CM, null, { timeout: 12000 });
  await page.waitForSelector('#mermaidOutput svg', { timeout: 12000 });
}

test.describe('Live Preview properties', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('properties menu opens above the preview canvas', async ({ page }) => {
    await page.click('#previewOptionsBtn');
    const state = await page.evaluate(() => {
      const panel = document.getElementById('previewOptionsPanel');
      const rect = panel.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + 8, rect.top + 8);
      return { visible: panel.classList.contains('vis'), hitInside: panel.contains(hit) };
    });
    expect(state).toEqual({ visible: true, hitInside: true });
  });

  test('canvas property applies and persists', async ({ page }) => {
    await page.click('#previewOptionsBtn');
    await page.selectOption('#previewCanvas', 'dots');
    await expect(page.locator('#previewScroll')).toHaveAttribute('data-canvas', 'dots');
    await page.reload();
    await page.waitForFunction(() => !!window.__CM);
    await expect(page.locator('#previewScroll')).toHaveAttribute('data-canvas', 'dots');
  });

  test('connection and minimap visibility controls apply immediately', async ({ page }) => {
    await page.click('#previewOptionsBtn');
    await page.selectOption('#previewConnections', 'hidden');
    const hiddenEdges = await page.locator('#mermaidOutput svg .edgePaths path').evaluateAll(paths => paths.every(p => p.style.visibility === 'hidden'));
    expect(hiddenEdges).toBe(true);

    await page.selectOption('#previewMinimapMode', 'hidden');
    await expect(page.locator('#previewMinimap')).toHaveClass(/hidden/);
  });

  test('background, quality, view mode, direction and snap properties apply', async ({ page }) => {
    await page.click('#previewOptionsBtn');
    await page.selectOption('#previewBackgroundMode', 'custom');
    await page.locator('#previewBackgroundColor').evaluate((el) => {
      el.value = '#123456';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.selectOption('#previewQuality', 'performance');
    await page.selectOption('#previewViewMode', 'inspect');
    await page.selectOption('#previewDirection', 'TD');
    await page.locator('#previewSnap').check();

    const state = await page.evaluate(() => ({
      background: document.getElementById('previewScroll').dataset.background,
      customBackground: document.getElementById('previewScroll').style.getPropertyValue('--preview-custom-bg'),
      quality: document.getElementById('rightPanel').dataset.quality,
      viewMode: document.getElementById('rightPanel').dataset.viewMode,
      direction: document.getElementById('diagramType').value,
      snapped: previewSnapValue(23),
    }));
    expect(state).toEqual({ background:'custom', customBackground:'#123456', quality:'performance', viewMode:'inspect', direction:'TD', snapped:16 });
  });

  test('zoom, device frame, background token and snap controls apply and persist', async ({ page }) => {
    await page.click('#previewOptionsBtn');
    await page.selectOption('#previewZoomMode', '150');
    await page.selectOption('#previewDevice', 'mobile');
    await page.selectOption('#previewBackgroundMode', 'theme');
    await page.selectOption('#previewBackgroundToken', 'elevated');
    await page.locator('#previewSnapNodes').check();
    await page.locator('#previewSnapGuides').uncheck();

    await expect(page.locator('#zoomDisplay')).toHaveText('150%');
    await expect(page.locator('#previewScroll')).toHaveAttribute('data-device', 'mobile');
    await expect(page.locator('#previewScroll')).toHaveAttribute('data-background-token', 'elevated');
    await page.reload();
    await page.waitForFunction(() => !!window.__CM);
    await expect(page.locator('#previewScroll')).toHaveAttribute('data-device', 'mobile');
    await page.click('#previewOptionsBtn');
    await expect(page.locator('#previewSnapNodes')).toBeChecked();
    await expect(page.locator('#previewSnapGuides')).not.toBeChecked();
  });

  test('custom viewport and custom zoom are clamped to supported ranges', async ({ page }) => {
    const state = await page.evaluate(() => validatedPreviewSettings({
      device:'custom', deviceWidth:9999, deviceHeight:100, zoomMode:'custom', zoomCustom:400,
    }));
    expect(state).toMatchObject({ device:'custom', deviceWidth:2560, deviceHeight:240, zoomMode:'custom', zoomCustom:200 });
  });

  test('node and alignment snap modes affect drag coordinates independently', async ({ page }) => {
    const state = await page.evaluate(() => {
      const nodes = new Map([['a',{cx:100,cy:100}],['b',{cx:200,cy:300}]]);
      _diagramSettings.preview = validatedPreviewSettings({ snapToNodes:true, alignmentGuides:false });
      const node = previewSnapPoint(106, 104, 'b', nodes);
      _diagramSettings.preview = validatedPreviewSettings({ snapToNodes:false, alignmentGuides:true });
      const guides = previewSnapPoint(106, 250, 'b', nodes);
      return { node, guides };
    });
    expect(state).toEqual({ node:{x:100,y:100}, guides:{x:100,y:250} });
  });

  test('present and inspect modes expose appropriate return-to-edit controls', async ({ page }) => {
    await page.click('#previewOptionsBtn');
    await page.selectOption('#previewViewMode', 'present');
    await expect(page.locator('#rightPanel')).toHaveAttribute('data-view-mode', 'present');
    await page.click('#presentationExit');
    await expect(page.locator('#rightPanel')).toHaveAttribute('data-view-mode', 'edit');
    await page.click('#previewOptionsBtn');
    await page.selectOption('#previewViewMode', 'inspect');
    await page.click('#reviewModeBadge');
    await expect(page.locator('#rightPanel')).toHaveAttribute('data-view-mode', 'edit');
  });

  test('hover affordances remain outside the hovered node', async ({ page }) => {
    const node = page.locator('#mermaidOutput svg g.node').first();
    await node.hover();
    await page.waitForTimeout(620);
    const geometry = await page.evaluate(() => {
      const node = document.querySelector('#mermaidOutput svg g.node').getBoundingClientRect();
      const handle = document.getElementById('nodeHandle').getBoundingClientRect();
      const tooltip = document.getElementById('nodeTooltip').getBoundingClientRect();
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        handleVisible: getComputedStyle(document.getElementById('nodeHandle')).display !== 'none',
        tooltipVisible: getComputedStyle(document.getElementById('nodeTooltip')).display !== 'none',
        handleOverlaps: overlap(node, handle),
        tooltipOverlaps: overlap(node, tooltip),
        helperTextVisible: getComputedStyle(document.querySelector('#nodeHandle .nh-tip')).display !== 'none',
      };
    });
    expect(geometry).toEqual({
      handleVisible: true,
      tooltipVisible: true,
      handleOverlaps: false,
      tooltipOverlaps: false,
      helperTextVisible: false,
    });
  });
});
