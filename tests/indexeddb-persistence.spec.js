// @ts-check
// IndexedDB persistence layer: write-through saves, boot-time hydration,
// and legacy localStorage → IndexedDB migration.
const { test, expect } = require('@playwright/test');

const SIMPLE_CODE = `
app:Alpha
app:Beta
db:Gamma
app:Alpha --> app:Beta
app:Beta --> db:Gamma
`;

async function gotoApp(page) {
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

async function dragNode(page, eid, dx, dy) {
  const box = await page.evaluate((id) => {
    const svg = document.querySelector('#mermaidOutput svg');
    const g = meridianNodeGroup(svg, id);
    const r = g.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, eid);
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + dx, box.y + dy, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

function idbGet(page, storeName, key) {
  return page.evaluate(({ storeName, key }) => new Promise((resolve) => {
    const req = indexedDB.open('meridian');
    req.onerror = () => resolve({ error: 'open failed' });
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) { db.close(); return resolve(null); }
      const get = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      get.onsuccess = () => { const r = get.result || null; db.close(); resolve(r); };
      get.onerror = () => { db.close(); resolve({ error: 'get failed' }); };
    };
  }), { storeName, key });
}

async function waitForIdbRecord(page, storeName, key, predicate = (r) => !!r) {
  for (let i = 0; i < 25; i++) {
    const rec = await idbGet(page, storeName, key);
    if (rec && !rec.error && predicate(rec)) return rec;
    await page.waitForTimeout(200);
  }
  return null;
}

test.describe('IndexedDB persistence', () => {
  test('node drag writes positions through to IndexedDB', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, SIMPLE_CODE);
    await dragNode(page, 'APP_Beta', 150, 100);

    const rec = await waitForIdbRecord(page, 'layout', 'nodePositions',
      r => r.value && r.value.APP_Beta);
    expect(rec, 'layout/nodePositions record should exist in IndexedDB').toBeTruthy();
    expect(Math.round(rec.value.APP_Beta.dx)).toBe(150);
    expect(Math.round(rec.value.APP_Beta.dy)).toBe(100);

    // matches the localStorage cache
    const ls = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_nodepos_v1') || '{}'));
    expect(rec.value).toEqual(ls);
  });

  test('document (nodes + links source) is saved to IndexedDB', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, SIMPLE_CODE);

    const rec = await waitForIdbRecord(page, 'documents', 'current',
      r => r.value && typeof r.value.input === 'string' && r.value.input.includes('app:Alpha'));
    expect(rec, 'documents/current record should exist in IndexedDB').toBeTruthy();
    expect(rec.value.input).toContain('app:Alpha --> app:Beta');
  });

  test('app state is restored from IndexedDB when localStorage is empty', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, SIMPLE_CODE);
    await dragNode(page, 'APP_Beta', 150, 100);

    // ensure both records reached IndexedDB
    await waitForIdbRecord(page, 'layout', 'nodePositions', r => r.value && r.value.APP_Beta);
    await waitForIdbRecord(page, 'documents', 'current',
      r => r.value && (r.value.input || '').includes('app:Alpha'));

    // wipe ONLY localStorage — IndexedDB survives
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 15000 }
    );

    // document restored from IndexedDB
    const input = await page.evaluate(() => $input.value);
    expect(input).toContain('app:Alpha --> app:Beta');

    // wait for render, then check Beta sits at its dragged position
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg') !== null,
      { timeout: 10000 }
    );
    await page.waitForTimeout(600);
    const beta = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const g = meridianNodeGroup(svg, 'APP_Beta');
      const tm = (g.getAttribute('transform') || '').match(/translate\(\s*([\d.eE+-]+)[, \t]+([\d.eE+-]+)\s*\)/);
      return tm ? { cx: +tm[1], cy: +tm[2] } : null;
    });
    expect(beta).toBeTruthy();
    expect(beta.cx).toBeGreaterThan(350); // auto-layout ≈ 274 + dragged 150

    // localStorage cache was re-hydrated from IndexedDB
    const lsPos = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_nodepos_v1') || '{}'));
    expect(lsPos.APP_Beta).toBeTruthy();
  });

  test('legacy localStorage-only data migrates into IndexedDB on boot', async ({ page }) => {
    await gotoApp(page);
    // simulate a pre-IndexedDB install: clear IDB, seed only localStorage
    await page.evaluate(() => new Promise((resolve) => {
      const del = indexedDB.deleteDatabase('meridian');
      del.onsuccess = del.onerror = del.onblocked = () => resolve();
    }));
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('meridian_nodepos_v1', JSON.stringify({ APP_Legacy: { dx: 33, dy: 44 } }));
      localStorage.setItem('smartMermaid_v2', JSON.stringify({ input: 'app:Legacy', type: 'LR' }));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 15000 }
    );

    const pos = await waitForIdbRecord(page, 'layout', 'nodePositions',
      r => r.value && r.value.APP_Legacy);
    expect(pos, 'legacy positions should be migrated into IndexedDB').toBeTruthy();
    expect(pos.value.APP_Legacy).toEqual({ dx: 33, dy: 44 });

    const doc = await waitForIdbRecord(page, 'documents', 'current',
      r => r.value && r.value.input === 'app:Legacy');
    expect(doc, 'legacy document should be migrated into IndexedDB').toBeTruthy();
  });

  test('clearing all positions also clears the IndexedDB record', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, SIMPLE_CODE);
    await dragNode(page, 'APP_Beta', 150, 100);
    await waitForIdbRecord(page, 'layout', 'nodePositions', r => r.value && r.value.APP_Beta);

    // Shift+click Reset Layout = clear everything
    await page.click('#resetPosBtn', { modifiers: ['Shift'] });
    await page.waitForTimeout(800);

    const rec = await idbGet(page, 'layout', 'nodePositions');
    expect(rec).toBeNull();
  });

  test('group drag writes node positions AND group offsets to IndexedDB', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, `
app:Frontend
app:API
db:Database
app:Frontend --> app:API
app:API --> db:Database

domain:WebLayer {
  app:Frontend
  app:API
}
`);
    await page.waitForFunction(
      () => document.querySelector('#mermaidOutput svg g.cluster') !== null,
      { timeout: 8000 }
    );
    // Find a point where the cluster rect itself is the hit target (the rect
    // centre can be covered by child nodes or edge paths)
    const box = await page.evaluate(() => {
      const rect = document.querySelector('#mermaidOutput svg g.cluster rect');
      const b = rect.getBoundingClientRect();
      for (const fy of [0.9, 0.1, 0.5, 0.75, 0.25]) {
        for (const fx of [0.5, 0.25, 0.75, 0.1, 0.9]) {
          const x = b.x + b.width * fx, y = b.y + b.height * fy;
          if (document.elementFromPoint(x, y) === rect) return { x, y };
        }
      }
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + 80, box.y + 60, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const pos = await waitForIdbRecord(page, 'layout', 'nodePositions',
      r => r.value && Object.keys(r.value).length > 0);
    expect(pos, 'group drag should persist child node offsets to IndexedDB').toBeTruthy();

    const sizes = await waitForIdbRecord(page, 'layout', 'groupSizes',
      r => r.value && Object.values(r.value).some(s => s.gDx || s.gDy));
    expect(sizes, 'group drag should persist cluster offsets (gDx/gDy) to IndexedDB').toBeTruthy();
  });

  test('canvas label changes reach IndexedDB', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, SIMPLE_CODE);
    await page.evaluate(() => {
      canvasLabelLoad();
      _canvasLabels.push({ id: 7, text: 'IDB label', x: 60, y: 60 });
      canvasLabelSave();
    });

    const rec = await waitForIdbRecord(page, 'layout', 'canvasLabels',
      r => Array.isArray(r.value) && r.value.some(l => l.id === 7));
    expect(rec, 'canvas labels should be written through to IndexedDB').toBeTruthy();
  });

  test('newer localStorage value is NOT clobbered by a stale IndexedDB copy', async ({ page }) => {
    await gotoApp(page);
    // Seed a stale IndexedDB record and a fresher localStorage value
    await page.evaluate(() => new Promise((resolve) => {
      const req = indexedDB.open('meridian');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('layout', 'readwrite');
        tx.objectStore('layout').put({
          key: 'nodePositions',
          value: { APP_Stale: { dx: 1, dy: 1 } },
          updatedAt: Date.now() - 60000,
        });
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    }));
    await page.evaluate(() => {
      localStorage.setItem('meridian_nodepos_v1',
        JSON.stringify({ APP_Fresh: { dx: 99, dy: 88 } }));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 15000 }
    );

    // localStorage kept its fresher value…
    const ls = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('meridian_nodepos_v1') || '{}'));
    expect(ls.APP_Fresh).toEqual({ dx: 99, dy: 88 });
    expect(ls.APP_Stale).toBeUndefined();

    // …and IndexedDB was backfilled from it
    const rec = await waitForIdbRecord(page, 'layout', 'nodePositions',
      r => r.value && r.value.APP_Fresh);
    expect(rec, 'IndexedDB should be backfilled from the fresher localStorage value').toBeTruthy();
    expect(rec.value.APP_Fresh).toEqual({ dx: 99, dy: 88 });
  });
});

test.describe('Settings → Storage panel', () => {
  async function openStorageTab(page) {
    await page.click('#settingsBtn');
    await page.click('.stt-tab[data-stt="storage"]');
    await page.waitForTimeout(300);
  }

  test('storage tab shows IndexedDB backend info and record counts', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, SIMPLE_CODE);
    await dragNode(page, 'APP_Beta', 100, 60);
    await waitForIdbRecord(page, 'layout', 'nodePositions', r => r.value && r.value.APP_Beta);

    await openStorageTab(page);
    const backend = await page.textContent('#storageBackendInfo');
    expect(backend).toContain('IndexedDB');
    const records = await page.textContent('#storageRecordInfo');
    expect(records).toMatch(/record/);
    expect(records).toMatch(/layout: [1-9]/);
  });

  test('Clear layout & styles removes layout records but keeps the diagram', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, SIMPLE_CODE);
    await dragNode(page, 'APP_Beta', 100, 60);
    await waitForIdbRecord(page, 'layout', 'nodePositions', r => r.value && r.value.APP_Beta);
    await waitForIdbRecord(page, 'documents', 'current',
      r => r.value && (r.value.input || '').includes('app:Alpha'));

    await openStorageTab(page);
    await page.click('#storageClearLayoutBtn');
    await page.waitForTimeout(800);

    const pos = await idbGet(page, 'layout', 'nodePositions');
    expect(pos).toBeNull();
    const lsPos = await page.evaluate(() => localStorage.getItem('meridian_nodepos_v1'));
    expect(lsPos).toBeNull();

    // diagram text survives in both tiers
    const doc = await idbGet(page, 'documents', 'current');
    expect(doc && doc.value && doc.value.input).toContain('app:Alpha');
    const input = await page.evaluate(() => $input.value);
    expect(input).toContain('app:Alpha --> app:Beta');
  });

  test('Erase all saved data wipes IndexedDB + localStorage and loads default template', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, SIMPLE_CODE);
    await dragNode(page, 'APP_Beta', 100, 60);
    await waitForIdbRecord(page, 'documents', 'current',
      r => r.value && (r.value.input || '').includes('app:Alpha'));

    await openStorageTab(page);
    page.once('dialog', d => d.accept());
    await page.click('#storageEraseAllBtn');
    await page.waitForTimeout(1000);

    // diagram document gone from IndexedDB store contents (a fresh autosave of
    // the default template may already exist — it must not contain app:Alpha)
    const doc = await idbGet(page, 'documents', 'current');
    if (doc) expect(doc.value.input).not.toContain('app:Alpha');
    const pos = await idbGet(page, 'layout', 'nodePositions');
    expect(pos).toBeNull();

    // default template loaded into the editor
    const input = await page.evaluate(() => $input.value);
    expect(input).toContain('API_Gateway');
    expect(input).not.toContain('app:Alpha --> app:Beta');
  });

  test('cancelling the erase-all confirm leaves data intact', async ({ page }) => {
    await gotoApp(page);
    await loadDiagram(page, SIMPLE_CODE);
    await dragNode(page, 'APP_Beta', 100, 60);
    await waitForIdbRecord(page, 'layout', 'nodePositions', r => r.value && r.value.APP_Beta);

    await openStorageTab(page);
    page.once('dialog', d => d.dismiss());
    await page.click('#storageEraseAllBtn');
    await page.waitForTimeout(500);

    const pos = await idbGet(page, 'layout', 'nodePositions');
    expect(pos && pos.value && pos.value.APP_Beta).toBeTruthy();
    const input = await page.evaluate(() => $input.value);
    expect(input).toContain('app:Alpha --> app:Beta');
  });
});
