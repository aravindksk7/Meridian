// @ts-check
const { test, expect } = require('@playwright/test');

const DIAGRAM_CODE = `domain:prod{
 config:EFS [icon: aws-efs]
instance:Lambda [icon: aws-lambda]
instance:EC2 [icon: aws-ec2]
instance:Lambda --> instance:EC2
config:EFS --> instance:EC2
env:test
db:DynamoDB [icon: aws-dynamodb]
instance:Cloud_Functions [icon: gcp-cloud-functions]
env:test --> instance:Cloud_Functions
instance:Cloud_Functions --> instance:EC2
instance:EC2 --> db:DynamoDB
db:DynamoDB --> net:ww
}

domain:test{
instance:Lambda1 [icon: aws-lambda]
instance:ECS [icon: aws-ecs]
instance:Lambda1 --> instance:ECS}`;

// Expected arrows: [fromId, toId]  (SmartParser ID format: TYPE_Label)
const EXPECTED_EDGES = [
  ['INSTANCE_Lambda',          'INSTANCE_EC2'],
  ['CONFIG_EFS',               'INSTANCE_EC2'],
  ['ENV_test',                 'INSTANCE_Cloud_Functions'],
  ['INSTANCE_Cloud_Functions', 'INSTANCE_EC2'],
  ['INSTANCE_EC2',             'DB_DynamoDB'],
  ['DB_DynamoDB',              'NET_ww'],
  ['INSTANCE_Lambda1',         'INSTANCE_ECS'],
];

test.describe('Arrows inside domain blocks', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4321/meridian.html');
    // Wait for the $input adapter to be set (CM editor ready).
    // $input is a `let` global (not on window) so we access it directly in evaluate.
    await page.waitForFunction(
      () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
      { timeout: 12000 }
    );
  });

  /**
   * Sets the editor value (triggers onInput + parser.parse synchronously)
   * and returns the parser's relationship list.
   */
  async function parseCode(page, code) {
    return page.evaluate((src) => {
      // $input.value setter dispatches a CM transaction → updateListener → onInput()
      $input.value = src;
      // parser.relationships is populated synchronously inside onInput → parser.parse()
      return parser.relationships.map(r => ({ from: r.from, to: r.to, label: r.label }));
    }, code);
  }

  /** Sets editor content then waits for at least one SVG edge path to appear. */
  async function renderCode(page, code) {
    await page.evaluate((src) => { $input.value = src; }, code);
    await page.waitForFunction(
      () => {
        const svg = document.querySelector('#mermaidOutput svg');
        return svg !== null && svg.querySelectorAll('.edgePaths path').length > 0;
      },
      { timeout: 8000 }
    );
  }

  // ── Parser unit tests ─────────────────────────────────────────────────────

  test('parser: arrows inside domain:prod block produce relationships', async ({ page }) => {
    const rels = await parseCode(page, DIAGRAM_CODE);
    const pairs = rels.map(r => [r.from, r.to]);

    for (const [from, to] of EXPECTED_EDGES) {
      expect(pairs, `Missing edge ${from} --> ${to}`).toContainEqual([from, to]);
    }
  });

  test('parser: relationship count matches all expected edges', async ({ page }) => {
    const rels = await parseCode(page, DIAGRAM_CODE);
    expect(rels.length).toBeGreaterThanOrEqual(EXPECTED_EDGES.length);
  });

  test('parser: closing } on same line as last arrow is handled', async ({ page }) => {
    const code = `domain:inline{
instance:Alpha [icon: aws-lambda]
instance:Beta [icon: aws-ecs]
instance:Alpha --> instance:Beta}`;

    const rels = await parseCode(page, code);
    const pairs = rels.map(r => [r.from, r.to]);
    expect(pairs, 'Missing edge for inline-closing-brace case').toContainEqual(
      ['INSTANCE_Alpha', 'INSTANCE_Beta']
    );
  });

  // ── SVG rendering tests ───────────────────────────────────────────────────

  test('SVG: edge count matches all expected arrows', async ({ page }) => {
    await renderCode(page, DIAGRAM_CODE);

    const edgeCount = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      return svg ? svg.querySelectorAll('.edgePaths path').length : 0;
    });

    expect(edgeCount, `Expected ≥${EXPECTED_EDGES.length} edge paths in SVG`).toBeGreaterThanOrEqual(EXPECTED_EDGES.length);
  });

  test('SVG: no render error box shown', async ({ page }) => {
    await page.evaluate((src) => { $input.value = src; }, DIAGRAM_CODE);
    await page.waitForTimeout(1500); // past 280 ms debounce + render
    const errorCount = await page.locator('.render-err').count();
    expect(errorCount).toBe(0);
  });

  test('SVG: both domain subgraphs are rendered', async ({ page }) => {
    await renderCode(page, DIAGRAM_CODE);

    const subgraphCount = await page.evaluate(() => {
      const svg = document.querySelector('#mermaidOutput svg');
      return svg ? svg.querySelectorAll('.cluster').length : 0;
    });

    // domain:prod and domain:test → 2 subgraphs (plus possible env:test subgraph)
    expect(subgraphCount, 'Expected at least 2 domain subgraphs').toBeGreaterThanOrEqual(2);
  });
});
