// @ts-check
const { test, expect } = require('@playwright/test');

// ── Shared helpers ─────────────────────────────────────────────────────────────

const DOMAIN_CODE = `
app:Frontend
db:Database
app:API
app:Frontend --> app:API
app:API --> db:Database

domain:WebLayer {
  app:Frontend
  app:API
}
`;

const COLUMN_DOMAIN_CODE = `
app:Frontend
app:API
app:Worker
db:Database
app:Frontend --> app:API
app:API --> app:Worker
app:Worker --> db:Database

domain:WebLayer {
  app:Frontend
  app:API
  app:Worker
  db:Database
}
`;

const NESTED_DOMAIN_CODE = `
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

const MULTI_NODE_CODE = `
app:ServiceA
app:ServiceB
db:Postgres
app:ServiceA --> db:Postgres
app:ServiceB --> db:Postgres
`;

const TYPE_SCOPED_LAYOUT_PROJECT = {
  format: 'meridian.project',
  version: 2,
  input: `domain:test{
  app:test1
  db:test2
  document:test3
  subdomain:test4{
    app:test5
    db:test6
    document:test7
}
app:test5 --> db:test6
db:test6 --> document:test7`,
  type: 'TD',
  theme: 'default',
  settings: {},
  layout: { split: '45%', zoom: 0.62 },
  nodePositions: {
    APP_test1: { dx: 408.8708771972713, dy: -211.19278156525672 },
    DB_test2: { dx: 408.8708771972713, dy: -249.61910290386976 },
    DOCUMENT_test3: { dx: 408.8708771972713, dy: -284.81555739859186 },
    APP_test5: { dx: -4.803620796062603, dy: -32.93650724099942 },
    DB_test6: { dx: -6.416535835125103, dy: -105.25410615844214 },
    DOCUMENT_test7: { dx: -9.642335395671978, dy: -158.2128099116814 },
  },
  groupSizes: {
    DOMAIN_test: { dw: 811.2902773437613, dh: -285.4838550493952, gDx: 3.225738525390625, gDy: -17.741943359375 },
    SUBDOMAIN_test4: { dw: 0, dh: 0, gDx: -8.064498901367188, gDy: -22.58062744140625 },
  },
  groupLayouts: {},
  entityColors: {},
  groupColors: {},
  canvasLabels: [],
  customIcons: [],
};

async function waitReady(page, clearStorage = true) {
  if (clearStorage) await page.addInitScript(() => localStorage.clear());
  await page.goto('http://localhost:4321/meridian.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
    { timeout: 15000 }
  );
}

async function loadDiagram(page, code) {
  await page.evaluate((src) => {
    $input.value = src;
    onInput();
  }, code);
  await page.waitForFunction(
    () => document.querySelector('#mermaidOutput svg') !== null,
    { timeout: 10000 }
  );
  // Allow any animations/post-render hooks to settle
  await page.waitForTimeout(600);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  1 — Domain / subdomain resize handles
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Diagram type scoped manual layout', () => {
  test('switching LR/TD does not apply imported TD offsets to LR', async ({ page }) => {
    await waitReady(page);
    await page.evaluate((bundle) => applyProjectBundle(bundle), TYPE_SCOPED_LAYOUT_PROJECT);
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg g.cluster') !== null,
      { timeout: 10000 }
    );
    await page.waitForTimeout(700);

    const td = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const domainRect = findGroupCluster(svg, 'DOMAIN_test')?.querySelector('rect');
      return {
        active: _activeLayoutType,
        positions: Object.keys(_nodePositions),
        sizes: Object.keys(_groupSizes),
        domainHeight: Number(domainRect?.getAttribute('height') || 0),
      };
    });
    expect(td.active).toBe('TD');
    expect(td.positions.length).toBeGreaterThan(0);
    expect(td.sizes).toContain('DOMAIN_test');

    await page.selectOption('#diagramType', 'LR');
    await page.waitForTimeout(900);
    const lr = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const domainRect = findGroupCluster(svg, 'DOMAIN_test')?.querySelector('rect');
      const nodes = meridianNodeGroups(svg).map(({ el }) => {
        const tm = (el.getAttribute('transform') || '').match(/translate\(\s*([+-]?[\d.eE+-]+)[, \t]+([+-]?[\d.eE+-]+)\s*\)/);
        return tm ? { y: Number(tm[2]) } : null;
      }).filter(Boolean);
      return {
        active: _activeLayoutType,
        positions: Object.keys(_nodePositions),
        sizes: Object.keys(_groupSizes),
        domainY: Number(domainRect?.getAttribute('y') || 0),
        domainHeight: Number(domainRect?.getAttribute('height') || 0),
        minNodeY: Math.min(...nodes.map(n => n.y)),
      };
    });
    expect(lr.active).toBe('LR');
    expect(lr.positions).toEqual([]);
    expect(lr.sizes).toEqual([]);
    expect(lr.domainHeight).toBeGreaterThan(80);
    expect(lr.minNodeY).toBeGreaterThan(lr.domainY);

    await page.selectOption('#diagramType', 'TD');
    await page.waitForTimeout(900);
    const tdAgain = await page.evaluate(() => ({
      active: _activeLayoutType,
      positions: Object.keys(_nodePositions),
      sizes: Object.keys(_groupSizes),
    }));
    expect(tdAgain.active).toBe('TD');
    expect(tdAgain.positions.length).toBeGreaterThan(0);
    expect(tdAgain.sizes).toContain('DOMAIN_test');
  });
});

test.describe('Domain/subdomain resize handles', () => {
  test.beforeEach(async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, DOMAIN_CODE);
    // Wait for cluster and resize handle to appear
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg g.cluster') !== null,
      { timeout: 8000 }
    );
  });

  test('resize handle is present on each domain cluster', async ({ page }) => {
    const count = await page.evaluate(() =>
      document.querySelectorAll('#mermaidOutput svg .meridian-cluster-resize-handle').length
    );
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('resize handle has data-group-id matching a domain entity', async ({ page }) => {
    const gid = await page.evaluate(() => {
      const h = document.querySelector('#mermaidOutput svg .meridian-cluster-resize-handle');
      return h ? h.getAttribute('data-group-id') : null;
    });
    expect(gid).toBeTruthy();
  });

  test('dragging resize handle increases the cluster rect size', async ({ page }) => {
    // Get the handle position and initial cluster rect dimensions
    const before = await page.evaluate(() => {
      const svg   = document.querySelector('#mermaidOutput svg');
      const cluster = svg.querySelector('g.cluster');
      const rect    = cluster.querySelector('rect');
      return {
        w: parseFloat(rect.getAttribute('width')),
        h: parseFloat(rect.getAttribute('height')),
      };
    });

    const handleBox = await page.evaluate(() => {
      const h = document.querySelector('#mermaidOutput svg .meridian-cluster-resize-handle rect');
      if (!h) return null;
      return h.getBoundingClientRect();
    });
    expect(handleBox).not.toBeNull();

    // Drag the handle 60px right and 40px down
    const cx = handleBox.x + handleBox.width  / 2;
    const cy = handleBox.y + handleBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => {
      const svg     = document.querySelector('#mermaidOutput svg');
      const cluster = svg.querySelector('g.cluster');
      const rect    = cluster.querySelector('rect');
      return {
        w: parseFloat(rect.getAttribute('width')),
        h: parseFloat(rect.getAttribute('height')),
      };
    });

    expect(after.w).toBeGreaterThan(before.w);
    expect(after.h).toBeGreaterThan(before.h);
  });

  test('resize delta is persisted to localStorage after drag', async ({ page }) => {
    const handleBox = await page.evaluate(() => {
      const h = document.querySelector('#mermaidOutput svg .meridian-cluster-resize-handle rect');
      return h ? h.getBoundingClientRect() : null;
    });
    expect(handleBox).not.toBeNull();

    const cx = handleBox.x + handleBox.width  / 2;
    const cy = handleBox.y + handleBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 50, cy + 30, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('meridian_groupsizes_v1');
      return raw ? JSON.parse(raw) : {};
    });
    const keys = Object.keys(stored);
    expect(keys.length).toBeGreaterThan(0);
    const first = stored[keys[0]];
    expect(first.dw).toBeGreaterThan(0);
    expect(first.dh).toBeGreaterThan(0);
  });

  test('resize survives a re-render (layout refresh)', async ({ page }) => {
    const handleBox = await page.evaluate(() => {
      const h = document.querySelector('#mermaidOutput svg .meridian-cluster-resize-handle rect');
      return h ? h.getBoundingClientRect() : null;
    });
    expect(handleBox).not.toBeNull();

    const cx = handleBox.x + handleBox.width  / 2;
    const cy = handleBox.y + handleBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const wAfterDrag = await page.evaluate(() => {
      const rect = document.querySelector('#mermaidOutput svg g.cluster rect');
      return parseFloat(rect.getAttribute('width'));
    });

    // Click reset layout (no shift — should preserve sizes)
    await page.click('#resetPosBtn');
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg') !== null,
      { timeout: 8000 }
    );
    await page.waitForTimeout(600);

    const wAfterReset = await page.evaluate(() => {
      const rect = document.querySelector('#mermaidOutput svg g.cluster rect');
      return parseFloat(rect.getAttribute('width'));
    });

    expect(wAfterReset).toBeGreaterThan(wAfterDrag - 5); // within rounding
  });

  test('resizing a parent domain keeps nested subdomain entities inside the subdomain', async ({ page }) => {
    await loadDiagram(page, NESTED_DOMAIN_CODE);
    await page.waitForFunction(
      () => typeof findGroupCluster === 'function' &&
            findGroupCluster(document.querySelector('#mermaidOutput svg'), 'DOMAIN_Commerce') &&
            findGroupCluster(document.querySelector('#mermaidOutput svg'), 'SUBDOMAIN_Catalog'),
      { timeout: 8000 }
    );

    const before = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const subRect = findGroupCluster(svg, 'SUBDOMAIN_Catalog')?.querySelector('rect');
      return {
        x: Number(subRect?.getAttribute('x') || 0),
        y: Number(subRect?.getAttribute('y') || 0),
        w: Number(subRect?.getAttribute('width') || 0),
        h: Number(subRect?.getAttribute('height') || 0),
      };
    });

    const handleBox = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const domain = findGroupCluster(svg, 'DOMAIN_Commerce');
      const h = domain?.querySelector('.meridian-cluster-resize-handle rect');
      return h ? h.getBoundingClientRect() : null;
    });
    expect(handleBox).not.toBeNull();

    const cx = handleBox.x + handleBox.width / 2;
    const cy = handleBox.y + handleBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 140, cy + 100, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const subRect = findGroupCluster(svg, 'SUBDOMAIN_Catalog')?.querySelector('rect');
      const box = {
        x: Number(subRect?.getAttribute('x') || 0),
        y: Number(subRect?.getAttribute('y') || 0),
        w: Number(subRect?.getAttribute('width') || 0),
        h: Number(subRect?.getAttribute('height') || 0),
      };
      const nodes = ['APP_Catalog_API', 'DB_Catalog_DB'].map(id => {
        const pos = readNodeCenter(meridianNodeGroup(svg, id));
        return { id, inside: pos && pos.cx >= box.x && pos.cx <= box.x + box.w && pos.cy >= box.y && pos.cy <= box.y + box.h };
      });
      return {
        box,
        nodes,
        groupSizes: JSON.parse(localStorage.getItem('meridian_groupsizes_v1') || '{}'),
      };
    });

    expect(after.box.w).toBeGreaterThan(before.w);
    expect(after.box.h).toBeGreaterThan(before.h);
    expect(after.nodes.every(n => n.inside)).toBe(true);
    expect(after.groupSizes.DOMAIN_Commerce?.dw).toBeGreaterThan(0);
    expect(after.groupSizes.SUBDOMAIN_Catalog?.dw).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  2 — Entity position persistence after Reset Layout
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Domain/subdomain column fitting', () => {
  test.beforeEach(async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, COLUMN_DOMAIN_CODE);
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg g.cluster') !== null,
      { timeout: 8000 }
    );
  });

  test('group context panel exposes column layout controls', async ({ page }) => {
    const visible = await page.evaluate(() => {
      const gid = [...parser.domains.keys()][0];
      showGroupCtx(gid, 220, 220);
      return !!document.querySelector('#gcpColumnBtns [data-cols="2"]') &&
        !!document.getElementById('gcpColumnClear');
    });
    expect(visible).toBe(true);
  });

  test('selecting two columns aligns entities and persists layout state', async ({ page }) => {
    const state = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const gid = [...parser.domains.keys()][0];
      showGroupCtx(gid, 220, 220);
      document.querySelector('#gcpColumnBtns [data-cols="2"]').click();
      const ids = groupColumnLayoutEntityIds(parser, gid);
      const positions = ids.map(id => {
        const pos = readNodeCenter(meridianNodeGroup(svg, id));
        return { id, x: Math.round(pos.cx), y: Math.round(pos.cy) };
      });
      return {
        layout: JSON.parse(localStorage.getItem('meridian_grouplayouts_v1') || '{}')[gid],
        nodePositionCount: Object.keys(JSON.parse(localStorage.getItem('meridian_nodepos_v1') || '{}')).length,
        positions,
      };
    });

    expect(state.layout.columns).toBe(2);
    expect(state.nodePositionCount).toBeGreaterThanOrEqual(4);
    const uniqueXs = new Set(state.positions.map(p => p.x));
    expect(uniqueXs.size).toBe(2);
  });

  test('resizing an active column layout reflows entities inside the cluster', async ({ page }) => {
    await page.evaluate(() => {
      const gid = [...parser.domains.keys()][0];
      showGroupCtx(gid, 220, 220);
      document.querySelector('#gcpColumnBtns [data-cols="2"]').click();
    });
    await page.waitForTimeout(200);

    const before = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const gid = [...parser.domains.keys()][0];
      return groupColumnLayoutEntityIds(parser, gid).map(id => readNodeCenter(meridianNodeGroup(svg, id)));
    });

    const handleBox = await page.evaluate(() => {
      const h = document.querySelector('#mermaidOutput svg .meridian-cluster-resize-handle rect');
      return h ? h.getBoundingClientRect() : null;
    });
    expect(handleBox).not.toBeNull();

    const cx = handleBox.x + handleBox.width / 2;
    const cy = handleBox.y + handleBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 90, cy + 70, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const gid = [...parser.domains.keys()][0];
      const cluster = [...svg.querySelectorAll('g.cluster')].find(c => resolveClusterGroupId(c) === gid);
      const rect = cluster.querySelector('rect');
      const bounds = {
        x: parseFloat(rect.getAttribute('x')),
        y: parseFloat(rect.getAttribute('y')),
        w: parseFloat(rect.getAttribute('width')),
        h: parseFloat(rect.getAttribute('height')),
      };
      const positions = groupColumnLayoutEntityIds(parser, gid).map(id => {
        const pos = readNodeCenter(meridianNodeGroup(svg, id));
        return { id, x: Math.round(pos.cx), y: Math.round(pos.cy) };
      });
      return { bounds, positions };
    });

    const moved = after.positions.some((p, i) =>
      Math.abs(p.x - before[i].cx) + Math.abs(p.y - before[i].cy) > 5
    );
    expect(moved).toBe(true);
    expect(new Set(after.positions.map(p => p.x)).size).toBe(2);
    for (const p of after.positions) {
      expect(p.x).toBeGreaterThan(after.bounds.x);
      expect(p.x).toBeLessThan(after.bounds.x + after.bounds.w);
      expect(p.y).toBeGreaterThan(after.bounds.y);
      expect(p.y).toBeLessThan(after.bounds.y + after.bounds.h);
    }
  });
});

test.describe('Entity position persistence after reset layout', () => {
  test.beforeEach(async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, MULTI_NODE_CODE);
  });

  test('dragged node position is stored in localStorage', async ({ page }) => {
    // Find a draggable node
    const nodeBox = await page.evaluate(() => {
      const g = document.querySelector('#mermaidOutput svg g.node');
      return g ? g.getBoundingClientRect() : null;
    });
    expect(nodeBox).not.toBeNull();

    const cx = nodeBox.x + nodeBox.width  / 2;
    const cy = nodeBox.y + nodeBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('meridian_nodepos_v1');
      return raw ? JSON.parse(raw) : {};
    });
    expect(Object.keys(stored).length).toBeGreaterThan(0);
  });

  test('Reset Layout (click) preserves node positions in localStorage', async ({ page }) => {
    const nodeBox = await page.evaluate(() => {
      const g = document.querySelector('#mermaidOutput svg g.node');
      return g ? g.getBoundingClientRect() : null;
    });
    const cx = nodeBox.x + nodeBox.width  / 2;
    const cy = nodeBox.y + nodeBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const storedBefore = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_nodepos_v1') || '{}')
    );
    expect(Object.keys(storedBefore).length).toBeGreaterThan(0);

    // Click reset (NOT shift+click) — positions must be retained
    await page.click('#resetPosBtn');
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg') !== null,
      { timeout: 8000 }
    );
    await page.waitForTimeout(400);

    const storedAfter = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_nodepos_v1') || '{}')
    );
    expect(Object.keys(storedAfter).length).toBeGreaterThan(0);
    // The same entity IDs should still be present
    const beforeKeys = Object.keys(storedBefore);
    const afterKeys  = Object.keys(storedAfter);
    expect(afterKeys.some(k => beforeKeys.includes(k))).toBe(true);
  });

  test('Shift+click Reset Layout clears all positions', async ({ page }) => {
    const nodeBox = await page.evaluate(() => {
      const g = document.querySelector('#mermaidOutput svg g.node');
      return g ? g.getBoundingClientRect() : null;
    });
    const cx = nodeBox.x + nodeBox.width  / 2;
    const cy = nodeBox.y + nodeBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await page.click('#resetPosBtn', { modifiers: ['Shift'] });
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg') !== null,
      { timeout: 8000 }
    );
    await page.waitForTimeout(400);

    const stored = await page.evaluate(() =>
      localStorage.getItem('meridian_nodepos_v1')
    );
    expect(stored).toBeNull();
  });

  test('node positions are re-applied after reset layout (edges stay connected)', async ({ page }) => {
    // Drag a node substantially
    const nodeBox = await page.evaluate(() => {
      const g = document.querySelector('#mermaidOutput svg g.node');
      return g ? g.getBoundingClientRect() : null;
    });
    const cx = nodeBox.x + nodeBox.width  / 2;
    const cy = nodeBox.y + nodeBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Click reset (keeps positions)
    await page.click('#resetPosBtn');
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg') !== null,
      { timeout: 8000 }
    );
    await page.waitForTimeout(600);

    // Edges should still be present after re-render
    const edgeCount = await page.evaluate(
      () => document.querySelectorAll('#mermaidOutput svg .edgePaths path').length
    );
    expect(edgeCount).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  3 — Custom entity colors
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Custom entity colors', () => {
  test.beforeEach(async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, MULTI_NODE_CODE);
  });

  test('color picker row is present in the node context panel', async ({ page }) => {
    const visible = await page.evaluate(
      () => document.getElementById('ncpColorPicker') !== null &&
            document.getElementById('ncpColorClearBtn') !== null
    );
    expect(visible).toBe(true);
  });

  test('setting a custom color via JS stores it in localStorage', async ({ page }) => {
    await page.evaluate(() => {
      entityColorLoad();
      _entityColors['ServiceA'] = '#ff0000';
      entityColorSave();
    });

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_entitycolors_v1') || '{}')
    );
    expect(stored['ServiceA']).toBe('#ff0000');
  });

  test('applyEntityColors sets fill style on the node shape', async ({ page }) => {
    // Get the actual entity ID from the parser (IDs are prefixed, e.g. APP_ServiceA)
    const eid = await page.evaluate(() => [...parser.entities.keys()][0]);
    expect(eid).toBeTruthy();

    await page.evaluate((id) => {
      entityColorLoad();
      _entityColors[id] = '#ff0000';
      entityColorSave();
      const svg = document.querySelector('#mermaidOutput svg');
      if (svg) applyEntityColors(svg);
    }, eid);

    const fill = await page.evaluate((id) => {
      const svg   = document.querySelector('#mermaidOutput svg');
      const nodes = typeof meridianNodeGroups === 'function' ? meridianNodeGroups(svg) : [];
      const match = nodes.find(({ eid: e }) => e === id);
      if (!match) return null;
      const shape = match.el.querySelector(
        'rect.label-container, rect.basic, .label-container, rect, polygon, circle, ellipse, path'
      );
      return shape ? shape.style.fill : null;
    }, eid);
    expect(fill).toBeTruthy();
    expect(fill).toMatch(/rgb\(255,\s*0,\s*0\)|#ff0000/i);
  });

  test('custom color survives a re-render (reset layout click)', async ({ page }) => {
    const eid = await page.evaluate(() => [...parser.entities.keys()][0]);
    expect(eid).toBeTruthy();

    await page.evaluate((id) => {
      entityColorLoad();
      _entityColors[id] = '#00cc88';
      entityColorSave();
    }, eid);

    // Click reset (preserves everything)
    await page.click('#resetPosBtn');
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg') !== null,
      { timeout: 8000 }
    );
    await page.waitForTimeout(600);

    const stored = await page.evaluate((id) =>
      JSON.parse(localStorage.getItem('meridian_entitycolors_v1') || '{}')[id]
    , eid);
    expect(stored).toBe('#00cc88');

    // Also verify it's visually applied
    const fill = await page.evaluate((id) => {
      const svg   = document.querySelector('#mermaidOutput svg');
      const nodes = typeof meridianNodeGroups === 'function' ? meridianNodeGroups(svg) : [];
      const match = nodes.find(({ eid: e }) => e === id);
      if (!match) return null;
      const shape = match.el.querySelector(
        'rect.label-container, rect.basic, .label-container, rect, polygon, circle, ellipse, path'
      );
      return shape ? shape.style.fill : null;
    }, eid);
    expect(fill).toBeTruthy();
  });

  test('Shift+click Reset Layout clears entity colors', async ({ page }) => {
    await page.evaluate(() => {
      entityColorLoad();
      _entityColors['ServiceA'] = '#ff0000';
      entityColorSave();
    });

    await page.click('#resetPosBtn', { modifiers: ['Shift'] });
    await page.waitForTimeout(400);

    const stored = await page.evaluate(() =>
      localStorage.getItem('meridian_entitycolors_v1')
    );
    expect(stored).toBeNull();
  });

  test('ncpColorClearBtn removes color and re-renders', async ({ page }) => {
    // Get actual entity ID from parser
    const eid = await page.evaluate(() => [...parser.entities.keys()][0]);
    expect(eid).toBeTruthy();

    await page.evaluate((id) => {
      entityColorLoad();
      _entityColors[id] = '#ff0000';
      entityColorSave();
      // Simulate showing the node ctx panel using the real entity ID
      showNodeCtx(id, 200, 200);
    }, eid);

    await page.waitForFunction(
      () => document.getElementById('nodeCtxPanel')?.classList.contains('vis'),
      { timeout: 5000 }
    );

    // Clear button should be visible
    const clearVisible = await page.evaluate(
      () => document.getElementById('ncpColorClearBtn').style.display !== 'none'
    );
    expect(clearVisible).toBe(true);

    await page.click('#ncpColorClearBtn');
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg') !== null,
      { timeout: 8000 }
    );
    await page.waitForTimeout(400);

    const stored = await page.evaluate((id) =>
      JSON.parse(localStorage.getItem('meridian_entitycolors_v1') || '{}')[id]
    , eid);
    expect(stored).toBeUndefined();
  });

  test('custom colors are included in project export bundle', async ({ page }) => {
    await page.evaluate(() => {
      entityColorLoad();
      _entityColors['ServiceA'] = '#123456';
      entityColorSave();
    });

    const bundle = await page.evaluate(() => currentProjectBundle());
    expect(bundle.entityColors).toBeDefined();
    expect(bundle.entityColors['ServiceA']).toBe('#123456');
  });
});
