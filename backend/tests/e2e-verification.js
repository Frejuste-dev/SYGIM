const http = require('http');

const BASE_URL = 'http://localhost:5000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      });
    }

    const reqOpts = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    if (options.token) {
      reqOpts.headers['Authorization'] = `Bearer ${options.token}`;
    }
    if (options.cookie) {
      reqOpts.headers['Cookie'] = options.cookie;
    }

    const req = http.request(url, reqOpts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function extractCookie(headers) {
  const setCookies = headers['set-cookie'];
  if (!setCookies) return '';
  return setCookies.map(c => c.split(';')[0]).join('; ');
}

async function runE2E() {
  console.log('===============================================================');
  console.log('🧪 SYGIM E2E VALIDATION SUITE — TEST DE TOUTES LES PAGES');
  console.log('===============================================================\n');

  // 1. AUTHENTICATION & ROLES
  console.log('1️⃣  AUTHENTIFICATION & SESSIONS DES RÔLES');
  
  const loginAdmin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'Admin2026!' }
  });
  const adminCookie = extractCookie(loginAdmin.headers);
  assert(loginAdmin.status === 200 && adminCookie.includes('accessToken'), 'Connexion Admin OK (Cookie sécurisé reçu)');

  const loginComptable = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'comptable', password: 'Comptable2026!' }
  });
  const comptableCookie = extractCookie(loginComptable.headers);
  assert(loginComptable.status === 200 && comptableCookie.includes('accessToken'), 'Connexion Comptable OK (rôle accounting)');

  const loginKorede = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'korede', password: 'Korede2026!' }
  });
  const collectorCookie = extractCookie(loginKorede.headers);
  assert(loginKorede.status === 200 && collectorCookie.includes('accessToken'), 'Connexion Collecteur Korédé OK (rôle collector)');

  const loginManager = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'manager', password: 'Mgr2026!' }
  });
  const managerCookie = extractCookie(loginManager.headers);
  assert(loginManager.status === 200 && managerCookie.includes('accessToken'), 'Connexion Gestionnaire OK (rôle collector_manager)');

  console.log('\n2️⃣  PAGE PROPRIÉTAIRES (Modalités de Paiement, Multi-Biens & Préférences)');
  const ownersList = await request('/api/owners', { cookie: adminCookie });
  assert(ownersList.status === 200 && Array.isArray(ownersList.data?.data), 'GET /api/owners renvoie la liste des propriétaires');
  
  const ownersStats = await request('/api/owners/stats', { cookie: adminCookie });
  assert(ownersStats.status === 200, 'GET /api/owners/stats renvoie les statistiques propriétaires');

  // Création d'un propriétaire avec préférences complètes
  const rand = Date.now().toString().slice(-4);
  const newOwner = await request('/api/owners', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      firstName: 'Alassane',
      lastName: `OUATTARA-${rand}`,
      email: `alassane.${rand}@example.com`,
      phone: `+225 07 10 20 ${rand.slice(0, 2)}`,
      preferredPaymentMethod: 'bank_transfer',
      payoutSchedule: 'monthly_full',
      preferredPayoutDay: '5',
      bankName: 'SOCIETE GENERALE CI',
      accountNumber: `CI008 01111 ${rand} 01`,
      commissionRate: 10
    }
  });
  assert(newOwner.status === 201 && newOwner.data?.data?.id, `POST /api/owners création propriétaire réussie (ID: ${newOwner.data?.data?.id})`);
  const createdOwnerId = newOwner.data?.data?.id;

  if (createdOwnerId) {
    const ownerDetails = await request(`/api/owners/${createdOwnerId}`, { cookie: adminCookie });
    assert(ownerDetails.status === 200 && ownerDetails.data?.data?.bank_name === 'SOCIETE GENERALE CI', 'Détails du propriétaire et coordonnées bancaires vérifiés');
  }

  console.log('\n3️⃣  PAGE LOGEMENTS & BIENS (Biens Vacants vs Loués & Attribution)');
  const propList = await request('/api/properties', { cookie: adminCookie });
  assert(propList.status === 200 && Array.isArray(propList.data?.data), 'GET /api/properties renvoie la liste des biens');

  const propStats = await request('/api/properties/stats', { cookie: adminCookie });
  assert(propStats.status === 200, 'GET /api/properties/stats renvoie les statistiques biens (vacants/loués)');

  // Trouver un bien ou en créer un
  let testPropertyId = propList.data?.data?.[0]?.id;
  if (!testPropertyId) {
    const propRes = await request('/api/properties', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        name: `Villa Oasis ${rand}`,
        address: 'Abidjan Cocody Angré',
        type: 'villa',
        rent: 250000,
        value: 45000000,
        status: 'vacant'
      }
    });
    testPropertyId = propRes.data?.data?.id;
  }

  console.log('\n4️⃣  PAGE LOCATAIRES (Attribution, Départ & Libération Automatique)');
  const clientsList = await request('/api/clients', { cookie: adminCookie });
  assert(clientsList.status === 200 && Array.isArray(clientsList.data?.data), 'GET /api/clients renvoie la liste des locataires');

  const clientStats = await request('/api/clients/stats', { cookie: adminCookie });
  assert(clientStats.status === 200, 'GET /api/clients/stats renvoie les statistiques locataires');

  // Test Attribution d'un bien à un nouveau locataire
  const assignRes = await request(`/api/properties/${testPropertyId}/assign`, {
    method: 'POST',
    cookie: collectorCookie,
    body: {
      rent: 200000,
      deposit: 400000,
      startDate: '2026-11-01',
      newTenant: {
        firstName: 'Jean-Marc',
        lastName: `KOFFI-${rand}`,
        phone: `+225 05 44 33 ${rand.slice(0, 2)}`,
        email: `jm.koffi.${rand}@test.ci`
      }
    }
  });
  assert(assignRes.status === 200 && assignRes.data?.data?.tenantId, 'Attribution réussie du bien au nouveau locataire (statut loué)');
  const testTenantId = assignRes.data?.data?.tenantId;

  // Test Départ locataire & Libération automatique en VACANT
  if (testTenantId) {
    const departRes = await request(`/api/clients/${testTenantId}/depart`, {
      method: 'POST',
      cookie: collectorCookie,
      body: {
        departureDate: '2026-11-10',
        departureReason: 'Déménagement mutation',
        departureNotes: 'Clés restituées, logement en parfait état'
      }
    });
    assert(departRes.status === 200, 'Signalement de départ locataire validé');

    const checkProp = await request(`/api/properties/${testPropertyId}`, { cookie: adminCookie });
    assert(checkProp.data?.data?.status === 'vacant', 'Logement automatiquement rebasculé en statut VACANT (Disponible)');
  }

  console.log('\n5️⃣  MODULE RÉPARATIONS & AMORTISSEMENT SUR LE LOYER');
  const repairsList = await request('/api/repairs', { cookie: collectorCookie });
  assert(repairsList.status === 200 && Array.isArray(repairsList.data?.data), 'GET /api/repairs renvoie la liste des réparations');

  // Trouver un locataire actif pour lui imputer une réparation
  const activeClient = clientsList.data?.data?.find(c => c.status === 'active' || c.status === 'pending');
  if (activeClient) {
    const repCreate = await request('/api/repairs', {
      method: 'POST',
      cookie: collectorCookie,
      body: {
        clientId: activeClient.id,
        propertyId: activeClient.property_id || null,
        description: 'Réparation fuite d\'eau et robinetterie cuisine',
        totalCost: 50000,
        deductionMode: 'monthly',
        monthlyDeduction: 25000,
        receiptRef: `FAC-TEST-${rand}`,
        notes: 'Travaux validés par le collecteur'
      }
    });
    assert(repCreate.status === 201 && repCreate.data?.data?.id, `Enregistrement réparation de 50 000 FCFA avec déduction 25 000 FCFA/mois (ID: ${repCreate.data?.data?.id})`);
    const repairId = repCreate.data?.data?.id;

    // Vérifier que le locataire a maintenant les informations de déduction dans sa tournée
    const clientTour = await request('/api/clients', { cookie: collectorCookie });
    const clientWithRepair = clientTour.data?.data?.find(c => c.id === activeClient.id);
    assert(
      Number(clientWithRepair?.active_repair_remaining) > 0 && Number(clientWithRepair?.active_repair_deduction) === 25000,
      'Déduction de réparation visible sur la carte tournée du collecteur'
    );

    // Solder la réparation
    if (repairId) {
      const settleRes = await request(`/api/repairs/${repairId}/settle`, {
        method: 'POST',
        cookie: collectorCookie,
        body: { notes: 'Clôture manuelle du test' }
      });
      assert(settleRes.status === 200 && settleRes.data?.data?.status === 'SETTLED', 'Réparation soldée avec succès (statut SETTLED)');
    }
  }

  console.log('\n6️⃣  GESTION COMPTABLE & FINANCIÈRE (Reversements, Préfinancements & Grand Livre)');
  const settlements = await request('/api/financial/settlements', { cookie: comptableCookie });
  assert(settlements.status === 200 && settlements.data?.data?.settlements, 'Comptable accède aux règlements propriétaires');

  const ledger = await request('/api/financial/ledger', { cookie: comptableCookie });
  assert(ledger.status === 200 && Array.isArray(ledger.data?.data?.entries), 'Comptable accède au Grand Livre Comptable Général');

  const ownersSummary = await request('/api/financial/owners-summary', { cookie: comptableCookie });
  assert(ownersSummary.status === 200, 'Comptable accède à la synthèse trésorerie propriétaires');

  // Enregistrement d'un préfinancement agence
  const prefinRes = await request('/api/financial/settlements', {
    method: 'POST',
    cookie: comptableCookie,
    body: {
      ownerId: createdOwnerId || 1,
      propertyId: testPropertyId || null,
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      expectedRent: 300000,
      totalCollected: 0,
      commissionRate: 10,
      agencyCommission: 30000,
      netOwnerPayout: 270000,
      amountPaid: 270000,
      paymentMethod: 'bank_transfer',
      payoutMode: 'prefinancing',
      isPrefinanced: 1,
      notes: 'Avance agence - locataire en retard'
    }
  });
  assert(prefinRes.status === 200 || prefinRes.status === 201, 'Enregistrement d\'un préfinancement propriétaire réussi');

  console.log('\n7️⃣  RAPPORTS & ANALYTICS (KPIs, Mensuel, Impayés & Rapport Préfinancement)');
  const kpis = await request('/api/reports/kpis', { cookie: comptableCookie });
  assert(kpis.status === 200, 'GET /api/reports/kpis validé');

  const monthlyReport = await request('/api/reports/monthly', { cookie: comptableCookie });
  assert(monthlyReport.status === 200, 'GET /api/reports/monthly validé');

  const overdueReport = await request('/api/alerts/overdue-payments', { cookie: comptableCookie });
  assert(overdueReport.status === 200, 'GET /api/alerts/overdue-payments validé');

  const prefinReport = await request('/api/reports/prefinancing', { cookie: comptableCookie });
  assert(prefinReport.status === 200 && prefinReport.data?.data?.kpis, 'GET /api/reports/prefinancing validé avec KPIs de trésorerie agence');

  console.log('\n8️⃣  CONTRÔLE DE SÉCURITÉ & RESTRICTIONS RBAC COLLECTEUR');
  const collectorSettlements = await request('/api/financial/settlements', { cookie: collectorCookie });
  assert(collectorSettlements.status === 403, 'Collecteur bloqué en 403 Forbidden sur /api/financial/settlements');

  const collectorLedger = await request('/api/financial/ledger', { cookie: collectorCookie });
  assert(collectorLedger.status === 403, 'Collecteur bloqué en 403 Forbidden sur /api/financial/ledger');

  const collectorTxList = await request('/api/transactions', { cookie: collectorCookie });
  assert(collectorTxList.status === 403, 'Collecteur bloqué en 403 Forbidden sur /api/transactions (liste globale)');

  console.log('\n===============================================================');
  console.log(`🏁 RÉSULTATS : ${passed} TESTS RÉUSSIS, ${failed} ÉCHECS`);
  console.log('===============================================================');
  
  if (failed > 0) process.exit(1);
}

runE2E().catch(err => {
  console.error('Erreur non gérée dans la suite de tests:', err);
  process.exit(1);
});
