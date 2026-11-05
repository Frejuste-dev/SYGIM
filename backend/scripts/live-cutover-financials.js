/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║   SYGIM — Script de Migration Rétroactive : Legacy -> New Ledger   ║
 * ║   Phase 8.2 — Bascule Finale en Production (Live Cutover)          ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { randomUUID } = require('crypto');

async function runLiveCutover() {
  console.log('\n===============================================================');
  console.log('🚀 PHASE 8.2 — BASCULE FINALE EN PRODUCTION (LIVE CUTOVER)');
  console.log('===============================================================\n');

  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'sibmlab@1014',
    database: process.env.DB_NAME || 'sygim_dev'
  });

  await connection.beginTransaction();

  try {
    // 1. Récupérer l'ID de l'utilisateur système de migration
    const [userRows] = await connection.query("SELECT id FROM users WHERE username = 'system_migration' LIMIT 1");
    if (userRows.length === 0) {
      throw new Error("L'utilisateur technique 'system_migration' est introuvable.");
    }
    const systemMigrationUserId = userRows[0].id;
    console.log(`👤 Utilisateur d'audit système identifié : ID ${systemMigrationUserId}`);

    // Nettoyer les tables financières avant peuplement initial (idempotence)
    await connection.query('DELETE FROM payment_allocations');
    await connection.query('DELETE FROM tenant_credit_ledger');
    await connection.query('DELETE FROM payments');
    await connection.query('DELETE FROM invoices');
    await connection.query('DELETE FROM owner_settlements');

    // 2. Récupérer tous les clients
    const [clients] = await connection.query(`
      SELECT id, first_name, last_name, property_id, property_value, amount_due, amount_paid, created_at, status
      FROM clients
      ORDER BY id ASC
    `);

    console.log(`📊 Clients à migrer : ${clients.length}`);

    let totalInvoicesCreated = 0;
    let totalPaymentsCreated = 0;
    let totalAllocationsCreated = 0;
    let totalOpeningBalancesCreated = 0;
    let totalAdvancesCount = 0;
    let totalAdvancesAmount = 0.00;

    for (const client of clients) {
      const clientId = client.id;
      const clientName = `${client.first_name} ${client.last_name}`.trim();
      const legacyDue = parseFloat(client.amount_due) || 0.00;
      const legacyPaid = parseFloat(client.amount_paid) || 0.00;
      const monthlyRent = parseFloat(client.property_value) > 0 ? parseFloat(client.property_value) : (legacyDue > 0 ? legacyDue : 100000.00);

      // A. Reconstitution des factures (invoices)
      const clientInvoices = [];
      if (legacyDue > 0) {
        // Si legacyDue est un multiple ou si on génère une facture globale
        const invoiceNum = `FAC-LEGACY-${clientId}-${Date.now().toString().slice(-4)}`;
        const invoiceUuid = randomUUID();
        const baseDate = client.created_at ? new Date(client.created_at) : new Date('2025-01-01');

        const [invRes] = await connection.query(`
          INSERT INTO invoices (
            uuid, invoice_number, client_id, property_id, invoice_type,
            billing_period_start, billing_period_end, contract_rent_applied,
            base_amount, total_amount, paid_amount, status, due_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invoiceUuid,
          invoiceNum,
          clientId,
          client.property_id || null,
          'RENT_FULL',
          baseDate,
          new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0),
          monthlyRent,
          legacyDue,
          legacyDue,
          0.00,
          'PENDING',
          baseDate
        ]);

        clientInvoices.push({
          id: invRes.insertId,
          total_amount: legacyDue,
          balance_due: legacyDue
        });
        totalInvoicesCreated++;
      }

      // B. Récupérer les transactions historiques traitées (processed)
      const [transactions] = await connection.query(`
        SELECT id, amount, method, status, date, created_at, reference, collector_id
        FROM transactions
        WHERE client_id = ? AND status = 'processed'
        ORDER BY COALESCE(date, created_at) ASC, id ASC
      `, [clientId]);

      const sumRealTransactions = transactions.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

      // C. Créer les paiements réels issus de `transactions`
      const clientPayments = [];
      for (const tx of transactions) {
        const txAmount = parseFloat(tx.amount) || 0;
        if (txAmount <= 0) continue;

        const pUuid = randomUUID();
        const pRef = tx.reference || randomUUID();
        let method = 'CASH';
        if (tx.method && ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE'].includes(tx.method.toUpperCase())) {
          method = tx.method.toUpperCase();
        }

        const [pRes] = await connection.query(`
          INSERT INTO payments (
            uuid, transaction_reference, receipt_number, client_id, collector_id,
            property_id, amount_received, payment_method, payment_date, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          pUuid,
          pRef,
          `REC-TX-${tx.id}`,
          clientId,
          tx.collector_id || null,
          client.property_id || null,
          txAmount,
          method,
          tx.date || tx.created_at || new Date(),
          'RECONCILED',
          systemMigrationUserId
        ]);

        clientPayments.push({
          id: pRes.insertId,
          amount_received: txAmount
        });
        totalPaymentsCreated++;
      }

      // D. Règle d'arbitrage d'audit : Reprise de Solde Initial (LEGACY-BAL-INIT)
      // Si amount_paid déclaré > transactions réelles, on émet une écriture compensatoire de reprise
      if (legacyPaid > sumRealTransactions) {
        const balanceDeficit = parseFloat((legacyPaid - sumRealTransactions).toFixed(2));
        const initUuid = randomUUID();
        const initRef = `LEGACY-BAL-INIT-${clientId}-${Date.now().toString().slice(-4)}`;

        const [initRes] = await connection.query(`
          INSERT INTO payments (
            uuid, transaction_reference, receipt_number, client_id, collector_id,
            property_id, amount_received, payment_method, payment_date, status, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          initUuid,
          initRef,
          `INIT-${clientId}`,
          clientId,
          null,
          client.property_id || null,
          balanceDeficit,
          'CASH',
          new Date(),
          'RECONCILED',
          systemMigrationUserId
        ]);

        clientPayments.push({
          id: initRes.insertId,
          amount_received: balanceDeficit
        });
        totalOpeningBalancesCreated++;
        totalPaymentsCreated++;
      }

      // E. Moteur FIFO d'imputation unitaire & Grand Livre des Avances
      let runningCreditBalance = 0.00;

      for (const p of clientPayments) {
        let remainingToAllocate = p.amount_received;

        for (const inv of clientInvoices) {
          if (remainingToAllocate <= 0) break;
          if (inv.balance_due <= 0) continue;

          const allocAmount = Math.min(remainingToAllocate, inv.balance_due);

          // Insertion PaymentAllocation
          await connection.query(`
            INSERT INTO payment_allocations (uuid, payment_id, invoice_id, allocated_amount, status)
            VALUES (?, ?, ?, ?, ?)
          `, [randomUUID(), p.id, inv.id, allocAmount, 'ACTIVE']);

          // Mise à jour Invoice
          inv.balance_due = parseFloat((inv.balance_due - allocAmount).toFixed(2));
          await connection.query(`
            UPDATE invoices
            SET paid_amount = paid_amount + ?,
                status = CASE WHEN paid_amount + ? >= total_amount THEN 'PAID' ELSE 'PARTIALLY_PAID' END
            WHERE id = ?
          `, [allocAmount, allocAmount, inv.id]);

          remainingToAllocate = parseFloat((remainingToAllocate - allocAmount).toFixed(2));
          totalAllocationsCreated++;
        }

        // Reliquat -> Avance Locataire au Grand Livre (FIN-001, FIN-016)
        if (remainingToAllocate > 0) {
          runningCreditBalance = parseFloat((runningCreditBalance + remainingToAllocate).toFixed(2));
          await connection.query(`
            INSERT INTO tenant_credit_ledger (
              uuid, client_id, transaction_type, amount, running_balance, source_payment_id, consumed_invoice_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            randomUUID(),
            clientId,
            'CREDIT_ADVANCE',
            remainingToAllocate,
            runningCreditBalance,
            p.id,
            null
          ]);
          totalAdvancesCount++;
          totalAdvancesAmount = parseFloat((totalAdvancesAmount + remainingToAllocate).toFixed(2));
        }
      }
    }

    // 3. Contrôle final de réconciliation
    const [invCheck] = await connection.query('SELECT COUNT(*) as c, SUM(total_amount) as s_tot, SUM(paid_amount) as s_paid, SUM(balance_due) as s_due FROM invoices');
    const [payCheck] = await connection.query('SELECT COUNT(*) as c, SUM(amount_received) as s_rec FROM payments');
    const [allocCheck] = await connection.query('SELECT COUNT(*) as c, SUM(allocated_amount) as s_alloc FROM payment_allocations');
    const [tclCheck] = await connection.query('SELECT COUNT(*) as c, SUM(amount) as s_adv FROM tenant_credit_ledger WHERE transaction_type = "CREDIT_ADVANCE"');

    // Tout valider et commiter
    await connection.commit();

    console.log('\n===============================================================');
    console.log('✅ BASCULE EN PRODUCTION TERMINÉE AVEC SUCCÈS (COMMIT EFFECTUÉ)');
    console.log('===============================================================');
    console.log(`- Factures (invoices) créées              : ${invCheck[0].c} (${parseFloat(invCheck[0].s_tot).toLocaleString('fr-FR')} FCFA)`);
    console.log(`- Dettes résiduelles (balance_due)        : ${parseFloat(invCheck[0].s_due).toLocaleString('fr-FR')} FCFA`);
    console.log(`- Paiements (payments) injectés           : ${payCheck[0].c} (${parseFloat(payCheck[0].s_rec).toLocaleString('fr-FR')} FCFA)`);
    console.log(`- Écritures de reprise (LEGACY-BAL-INIT)  : ${totalOpeningBalancesCreated}`);
    console.log(`- Imputations unitaires (allocations)     : ${allocCheck[0].c} (${parseFloat(allocCheck[0].s_alloc).toLocaleString('fr-FR')} FCFA)`);
    console.log(`- Écritures d'avance au Grand Livre       : ${tclCheck[0].c} (${parseFloat(tclCheck[0].s_adv || 0).toLocaleString('fr-FR')} FCFA)`);
    console.log('===============================================================\n');

  } catch (err) {
    await connection.rollback();
    console.error('❌ ERREUR CRITIQUE — TRANSACTION ROLLBACK :', err);
    process.exit(1);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

runLiveCutover();
