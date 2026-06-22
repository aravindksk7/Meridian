// @ts-check
// Regression tests for the node-drag arrow glitch:
// after dragging a node, redrawn edges must terminate ON the node's boundary
// (not at its centre, where the arrowhead is hidden beneath the node shape).
const { test, expect } = require('@playwright/test');

const SIMPLE_CODE = `
app:Alpha
app:Beta
db:Gamma
app:Alpha --> app:Beta
app:Beta --> db:Gamma
`;

const PARALLEL_CODE = `
app:API
app:Auth
app:API --> app:Auth : REST
app:Auth --> app:API : JWT
`;

async function waitReady(page) {
  await page.addInitScript(() => localStorage.clear());
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

// For every edge path, classify each endpoint against every node bbox
// (in SVG-root coordinates). Returns endpoints strictly INSIDE a node's
// interior (≥6px from every border edge) — i.e. buried arrowheads.
async function buriedEndpoints(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('#mermaidOutput svg');
    const rects = meridianNodeGroups(svg).map(({ el, eid }) => {
      const tm = (el.getAttribute('transform') || '').match(/translate\(\s*([\d.eE+-]+)[, \t]+([\d.eE+-]+)\s*\)/);
      if (!tm) return null;
      const cx = parseFloat(tm[1]), cy = parseFloat(tm[2]);
      let bb; try { bb = el.getBBox(); } catch { return null; }
      return { eid, x: cx + bb.x, y: cy + bb.y, w: bb.width, h: bb.height };
    }).filter(Boolean);

    const PAD = 6;
    const inside = (pt, r) =>
      pt.x > r.x + PAD && pt.x < r.x + r.w - PAD &&
      pt.y > r.y + PAD && pt.y < r.y + r.h - PAD;

    const offenders = [];
    [...svg.querySelectorAll('.edgePaths path')].forEach((p, i) => {
      if (!p.getTotalLength) return;
      const len = p.getTotalLength();
      if (len < 2) return;
      for (const [name, pt] of [['start', p.getPointAtLength(0)], ['end', p.getPointAtLength(len)]]) {
        const r = rects.find(r => inside(pt, r));
        if (r) offenders.push({ pathIdx: i, endpoint: name, insideNode: r.eid, x: +pt.x.toFixed(1), y: +pt.y.toFixed(1) });
      }
    });
    return offenders;
  });
}

test.describe('Node drag — arrows stay attached to node boundaries', () => {
  test('after dragging a node, no edge endpoint is buried inside a node', async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, SIMPLE_CODE);

    await dragNode(page, 'APP_Beta', 140, 100);

    const offenders = await buriedEndpoints(page);
    expect(offenders, `Edge endpoints hidden under node shapes: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  test('edges still terminate adjacent to the dragged node (stay connected)', async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, SIMPLE_CODE);
    await dragNode(page, 'APP_Beta', 140, 100);

    const maxGap = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const geo = {};
      meridianNodeGroups(svg).forEach(({ el, eid }) => {
        const tm = (el.getAttribute('transform') || '').match(/translate\(\s*([\d.eE+-]+)[, \t]+([\d.eE+-]+)\s*\)/);
        let bb; try { bb = el.getBBox(); } catch { return; }
        geo[eid] = { cx: +tm[1], cy: +tm[2], halfDiag: Math.hypot(bb.width, bb.height) / 2 };
      });
      // each endpoint must be within (halfDiag + 4) of its nearest node centre
      let worst = 0;
      [...svg.querySelectorAll('.edgePaths path')].forEach(p => {
        const len = p.getTotalLength();
        for (const pt of [p.getPointAtLength(0), p.getPointAtLength(len)]) {
          let best = Infinity;
          for (const g of Object.values(geo)) {
            const d = Math.hypot(pt.x - g.cx, pt.y - g.cy) - g.halfDiag;
            if (d < best) best = d;
          }
          worst = Math.max(worst, best);
        }
      });
      return worst;
    });
    expect(maxGap).toBeLessThan(4);
  });

  test('reload with persisted positions keeps arrowheads on boundaries', async ({ page }) => {
    await page.goto('http://localhost:4321/meridian.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 15000 }
    );
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 15000 }
    );
    await loadDiagram(page, SIMPLE_CODE);
    await dragNode(page, 'APP_Beta', 140, 100);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 15000 }
    );
    await loadDiagram(page, SIMPLE_CODE);

    // position survived
    const beta = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const g = meridianNodeGroup(svg, 'APP_Beta');
      const tm = (g.getAttribute('transform') || '').match(/translate\(\s*([\d.eE+-]+)[, \t]+([\d.eE+-]+)\s*\)/);
      return { cx: +tm[1], cy: +tm[2] };
    });
    expect(beta.cx).toBeGreaterThan(350); // auto-layout puts it ~274; drag adds ~140

    const offenders = await buriedEndpoints(page);
    expect(offenders, `Edge endpoints hidden under node shapes: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  test('parallel (reciprocal) edges stay separated after drag', async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, PARALLEL_CODE);
    await dragNode(page, 'APP_Auth', 80, 120);

    const info = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const paths = [...svg.querySelectorAll('.edgePaths path')].filter(p => p.getTotalLength() > 2);
      if (paths.length < 2) return { count: paths.length, minMidDist: -1 };
      const mids = paths.map(p => p.getPointAtLength(p.getTotalLength() / 2));
      const d = Math.hypot(mids[0].x - mids[1].x, mids[0].y - mids[1].y);
      return { count: paths.length, minMidDist: d };
    });
    expect(info.count).toBe(2);
    expect(info.minMidDist).toBeGreaterThan(20);
  });

  test('group drag keeps edge endpoints out of node interiors', async ({ page }) => {
    await waitReady(page);
    await loadDiagram(page, `
app:Frontend
db:Database
app:API
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
    const clusterBox = await page.evaluate(() => {
      const r = document.querySelector('#mermaidOutput svg g.cluster rect');
      const b = r.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    await page.mouse.move(clusterBox.x, clusterBox.y);
    await page.mouse.down();
    await page.mouse.move(clusterBox.x + 90, clusterBox.y + 70, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const offenders = await buriedEndpoints(page);
    expect(offenders, `Edge endpoints hidden under node shapes: ${JSON.stringify(offenders)}`).toEqual([]);
  });
});
