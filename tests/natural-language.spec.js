// Natural-language Smart Input: every documented phrase plus common variants.
const { test, expect } = require('@playwright/test');
const { openApp, setInput } = require('./helpers');

// [input, expected relationships as "FromLabel -label-> ToLabel"]
const CASES = [
  // Documented in Help → Natural Language
  ['A connects to B', ['A -connects to-> B']],
  ['A calls B', ['A -calls-> B']],
  ['A queries B', ['A -queries-> B']],
  ['A reads from B', ['A -reads from-> B']],
  ['A writes to B', ['A -writes to-> B']],
  ['A depends on B', ['A -depends on-> B']],
  ['A sends data to B', ['A -sends to-> B']],
  ['A talks to B', ['A -talks to-> B']],
  ['A uses B', ['A -uses-> B']],
  ['A forwards to B', ['A -forwards to-> B']],
  ['A publishes to B', ['A -publishes to-> B']],
  ['A subscribes to B', ['A -subscribes to-> B']],
  ['UserAPI connects to PostgreSQL', ['UserAPI -connects to-> PostgreSQL']],
  ['BatchJob reads from db:Staging', ['BatchJob -reads from-> Staging']],
  ['app:Frontend calls app:API', ['Frontend -calls-> API']],
  // Articles, multi-word names, singular verbs
  ['The API calls the database', ['API -calls-> database']],
  ['Order Service calls Payment Service', ['Order Service -calls-> Payment Service']],
  ['API query Postgres', ['API -queries-> Postgres']],
  ['Users log in to Portal', ['Users -logs in to-> Portal']],
  // Fan-out / fan-in
  ['API calls Auth and Billing', ['API -calls-> Auth', 'API -calls-> Billing']],
  ['API calls Auth, Billing', ['API -calls-> Auth', 'API -calls-> Billing']],
  ['Web, Mobile call API', ['Web -calls-> API', 'Mobile -calls-> API']],
  // Chains and multiple sentences
  ['Service A calls Service B which writes to Postgres', ['Service A -calls-> Service B', 'Service B -writes to-> Postgres']],
  ['API reads from Cache and writes to Postgres', ['API -reads from-> Cache', 'API -writes to-> Postgres']],
  ['A calls B; B queries C.', ['A -calls-> B', 'B -queries-> C']],
  ['Data flows from Kafka to Spark', ['Kafka -flows to-> Spark']],
  // Extra verbs
  ['API stores data in Postgres', ['API -stores in-> Postgres']],
  ['Worker consumes from Kafka', ['Worker -consumes from-> Kafka']],
  ['Gateway routes to API', ['Gateway -routes to-> API']],
  ['Cron triggers ETL', ['Cron -triggers-> ETL']],
  ['API authenticates with Okta', ['API -authenticates with-> Okta']],
  ['App fetches from Cache', ['App -fetches from-> Cache']],
  ['Client sends request to Server', ['Client -sends to-> Server']],
  ['User accesses the dashboard', ['User -accesses-> dashboard']],
  ['App uses Redis for caching', ['App -uses-> Redis']],
  ['Health Monitor calls API', ['Health Monitor -calls-> API']],
  ['Primary syncs with Replica', ['Primary -syncs with-> Replica']],
  // Arrow syntax keeps working, including single-letter names
  ['A --> B', ['A --> B']],
  ['Frontend -> Backend', ['Frontend --> Backend']],
];

test.describe('natural language parsing', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('all phrases produce the expected relationships', async ({ page }) => {
    const results = await page.evaluate((cases) => cases.map(([input]) => {
      const p = new SmartParser();
      p.parse(input, 'LR');
      return p.relationships.map(r => {
        const from = p.entities.get(r.from).label, to = p.entities.get(r.to).label;
        return r.label ? `${from} -${r.label}-> ${to}` : `${from} --> ${to}`;
      });
    }), CASES);
    const failures = [];
    CASES.forEach(([input, expected], i) => {
      const got = results[i];
      if (JSON.stringify(got) !== JSON.stringify(expected)) failures.push(`${input}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(got)}`);
    });
    expect(failures, failures.join('\n')).toEqual([]);
  });

  test('bare declarations and plain prefixed labels are not mistaken for sentences', async ({ page }) => {
    const r = await page.evaluate(() => {
      const p = new SmartParser();
      p.parse('nginx redis postgres\napp:Order Service\ninstance:file monitor', 'LR');
      return { rels: p.relationships.length, labels: [...p.entities.values()].map(e => `${e.type}:${e.label}`) };
    });
    expect(r.rels).toBe(0);
    expect(r.labels).toEqual(['server:nginx', 'db:redis', 'db:postgres', 'app:Order Service', 'instance:file monitor']);
  });

  test('a natural-language paragraph renders a connected diagram with labelled edges', async ({ page }) => {
    await setInput(page, [
      'The web app calls the API Gateway',
      'API Gateway routes to Order Service and User Service',
      'Order Service writes to db:Orders and publishes to Kafka',
      'Billing consumes from Kafka',
    ].join('\n'));
    await expect(page.locator('#previewStatus')).toContainText('OK');
    const r = await page.evaluate(() => ({
      edges: document.querySelectorAll('#mermaidOutput svg .flowchart-link').length,
      labels: [...document.querySelectorAll('#mermaidOutput svg g.edgeLabel')].map(l => l.textContent.trim()).filter(Boolean).sort(),
      rels: parser.relationships.length,
    }));
    expect(r.rels).toBe(6);
    expect(r.edges).toBe(6);
    expect(r.labels).toEqual(['calls', 'consumes from', 'publishes to', 'routes to', 'routes to', 'writes to']);
  });

  test('natural language works in sequence diagrams', async ({ page }) => {
    await page.selectOption('#diagramType', 'sequence');
    await setInput(page, 'Browser calls API\nAPI queries Postgres');
    const msgs = await page.locator('#mermaidOutput svg text.messageText').allTextContents();
    expect(msgs).toEqual(['calls', 'queries']);
  });
});
