const { chromium } = require('playwright');

const APP_URL = 'http://127.0.0.1:4173/manager';
const USER = {
  id: 2,
  role: 'collector_manager',
  userType: 'collector_manager',
  displayName: 'Aminata Manager',
  firstName: 'Aminata',
  lastName: 'Manager'
};

const BASE_COLLECTORS = [
  { id: 1, firstName: 'Korede', lastName: 'NDIAYE' },
  { id: 2, firstName: 'Leonce', lastName: 'DIOP' },
  { id: 3, firstName: 'Marieme', lastName: 'FALL' },
  { id: 4, firstName: 'Oumar', lastName: 'SOW' }
];

const BASE_PROPERTIES = [
  { id: 11, name: 'Appartement Mermoz', address: 'Mermoz', type: 'Appartement', value: 85000000, collectorId: 1 },
  { id: 12, name: 'Villa Ouakam', address: 'Ouakam', type: 'Villa', value: 130000000, collectorId: 1 },
  { id: 13, name: 'Studio Plateau', address: 'Plateau', type: 'Studio', value: 45000000, collectorId: 2 },
  { id: 14, name: 'Maison Rufisque', address: 'Rufisque', type: 'Maison', value: 65000000 },
  { id: 15, name: 'Local Almadies', address: 'Almadies', type: 'Commerce', value: 95000000 }
];

const CLIENTS = [
  { id: 21, collector_id: 1, amount_due: 100000, amount_paid: 80000, status: 'partial' },
  { id: 22, collector_id: 1, amount_due: 100000, amount_paid: 20000, status: 'partial' },
  { id: 23, collector_id: 2, amount_due: 100000, amount_paid: 100000, status: 'paid' },
  { id: 24, collector_id: 4, amount_due: 100000, amount_paid: 0, status: 'pending' },
  { id: 25, collector_id: 1, amount_due: 50000, amount_paid: 50000, status: 'inactive' }
];

const TRANSACTIONS = [
  { id: 31, collector_id: 1, amount: 80000, status: 'processed', date: '2026-07-05' },
  { id: 32, collector_id: 1, amount: 20000, status: 'paid', date: '2026-07-09' },
  { id: 33, collector_id: 1, amount: 200000, status: 'processed', date: '2026-06-18' },
  { id: 34, collector_id: 2, amount: 100000, status: 'processed', date: '2026-07-11' },
  { id: 35, collector_id: 4, amount: 50000, status: 'pending', date: '2026-07-13' }
];

const ALERTS = [
  {
    id: 51,
    first_name: 'Samba',
    last_name: 'DIOP',
    property_name: 'Appartement Mermoz',
    amount_owed: 100000,
    status: 'late',
    severity: 'haute'
  },
  {
    id: 52,
    first_name: 'Awa',
    last_name: 'FALL',
    property_name: 'Villa Ouakam',
    amount_owed: 50000,
    status: 'partial',
    severity: 'normale'
  }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createState({ emptyCollectors = false } = {}) {
  return {
    collectors: emptyCollectors ? [] : structuredClone(BASE_COLLECTORS),
    properties: structuredClone(BASE_PROPERTIES),
    clients: structuredClone(CLIENTS),
    transactions: structuredClone(TRANSACTIONS),
    alerts: structuredClone(ALERTS),
    assignmentCalls: [],
    acknowledgeCalls: []
  };
}

async function authenticate(page) {
  page.on('pageerror', error => console.error('Browser page error:', error.message));
  await page.addInitScript(user => {
    localStorage.setItem('sygim_jwt_token', 'manager-test-token');
    localStorage.setItem('sygim_current_user', JSON.stringify(user));
  }, USER);
}

async function installApiMocks(page, state) {
  await page.route('http://127.0.0.1:4173/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === 'POST' && path.match(/^\/api\/collectors\/\d+\/assign-properties$/)) {
      const collectorId = Number(path.split('/')[3]);
      const propertyIds = request.postDataJSON().propertyIds;
      state.assignmentCalls.push({ collectorId, propertyIds });
      await new Promise(resolve => setTimeout(resolve, 650));
      state.properties = state.properties.map(property =>
        propertyIds.includes(property.id)
          ? { ...property, collectorId, collector_id: collectorId }
          : property
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { assignedCount: propertyIds.length } })
      });
      return;
    }

    if (request.method() === 'PUT' && path.match(/^\/api\/alerts\/\d+\/acknowledge$/)) {
      const alertId = Number(path.split('/')[3]);
      state.acknowledgeCalls.push(alertId);
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
      return;
    }

    const dataByPath = {
      '/api/collectors': state.collectors,
      '/api/properties': state.properties,
      '/api/clients': state.clients,
      '/api/transactions': state.transactions,
      '/api/owners': [],
      '/api/alerts/overdue-payments': state.alerts
    };
    const responseData = dataByPath[path] || [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: responseData })
    });
  });
}

async function waitForManager(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Gestion des récolteurs' }).waitFor();
  await page.getByRole('button', { name: 'Synchroniser les données' }).waitFor();
}

async function verifyDesktop(browser) {
  const state = createState();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await authenticate(page);
  await installApiMocks(page, state);
  await waitForManager(page);
  await page.locator('.manager-collector-card').first().waitFor();

  const syncButton = page.getByRole('button', { name: 'Synchroniser les données' });
  assert((await syncButton.getAttribute('class')).includes('btn-outline'),
    'La synchronisation Manager reste visuellement prioritaire.');
  assert(await page.locator('.overdue-alert-toggle[aria-expanded="true"]').count() === 1,
    'L’alerte urgente Manager ne s’ouvre plus automatiquement.');
  assert(await page.getByRole('button', { name: /Marquer l'alerte.*comme traitée/ }).count() === 2,
    'Les actions de traitement des alertes ne sont pas explicites.');
  assert(await page.getByText('2 à attribuer', { exact: true }).count() === 1,
    'Le résumé des biens à attribuer est absent.');

  const collectorCards = page.locator('.manager-collector-card');
  assert(await collectorCards.nth(0).getByText('Sans bien', { exact: true }).count() === 1,
    'Les récolteurs sans portefeuille ne sont pas prioritaires.');
  assert(await collectorCards.nth(1).getByText('Sans bien', { exact: true }).count() === 1,
    'Tous les récolteurs sans portefeuille ne remontent pas en premier.');

  const firstAcknowledge = page.getByRole('button', { name: /Marquer l'alerte de Samba DIOP/ });
  await firstAcknowledge.evaluate(button => {
    button.click();
    button.click();
  });
  await page.getByRole('button', { name: /Marquer l'alerte de Samba DIOP/ })
    .getByText('Traitement...', { exact: true }).waitFor();
  await page.waitForTimeout(100);
  assert(state.acknowledgeCalls.length === 1,
    `Le double clic sur une alerte a produit ${state.acknowledgeCalls.length} appels.`);
  await page.getByText(/Alerte de Samba DIOP marquée comme traitée/).waitFor();

  await page.getByRole('tab', { name: 'Performance' }).click();
  await page.getByText('Recouvrement · juillet 2026').first().waitFor();
  const firstRates = await page.locator('.manager-performance-rate > strong').allTextContents();
  assert(firstRates.includes('50%') && firstRates.includes('100%') && firstRates.includes('0%'),
    `Les taux réels attendus ne sont pas affichés : ${firstRates.join(', ')}`);
  assert(await page.getByText('Taux non disponible', { exact: true }).count() === 1,
    'Le cas sans loyer dû ne présente pas un état indisponible honnête.');
  assert(await page.getByText('100 000 XOF encaissés', { exact: true }).count() >= 2,
    'Les montants justifiant les taux ne sont pas visibles.');

  await page.getByRole('tab', { name: 'Récolteurs' }).click();
  await page.getByRole('tab', { name: 'Performance' }).click();
  const secondRates = await page.locator('.manager-performance-rate > strong').allTextContents();
  assert(JSON.stringify(firstRates) === JSON.stringify(secondRates),
    'Les taux changent encore après un aller-retour d’onglet.');
  await page.screenshot({
    path: 'tests/manual/manager-after-desktop-performance.png',
    fullPage: true
  });

  await page.getByRole('tab', { name: 'Récolteurs' }).click();
  await page.getByRole('button', { name: 'Attribuer un bien' }).click();
  assert(await page.getByRole('button', { name: 'Attribuer un bien' }).count() === 0,
    'Le CTA de navigation reste affiché dans l’onglet déjà actif.');
  await page.locator('#assignmentCollector').selectOption('1');

  const assignmentButtons = page.locator('.assignment-desktop-table .assignment-row-action');
  assert(await assignmentButtons.count() === 2, 'Les deux biens non attribués ne sont pas affichés.');
  assert(await assignmentButtons.nth(0).textContent().then(text => text.includes('Attribuer à NDIAYE')),
    'Le bouton ne rappelle pas le récolteur destinataire.');
  assert(await assignmentButtons.nth(1).isEnabled(),
    'Le second bien est bloqué avant le début de sa propre attribution.');

  await assignmentButtons.nth(0).evaluate(button => {
    button.click();
    button.click();
  });
  await assignmentButtons.nth(0).getByText('Attribution en cours...', { exact: true }).waitFor();
  assert(await assignmentButtons.nth(1).isEnabled(),
    'Le verrou d’un bien bloque les autres attributions.');
  await assignmentButtons.nth(1).click();
  await page.waitForTimeout(120);

  assert(state.assignmentCalls.length === 2,
    `Les clics ont produit ${state.assignmentCalls.length} appels au lieu de deux biens distincts.`);
  const assignedIds = state.assignmentCalls.flatMap(call => call.propertyIds).sort();
  assert(JSON.stringify(assignedIds) === JSON.stringify([14, 15]),
    `Les appels d’attribution ne sont pas uniques par bien : ${assignedIds.join(', ')}`);
  await page.locator('.assignment-desktop-table')
    .getByText('Tous les biens sont déjà attribués.', { exact: true }).waitFor();
  await page.screenshot({
    path: 'tests/manual/manager-after-desktop-assignment.png',
    fullPage: true
  });

  assert(!await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    'Le rendu desktop présente un débordement horizontal.');
  await context.close();
}

async function verifyMobile(browser) {
  const state = createState();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  await authenticate(page);
  await installApiMocks(page, state);
  await waitForManager(page);
  await page.locator('.manager-collector-card').first().waitFor();

  assert(await page.getByText('Aminata Manager', { exact: true }).isVisible(),
    'Le nom du manager reste masqué sur mobile.');
  assert(await page.getByRole('button', { name: 'Déconnexion' }).isVisible(),
    'La déconnexion reste inaccessible sur mobile.');

  const tabBoxes = await Promise.all(
    ['Récolteurs', 'Attributions', 'Performance'].map(async name =>
      page.getByRole('tab', { name }).boundingBox()
    )
  );
  assert(Math.max(...tabBoxes.map(box => box.y)) - Math.min(...tabBoxes.map(box => box.y)) < 4,
    'Les trois onglets ne tiennent pas sur une seule ligne mobile.');

  await page.getByRole('tab', { name: 'Attributions' }).click();
  await page.locator('#assignmentCollector').selectOption('1');
  assert(!await page.locator('.assignment-desktop-table').isVisible(),
    'Le tableau horizontal reste affiché sur mobile.');
  assert(await page.locator('.assignment-mobile-list').isVisible(),
    'La liste d’attribution mobile n’est pas visible.');
  assert(await page.getByRole('button', { name: /Attribuer Maison Rufisque à NDIAYE Korede/ }).isVisible(),
    'L’action du premier bien n’est pas immédiatement visible sur mobile.');
  await page.screenshot({
    path: 'tests/manual/manager-after-mobile-assignment.png',
    fullPage: true
  });

  await page.getByRole('tab', { name: 'Performance' }).click();
  await page.getByText('Taux non disponible', { exact: true }).waitFor();
  await page.screenshot({
    path: 'tests/manual/manager-after-mobile-performance.png',
    fullPage: true
  });
  assert(!await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    'Le rendu mobile présente un débordement horizontal.');
  await context.close();
}

async function verifyEmptyCollectors(browser) {
  const state = createState({ emptyCollectors: true });
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await context.newPage();
  await authenticate(page);
  await installApiMocks(page, state);
  await waitForManager(page);

  assert(await page.getByRole('button', { name: 'Attribuer un bien' }).count() === 0,
    'Le CTA d’attribution reste proposé sans récolteur.');
  await page.getByRole('tab', { name: 'Attributions' }).click();
  await page.getByText('Aucun récolteur disponible.', { exact: true }).waitFor();
  assert(await page.locator('#assignmentCollector').count() === 0,
    'Le sélecteur vide reste affiché sans récolteur.');
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    await verifyDesktop(browser);
    await verifyMobile(browser);
    await verifyEmptyCollectors(browser);
    console.log('Manager UX test: PASS');
    console.log('Rapid duplicate assignment: 1 POST for the same property');
    console.log('Parallel assignments: 2 distinct properties accepted');
    console.log('Performance rates: stable and derived from July 2026 transactions');
    console.log('Empty collectors: no dead-end primary CTA');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
