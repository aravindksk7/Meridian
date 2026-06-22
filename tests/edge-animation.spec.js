// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ acceptDownloads: true });

const SIMPLE_DIAGRAM = `app:Frontend --> app:Backend
app:Backend --> db:Database`;

const DESIGN_BOARD = `domain:Product {
  app:Web_App
  interface:Public_API
}

domain:Platform {
  app:Canvas_Service
  db:Project_Store
  watcher:Telemetry
}

app:Web_App --> interface:Public_API
interface:Public_API --sync--> app:Canvas_Service
app:Canvas_Service --> db:Project_Store
watcher:Telemetry --> app:Canvas_Service`;

function readSubBlocks(bytes, offset) {
  const chunks = [];
  let total = 0;
  while (offset < bytes.length) {
    const len = bytes[offset++];
    if (len === 0) break;
    const chunk = bytes.slice(offset, offset + len);
    chunks.push(chunk);
    total += chunk.length;
    offset += len;
  }
  return { data: Buffer.concat(chunks, total), offset };
}

function decodeGifLzw(data, minCodeSize, expectedPixels) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let codeSize;
  let nextCode;
  let dict;
  let bitOffset = 0;
  let previous = null;
  const output = [];

  function reset() {
    dict = Array.from({ length: clearCode }, (_, i) => [i]);
    dict[clearCode] = null;
    dict[endCode] = null;
    codeSize = minCodeSize + 1;
    nextCode = endCode + 1;
    previous = null;
  }

  function readCode() {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = data[bitOffset >> 3];
      if (byte === undefined) return null;
      code |= ((byte >> (bitOffset & 7)) & 1) << i;
      bitOffset++;
    }
    return code;
  }

  reset();
  for (;;) {
    const code = readCode();
    if (code === null) throw new Error('GIF LZW stream ended early');
    if (code === clearCode) { reset(); continue; }
    if (code === endCode) break;

    let entry = dict[code];
    if (!entry && previous && code === nextCode) entry = previous.concat(previous[0]);
    if (!entry) throw new Error(`Invalid GIF LZW code ${code}`);
    output.push(...entry);

    if (previous) {
      dict[nextCode++] = previous.concat(entry[0]);
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
    }
    previous = entry;
  }

  expect(output.length).toBe(expectedPixels);
}

function validateGifImageData(bytes) {
  expect(bytes.slice(0, 6).toString('ascii')).toBe('GIF89a');
  const globalPacked = bytes[10];
  let offset = 13;
  if (globalPacked & 0x80) offset += 3 * (1 << ((globalPacked & 0x07) + 1));

  let frames = 0;
  while (offset < bytes.length) {
    const marker = bytes[offset++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      offset++;
      ({ offset } = readSubBlocks(bytes, offset));
      continue;
    }
    expect(marker).toBe(0x2c);
    const width = bytes[offset + 4] | (bytes[offset + 5] << 8);
    const height = bytes[offset + 6] | (bytes[offset + 7] << 8);
    const packed = bytes[offset + 8];
    offset += 9;
    if (packed & 0x80) offset += 3 * (1 << ((packed & 0x07) + 1));
    const minCodeSize = bytes[offset++];
    const block = readSubBlocks(bytes, offset);
    offset = block.offset;
    decodeGifLzw(block.data, minCodeSize, width * height);
    frames++;
  }
  expect(bytes[bytes.length - 1]).toBe(0x3b);
  return frames;
}

async function waitReady(page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.clear());
  await page.goto('http://localhost:4321/meridian.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
    { timeout: 12000 }
  );
}

async function loadDiagram(page, code, type = 'LR') {
  await page.evaluate(({ src, diagramType }) => {
    document.getElementById('diagramType').value = diagramType;
    $input.value = src;
  }, { src: code, diagramType: type });
  await page.waitForFunction(
    () => {
      const svg = document.querySelector('#mermaidOutput svg');
      return svg && svg.querySelectorAll('.edgePaths path').length > 0;
    },
    { timeout: 8000 }
  );
}

async function setEdgeAnimation(page, mode) {
  if (await page.locator('#settingsModal.hidden').count()) {
    await page.click('#settingsBtn');
  }
  await page.click('[data-stt="diagram"]');
  await page.click(`#edgeAnimBtns [data-edge-animation="${mode}"]`);
  await page.waitForFunction(expected => _diagramSettings.edgeAnimation === expected, mode);
}

async function waitForAnimation(page, minCount = 1) {
  await page.waitForFunction(
    count => document.querySelectorAll('#mermaidOutput svg .meridian-edge-flow').length >= count,
    minCount,
    { timeout: 8000 }
  );
}

test.describe('Animated edge overlay', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('is off by default', async ({ page }) => {
    await loadDiagram(page, SIMPLE_DIAGRAM);

    const state = await page.evaluate(() => ({
      mode: _diagramSettings.edgeAnimation,
      groups: document.querySelectorAll('#mermaidOutput svg .meridian-edge-animation').length,
      flows: document.querySelectorAll('#mermaidOutput svg .meridian-edge-flow').length,
    }));

    expect(state.mode).toBe('off');
    expect(state.groups).toBe(0);
    expect(state.flows).toBe(0);
  });

  test('adds moving arrows without changing the real edge path count', async ({ page }) => {
    await loadDiagram(page, SIMPLE_DIAGRAM);
    const before = await page.evaluate(() =>
      document.querySelectorAll('#mermaidOutput svg .edgePaths path').length
    );

    await setEdgeAnimation(page, 'fast');
    await waitForAnimation(page, before);

    const state = await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('meridian_settings') || '{}');
      const svg = document.querySelector('#mermaidOutput svg');
      return {
        savedMode: settings.diagram?.edgeAnimation,
        edgePaths: svg ? svg.querySelectorAll('.edgePaths path').length : 0,
        groups: svg ? svg.querySelectorAll('.meridian-edge-animation').length : 0,
        flows: svg ? svg.querySelectorAll('.meridian-edge-flow').length : 0,
        overlayInsideEdgePaths: svg ? svg.querySelectorAll('.edgePaths .meridian-edge-animation').length : 0,
        durations: [...(svg?.querySelectorAll('.meridian-edge-flow') || [])]
          .map(flow => flow.querySelector('animateMotion, animatemotion')?.getAttribute('dur') || ''),
      };
    });

    expect(state.savedMode).toBe('fast');
    expect(state.edgePaths).toBe(before);
    expect(state.groups).toBe(1);
    expect(state.flows).toBeGreaterThanOrEqual(before);
    expect(state.overlayInsideEdgePaths).toBe(0);
    expect(state.durations.every(d => d === '1.15s')).toBe(true);
  });

  test('removes the overlay when set back to off', async ({ page }) => {
    await loadDiagram(page, SIMPLE_DIAGRAM);
    await setEdgeAnimation(page, 'slow');
    await waitForAnimation(page, 2);

    await setEdgeAnimation(page, 'off');
    await page.waitForFunction(
      () => document.querySelectorAll('#mermaidOutput svg .meridian-edge-animation').length === 0,
      { timeout: 8000 }
    );

    expect(await page.evaluate(() => _diagramSettings.edgeAnimation)).toBe('off');
  });

  test('works with the Design Board renderer', async ({ page }) => {
    await loadDiagram(page, DESIGN_BOARD, 'design');
    await setEdgeAnimation(page, 'slow');
    await waitForAnimation(page, 4);

    const state = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg[data-renderer="meridian-design-board"]');
      return {
        isDesign: !!svg,
        flows: svg ? svg.querySelectorAll('.meridian-edge-flow').length : 0,
        edgePaths: svg ? svg.querySelectorAll('.edgePaths path').length : 0,
        durations: [...(svg?.querySelectorAll('.meridian-edge-flow') || [])]
          .map(flow => flow.querySelector('animateMotion, animatemotion')?.getAttribute('dur') || ''),
      };
    });

    expect(state.isDesign).toBe(true);
    expect(state.edgePaths).toBeGreaterThanOrEqual(4);
    expect(state.flows).toBeGreaterThanOrEqual(4);
    expect(state.durations.every(d => d === '2.8s')).toBe(true);
  });

  test('exports an animated GIF with sampled edge motion frames', async ({ page }) => {
    await loadDiagram(page, SIMPLE_DIAGRAM);
    await setEdgeAnimation(page, 'fast');
    await waitForAnimation(page, 2);

    const frameState = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      const size = getSvgExportDimensions(svg, { maxDimension: 320 });
      const edges = collectGifEdgeMotion(svg);
      const first = createGifFrameSvgText(svg, size, edges, 0, 'fast');
      const second = createGifFrameSvgText(svg, size, edges, 0.5, 'fast');
      return {
        hasButton: !!document.getElementById('downloadGif'),
        edges: edges.length,
        hasGifOverlay: first.includes('meridian-gif-edge-frame'),
        hasMovingArrows: first.includes('meridian-edge-flow'),
        framesDiffer: first !== second,
      };
    });

    expect(frameState.hasButton).toBe(true);
    expect(frameState.edges).toBeGreaterThanOrEqual(2);
    expect(frameState.hasGifOverlay).toBe(true);
    expect(frameState.hasMovingArrows).toBe(true);
    expect(frameState.framesDiffer).toBe(true);

    const gif = await page.evaluate(async () => {
      const svg = document.querySelector('#mermaidOutput svg');
      const blob = await createDiagramGifBlob(svg, {
        frameCount: 3,
        maxDimension: 320,
        skipYield: true,
      });
      const decoded = await new Promise(resolve => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const result = { ok: true, width: img.naturalWidth, height: img.naturalHeight };
          URL.revokeObjectURL(url);
          resolve(result);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve({ ok: false, width: 0, height: 0 });
        };
        img.src = url;
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let graphicsControlExtensions = 0;
      for (let i = 0; i < bytes.length - 2; i++) {
        if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
          graphicsControlExtensions++;
        }
      }
      return {
        type: blob.type,
        size: blob.size,
        header: String.fromCharCode(...bytes.slice(0, 6)),
        trailer: bytes[bytes.length - 1],
        graphicsControlExtensions,
        decoded,
        bytes: Array.from(bytes),
      };
    });

    const gifBytes = Buffer.from(gif.bytes);
    expect(gif.type).toBe('image/gif');
    expect(gif.header).toBe('GIF89a');
    expect(gif.trailer).toBe(0x3b);
    expect(gif.graphicsControlExtensions).toBe(3);
    expect(gif.decoded.ok).toBe(true);
    expect(gif.decoded.width).toBeGreaterThan(0);
    expect(gif.decoded.height).toBeGreaterThan(0);
    expect(validateGifImageData(gifBytes)).toBe(3);
    expect(gif.size).toBeGreaterThan(1000);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('settingsModal')?.classList.contains('hidden'));
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#downloadGif'),
    ]);
    expect(download.suggestedFilename()).toBe('diagram.gif');
  });
});
