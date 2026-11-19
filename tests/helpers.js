// Shared helpers for the Meridian Playwright suite.
const { expect } = require('@playwright/test');

/** Fresh app: clears storage, optionally forces a theme, waits for first render. */
async function openApp(page, { theme = null, clear = true } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.PAGE || '/meridian.html');
  if (clear) {
    await page.evaluate(async (t) => {
      localStorage.clear();
      if (t) localStorage.setItem('meridian-app-theme', t);
      await new Promise(res => { const r = indexedDB.deleteDatabase('meridian'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    }, theme);
    await page.reload();
  }
  await page.waitForFunction(() => window.__CM && typeof parser !== 'undefined' && typeof $input !== 'undefined' && typeof _cmView !== 'undefined' && _cmView);
  await page.waitForSelector('#mermaidOutput svg');
  return errors;
}

/** Replace Smart Input text and wait for the re-render to settle. */
async function setInput(page, text) {
  await page.evaluate((t) => { $input.value = t; onInput(); }, text);
  await page.waitForFunction((t) => $input.value === t, text);
  await page.waitForTimeout(450);
  if (text.trim()) await page.waitForSelector('#mermaidOutput svg, #mermaidOutput .render-err');
}

async function setTheme(page, theme) {
  await page.evaluate((t) => setAppTheme(t), theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.waitForTimeout(400);
}

async function setType(page, type) {
  await page.selectOption('#diagramType', type);
  await page.waitForTimeout(500);
  await page.waitForSelector('#mermaidOutput svg, #mermaidOutput .render-err');
}

/** Rendered node <g> for an entity id (e.g. "APP_API"). */
function node(page, eid) {
  return page.locator(`#mermaidOutput svg g.node[id*="-${eid}-"], #mermaidOutput svg g[data-entity-id="${eid}"]`).first();
}

async function nodeCenter(page, eid) {
  return page.evaluate((id) => {
    const g = meridianNodeGroup(document.querySelector('#mermaidOutput svg'), id);
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }, eid);
}

async function drag(page, from, to, steps = 8) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

/** Counts of the rendered diagram. */
async function stats(page) {
  return page.evaluate(() => ({
    nodes: document.querySelectorAll('#mermaidOutput svg g.node').length,
    edges: document.querySelectorAll('#mermaidOutput svg .flowchart-link').length,
    clusters: document.querySelectorAll('#mermaidOutput svg g.cluster').length,
    edgeLabels: [...document.querySelectorAll('#mermaidOutput svg g.edgeLabel')].map(l => l.textContent.trim()).filter(Boolean),
    error: !!document.querySelector('#mermaidOutput .render-err'),
    status: document.getElementById('previewStatus').textContent.trim(),
  }));
}

/** WCAG contrast helpers installed into the page. */
function contrastFn() {
  return `
  window.__parseColor = (c) => {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
    const h = String(c).trim().match(/^#([0-9a-f]{3,8})$/i);
    if (h) { let v = h[1]; if (v.length === 3) v = v.split('').map(x => x + x).join(''); return { r: parseInt(v.slice(0,2),16), g: parseInt(v.slice(2,4),16), b: parseInt(v.slice(4,6),16), a: v.length === 8 ? parseInt(v.slice(6,8),16)/255 : 1 }; }
    return null;
  };
  window.__lum = ({ r, g, b }) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  window.__contrast = (a, b) => { const l1 = __lum(a), l2 = __lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  window.__blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  window.__bgOf = (el) => {
    const layers = [];
    for (let n = el instanceof Element ? el : el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      let c = __parseColor(cs.backgroundColor);
      if ((!c || c.a === 0) && /gradient/.test(cs.backgroundImage)) {
        const stops = cs.backgroundImage.match(/rgba?\\([^)]+\\)/g) || [];
        if (stops.length) c = __parseColor(stops[0]);
      }
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.999) break; }
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    if (layers.length && layers[layers.length - 1].a < 1) out = document.documentElement.dataset.theme === 'light' ? out : { r: 17, g: 24, b: 39, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) out = __blend(layers[i], out);
    return out;
  };`;
}

async function installContrast(page) {
  await page.addScriptTag({ content: contrastFn() });
}

module.exports = { openApp, setInput, setTheme, setType, node, nodeCenter, drag, stats, installContrast };
