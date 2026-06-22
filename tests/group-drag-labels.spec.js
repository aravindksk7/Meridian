// @ts-check
const { test, expect } = require('@playwright/test');

const DOMAIN_CODE = `
app:Frontend
db:Database
app:API
server:Cache
app:Frontend --> app:API
app:API --> db:Database
app:API --> server:Cache

domain:WebLayer {
  app:Frontend
  app:API
}

domain:DataLayer {
  db:Database
  server:Cache
}
`;

const NESTED_SUBDOMAIN_CODE = `
domain:Commerce {
  app:Checkout_API
  subdomain:Catalog {
    app:Catalog_API
    db:Catalog_DB
    app:Catalog_API --> db:Catalog_DB
  }
  app:Checkout_API --> app:Catalog_API
}
`;

const SIMPLE_CODE = `
app:Alpha
app:Beta
db:Gamma
app:Alpha --> app:Beta
app:Beta --> db:Gamma
`;

async function waitReady(page, clearStorage = true) {
  if (clearStorage) await page.addInitScript(() => localStorage.clear());
  await page.goto('http://localhost:4321/meridian.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
    { timeout: 15000 }
  );
}

async function loadDiagram(page, code) {
  await page.evaluate((src) => { $input.value = src; onInput(); }, code);
  await page.waitForFunction(
    () => document.querySelector('#mermaidOutput svg') !== null,
    { timeout: 10000 }
  );
  await page.waitForTimeout(600);
}

async function clusterBackgroundPoint(page) {
  return page.evaluate(() => {
    const rect = document.querySelector('#mermaidOutput svg g.cluster rect');
    if (!rect) return null;
    const box = rect.getBoundingClientRect();
    for (const fy of [0.9, 0.1, 0.5, 0.75, 0.25]) {
      for (const fx of [0.5, 0.25, 0.75, 0.1, 0.9]) {
        const x = box.x + box.width * fx;
        const y = box.y + box.height * fy;
        if (document.elementFromPoint(x, y) === rect) return { x, y };
      }
    }
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1 — Group (domain/subdomain) drag
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Group drag — domain/subdomain moves with entities', () => {
  test.beforeEach(async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, DOMAIN_CODE);
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg g.cluster') !== null,
      { timeout: 8000 }
    );
  });

  test('cluster rect has move cursor after attachGroupDrag', async ({ page }) => {
    const cursor = await page.evaluate(() => {
      const cluster = document.querySelector('#mermaidOutput svg g.cluster');
      return cluster?.querySelector('rect')?.style.cursor;
    });
    expect(cursor).toBe('move');
  });

  test('dragging cluster background moves child nodes', async ({ page }) => {
    // Get initial positions of child nodes
    const before = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      return typeof meridianNodeGroups === 'function'
        ? meridianNodeGroups(svg).map(({ eid, el }) => ({
            eid,
            t: el.getAttribute('transform'),
          }))
        : [];
    });

    // Find the cluster rect and drag it
    const clusterBox = await page.evaluate(() => {
      const r = document.querySelector('#mermaidOutput svg g.cluster rect');
      return r ? r.getBoundingClientRect() : null;
    });
    expect(clusterBox).not.toBeNull();

    const cx = clusterBox.x + clusterBox.width / 2;
    const cy = clusterBox.y + clusterBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 70, cy + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      return typeof meridianNodeGroups === 'function'
        ? meridianNodeGroups(svg).map(({ eid, el }) => ({
            eid,
            t: el.getAttribute('transform'),
          }))
        : [];
    });

    // At least some nodes should have moved
    const changed = after.filter((a, i) => before[i] && a.t !== before[i].t);
    expect(changed.length).toBeGreaterThan(0);
  });

  test('group drag persists child node offsets to localStorage', async ({ page }) => {
    const clusterBox = await page.evaluate(() => {
      const r = document.querySelector('#mermaidOutput svg g.cluster rect');
      return r ? r.getBoundingClientRect() : null;
    });
    const cx = clusterBox.x + clusterBox.width / 2;
    const cy = clusterBox.y + clusterBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 70, cy + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_nodepos_v1') || '{}')
    );
    expect(Object.keys(stored).length).toBeGreaterThan(0);
  });

  test('group drag persists cluster visual offset (gDx/gDy) to groupSizes', async ({ page }) => {
    const { x: cx, y: cy } = await clusterBackgroundPoint(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 70, cy + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_groupsizes_v1') || '{}')
    );
    const keys = Object.keys(stored);
    expect(keys.length).toBeGreaterThan(0);
    const sz = stored[keys[0]];
    expect(typeof sz.gDx).toBe('number');
    expect(typeof sz.gDy).toBe('number');
  });

  test('group position is re-applied after reset layout', async ({ page }) => {
    const { x: cx, y: cy } = await clusterBackgroundPoint(page);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 70, cy + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await page.click('#resetPosBtn');
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg') !== null,
      { timeout: 8000 }
    );
    await page.waitForTimeout(600);

    // gDx/gDy should still be in storage (not cleared by plain reset)
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_groupsizes_v1') || '{}')
    );
    const keys = Object.keys(stored);
    expect(keys.length).toBeGreaterThan(0);
    expect(stored[keys[0]].gDx).toBeTruthy();
  });

  test('edges remain connected after group drag', async ({ page }) => {
    const clusterBox = await page.evaluate(() => {
      const r = document.querySelector('#mermaidOutput svg g.cluster rect');
      return r ? r.getBoundingClientRect() : null;
    });
    const cx = clusterBox.x + clusterBox.width / 2;
    const cy = clusterBox.y + clusterBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 70, cy + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const edgeCount = await page.evaluate(
      () => document.querySelectorAll('#mermaidOutput svg .edgePaths path').length
    );
    expect(edgeCount).toBeGreaterThan(0);
  });

  test('microservices reciprocal API/Auth edges stay separated after group drag', async ({ page }) => {
    await page.evaluate(() => loadTemplate('microservices'));
    await page.waitForFunction(
      () => parser.entities.has('APP_API_Gateway') &&
            parser.entities.has('APP_Auth_Service') &&
            document.querySelector('#mermaidOutput svg g.cluster'),
      { timeout: 8000 }
    );
    await page.waitForTimeout(700);

    const clusterBox = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const cluster = [...svg.querySelectorAll('g.cluster')]
        .find(c => (c.textContent || '').includes('Production'));
      const r = cluster?.querySelector('rect');
      return r ? r.getBoundingClientRect() : null;
    });
    expect(clusterBox).not.toBeNull();

    const cx = clusterBox.x + clusterBox.width / 2;
    const cy = clusterBox.y + clusterBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy + 40, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const pairEdges = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      return buildEdgeConnections(svg)
        .filter(c => {
          const ids = new Set([c.fromId, c.toId]);
          return ids.has('APP_API_Gateway') && ids.has('APP_Auth_Service');
        })
        .map(c => ({
          fromId: c.fromId,
          toId: c.toId,
          text: c.labelEl?.textContent.trim(),
          transform: c.labelEl?.getAttribute('transform'),
          d: c.path.getAttribute('d'),
        }));
    });

    const rest = pairEdges.find(e => e.fromId === 'APP_API_Gateway' && e.text === 'REST');
    const jwt = pairEdges.find(e => e.fromId === 'APP_Auth_Service' && e.text === 'JWT verify');
    expect(rest).toBeTruthy();
    expect(jwt).toBeTruthy();
    expect(rest.transform).not.toBe(jwt.transform);
    expect(rest.d).not.toBe(jwt.d);
  });

  test('dragging a parent domain keeps nested subdomains aligned with it', async ({ page }) => {
    await loadDiagram(page, NESTED_SUBDOMAIN_CODE);
    await page.waitForFunction(
      () => typeof findGroupCluster === 'function' &&
            findGroupCluster(document.querySelector('#mermaidOutput svg'), 'DOMAIN_Commerce') &&
            findGroupCluster(document.querySelector('#mermaidOutput svg'), 'SUBDOMAIN_Catalog'),
      { timeout: 8000 }
    );
    await page.waitForTimeout(500);

    const before = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const nodeTransform = (id) => meridianNodeGroup(svg, id)?.getAttribute('transform') || '';
      const subRect = findGroupCluster(svg, 'SUBDOMAIN_Catalog')?.querySelector('rect');
      const internalEdge = buildEdgeConnections(svg)
        .find(c => c.fromId === 'APP_Catalog_API' && c.toId === 'DB_Catalog_DB');
      return {
        checkout: nodeTransform('APP_Checkout_API'),
        catalog: nodeTransform('APP_Catalog_API'),
        catalogDb: nodeTransform('DB_Catalog_DB'),
        subRectX: subRect?.getAttribute('x') || '',
        subRectY: subRect?.getAttribute('y') || '',
        internalEdgePath: internalEdge?.path?.getAttribute('d') || '',
      };
    });

    const dragPoint = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const cluster = findGroupCluster(svg, 'DOMAIN_Commerce');
      const rect = cluster?.querySelector('rect');
      const b = rect.getBoundingClientRect();
      for (const fy of [0.12, 0.88, 0.5, 0.25, 0.75]) {
        for (const fx of [0.12, 0.88, 0.5, 0.25, 0.75]) {
          const x = b.x + b.width * fx;
          const y = b.y + b.height * fy;
          if (document.elementFromPoint(x, y) === rect) return { x, y };
        }
      }
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });

    await page.mouse.move(dragPoint.x, dragPoint.y);
    await page.mouse.down();
    await page.mouse.move(dragPoint.x + 90, dragPoint.y + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const nodeTransform = (id) => meridianNodeGroup(svg, id)?.getAttribute('transform') || '';
      const subRect = findGroupCluster(svg, 'SUBDOMAIN_Catalog')?.querySelector('rect');
      const internalEdge = buildEdgeConnections(svg)
        .find(c => c.fromId === 'APP_Catalog_API' && c.toId === 'DB_Catalog_DB');
      return {
        checkout: nodeTransform('APP_Checkout_API'),
        catalog: nodeTransform('APP_Catalog_API'),
        catalogDb: nodeTransform('DB_Catalog_DB'),
        subRectX: subRect?.getAttribute('x') || '',
        subRectY: subRect?.getAttribute('y') || '',
        internalEdgePath: internalEdge?.path?.getAttribute('d') || '',
        nodePositions: JSON.parse(localStorage.getItem('meridian_nodepos_v1') || '{}'),
        groupSizes: JSON.parse(localStorage.getItem('meridian_groupsizes_v1') || '{}'),
      };
    });

    expect(after.checkout).not.toBe(before.checkout);
    expect(after.catalog).not.toBe(before.catalog);
    expect(after.catalogDb).not.toBe(before.catalogDb);
    expect(after.subRectX).not.toBe(before.subRectX);
    expect(after.subRectY).not.toBe(before.subRectY);
    expect(after.internalEdgePath).not.toBe(before.internalEdgePath);
    expect(after.nodePositions.APP_Checkout_API).toBeTruthy();
    expect(after.nodePositions.APP_Catalog_API).toBeTruthy();
    expect(after.nodePositions.DB_Catalog_DB).toBeTruthy();
    expect(after.groupSizes.DOMAIN_Commerce?.gDx).toBeTruthy();
    expect(after.groupSizes.SUBDOMAIN_Catalog?.gDx).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  2 — Canvas annotation labels
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Canvas annotation labels', () => {
  test.beforeEach(async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, SIMPLE_CODE);
  });

  test('"Add Label" button is present in the toolbar', async ({ page }) => {
    const btn = await page.evaluate(() => !!document.getElementById('addLabelBtn'));
    expect(btn).toBe(true);
  });

  test('clicking Add Label button enters add-label mode', async ({ page }) => {
    await page.click('#addLabelBtn');
    const active = await page.evaluate(() =>
      document.getElementById('addLabelBtn')?.classList.contains('active')
    );
    expect(active).toBe(true);
    const cursorMode = await page.evaluate(() =>
      document.getElementById('zoomWrapper')?.classList.contains('label-add-mode')
    );
    expect(cursorMode).toBe(true);
    // Exit mode
    await page.keyboard.press('Escape');
  });

  test('Escape exits add-label mode', async ({ page }) => {
    await page.click('#addLabelBtn');
    await page.keyboard.press('Escape');
    const active = await page.evaluate(() =>
      document.getElementById('addLabelBtn')?.classList.contains('active')
    );
    expect(active).toBe(false);
  });

  test('_placeLabelAt creates a label in the SVG', async ({ page }) => {
    const svgBox = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      return svg ? svg.getBoundingClientRect() : null;
    });
    expect(svgBox).not.toBeNull();

    await page.evaluate(() => {
      // Place directly via API to avoid textarea blur issues in headless
      _placeLabelAt(100, 100);
      // Close editor if open
      const ed = document.getElementById('meridian-label-editor');
      if (ed) ed.blur();
    });
    await page.waitForTimeout(400);

    const count = await page.evaluate(() =>
      document.querySelectorAll('#mermaidOutput svg .meridian-canvas-label').length
    );
    expect(count).toBeGreaterThan(0);
  });

  test('placed label is saved to localStorage', async ({ page }) => {
    await page.evaluate(() => {
      canvasLabelLoad();
      _canvasLabels.push({ id: 999, text: 'Test Label', x: 50, y: 50 });
      canvasLabelSave();
    });

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_canvas_labels_v1') || '[]')
    );
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.find(l => l.id === 999)?.text).toBe('Test Label');
  });

  test('applyCanvasLabels renders stored labels into SVG', async ({ page }) => {
    await page.evaluate(() => {
      canvasLabelLoad();
      _canvasLabels.push({ id: 42, text: 'Hello', x: 80, y: 80 });
      canvasLabelSave();
      const svg = document.querySelector('#mermaidOutput svg');
      if (svg) applyCanvasLabels(svg);
    });

    const count = await page.evaluate(() =>
      document.querySelectorAll('#mermaidOutput svg .meridian-canvas-label').length
    );
    expect(count).toBeGreaterThan(0);
  });

  test('canvas labels survive a re-render (reset layout click)', async ({ page }) => {
    await page.evaluate(() => {
      canvasLabelLoad();
      _canvasLabels.push({ id: 77, text: 'Sticky', x: 100, y: 100 });
      canvasLabelSave();
    });

    await page.click('#resetPosBtn');
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg') !== null,
      { timeout: 8000 }
    );
    await page.waitForTimeout(600);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_canvas_labels_v1') || '[]')
    );
    expect(stored.find(l => l.id === 77)?.text).toBe('Sticky');

    const rendered = await page.evaluate(() =>
      document.querySelectorAll('#mermaidOutput svg .meridian-canvas-label').length
    );
    expect(rendered).toBeGreaterThan(0);
  });

  test('deleting a label removes it from SVG and localStorage', async ({ page }) => {
    await page.evaluate(() => {
      canvasLabelLoad();
      _canvasLabels.push({ id: 55, text: 'Delete Me', x: 120, y: 120 });
      canvasLabelSave();
      const svg = document.querySelector('#mermaidOutput svg');
      if (svg) applyCanvasLabels(svg);
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      const del = document.querySelector(
        '#mermaidOutput svg .meridian-canvas-label[data-label-id="55"] .meridian-label-delete'
      );
      if (del) del.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(200);

    const inDom = await page.evaluate(() =>
      document.querySelectorAll('#mermaidOutput svg .meridian-canvas-label[data-label-id="55"]').length
    );
    expect(inDom).toBe(0);

    const inStorage = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_canvas_labels_v1') || '[]').find(l => l.id === 55)
    );
    expect(inStorage).toBeUndefined();
  });

  test('dragging a label updates its position in localStorage', async ({ page }) => {
    await page.evaluate(() => {
      canvasLabelLoad();
      _canvasLabels.push({ id: 33, text: 'Drag Me', x: 50, y: 50 });
      canvasLabelSave();
      const svg = document.querySelector('#mermaidOutput svg');
      if (svg) applyCanvasLabels(svg);
    });
    await page.waitForTimeout(200);

    const labelBox = await page.evaluate(() => {
      const g = document.querySelector(
        '#mermaidOutput svg .meridian-canvas-label[data-label-id="33"] rect'
      );
      return g ? g.getBoundingClientRect() : null;
    });
    expect(labelBox).not.toBeNull();

    const cx = labelBox.x + labelBox.width / 2;
    const cy = labelBox.y + labelBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_canvas_labels_v1') || '[]').find(l => l.id === 33)
    );
    expect(stored).toBeDefined();
    // Position should have changed from original (50, 50)
    expect(Math.abs(stored.x - 50) + Math.abs(stored.y - 50)).toBeGreaterThan(5);
  });

  test('canvas labels are included in project export bundle', async ({ page }) => {
    await page.evaluate(() => {
      canvasLabelLoad();
      _canvasLabels.push({ id: 11, text: 'Export Test', x: 200, y: 200 });
      canvasLabelSave();
    });

    const bundle = await page.evaluate(() => currentProjectBundle());
    expect(Array.isArray(bundle.canvasLabels)).toBe(true);
    expect(bundle.canvasLabels.find(l => l.id === 11)?.text).toBe('Export Test');
  });

  test('Shift+click Reset Layout clears canvas labels', async ({ page }) => {
    await page.evaluate(() => {
      canvasLabelLoad();
      _canvasLabels.push({ id: 22, text: 'Clear Me', x: 100, y: 100 });
      canvasLabelSave();
    });

    await page.click('#resetPosBtn', { modifiers: ['Shift'] });
    await page.waitForTimeout(400);

    const stored = await page.evaluate(() =>
      localStorage.getItem('meridian_canvas_labels_v1')
    );
    expect(stored).toBeNull();
  });
});
