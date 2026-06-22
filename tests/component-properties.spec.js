// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof onInput === 'function' && !!window.__CM);
  await page.waitForSelector('#mermaidOutput svg');
}

test.describe('Component properties', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('opens a Figma-style property panel with every property category', async ({ page }) => {
    await page.click('#componentPropsBtn');
    await expect(page.locator('#componentPropsPanel')).toHaveClass(/vis/);
    const sections = await page.locator('#componentPropsPanel .cp-title').allTextContents();
    expect(sections).toEqual(['Boolean','Variant','Instance swap','Text','Number','Color token','Interaction state']);
  });

  test('boolean properties control labels, minimap, grid, inspector and warnings', async ({ page }) => {
    await page.click('#componentPropsBtn');
    await page.locator('#cpLabels').uncheck();
    await page.locator('#cpMinimap').uncheck();
    await page.locator('#cpGrid').uncheck();
    await page.locator('#cpInspector').check();
    await page.locator('#cpWarnings').uncheck();
    const state = await page.evaluate(() => ({
      labels:document.getElementById('rightPanel').dataset.showLabels,
      warnings:document.getElementById('rightPanel').dataset.showWarnings,
      minimap:document.getElementById('previewMinimap').classList.contains('hidden'),
      canvas:document.getElementById('previewScroll').dataset.canvas,
      inspector:document.getElementById('inspectorPanel').classList.contains('vis'),
    }));
    expect(state).toEqual({ labels:'false', warnings:'false', minimap:true, canvas:'plain', inspector:true });
  });

  test('node type, label and relationship text properties mutate Smart Input', async ({ page }) => {
    await page.evaluate(() => {
      $input.value = 'app:Frontend\ndb:Database\napp:Frontend --> db:Database';
      parser.parse($input.value, 'LR');
      selectNode([...parser.entities.keys()].find(id => id.includes('Frontend')));
    });
    await page.click('#componentPropsBtn');
    await page.selectOption('#cpNodeType', 'server');
    await expect.poll(() => page.evaluate(() => $input.value)).toContain('server:Frontend');
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      parser.parse($input.value, 'LR');
      selectNode([...parser.entities.keys()].find(id => id.includes('Frontend')));
      syncComponentPropsUI();
    });
    await page.fill('#cpNodeLabel', 'Gateway');
    await page.locator('#cpNodeLabel').press('Enter');
    await expect.poll(() => page.evaluate(() => $input.value)).toContain('server:Gateway');
  });

  test('instance swap replaces the selected node icon instead of inserting a new node', async ({ page }) => {
    const result = await page.evaluate(() => {
      $input.value = 'app:Frontend\ndb:Database';
      parser.parse($input.value, 'LR');
      const id = [...parser.entities.keys()].find(key => key.includes('Frontend'));
      selectNode(id); _iconReplaceTarget = id;
      chooseIconItem('aws:lambda','app',false,'app:Lambda [icon: aws:lambda]');
      return $input.value;
    });
    expect(result).toContain('app:Frontend [icon: aws:lambda]');
    expect(result).not.toContain('app:Lambda');
  });

  test('number, color and interaction properties apply and persist', async ({ page }) => {
    await page.evaluate(() => selectNode([...parser.entities.keys()][0]));
    await page.click('#componentPropsBtn');
    await page.fill('#cpRadius','18'); await page.locator('#cpRadius').press('Enter');
    await page.fill('#cpStrokeWidth','4'); await page.locator('#cpStrokeWidth').press('Enter');
    await page.locator('#cpBorderColor').evaluate(el => { el.value='#123456'; el.dispatchEvent(new Event('input',{bubbles:true})); });
    await page.selectOption('#cpInteractionState','error');
    const state = await page.evaluate(() => {
      const node = meridianNodeGroup(document.querySelector('#mermaidOutput svg'), selectedNodeId);
      const shape = node.querySelector(':scope > rect,:scope > polygon,:scope > circle,:scope > ellipse,:scope > path');
      return { error:node.classList.contains('component-error'), stroke:shape.style.stroke,
        saved:JSON.parse(localStorage.getItem('meridian_settings')).diagram.componentProps };
    });
    expect(state.error).toBe(true);
    expect(state.stroke).toBe('rgb(18, 52, 86)');
    expect(state.saved).toMatchObject({ radius:18,strokeWidth:4,borderColor:'#123456' });
  });

  test('component property validation clamps unsafe persisted values', async ({ page }) => {
    const value = await page.evaluate(() => validatedComponentProps({ radius:999,strokeWidth:0,spacing:'bad',borderColor:'red',connectionStyle:'unknown' }));
    expect(value).toMatchObject({ radius:48,strokeWidth:1,spacing:24,borderColor:'#8b5cf6',connectionStyle:'solid' });
  });
});
