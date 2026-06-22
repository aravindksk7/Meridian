// @ts-check
const { test, expect } = require('@playwright/test');

const SUBDOMAIN_CODE = `domain:Commerce {
  subdomain:Checkout {
    app:Cart
    app:Payment
    app:Cart --> app:Payment
  }
  subdomain:Catalog {
    app:Product
  }
}

app:Payment --> app:Product`;

async function waitReady(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('http://localhost:4321/meridian.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof onInput === 'function' && typeof $input !== 'undefined' && $input !== null,
    { timeout: 12000 }
  );
}

test.describe('Domain subdomain grouping', () => {
  test.beforeEach(({ page }) => waitReady(page));

  test('parser records nested subdomains under their parent domain', async ({ page }) => {
    const state = await page.evaluate(src => {
      const code = parser.parse(src, 'LR');
      const domainId = [...parser.domains.keys()][0];
      const subIds = [...parser.subdomains.keys()];
      return {
        code,
        domainId,
        subIds,
        parents: subIds.map(id => parser.subdomainParents.get(id)),
        checkoutKids: parser.subdomains.get('SUBDOMAIN_Checkout') || [],
        commerceKids: parser.domains.get('DOMAIN_Commerce') || [],
      };
    }, SUBDOMAIN_CODE);

    expect(state.domainId).toBe('DOMAIN_Commerce');
    expect(state.subIds).toEqual(expect.arrayContaining(['SUBDOMAIN_Checkout', 'SUBDOMAIN_Catalog']));
    expect(state.parents).toEqual(expect.arrayContaining(['DOMAIN_Commerce']));
    expect(state.checkoutKids).toEqual(expect.arrayContaining(['APP_Cart', 'APP_Payment']));
    expect(state.commerceKids).toEqual(expect.arrayContaining(['APP_Cart', 'APP_Payment', 'APP_Product']));
    expect(state.code).toContain('subgraph DOMAIN_Commerce');
    expect(state.code).toContain('subgraph SUBDOMAIN_Checkout');
  });

  test('renders parent domain and child subdomain clusters', async ({ page }) => {
    await page.evaluate(src => { $input.value = src; }, SUBDOMAIN_CODE);
    await page.waitForFunction(
      () => document.querySelectorAll('#mermaidOutput svg g.cluster').length >= 3,
      { timeout: 10000 }
    );

    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('#mermaidOutput svg g.cluster')]
        .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
    );

    expect(labels.some(label => label.includes('Commerce'))).toBe(true);
    expect(labels.some(label => label.includes('Checkout'))).toBe(true);
    expect(labels.some(label => label.includes('Catalog'))).toBe(true);
  });

  test('subdomain collapse creates a styled proxy inside the parent domain', async ({ page }) => {
    const collapsed = await page.evaluate(src => {
      const raw = parser.parse(src, 'LR');
      _collapsedGroups.add('SUBDOMAIN_Checkout');
      const out = applyGroupCollapse(raw);
      _collapsedGroups.clear();
      return out;
    }, SUBDOMAIN_CODE);

    expect(collapsed).toContain('subgraph DOMAIN_Commerce');
    expect(collapsed).not.toContain('subgraph SUBDOMAIN_Checkout');
    expect(collapsed).toContain('SUBDOMAIN_Checkout["');
    expect(collapsed).toContain('style SUBDOMAIN_Checkout');
    expect(collapsed).toContain('SUBDOMAIN_Checkout --> APP_Product');
  });
});
