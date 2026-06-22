// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof applyResponsivePreset === 'function' && !!window.__CM);
  await page.waitForSelector('#mermaidOutput svg');
}

test.describe('Responsive preview', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('offers built-in viewport presets and density modes', async ({ page }) => {
    await page.click('#previewOptionsBtn');
    expect(await page.locator('#previewViewportPreset option').allTextContents()).toEqual(expect.arrayContaining(['Desktop · 1440×900','Laptop · 1280×800','Tablet · 768×1024','Mobile · 390×844','Current custom size']));
    expect(await page.locator('#previewDensity option').allTextContents()).toEqual(['Auto density','Compact','Comfortable','Spacious']);
  });

  test('mobile preset applies exact viewport dimensions and automatic compact density', async ({ page }) => {
    await page.click('#previewOptionsBtn');await page.selectOption('#previewViewportPreset','mobile');
    const state=await page.evaluate(() => ({device:$previewScroll.dataset.device,width:$previewScroll.style.getPropertyValue('--preview-device-width'),height:$previewScroll.style.getPropertyValue('--preview-device-height'),density:document.getElementById('rightPanel').dataset.density,preset:_diagramSettings.preview.viewportPreset}));
    expect(state).toEqual({device:'custom',width:'390px',height:'844px',density:'compact',preset:'mobile'});
  });

  test('explicit density changes layout spacing deterministically', async ({ page }) => {
    const values=await page.evaluate(() => {commitPreviewSetting('density','compact');applyResponsiveDensity();const compact={padding:BASE_MERMAID_CONFIG.flowchart.padding,gap:BASE_MERMAID_CONFIG.flowchart.nodeSpacing};commitPreviewSetting('density','spacious');applyResponsiveDensity();const spacious={padding:BASE_MERMAID_CONFIG.flowchart.padding,gap:BASE_MERMAID_CONFIG.flowchart.nodeSpacing};return {compact,spacious};});
    expect(values.compact.padding).toBeLessThan(values.spacious.padding);expect(values.compact.gap).toBeLessThan(values.spacious.gap);
  });

  test('saves, escapes and persists a custom viewport preset', async ({ page }) => {
    await page.click('#previewOptionsBtn');await page.selectOption('#previewDevice','custom');await page.fill('#previewDeviceWidth','1111');await page.locator('#previewDeviceWidth').press('Enter');await page.fill('#previewDeviceHeight','777');await page.locator('#previewDeviceHeight').press('Enter');
    await page.fill('#previewPresetName','<img onerror=alert(1)> Review');await page.click('#previewPresetSave');
    const preset=await page.evaluate(() => _diagramSettings.preview.customViewports[0]);expect(preset).toMatchObject({name:'<img onerror=alert(1)> Review',width:1111,height:777});await expect(page.locator('#previewViewportPreset img')).toHaveCount(0);
    await page.reload();await page.waitForFunction(() => !!window.__CM);await page.click('#previewOptionsBtn');await expect(page.locator('#previewViewportPreset')).toContainText('<img onerror=alert(1)> Review');
  });

  test('deletes custom presets without affecting built-ins', async ({ page }) => {
    await page.evaluate(() => {_diagramSettings.preview=validatedPreviewSettings({..._diagramSettings.preview,customViewports:[{id:'custom-test',name:'Test',width:900,height:600}],viewportPreset:'custom-test'});saveSettings();syncPreviewOptionsUI();});
    await page.click('#previewOptionsBtn');await page.click('#previewPresetDelete');
    expect(await page.evaluate(() => _diagramSettings.preview.customViewports)).toEqual([]);await expect(page.locator('#previewViewportPreset')).toContainText('Desktop · 1440×900');
  });

  test('validates and caps persisted custom presets', async ({ page }) => {
    const result=await page.evaluate(() => validatedPreviewSettings({customViewports:Array.from({length:20},(_,index)=>({id:'bad id',name:`Preset\u0000${index}`,width:index?9999:10,height:'bad'})),viewportPreset:'unknown'}));
    expect(result.customViewports).toHaveLength(12);expect(result.customViewports[0]).toMatchObject({id:'custom-1',name:'Preset0',width:240,height:720});expect(result.customViewports[1].width).toBe(2560);expect(result.viewportPreset).toBe('desktop');
  });
});
