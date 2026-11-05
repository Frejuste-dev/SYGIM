const { chromium } = require('playwright');

const APP_URL = 'http://127.0.0.1:4173/collector';
const USER = {
  id: 7,
  username: 'korede',
  role: 'collector',
  userType: 'collector',
  firstName: 'Korede',
  lastName: 'Ndiaye',
  displayName: 'Korede Ndiaye',
  collectorName: 'KOREDE'
};

const CLIENTS = [
  {
    id: 1,
    firstName: 'Fatou',
    lastName: 'BA',
    phone: '77 000 00 01',
    address: 'Plateau',
    property: 'Studio Plateau',
    amountDue: 100000,
    amountPaid: 100000,
    status: 'paid',
    agent: 'KOREDE'
  },
  {
    id: 2,
    firstName: 'Samba',
    lastName: 'DIOP',
    phone: '77 000 00 02',
    address: 'Mermoz',
    property: 'Appartement Mermoz',
    amountDue: 120000,
    amountPaid: 20000,
    status: 'overdue',
    agent: 'KOREDE'
  },
  {
    id: 3,
    firstName: 'Awa',
    lastName: 'FALL',
    phone: '77 000 00 03',
    address: 'Ouakam',
    property: 'Villa Ouakam',
    amountDue: 150000,
    amountPaid: 100000,
    status: 'partial',
    agent: 'KOREDE'
  }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function installApiMocks(page, state) {
  await page.route('http://127.0.0.1:4173/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === 'POST' && path.endsWith('/transactions')) {
      state.transactionPosts += 1;
      state.transactionPayloads.push(request.postDataJSON());
      await new Promise(resolve => setTimeout(resolve, 650));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 901 } })
      });
      return;
    }

    const dataByPath = {
      '/api/clients': CLIENTS,
      '/api/properties': [
        { id: 11, name: 'Appartement Mermoz', address: 'Mermoz', status: 'loue', tenantId: 2 }
      ],
      '/api/owners': [],
      '/api/collectors': [],
      '/api/transactions': [],
      '/api/alerts/overdue-payments': [
        {
          id: 51,
          first_name: 'Samba',
          last_name: 'DIOP',
          property_name: 'Appartement Mermoz',
          amount_owed: 100000,
          status: 'late',
          severity: 'haute'
        }
      ]
    };

    const responseData = dataByPath[path] || [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: responseData })
    });
  });
}

async function authenticate(page) {
  page.on('pageerror', error => console.error('Browser page error:', error.message));
  page.on('console', message => {
    if (message.type() === 'error') console.error('Browser console error:', message.text());
  });
  await page.addInitScript(user => {
    localStorage.setItem('sygim_jwt_token', 'collector-test-token');
    localStorage.setItem('sygim_current_user', JSON.stringify(user));
  }, USER);
}

async function waitForCollector(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: 'Collecte des loyers' }).waitFor({ timeout: 10000 });
  } catch (error) {
    console.error('Collector URL:', page.url());
    console.error('Collector body:', (await page.locator('body').innerText()).slice(0, 800));
    throw error;
  }
  await page.locator('.client-card').first().waitFor();
}

async function verifyDesktop(browser) {
  const state = { transactionPosts: 0, transactionPayloads: [] };
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  await authenticate(page);
  await installApiMocks(page, state);
  await waitForCollector(page);

  assert(
    await page.getByRole('button', { name: 'Synchroniser les données' }).count() === 1,
    'La synchronisation apparaît plus d’une fois sur Collector.'
  );

  const names = await page.locator('.client-card .client-name').allTextContents();
  assert(names[0].includes('DIOP Samba'), 'Les locataires avec solde ne sont pas affichés en premier.');
  assert(names[names.length - 1].includes('BA Fatou'), 'La carte soldée devrait être reléguée après les soldes ouverts.');

  const alertExpanded = await page.locator('[aria-expanded="true"]').count();
  assert(alertExpanded >= 1, 'L’alerte urgente Collector ne s’ouvre plus automatiquement.');

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  assert(!hasHorizontalOverflow, 'Le rendu desktop présente un débordement horizontal.');

  await page.screenshot({
    path: 'tests/manual/collector-after-desktop.png',
    fullPage: true
  });
  await context.close();
}

async function verifyMobilePaymentFlow(browser) {
  const state = { transactionPosts: 0, transactionPayloads: [] };
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  await authenticate(page);
  await installApiMocks(page, state);
  await waitForCollector(page);

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  assert(!hasHorizontalOverflow, 'Le rendu mobile présente un débordement horizontal.');

  await page.locator('.client-card').first()
    .getByRole('button', { name: 'Enregistrer un paiement' })
    .click();

  const paymentModal = page.getByRole('heading', { name: 'Enregistrer un paiement' })
    .locator('..').locator('..');
  await paymentModal.getByText('Appartement Mermoz', { exact: true }).waitFor();
  await paymentModal.getByText('100 000 XOF', { exact: true }).waitFor();
  await paymentModal.getByRole('button', { name: 'Wave' }).click();
  await paymentModal.getByRole('button', { name: /Valider et passer/ }).click();

  const signatureModal = page.getByRole('heading', { name: 'Signature Électronique' })
    .locator('..').locator('..');
  await signatureModal.getByText('DIOP Samba', { exact: true }).waitFor();
  await signatureModal.getByText('Wave', { exact: true }).waitFor();

  const canvas = signatureModal.locator('.signature-pad-canvas');
  const canvasMetrics = await canvas.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      cssWidth: rect.width,
      cssHeight: rect.height,
      width: element.width,
      height: element.height,
      touchAction: getComputedStyle(element).touchAction
    };
  });
  assert(canvasMetrics.touchAction === 'none', 'Le défilement tactile n’est pas neutralisé sur le canvas.');
  assert(canvasMetrics.width >= canvasMetrics.cssWidth * 1.9, 'Le canvas ne tient pas compte du devicePixelRatio.');

  const canvasBox = await canvas.boundingBox();
  assert(canvasBox, 'La zone de signature mobile n’est pas visible.');
  const touchPoints = [
    { x: canvasBox.x + 30, y: canvasBox.y + 90 },
    { x: canvasBox.x + 90, y: canvasBox.y + 45 },
    { x: canvasBox.x + 150, y: canvasBox.y + 125 },
    { x: canvasBox.x + 230, y: canvasBox.y + 55 }
  ];
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoints[0]]
  });
  for (const point of touchPoints.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point]
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });

  await signatureModal.getByText('Signature capturée', { exact: true }).waitFor();
  await page.screenshot({
    path: 'tests/manual/collector-signature-mobile.png',
    fullPage: false
  });
  const submitButton = signatureModal.getByRole('button', { name: 'Enregistrer et finaliser' });
  await submitButton.evaluate(button => {
    button.click();
    button.click();
  });

  await signatureModal.getByRole('button', { name: /Enregistrement en cours/ }).waitFor();
  assert(await signatureModal.getByRole('button', { name: /Enregistrement en cours/ }).isDisabled(),
    'Le bouton final reste actif pendant l’appel API.');
  await page.waitForTimeout(150);
  assert(state.transactionPosts === 1, `Deux clics rapides ont produit ${state.transactionPosts} appels API.`);

  const successNotice = page.locator('.collector-notice-success');
  await successNotice.waitFor();
  assert((await successNotice.innerText()).includes('Paiement de'),
    'Le paiement réussi n’affiche pas de confirmation dans la page.');
  assert(state.transactionPosts === 1, 'Plus d’un paiement a été envoyé.');
  assert(
    state.transactionPayloads[0]?.signature?.startsWith('data:image/png;base64,'),
    'Le format de signature envoyé a changé.'
  );

  await page.screenshot({
    path: 'tests/manual/collector-after-mobile.png',
    fullPage: true
  });
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    await verifyDesktop(browser);
    await verifyMobilePaymentFlow(browser);
    console.log('Collector UX test: PASS');
    console.log('Transaction POST after rapid double click: 1');
    console.log('Signature payload format: data:image/png;base64');
    console.log('Screenshots: desktop, mobile and signature modal saved in tests/manual');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
