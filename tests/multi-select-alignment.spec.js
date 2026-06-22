// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof arrangeSelectedNodes === 'function' && !!window.__CM);
  await page.waitForSelector('#mermaidOutput svg');
}

async function selectFirstTwo(page) {
  return page.evaluate(() => {
    const ids=[...parser.entities.keys()].filter(id=>!groupVisualFor(parser,id)).slice(0,2);
    selectNode(ids[0]);selectNode(ids[1],true);return ids;
  });
}

test.describe('Multi-select and alignment', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('additive selection tracks multiple nodes and updates the toolbar', async ({ page }) => {
    const ids=await selectFirstTwo(page);
    const state=await page.evaluate(() => ({ids:[...selectedNodeIds],label:document.getElementById('selectionName').textContent,selected:document.querySelectorAll('#mermaidOutput svg g.node.node-selected').length}));
    expect(state.ids).toEqual(ids);expect(state.label).toBe('2 selected');expect(state.selected).toBe(2);
  });

  test('Shift-click adds a canvas node to the current selection', async ({ page }) => {
    const nodes=page.locator('#mermaidOutput svg g.node');
    await nodes.nth(0).click();await nodes.nth(1).click({modifiers:['Shift']});
    expect(await page.evaluate(() => selectedNodeIds.size)).toBe(2);
  });

  test('bulk color and lock apply to every selected node', async ({ page }) => {
    const ids=await selectFirstTwo(page);
    await page.locator('#selectionColor').evaluate(el=>{el.value='#123456';el.dispatchEvent(new Event('input',{bubbles:true}));});
    await page.click('#selectionLock');
    const state=await page.evaluate(ids=>({colors:ids.map(id=>_entityColors[id]),locked:ids.map(isNodeLocked)}),ids);
    expect(state.colors).toEqual(['#123456','#123456']);expect(state.locked).toEqual([true,true]);
  });

  test('align left updates persisted offsets to a common x coordinate', async ({ page }) => {
    const result=await page.evaluate(() => {
      const ids=[...parser.entities.keys()].filter(id=>!groupVisualFor(parser,id)).slice(0,3);selectedNodeIds=new Set(ids);selectedNodeId=ids.at(-1);
      const svg=document.querySelector('#mermaidOutput svg');const before=Object.fromEntries(ids.map(id=>{const m=meridianNodeGroup(svg,id).getAttribute('transform').match(/translate\(\s*([\d.eE+-]+)[, \t]+([\d.eE+-]+)/);return[id,{x:+m[1],y:+m[2]}];}));
      arrangeSelectedNodes('left');
      const finalX=ids.map(id=>before[id].x+(_nodePositions[id]?.dx||0));return {finalX};
    });
    expect(new Set(result.finalX.map(Math.round)).size).toBe(1);
  });

  test('horizontal distribution creates equal intervals', async ({ page }) => {
    const gaps=await page.evaluate(() => {
      const ids=[...parser.entities.keys()].filter(id=>!groupVisualFor(parser,id)).slice(0,3);selectedNodeIds=new Set(ids);selectedNodeId=ids.at(-1);
      const svg=document.querySelector('#mermaidOutput svg');const before=Object.fromEntries(ids.map(id=>{const m=meridianNodeGroup(svg,id).getAttribute('transform').match(/translate\(\s*([\d.eE+-]+)[, \t]+([\d.eE+-]+)/);return[id,{x:+m[1],y:+m[2]}];}));arrangeSelectedNodes('distribute-x');
      const xs=ids.map(id=>before[id].x+(_nodePositions[id]?.dx||0)).sort((a,b)=>a-b);return [xs[1]-xs[0],xs[2]-xs[1]];
    });
    expect(Math.abs(gaps[0]-gaps[1])).toBeLessThan(.01);
  });

  test('grouping persists membership and restores grouped selection', async ({ page }) => {
    const ids=await selectFirstTwo(page);await page.click('#selectionGroup');
    const state=await page.evaluate(ids=>{const stored=JSON.parse(localStorage.getItem('meridian_selection_groups_v1')||'{}');clearNodeSelection();selectNode(ids[0]);return {stored:Object.values(stored)[0],selected:[...selectedNodeIds]};},ids);
    expect(state.stored).toEqual(ids);expect(state.selected).toEqual(ids);
  });

  test('Layers supports additive Shift-selection', async ({ page }) => {
    await page.click('#layersBtn');const rows=page.locator('.layer-row[data-layer-kind="node"]');
    await rows.nth(0).click();await rows.nth(1).click({modifiers:['Shift']});
    expect(await page.evaluate(() => selectedNodeIds.size)).toBe(2);
  });
});
