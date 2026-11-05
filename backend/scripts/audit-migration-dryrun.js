/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║   SYGIM — Script d'Audit & Simulation de Migration Financière      ║
 * ║   Phase 8.1 — Dry-Run In-Memory & Audit de Réconciliation          ║
 * ╚════════════════════════════════════════════════════════════════════╝
 *
 * Exécute une simulation in-memory du moteur FIFO et de la reconstruction
 * des factures/paiements sans rien écrire en base (READ-ONLY STRICT).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.dev') });
const { pool } = require('../config/db');

async function auditFinancialMigrationDryRun() {
  console.log('\n===============================================================');
  console.log('🔍 PHASE 8.1 — AUDIT DE MIGRATION FINANCIÈRE (READ-ONLY DRY-RUN)');
  console.log('===============================================================\n');

  let connection;
  try {
    connection = await pool.getConnection();

    // 1. Lire tous les clients
    const [clients] = await connection.query(`
      SELECT id, first_name, last_name, rent, amount_due, amount_paid, created_at, status
      FROM clients
      ORDER BY id ASC
    `);

    console.log(`📊 Clients identifiés dans la base : ${clients.length}`);

    let totalInvoicesSimulated = 0;
    let totalPaymentsSimulated = 0;
    let totalAllocationsSimulated = 0;
    let totalAdvancesCount = 0;
    let totalAdvancesAmount = 0.00;
    let totalDiscrepancies = 0;
    const discrepancyList = [];

    for (const client of clients) {
      const clientId = client.id;
      const clientName = `${client.first_name} ${client.last_name}`.trim();
      const monthlyRent = parseFloat(client.rent) || 0;
      const legacyDue = parseFloat(client.amount_due) || 0;
      const legacyPaid = parseFloat(client.amount_paid) || 0;
      const legacyNetDebt = parseFloat((legacyDue - legacyPaid).toFixed(2));

      // Reconstitution virtuelle des factures pour ce client
      const simulatedInvoices = [];
      if (monthlyRent > 0 && legacyDue > 0) {
        const fullMonths = Math.floor(legacyDue / monthlyRent);
        const remainder = parseFloat((legacyDue % monthlyRent).toFixed(2));
        const baseDate = new Date(client.created_at || '2025-01-01');

        for (let i = 0; i < fullMonths; i++) {
          const pStart = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
          simulatedInvoices.push({
            index: i + 1,
            total_amount: monthlyRent,
            paid_amount: 0.00,
            balance_due: monthlyRent,
            period: pStart.toISOString().slice(0, 7)
          });
          totalInvoicesSimulated++;
        }

        if (remainder > 0) {
          simulatedInvoices.push({
            index: fullMonths + 1,
            total_amount: remainder,
            paid_amount: 0.00,
            balance_due: remainder,
            period: 'PRORATA_RELIQUAT'
          });
          totalInvoicesSimulated++;
        }
      }

      // Lire les transactions historiques du client
      const [legacyTransactions] = await connection.query(`
        SELECT id, amount, method, status, date, created_at, reference
        FROM transactions
        WHERE client_id = ? AND status = 'processed'
        ORDER BY COALESCE(date, created_at) ASC, id ASC
      `, [clientId]);

      let clientCreditAdvance = 0.00;

      // Simulation du moteur FIFO
      for (const tx of legacyTransactions) {
        const txAmount = parseFloat(tx.amount) || 0;
        if (txAmount <= 0) continue;
        totalPaymentsSimulated++;

        let remainingToAllocate = txAmount;

        for (const inv of simulatedInvoices) {
          if (remainingToAllocate <= 0) break;
          if (inv.balance_due <= 0) continue;

          const alloc = Math.min(remainingToAllocate, inv.balance_due);
          inv.paid_amount = parseFloat((inv.paid_amount + alloc).toFixed(2));
          inv.balance_due = parseFloat((inv.balance_due - alloc).toFixed(2));
          remainingToAllocate = parseFloat((remainingToAllocate - alloc).toFixed(2));
          totalAllocationsSimulated++;
        }

        // Reliquat -> Avance
        if (remainingToAllocate > 0) {
          clientCreditAdvance = parseFloat((clientCreditAdvance + remainingToAllocate).toFixed(2));
        }
      }

      if (clientCreditAdvance > 0) {
        totalAdvancesCount++;
        totalAdvancesAmount = parseFloat((totalAdvancesAmount + clientCreditAdvance).toFixed(2));
      }

      // Rapprochement financier
      const newTotalRemainingDue = simulatedInvoices.reduce((sum, inv) => sum + inv.balance_due, 0);
      const newCalculatedNet = parseFloat((newTotalRemainingDue - clientCreditAdvance).toFixed(2));

      // Comparaison avec legacyNetDebt
      const diff = parseFloat((newCalculatedNet - legacyNetDebt).toFixed(2));
      if (Math.abs(diff) > 0.01) {
        totalDiscrepancies++;
        discrepancyList.push({
          clientId,
          clientName,
          legacyDue,
          legacyPaid,
          legacyNetDebt,
          transactionsCount: legacyTransactions.length,
          transactionsTotalSum: legacyTransactions.reduce((s, t) => s + parseFloat(t.amount || 0), 0),
          newTotalRemainingDue,
          clientCreditAdvance,
          newCalculatedNet,
          diff
        });
      }
    }

    console.log('---------------------------------------------------------------');
    console.log('📋 RÉSULTATS DU DRY-RUN DE MIGRATION');
    console.log('---------------------------------------------------------------');
    console.log(`- Clients traités                     : ${clients.length}`);
    console.log(`- Factures (invoices) à créer         : ${totalInvoicesSimulated}`);
    console.log(`- Paiements (payments) à migrer       : ${totalPaymentsSimulated}`);
    console.log(`- Imputations unitaires (allocations) : ${totalAllocationsSimulated}`);
    console.log(`- Locataires avec solde d'avance      : ${totalAdvancesCount}`);
    console.log(`- Montant total des avances (€)       : ${totalAdvancesAmount.toFixed(2)}`);
    console.log(`- Écarts de rapprochement détectés    : ${totalDiscrepancies}`);
    console.log('---------------------------------------------------------------\n');

    if (totalDiscrepancies > 0) {
      console.log('⚠️ DÉTAIL DES ÉCARTS DE RAPPROCHEMENT :');
      console.log(JSON.stringify(discrepancyList, null, 2));
    } else {
      console.log('🎉 RAPPROCHEMENT PARFAIT : 100% des soldes clients recalculés sont rigoureusement identiques aux soldes Legacy.');
    }

  } catch (err) {
    console.error('❌ Erreur lors de l\'audit dry-run :', err);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

auditFinancialMigrationDryRun();
