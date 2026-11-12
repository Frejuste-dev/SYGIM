const http = require('http');

function req(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:5000');
    const r = http.request(url, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.cookie ? { 'Cookie': opts.cookie } : {})
      }
    }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: d });
        }
      });
    });
    r.on('error', reject);
    if (opts.body) r.write(JSON.stringify(opts.body));
    r.end();
  });
}

function extractCookie(headers) {
  const setCookies = headers['set-cookie'];
  if (!setCookies) return '';
  return setCookies.map(c => c.split(';')[0]).join('; ');
}

async function runTest() {
  console.log('===============================================================');
  console.log('🧪 TEST: WORKFLOW COLLECTEUR -> COMPTABLE (ENCAISSEMENT & VALIDATION)');
  console.log('===============================================================\n');

  // 1. Login Collector
  const loginCol = await req('/api/auth/login', {
    method: 'POST',
    body: { username: 'korede', password: 'Korede2026!' }
  });
  const colCookie = extractCookie(loginCol.headers);
  console.log('1️⃣  Connexion Collecteur Korédé:', loginCol.status === 200 ? '✅ OK' : '❌ FAIL');

  // 2. Login Accountant
  const loginCpt = await req('/api/auth/login', {
    method: 'POST',
    body: { username: 'comptable', password: 'Comptable2026!' }
  });
  const cptCookie = extractCookie(loginCpt.headers);
  console.log('2️⃣  Connexion Comptable:', loginCpt.status === 200 ? '✅ OK' : '❌ FAIL');

  // 3. Find a client assigned to Korede
  const clientsRes = await req('/api/clients', { cookie: colCookie });
  const clients = clientsRes.data?.data || clientsRes.data || [];
  const testClient = clients[0];
  if (!testClient) {
    console.error('Aucun client trouvé pour le collecteur');
    process.exit(1);
  }
  const initialPaid = parseFloat(testClient.amount_paid || 0);
  console.log(`3️⃣  Client cible: ${testClient.first_name} ${testClient.last_name} (ID: ${testClient.id}), Solde payé initial: ${initialPaid} FCFA`);

  // 4. Collector submits a payment of 25 000 FCFA
  const paymentAmount = 25000;
  const paymentRef = 'TEST-COLLECT-' + Date.now().toString().slice(-6);
  const createTxRes = await req('/api/transactions', {
    method: 'POST',
    cookie: colCookie,
    body: {
      clientId: testClient.id,
      amount: paymentAmount,
      method: 'cash',
      reference: paymentRef,
      notes: 'Test collecte terrain'
    }
  });

  const createdTxId = createTxRes.data?.data?.id || createTxRes.data?.id;
  console.log(`4️⃣  Saisie encaissement par le collecteur: Statut HTTP ${createTxRes.status}, ID Transaction: ${createdTxId}`);

  // 5. Inspect transaction status
  const txDetails = await req(`/api/transactions/${createdTxId}`, { cookie: cptCookie });
  const tx = txDetails.data?.data || txDetails.data;
  console.log(`5️⃣  Vérification statut transaction créée: "${tx?.status}"`);
  if (tx?.status === 'pending') {
    console.log('  ✅ Statut vérifié: PENDING (en attente de réception des fonds par le comptable)');
  } else {
    console.error('  ❌ ERREUR: La transaction du collecteur doit être PENDING !');
    process.exit(1);
  }

  // 6. Check client's amount_paid has NOT been credited yet
  const clientCheck1 = await req(`/api/clients/${testClient.id}`, { cookie: colCookie });
  const currentPaid = parseFloat(clientCheck1.data?.data?.amount_paid || clientCheck1.data?.amount_paid || 0);
  console.log(`6️⃣  Vérification solde locataire avant validation: ${currentPaid} FCFA (Attendu: ${initialPaid} FCFA)`);
  if (currentPaid === initialPaid) {
    console.log('  ✅ Non-créditation anticipée vérifiée avec succès (locataire non crédité tant que les fonds ne sont pas remis) !');
  } else {
    console.error('  ❌ ERREUR: Le client ne doit PAS être crédité tant que le comptable n a pas validé !');
    process.exit(1);
  }

  // 7. Collector tries to validate -> MUST BE FORBIDDEN (403)
  const colValidateRes = await req(`/api/transactions/${createdTxId}/validate`, {
    method: 'POST',
    cookie: colCookie,
    body: { notes: 'Tentative de validation frauduleuse par le collecteur' }
  });
  console.log(`7️⃣  Tentative de validation par le collecteur: Statut HTTP ${colValidateRes.status}`);
  if (colValidateRes.status === 403) {
    console.log('  ✅ Sécurité RBAC vérifiée: Le collecteur est bloqué en 403 Forbidden !');
  } else {
    console.error('  ❌ ERREUR: Le collecteur ne doit PAS pouvoir valider sa propre transaction !');
    process.exit(1);
  }

  // 8. Accountant validates the transaction upon receiving the funds
  const cptValidateRes = await req(`/api/transactions/${createdTxId}/validate`, {
    method: 'POST',
    cookie: cptCookie,
    body: { notes: 'Fonds reçus en espèces à la caisse principale' }
  });
  console.log(`8️⃣  Validation par le comptable lors de la remise des fonds: Statut HTTP ${cptValidateRes.status}`);
  if (cptValidateRes.status === 200) {
    console.log('  ✅ Validation comptable acceptée avec succès !');
  } else {
    console.error('  ❌ ERREUR: La validation par le comptable a échoué !', cptValidateRes.data);
    process.exit(1);
  }

  // 9. Verify transaction is now PROCESSED and validated_by is set
  const txDetailsAfter = await req(`/api/transactions/${createdTxId}`, { cookie: cptCookie });
  const txAfter = txDetailsAfter.data?.data || txDetailsAfter.data;
  console.log(`9️⃣  Transaction après validation: Statut "${txAfter?.status}", Validateur ID: ${txAfter?.validated_by}, Date: ${txAfter?.validated_at}`);
  if (txAfter?.status === 'processed' && txAfter?.validated_by > 0) {
    console.log('  ✅ Transaction confirmée TRAITÉE (processed) avec traçabilité complète de l\'agent comptable !');
  } else {
    console.error('  ❌ ERREUR: La transaction doit être processed avec validated_by renseigné !');
    process.exit(1);
  }

  // 10. Verify client's amount_paid IS NOW CREDITED
  const clientCheck2 = await req(`/api/clients/${testClient.id}`, { cookie: colCookie });
  const finalPaid = parseFloat(clientCheck2.data?.data?.amount_paid || clientCheck2.data?.amount_paid || 0);
  console.log(`🔟 Solde locataire final: ${finalPaid} FCFA (Attendu: ${initialPaid + paymentAmount} FCFA)`);
  if (finalPaid === initialPaid + paymentAmount) {
    console.log('  ✅ Créditation du locataire effectuée avec succès après validation comptable !');
  } else {
    console.error('  ❌ ERREUR: Le montant doit être crédité au locataire !');
    process.exit(1);
  }

  console.log('\n===============================================================');
  console.log('🎉 TOUS LES TESTS DU WORKFLOW COLLECTEUR -> COMPTABLE SONT VALIDÉS !');
  console.log('===============================================================');
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});

