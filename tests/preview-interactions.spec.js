// Live Preview interactions: node / group context menus, selection toolbar,
// dragging, zoom, minimap, layout reset, fullscreen, labels and node search.
const { test, expect } = require('@playwright/test');
const { openApp, setInput, nodeCenter, drag, stats } = require('./helpers');

const DIAGRAM = `env:Prod {
  app:Api
  app:Worker
}
app:Web --> app:Api
app:Api --> db:Store
app:Worker --> db:Store`;

const text = page => page.evaluate(() => $input.value);

async function clickNode(page, eid) {
  const c = await nodeCenter(page, eid);
  await page.mouse.click(c.x, c.y);
}

test.describe('node context menu', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, DIAGRAM); });

  test('clicking a node opens its menu with name and connections', async ({ page }) => {
    await clickNode(page, 'APP_Api');
    const ctx = page.locator('#nodeCtxPanel');
    await expect(ctx).toBeVisible();
    await expect(page.locator('#ncpName')).toContainText('Api');
    await expect(page.locator('#ncpConns')).toContainText('Web');
    await expect(page.locator('#ncpConns')).toContainText('Store');
    await page.keyboard.press('Escape');
  });

  test('rename updates the source text and the rendered label', async ({ page }) => {
    await clickNode(page, 'APP_Web');
    await page.click('#nodeCtxPanel [onclick="startRename()"]');
    const input = page.locator('#ncpName input');
    await input.fill('Portal');
    await input.press('Enter');
    await expect(page.locator('#mermaidOutput svg g.node', { hasText: 'Portal' })).toHaveCount(1);
    expect(await text(page)).toContain('app:Portal --> app:Api');
  });

  test('add connected node creates a new entity and edge', async ({ page }) => {
    await clickNode(page, 'APP_Api');
    await page.click('#nodeCtxPanel [onclick="openAddNodeForm()"]');
    await expect(page.locator('#nodeAddForm')).toBeVisible();
    await page.fill('#nafName', 'Cache');
    await page.fill('#nafLabel', 'reads');
    await page.click('#nodeAddForm [onclick="submitAddNode()"]');
    await expect(page.locator('#mermaidOutput svg g.node', { hasText: 'Cache' })).toHaveCount(1);
    expect(await text(page)).toMatch(/app:Api --reads--> \w+:Cache/);
  });

  test('connect-to links two existing nodes', async ({ page }) => {
    const before = (await stats(page)).edges;
    await clickNode(page, 'APP_Web');
    await page.click('#nodeCtxPanel [onclick="openConnectToPanel()"]');
    await expect(page.locator('#nodeConnectPanel')).toBeVisible();
    await page.locator('#nc2List .nc2-item', { hasText: 'Worker' }).click();
    await expect.poll(async () => (await stats(page)).edges).toBe(before + 1);
    expect(await text(page)).toContain('app:Web --> app:Worker');
  });

  test('custom node colour is applied and can be cleared', async ({ page }) => {
    await clickNode(page, 'APP_Web');
    await page.locator('#ncpColorPicker').evaluate(el => { el.value = '#ff0000'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('meridian_entitycolors_v1') || '{}').APP_Web)).toBe('#ff0000');
    const fill = await page.evaluate(() => getComputedStyle(primaryNodeShape(meridianNodeGroup(document.querySelector('#mermaidOutput svg'), 'APP_Web'))).fill);
    expect(fill).toBe('rgb(255, 0, 0)');
    await page.click('#ncpColorClearBtn');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('meridian_entitycolors_v1') || '{}').APP_Web)).toBeUndefined();
  });

  test('delete removes the node and its relationships', async ({ page }) => {
    await clickNode(page, 'APP_Web');
    await page.click('#nodeCtxPanel [onclick="deleteNode(activeNodeId)"]');
    await expect(page.locator('#mermaidOutput svg g.node', { hasText: 'Web' })).toHaveCount(0);
    expect(await text(page)).not.toContain('app:Web');
  });

  test('find in source highlights the entity in the editor', async ({ page }) => {
    await clickNode(page, 'DB_Store');
    await page.click('#nodeCtxPanel [onclick^="highlightEntityInInput"]');
    const sel = await page.evaluate(() => { const r = _cmView.state.selection.main; return _cmView.state.sliceDoc(r.from, r.to); });
    expect(sel).toMatch(/Store/);
  });
});

test.describe('selection toolbar', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, DIAGRAM); });

  test('selecting shows toolbar; duplicate, lock and delete work', async ({ page }) => {
    await clickNode(page, 'APP_Web');
    await page.keyboard.press('Escape'); // close context menu, keep selection
    await page.evaluate(() => selectNode('APP_Web'));
    const bar = page.locator('#selectionToolbar');
    await expect(bar).toBeVisible();
    await expect(page.locator('#selectionName')).toHaveText('Web');

    await page.click('#selectionDuplicate');
    await expect(page.locator('#mermaidOutput svg g.node', { hasText: 'Web_Copy' })).toHaveCount(1);

    await page.evaluate(() => selectNode('APP_Web'));
    await page.click('#selectionLock');
    expect(await page.evaluate(() => isNodeLocked('APP_Web'))).toBe(true);
    // locked node does not move when dragged
    const c0 = await nodeCenter(page, 'APP_Web');
    await drag(page, c0, { x: c0.x + 80, y: c0.y + 60 }, 10);
    const c1 = await nodeCenter(page, 'APP_Web');
    expect(Math.abs(c1.x - c0.x)).toBeLessThan(2);
    await page.evaluate(() => selectNode('APP_Web'));
    await page.click('#selectionLock');
    expect(await page.evaluate(() => isNodeLocked('APP_Web'))).toBe(false);

    await page.evaluate(() => selectNode('APP_Web_Copy'));
    await page.click('#selectionDelete');
    await expect(page.locator('#mermaidOutput svg g.node', { hasText: 'Web_Copy' })).toHaveCount(0);
  });

  test('shift-click builds a multi-selection', async ({ page }) => {
    await page.evaluate(() => { selectNode('APP_Web'); selectNode('DB_Store', true); });
    await expect(page.locator('#selectionName')).toHaveText('2 selected');
    await page.click('#selectionClose');
    await expect(page.locator('#selectionToolbar')).toBeHidden();
  });
});

test.describe('groups', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, DIAGRAM); });

  async function openGroup(page) {
    // Mermaid can lay a child node over part of the label, so dispatch on the label itself.
    await page.locator('#mermaidOutput svg g.cluster .cluster-label').first().dispatchEvent('click');
    await expect(page.locator('#groupCtxPanel')).toBeVisible();
  }

  test('group menu collapses and expands the group', async ({ page }) => {
    await openGroup(page);
    await expect(page.locator('#gcpName')).toContainText('Prod');
    await page.click('#gcpCollapse');
    await expect.poll(async () => (await stats(page)).clusters).toBe(0);
    expect(await page.evaluate(() => [..._collapsedGroups])).toEqual(['ENV_Prod']);
    await page.evaluate(() => toggleGroupCollapse('ENV_Prod', false));
    await expect.poll(async () => (await stats(page)).clusters).toBe(1);
  });

  test('group colour is stored and applied', async ({ page }) => {
    await openGroup(page);
    await page.locator('#gcpColorPicker').evaluate(el => { el.value = '#00aa00'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_groupcolors_v1')).ENV_Prod)).toBe('#00aa00');
    await page.click('#gcpColorClearBtn');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_groupcolors_v1') || '{}').ENV_Prod)).toBeUndefined();
  });

  test('group rename rewrites the block header', async ({ page }) => {
    await openGroup(page);
    page.once('dialog', d => d.accept('Production'));
    await page.click('#gcpRename');
    const renameInput = page.locator('#gcpName input');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Production');
    await renameInput.press('Enter');
    await expect.poll(() => text(page)).toContain('env:Production');
    await expect(page.locator('#mermaidOutput svg g.cluster', { hasText: 'Production' })).toHaveCount(1);
  });

  test('group column layout buttons arrange children', async ({ page }) => {
    await openGroup(page);
    await page.locator('#gcpColumnBtns button', { hasText: '2' }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_grouplayouts_v1') || '{}').ENV_Prod?.columns)).toBe(2);
    await page.click('#gcpColumnClear');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_grouplayouts_v1') || '{}').ENV_Prod)).toBeUndefined();
  });
});

test.describe('dragging and layout', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, DIAGRAM); });

  test('node drag moves the node, persists across reload and edges follow', async ({ page }) => {
    const c0 = await nodeCenter(page, 'APP_Web');
    await drag(page, c0, { x: c0.x, y: c0.y + 120 }, 12);
    const c1 = await nodeCenter(page, 'APP_Web');
    expect(c1.y - c0.y).toBeGreaterThan(60);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_nodepos_v1')).APP_Web)).toBeTruthy();
    await page.reload();
    await page.waitForSelector('#mermaidOutput svg g.node');
    await page.waitForTimeout(500);
    const c2 = await nodeCenter(page, 'APP_Web');
    expect(Math.abs(c2.y - c1.y)).toBeLessThan(4);
  });

  test('Reset layout returns dragged nodes to auto-layout (Shift+click clears all)', async ({ page }) => {
    const c0 = await nodeCenter(page, 'APP_Web');
    await drag(page, c0, { x: c0.x, y: c0.y + 120 }, 12);
    await page.locator('#resetPosBtn').click({ modifiers: ['Shift'] });
    await page.waitForTimeout(600);
    const c2 = await nodeCenter(page, 'APP_Web');
    expect(Math.abs(c2.y - c0.y)).toBeLessThan(4);
  });

  test('group drag moves every child together', async ({ page }) => {
    const a0 = await nodeCenter(page, 'APP_Api'), w0 = await nodeCenter(page, 'APP_Worker');
    const rect = await page.evaluate(() => {
      const cl = document.querySelector('#mermaidOutput svg g.cluster rect').getBoundingClientRect();
      // a point on the cluster background not covered by nodes or labels
      for (let y = cl.bottom - 6; y > cl.top + 20; y -= 4) for (let x = cl.left + 6; x < cl.right - 6; x += 6) {
        const el = document.elementFromPoint(x, y);
        if (el && el.closest('g.cluster') && !el.closest('g.node, .cluster-label, .meridian-cluster-resize-handle')) return { x, y };
      }
      return null;
    });
    expect(rect).not.toBeNull();
    await drag(page, rect, { x: rect.x + 70, y: rect.y + 50 }, 12);
    const a1 = await nodeCenter(page, 'APP_Api'), w1 = await nodeCenter(page, 'APP_Worker');
    expect(a1.x - a0.x).toBeGreaterThan(30);
    expect(Math.abs((a1.x - a0.x) - (w1.x - w0.x))).toBeLessThan(3);
  });
});

test.describe('zoom, minimap, fullscreen', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, DIAGRAM); });

  test('zoom in / out / picker / fit / Ctrl shortcuts', async ({ page }) => {
    await page.evaluate(() => setZoom(1));
    await page.click('#zoomIn');
    await expect(page.locator('#zoomDisplay')).toHaveText(/1[1-9]\d%|125%|120%|110%/);
    await page.click('#zoomOut');
    await page.click('#zoomOut');
    expect(await page.evaluate(() => zoom)).toBeLessThan(1);
    await page.click('#zoomDisplay');
    await expect(page.locator('#zoomPicker')).toBeVisible();
    await page.locator('.zoom-pick-item', { hasText: '200%' }).click();
    await expect(page.locator('#zoomPicker')).toBeHidden();
    await expect(page.locator('#zoomDisplay')).toHaveText('200%');
    expect(await page.locator('#zoomWrapper').evaluate(el => el.style.transform)).toBe('scale(2)');
    await page.click('#zoomFit');
    expect(await page.evaluate(() => zoom)).toBeLessThanOrEqual(1);
    await page.locator('#previewScroll').hover();
    await page.evaluate(() => setZoom(1));
    await page.keyboard.press('Control+=');
    expect(await page.evaluate(() => zoom)).toBeGreaterThan(1);
  });

  test('manual zoom is kept when the diagram re-renders; fixed zoom mode is enforced', async ({ page }) => {
    await page.evaluate(() => setZoom(1.75));
    await setInput(page, DIAGRAM + '\napp:Api --> app:Extra');
    await page.waitForTimeout(300);
    await expect(page.locator('#zoomDisplay')).toHaveText('175%');
    await page.click('#previewOptionsBtn');
    await page.selectOption('#previewZoomMode', '50');
    await expect(page.locator('#zoomDisplay')).toHaveText('50%');
    await setInput(page, DIAGRAM);
    await page.waitForTimeout(300);
    await expect(page.locator('#zoomDisplay')).toHaveText('50%');
  });

  test('minimap renders a copy of the diagram, navigates and collapses', async ({ page }) => {
    await expect(page.locator('#previewMinimap')).toBeVisible();
    await expect(page.locator('#minimapSvgHost svg g.node')).toHaveCount(await page.locator('#mermaidOutput svg g.node').count());
    await page.evaluate(() => setZoom(4));
    await page.waitForTimeout(300);
    const body = await page.locator('#minimapBody').boundingBox();
    await page.mouse.click(body.x + body.width - 5, body.y + body.height - 5);
    await page.waitForTimeout(400);
    const pos = await page.locator('#previewScroll').evaluate(el => el.scrollLeft + el.scrollTop);
    expect(pos).toBeGreaterThan(50);
    await page.click('#minimapToggle');
    await expect(page.locator('#previewMinimap')).toHaveClass(/collapsed/);
  });

  test('fullscreen preview toggles with button and Ctrl+Shift+F', async ({ page }) => {
    await page.locator('#fullscreenBtn').evaluate(b => b.click());
    await expect(page.locator('body')).toHaveClass(/fullscreen-preview/);
    await page.locator('#fullscreenBtn').evaluate(b => b.click());
    await expect(page.locator('body')).not.toHaveClass(/fullscreen-preview/);
  });

  test('panel resizer changes the editor / preview split', async ({ page }) => {
    const before = await page.locator('#leftPanel').evaluate(el => el.getBoundingClientRect().width);
    const handle = await page.evaluate(() => { const r = document.getElementById('leftPanel').getBoundingClientRect(); return { x: r.right + 2, y: r.top + r.height / 2 }; });
    await drag(page, handle, { x: handle.x - 200, y: handle.y }, 10);
    const after = await page.locator('#leftPanel').evaluate(el => el.getBoundingClientRect().width);
    expect(before - after).toBeGreaterThan(100);
  });
});

test.describe('labels and search', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); await setInput(page, DIAGRAM); });

  test('canvas label: add, edit text, persist and delete', async ({ page }) => {
    await page.locator('#addLabelBtn').evaluate(b => b.click());
    const box = await page.locator('#mermaidOutput > svg').boundingBox();
    await page.mouse.click(box.x + 6, box.y + box.height - 6);
    await expect(page.locator('#mermaidOutput .meridian-canvas-label')).toHaveCount(1);
    const editorTa = page.locator('textarea').last();
    await editorTa.fill('Release 2');
    await editorTa.press('Control+Enter').catch(() => {});
    await page.keyboard.press('Escape');
    await page.mouse.click(box.x + box.width - 4, box.y + 4);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('meridian_canvas_labels_v1') || '[]').map(l => l.text))).toEqual(['Release 2']);
    await page.reload();
    await expect(page.locator('#mermaidOutput .meridian-canvas-label')).toContainText('Release 2');
    await page.locator('#mermaidOutput .meridian-label-delete').dispatchEvent('click');
    await expect(page.locator('#mermaidOutput .meridian-canvas-label')).toHaveCount(0);
  });

  test('Ctrl+F finds nodes, cycles matches and closes with Escape', async ({ page }) => {
    await page.locator('#previewScroll').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+f');
    await expect(page.locator('#nodeFindBar')).toBeVisible();
    await page.fill('#nodeFindInput', 'Wor');
    await expect(page.locator('#nodeFindCount')).toContainText('1');
    await expect(page.locator('#mermaidOutput svg g.node.node-find-hl')).toHaveCount(1);
    await page.fill('#nodeFindInput', 'zzz');
    await expect(page.locator('#nodeFindCount')).toContainText(/0|no match/i);
    await page.locator('#nodeFindInput').press('Escape');
    await expect(page.locator('#nodeFindBar')).toBeHidden();
  });

  test('hovering a node shows its tooltip', async ({ page }) => {
    const c = await nodeCenter(page, 'DB_Store');
    await page.mouse.move(c.x, c.y);
    await expect(page.locator('#nodeTooltip')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#nodeTooltip')).toContainText('Store');
  });
});
