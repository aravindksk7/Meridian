// @ts-check
const { test, expect } = require('@playwright/test');

const WIDE_DIAGRAM = Array.from({ length: 28 }, (_, i) =>
  `app:Service_${String(i + 1).padStart(2, '0')} --> app:Service_${String(i + 2).padStart(2, '0')}`
).join('\n');

async function waitReady(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('http://localhost:4321/meridian.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
    { timeout: 12000 }
  );
}

async function loadWideDiagram(page) {
  await page.evaluate(src => { $input.value = src; }, WIDE_DIAGRAM);
  await page.waitForFunction(
    () => document.querySelector('#mermaidOutput svg') &&
      document.querySelector('#previewMinimap:not(.hidden) #minimapSvgHost svg') &&
      document.querySelector('#minimapViewport')?.offsetWidth > 0,
    { timeout: 10000 }
  );
}

test.describe('Preview minimap', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('shows a live overview after rendering', async ({ page }) => {
    await loadWideDiagram(page);

    const state = await page.evaluate(() => ({
      visible: !document.getElementById('previewMinimap').classList.contains('hidden'),
      clonedSvgs: document.querySelectorAll('#minimapSvgHost svg').length,
      viewportWidth: document.getElementById('minimapViewport').offsetWidth,
      viewportHeight: document.getElementById('minimapViewport').offsetHeight,
      sourceSvgs: document.querySelectorAll('#mermaidOutput svg').length,
    }));

    expect(state.visible).toBe(true);
    expect(state.clonedSvgs).toBe(1);
    expect(state.sourceSvgs).toBe(1);
    expect(state.viewportWidth).toBeGreaterThan(0);
    expect(state.viewportHeight).toBeGreaterThan(0);
  });

  test('clicking the overview navigates the live preview', async ({ page }) => {
    await loadWideDiagram(page);
    await page.evaluate(() => setZoom(5));
    await page.waitForFunction(
      () => {
        const scroll = document.getElementById('previewScroll');
        return scroll.scrollWidth > scroll.clientWidth + 20;
      },
      { timeout: 5000 }
    );
    await page.evaluate(() => {
      const scroll = document.getElementById('previewScroll');
      scroll.scrollLeft = 0;
      scroll.scrollTop = 0;
      updateMinimapViewport();
    });

    const beforeLeft = await page.locator('#minimapViewport').evaluate(el => el.getBoundingClientRect().left);
    const box = await page.locator('#minimapBody').boundingBox();
    if (!box) throw new Error('minimap body is not visible');
    await page.mouse.click(box.x + box.width - 12, box.y + box.height / 2);

    await page.waitForFunction(
      () => document.getElementById('previewScroll').scrollLeft > 0,
      { timeout: 3000 }
    );
    const after = await page.evaluate(() => ({
      scrollLeft: document.getElementById('previewScroll').scrollLeft,
      viewportLeft: document.getElementById('minimapViewport').getBoundingClientRect().left,
    }));

    expect(after.scrollLeft).toBeGreaterThan(0);
    expect(after.viewportLeft).toBeGreaterThan(beforeLeft);
  });

  test('clicking minimap edges can reach all zoomed preview bounds', async ({ page }) => {
    await page.evaluate(() => loadTemplate('enterpriseDomains'));
    await page.waitForFunction(
      () => document.querySelector('#previewMinimap:not(.hidden) #minimapSvgHost svg') &&
        document.querySelector('#minimapViewport')?.offsetWidth > 0,
      { timeout: 10000 }
    );
    await page.evaluate(() => {
      setZoom(5);
      const scroll = document.getElementById('previewScroll');
      scroll.scrollLeft = 0;
      scroll.scrollTop = 0;
      updateMinimapViewport();
    });
    await page.waitForFunction(() => {
      const scroll = document.getElementById('previewScroll');
      return scroll.scrollWidth > scroll.clientWidth + 20 &&
        scroll.scrollHeight > scroll.clientHeight + 20;
    }, { timeout: 5000 });

    const box = await page.locator('#minimapBody').boundingBox();
    if (!box) throw new Error('minimap body is not visible');
    await page.mouse.click(box.x + box.width - 2, box.y + box.height - 2);

    await page.waitForFunction(() => {
      const scroll = document.getElementById('previewScroll');
      return Math.abs(scroll.scrollLeft - (scroll.scrollWidth - scroll.clientWidth)) <= 2 &&
        Math.abs(scroll.scrollTop - (scroll.scrollHeight - scroll.clientHeight)) <= 2;
    }, { timeout: 3000 });

    const state = await page.evaluate(() => {
      const scroll = document.getElementById('previewScroll');
      const viewport = document.getElementById('minimapViewport').getBoundingClientRect();
      const m = minimapMetrics();
      return {
        scrollLeft: scroll.scrollLeft,
        scrollTop: scroll.scrollTop,
        maxLeft: scroll.scrollWidth - scroll.clientWidth,
        maxTop: scroll.scrollHeight - scroll.clientHeight,
        viewportRight: viewport.right,
        viewportBottom: viewport.bottom,
        mapRight: m.bodyRect.left + m.x + m.mapW,
        mapBottom: m.bodyRect.top + m.y + m.mapH,
      };
    });

    expect(state.scrollLeft).toBeCloseTo(state.maxLeft, 0);
    expect(state.scrollTop).toBeCloseTo(state.maxTop, 0);
    expect(state.viewportRight).toBeCloseTo(state.mapRight, 1);
    expect(state.viewportBottom).toBeCloseTo(state.mapBottom, 1);
  });

  test('manual rightward group movement expands preview and remains reachable from minimap', async ({ page }) => {
    await page.evaluate(() => loadTemplate('microservices'));
    await page.waitForFunction(
      () => parser.entities.has('APP_API_Gateway') &&
        document.querySelector('#previewMinimap:not(.hidden) #minimapSvgHost svg') &&
        document.querySelector('#minimapViewport')?.offsetWidth > 0,
      { timeout: 10000 }
    );
    await page.evaluate(() => setZoom(3));
    await page.waitForTimeout(250);

    const clusterBox = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const cluster = [...svg.querySelectorAll('g.cluster')]
        .find(c => (c.textContent || '').includes('Production'));
      const rect = cluster?.querySelector('rect');
      return rect ? rect.getBoundingClientRect() : null;
    });
    expect(clusterBox).not.toBeNull();

    const cx = clusterBox.x + clusterBox.width / 2;
    const cy = clusterBox.y + clusterBox.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 600, cy, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    const target = await page.evaluate(() => {
      const scroll = document.getElementById('previewScroll');
      scroll.scrollLeft = 0;
      updateMinimapViewport();
      const svg = document.querySelector('#mermaidOutput svg');
      const api = meridianNodeGroup(svg, 'APP_API_Gateway');
      const apiRect = api.getBoundingClientRect();
      const scrollRect = scroll.getBoundingClientRect();
      const pos = readNodeCenter(api);
      const vb = svg.viewBox.baseVal;
      const maxLeft = scroll.scrollWidth - scroll.clientWidth;
      const desiredLeft = Math.max(0, Math.min(maxLeft, (pos.cx - vb.x) * zoom - scroll.clientWidth / 2));
      const m = minimapMetrics();
      return {
        maxLeft,
        desiredLeft,
        visibleAtLeft: apiRect.left >= scrollRect.left && apiRect.right <= scrollRect.right,
        clickX: m.bodyRect.left + m.x + (maxLeft > 0 ? desiredLeft / maxLeft : 0) * m.mapW,
        clickY: m.bodyRect.top + m.y + m.mapH / 2,
      };
    });

    expect(target.maxLeft).toBeGreaterThan(0);
    expect(target.desiredLeft).toBeGreaterThan(100);
    expect(target.desiredLeft).toBeLessThanOrEqual(target.maxLeft);
    expect(target.visibleAtLeft).toBe(false);

    await page.mouse.click(target.clickX, target.clickY);
    await page.waitForTimeout(250);

    const state = await page.evaluate(() => {
      const scroll = document.getElementById('previewScroll');
      const s = scroll.getBoundingClientRect();
      const api = meridianNodeGroup(document.querySelector('#mermaidOutput svg'), 'APP_API_Gateway')
        .getBoundingClientRect();
      return {
        scrollLeft: scroll.scrollLeft,
        visible: api.left >= s.left && api.right <= s.right && api.top < s.bottom && api.bottom > s.top,
      };
    });

    expect(Math.abs(state.scrollLeft - target.desiredLeft)).toBeLessThan(25);
    expect(state.visible).toBe(true);
  });

  test('can collapse and expand the navigator', async ({ page }) => {
    await loadWideDiagram(page);

    await page.click('#minimapToggle');
    await expect(page.locator('#previewMinimap')).toHaveClass(/collapsed/);
    await expect(page.locator('#minimapBody')).toBeHidden();

    await page.click('#minimapToggle');
    await expect(page.locator('#previewMinimap')).not.toHaveClass(/collapsed/);
    await expect(page.locator('#minimapBody')).toBeVisible();
  });

  test('renders a simplified static overview without marker shadows', async ({ page }) => {
    await loadWideDiagram(page);

    const state = await page.evaluate(() => {
      const clone = document.querySelector('#minimapSvgHost svg');
      const edgePaths = [...(clone?.querySelectorAll('.edgePaths path,.edgePath path,path.flowchart-link') || [])];
      return {
        defs: clone?.querySelectorAll('defs,filter,marker').length || 0,
        labelledEdges: clone?.querySelectorAll('g.edgeLabel,.edgeLabel').length || 0,
        markerAttrs: edgePaths.filter(path =>
          path.hasAttribute('marker-start') || path.hasAttribute('marker-mid') || path.hasAttribute('marker-end')
        ).length,
        filters: [...(clone?.querySelectorAll('[filter]') || [])].length,
        strokes: edgePaths.map(path => path.style.stroke || path.getAttribute('stroke') || ''),
      };
    });

    expect(state.defs).toBe(0);
    expect(state.markerAttrs).toBe(0);
    expect(state.filters).toBe(0);
    expect(state.labelledEdges).toBe(0);
    expect(state.strokes.length).toBeGreaterThan(0);
    expect(state.strokes.every(stroke => !/black|#000|rgb\(0,\s*0,\s*0\)/i.test(stroke))).toBe(true);
  });
});
