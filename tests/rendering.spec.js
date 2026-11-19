// Rendering: every diagram type, entity type, arrow style, grouping construct,
// icon metadata and error path produces the right SVG.
const { test, expect } = require('@playwright/test');
const { openApp, setInput, setType, stats } = require('./helpers');

const ALL_TYPES = `app:App
db:Db
server:Server
instance:Instance
interface:Iface
config:Cfg
batch:Batch
watcher:Watch
ftp:Ftp
app:App --> db:Db`;

test.describe('flowchart rendering', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('initial template renders with nodes, edges, groups and an OK status', async ({ page }) => {
    const s = await stats(page);
    expect(s.error).toBe(false);
    expect(s.nodes).toBeGreaterThan(5);
    expect(s.edges).toBeGreaterThan(4);
    expect(s.clusters).toBeGreaterThan(0);
    await expect(page.locator('#previewStatus')).toContainText('OK');
    await expect(page.locator('#statusLeft')).toContainText(/Rendered · \d+ nodes · \d+ edges/);
  });

  test('every entity type renders its own Mermaid shape and class', async ({ page }) => {
    await setInput(page, ALL_TYPES);
    const r = await page.evaluate(() => ({
      code: lastCode,
      classes: [...document.querySelectorAll('#mermaidOutput svg g.node')].map(g => [...g.classList].find(c => ['app', 'db', 'server', 'instance', 'interface', 'config', 'batch', 'watcher', 'ftp'].includes(c))).sort(),
    }));
    expect(r.classes).toEqual(['app', 'batch', 'config', 'db', 'ftp', 'instance', 'interface', 'server', 'watcher']);
    expect(r.code).toContain('DB_Db[("');          // cylinder
    expect(r.code).toContain('SERVER_Server[["');  // subroutine
    expect(r.code).toContain('INTERFACE_Iface{{"'); // hexagon
    expect(r.code).toContain('BATCH_Batch[/"');    // parallelogram
    expect(r.code).toContain('FTP_Ftp(["');        // stadium
  });

  test('flowchart shapes (process, decision, terminal, io, document, predefined, connector)', async ({ page }) => {
    await setInput(page, 'terminal:Start --> process:Work\nprocess:Work --> decision:Ok\ndecision:Ok --> io:Read\nio:Read --> document:Report\ndocument:Report --> predefined:Sub\npredefined:Sub --> connector:J');
    const s = await stats(page);
    expect(s.error).toBe(false);
    expect(s.nodes).toBe(7);
    expect(s.edges).toBe(6);
  });

  test('arrow styles: plain, labelled, bidirectional, pre (dotted), post (thick), chain', async ({ page }) => {
    await setInput(page, [
      'app:A --> app:B',
      'app:B --calls--> app:C',
      'app:C <--> app:D',
      'app:D --pre--> app:E',
      'app:E --post--> app:F',
      'batch:X >> batch:Y >> batch:Z',
    ].join('\n'));
    const r = await page.evaluate(() => ({ code: lastCode, rels: parser.relationships.map(x => [x.label, x.bidir, x.style]) }));
    expect(r.code).toMatch(/APP_A --> APP_B/);
    expect(r.code).toMatch(/APP_B -->\|"calls"\| APP_C/);
    expect(r.code).toMatch(/APP_C <--> APP_D/);
    expect(r.code).toMatch(/APP_D -\. pre \.-> APP_E/);
    expect(r.code).toMatch(/APP_E == post ==> APP_F/);
    expect(r.code).toMatch(/BATCH_X == triggers ==> BATCH_Y/);
    expect(r.rels).toHaveLength(7);
    const s = await stats(page);
    expect(s.edges).toBe(7);
    expect(s.edgeLabels).toEqual(expect.arrayContaining(['calls', 'pre', 'post', 'triggers']));
  });

  test('env / net / domain / subdomain groups render as nested clusters', async ({ page }) => {
    await setInput(page, `env:Prod {
  app:Api
}
net:DMZ { server:Proxy }
domain:Sales {
  subdomain:Orders {
    app:OrderSvc
  }
  db:SalesDb
}
server:Proxy --> app:Api
app:Api --> app:OrderSvc
app:OrderSvc --> db:SalesDb`);
    const r = await page.evaluate(() => ({
      clusters: [...document.querySelectorAll('#mermaidOutput svg g.cluster')].map(c => c.textContent.trim()),
      nested: !!document.querySelector('#mermaidOutput svg g.cluster[id*="DOMAIN_Sales"]') ,
      envs: parser.environments.size, domains: parser.domains.size, subs: parser.subdomains.size,
      parent: [...parser.subdomainParents.entries()],
    }));
    expect(r.envs).toBe(2);
    expect(r.domains).toBe(1);
    expect(r.subs).toBe(1);
    expect(r.parent).toEqual([['SUBDOMAIN_Orders', 'DOMAIN_Sales']]);
    expect(r.clusters.join(' ')).toMatch(/Prod/);
    expect(r.clusters.join(' ')).toMatch(/DMZ/);
    expect(r.clusters.join(' ')).toMatch(/Sales/);
    expect(r.clusters.join(' ')).toMatch(/Orders/);
  });

  test('direction LR vs TD changes the layout', async ({ page }) => {
    await setInput(page, 'app:A --> app:B\napp:B --> app:C');
    const lr = await page.evaluate(() => { const b = document.querySelector('#mermaidOutput svg').getBBox(); return b.width / b.height; });
    await setType(page, 'TD');
    expect(await page.evaluate(() => lastCode.startsWith('flowchart TD'))).toBe(true);
    const td = await page.evaluate(() => { const b = document.querySelector('#mermaidOutput svg').getBBox(); return b.width / b.height; });
    expect(lr).toBeGreaterThan(td);
  });

  test('icon metadata attaches an icon image to the node', async ({ page }) => {
    await setInput(page, 'instance:Fn [icon: aws-lambda] --> db:Store');
    expect(await page.evaluate(() => parser.entities.get('INSTANCE_Fn').icon)).toBeTruthy();
    await expect(page.locator('#mermaidOutput svg g.node[id*="INSTANCE_Fn"] img')).toHaveAttribute('src', /aws-lambda/);
  });

  test('comments and blank lines are ignored', async ({ page }) => {
    await setInput(page, '// heading\n\n# also a comment\napp:A --> app:B\n');
    const s = await stats(page);
    expect(s.nodes).toBe(2);
    expect(s.edges).toBe(1);
  });

  test('semantic warnings appear in the lint panel and in the editor gutter', async ({ page }) => {
    await setInput(page, 'app:A --> app:B\napp:Lonely\nfoo:Bar\napp:A -> ');
    await expect(page.locator('#lintBtn')).toContainText(/warning/);
    await page.click('#lintBtn');
    const panel = page.locator('#lintPanel');
    await expect(panel).toHaveClass(/vis/);
    await expect(panel).toContainText('UNKNOWN_PREFIX');
    await expect(panel).toContainText('ORPHAN');
    await expect(page.locator('#smartInput .cm-lintRange-warning').first()).toBeAttached();
    // clicking a warning jumps the cursor to its line
    await panel.locator('.lint-item', { hasText: 'UNKNOWN_PREFIX' }).click();
    const line = await page.evaluate(() => _cmView.state.doc.lineAt(_cmView.state.selection.main.head).number);
    expect(line).toBe(3);
  });

  test('empty input shows the placeholder; text brings the diagram back', async ({ page }) => {
    await setInput(page, '');
    await expect(page.locator('#mermaidOutput svg')).toHaveCount(0);
    await expect(page.locator('#mermaidOutput')).toContainText('Start typing');
    await setInput(page, 'app:Back');
    await expect(page.locator('#mermaidOutput svg g.node')).toHaveCount(1);
  });

  test('labels with special characters are escaped safely', async ({ page }) => {
    await setInput(page, 'app:"Quote" --> app:Amp&Co\napp:Amp&Co --x<y--> db:Store');
    const s = await stats(page);
    expect(s.error).toBe(false);
    expect(s.nodes).toBeGreaterThanOrEqual(3);
  });
});

test.describe('other diagram types', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await setInput(page, 'app:Web --> app:API\napp:API --queries--> db:Store\napp:API <--> app:Auth');
  });

  test('sequence diagram renders participants and messages', async ({ page }) => {
    await setType(page, 'sequence');
    const r = await page.evaluate(() => ({
      code: lastCode,
      actors: new Set([...document.querySelectorAll('#mermaidOutput svg text.actor')].map(t => t.textContent.trim())).size,
      msgs: [...document.querySelectorAll('#mermaidOutput svg text.messageText')].map(t => t.textContent.trim()),
    }));
    expect(r.code.startsWith('sequenceDiagram')).toBe(true);
    expect(r.actors).toBe(4);
    expect(r.msgs).toEqual(['calls', 'queries', 'calls']);
  });

  test('class diagram renders one class box per entity with relations', async ({ page }) => {
    await setType(page, 'class');
    const r = await page.evaluate(() => ({
      code: lastCode,
      classes: document.querySelectorAll('#mermaidOutput svg g.node').length,
      relations: document.querySelectorAll('#mermaidOutput svg path.relation').length,
    }));
    expect(r.code.startsWith('classDiagram')).toBe(true);
    expect(r.classes).toBe(4);
    expect(r.relations).toBe(3);
  });

  test('design board renders lanes, cards and connections', async ({ page }) => {
    await setType(page, 'design');
    await expect(page.locator('#previewStatus')).toContainText('Design Board');
    const r = await page.evaluate(() => ({
      cards: document.querySelectorAll('#mermaidOutput svg .design-node, #mermaidOutput svg g.node').length,
      edges: document.querySelectorAll('#mermaidOutput svg .design-edge, #mermaidOutput svg path.flowchart-link, #mermaidOutput svg .edgePaths path').length,
    }));
    expect(r.cards).toBeGreaterThanOrEqual(4);
    expect(r.edges).toBeGreaterThanOrEqual(3);
  });

  test('switching types back and forth keeps rendering without errors', async ({ page }) => {
    for (const t of ['TD', 'design', 'sequence', 'class', 'LR']) {
      await setType(page, t);
      const s = await stats(page);
      expect(s.error, t).toBe(false);
    }
  });
});
