// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof applyDesignTokens === 'function' && !!window.__CM);
  await page.waitForSelector('#mermaidOutput svg');
}

test.describe('Design tokens panel', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('exposes colors, typography, spacing, radii, shadows and edge styles', async ({ page }) => {
    await page.click('#designTokensBtn');
    await expect(page.locator('#designTokensPanel')).toHaveClass(/vis/);
    expect(await page.locator('#designTokensPanel .cp-title').allTextContents()).toEqual(['Colors','Typography','Spacing & radii','Shadows & edges']);
  });

  test('palette tokens style nodes and relationships but preserve node overrides', async ({ page }) => {
    const state=await page.evaluate(() => {
      const ids=[...parser.entities.keys()];entityColorLoad();_entityColors[ids[0]]='#abcdef';entityColorSave();
      _diagramSettings.designTokens=validatedDesignTokens({..._diagramSettings.designTokens,followTheme:false,nodeFill:'#112233',border:'#445566',relationship:'#778899'});
      applyDesignTokens(document.querySelector('#mermaidOutput svg'));
      const shapes=ids.slice(0,2).map(id=>meridianNodeGroup(document.querySelector('#mermaidOutput svg'),id)?.querySelector(':scope > rect,:scope > polygon,:scope > circle,:scope > ellipse,:scope > path')?.style.fill);
      return { shapes,edge:document.querySelector('#mermaidOutput svg .edgePaths path')?.style.stroke };
    });
    expect(state.shapes[0]).not.toBe('rgb(17, 34, 51)');
    expect(state.shapes[1]).toBe('rgb(17, 34, 51)');
    expect(state.edge).toBe('rgb(119, 136, 153)');
  });

  test('typography and shadow tokens apply immediately', async ({ page }) => {
    await page.click('#designTokensBtn');
    await page.selectOption('#dtFontFamily','mono');
    await page.fill('#dtFontSize','18');await page.locator('#dtFontSize').press('Enter');
    await page.selectOption('#dtShadow','strong');
    const state=await page.evaluate(() => ({shadow:document.getElementById('rightPanel').dataset.tokenShadow,
      size:document.querySelector('#mermaidOutput svg g.node text, #mermaidOutput svg g.node .nodeLabel')?.style.fontSize}));
    expect(state.shadow).toBe('strong');expect(state.size).toBe('18px');
  });

  test('edge tokens synchronize component properties and persistence', async ({ page }) => {
    await page.click('#designTokensBtn');
    await page.selectOption('#dtEdgeStyle','dashed');
    await page.fill('#dtEdgeWidth','4');await page.locator('#dtEdgeWidth').press('Enter');
    const saved=await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_settings')).diagram);
    expect(saved.designTokens).toMatchObject({edgeStyle:'dashed',edgeWidth:4});
    expect(saved.componentProps).toMatchObject({connectionStyle:'dashed',strokeWidth:4});
  });

  test('validation clamps malformed token values', async ({ page }) => {
    const value=await page.evaluate(() => validatedDesignTokens({fontSize:99,nodePadding:1,panelRadius:-4,edgeWidth:20,canvas:'red',shadow:'huge'}));
    expect(value).toMatchObject({fontSize:24,nodePadding:8,panelRadius:0,edgeWidth:6,canvas:'#0b1020',shadow:'subtle'});
  });

  test('reset restores the token defaults', async ({ page }) => {
    await page.click('#designTokensBtn');
    await page.locator('#dtCanvas').evaluate(el=>{el.value='#ffffff';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.click('#designTokensReset');
    const tokens=await page.evaluate(() => _diagramSettings.designTokens);
    expect(tokens.canvas).toBe('#0b1020');expect(tokens.edgeStyle).toBe('solid');
  });

  test('Live Preview visibly follows light and dark diagram themes by default', async ({ page }) => {
    const result=await page.evaluate(async()=>{
      _diagramSettings.designTokens=validatedDesignTokens({..._diagramSettings.designTokens,followTheme:true});
      const theme=document.getElementById('mermaidTheme');
      theme.value='default';theme.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,700));
      const light={canvas:getComputedStyle(document.getElementById('previewScroll')).backgroundColor,
        fill:getComputedStyle(document.querySelector('#mermaidOutput svg g.node rect,#mermaidOutput svg g.node polygon,#mermaidOutput svg g.node circle')).fill};
      theme.value='dark';theme.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,700));
      const dark={canvas:getComputedStyle(document.getElementById('previewScroll')).backgroundColor,
        fill:getComputedStyle(document.querySelector('#mermaidOutput svg g.node rect,#mermaidOutput svg g.node polygon,#mermaidOutput svg g.node circle')).fill};
      return {light,dark};
    });
    expect(result.light.canvas).not.toBe(result.dark.canvas);
    expect(result.light.fill).not.toBe(result.dark.fill);
  });
});
