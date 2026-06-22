// @ts-check
const { test, expect } = require('@playwright/test');

async function waitReady(page) {
  await page.goto('http://localhost:4321/meridian.html');
  await page.waitForFunction(() => typeof applyReviewPins === 'function' && !!window.__CM);
  await page.waitForSelector('#mermaidOutput svg');
}

async function addCanvasComment(page,text='Check this boundary') {
  await page.click('#commentsBtn');await page.click('#newCommentBtn');
  const box=await page.locator('#previewScroll').boundingBox();
  await page.locator('#previewScroll').click({position:{x:10,y:Math.max(10,box.height-12)}});
  await page.fill('#commentText',text);await page.click('#commentSave');
}

test.describe('Comments and review pins', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('opens a comments panel and enters pin placement mode', async ({ page }) => {
    await page.click('#commentsBtn');await expect(page.locator('#commentsPanel')).toHaveClass(/vis/);
    await page.click('#newCommentBtn');await expect(page.locator('body')).toHaveClass(/comment-placement/);
  });

  test('places coordinate feedback and renders a numbered canvas pin', async ({ page }) => {
    await addCanvasComment(page);
    await expect(page.locator('#mermaidOutput svg .meridian-comment-pin')).toHaveCount(1);
    const saved=await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_review_comments_v1')));
    expect(saved[0]).toMatchObject({text:'Check this boundary',nodeId:null,resolved:false});
    expect(Number.isFinite(saved[0].x)&&Number.isFinite(saved[0].y)).toBe(true);
  });

  test('attaches feedback to a node', async ({ page }) => {
    await page.click('#commentsBtn');await page.click('#newCommentBtn');await page.locator('#mermaidOutput svg g.node').first().click();
    await expect(page.locator('#commentComposerTarget')).not.toHaveText('Canvas');await page.fill('#commentText','Node-specific feedback');await page.click('#commentSave');
    const comment=await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_review_comments_v1'))[0]);
    expect(comment.nodeId).toBeTruthy();await expect(page.locator(`.meridian-comment-pin[data-comment-id="${comment.id}"]`)).toHaveCount(1);
  });

  test('renders authored text without interpreting HTML', async ({ page }) => {
    await addCanvasComment(page,'<img src=x onerror=alert(1)> Review');await page.click('#commentsBtn');
    await expect(page.locator('#commentsList')).toContainText('<img src=x onerror=alert(1)> Review');
    await expect(page.locator('#commentsList img')).toHaveCount(0);
  });

  test('resolves, filters and reopens comments', async ({ page }) => {
    await addCanvasComment(page);await page.click('#commentsBtn');await page.locator('.comment-item').click();await page.click('#commentResolve');
    await expect(page.locator('.meridian-comment-pin')).toHaveClass(/resolved/);
    await expect(page.locator('.comment-item')).toHaveCount(0);await page.selectOption('#commentsFilter','resolved');await expect(page.locator('.comment-item')).toHaveCount(1);
    await page.locator('.comment-item').click();await page.click('#commentResolve');await expect(page.locator('.meridian-comment-pin')).not.toHaveClass(/resolved/);
  });

  test('deletes comments from storage and canvas', async ({ page }) => {
    await addCanvasComment(page);await page.click('.meridian-comment-pin');await page.click('#commentDelete');
    await expect(page.locator('.meridian-comment-pin')).toHaveCount(0);expect(await page.evaluate(() => JSON.parse(localStorage.getItem('meridian_review_comments_v1')))).toEqual([]);
  });

  test('comments and pins survive reload', async ({ page }) => {
    await addCanvasComment(page,'Persist this review');await page.reload();await page.waitForFunction(() => !!window.__CM);await page.waitForSelector('#mermaidOutput svg .meridian-comment-pin');
    await page.click('#commentsBtn');await expect(page.locator('#commentsList')).toContainText('Persist this review');
  });
});
