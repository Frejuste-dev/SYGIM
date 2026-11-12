/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║   SYGIM — Script de Migration Rétroactive : Legacy -> New Ledger   ║
 * ║   Phase 8.2 — Bascule Finale en Production (Live Cutover)          ║
 * ╚════════════════════════════════════════════════════════════════════╝
 *
 * Utilisation :
 *   node backend/scripts/migrate-legacy-financials.js [--dry-run]
 *
 * Règles Métier d'Audit :
 *   1. Reconstitution unitaire des échéances de loyer (invoices).
 *   2. Migration des encaissements réels (transactions -> payments).
 *   3. Règle de Reprise de Solde Initial (LEGACY-BAL-INIT) rattachée à l'utilisateur
 *      technique 'system_migration' (ID 69) pour apurer les 11 clients orphelins
 *      de transactions et les différentiels comptables Legacy.
 *   4. Apurement FIFO strict (payment_allocations).
 *   5. Consignation des surpaiements dans le Grand Livre des Avances (tenant_credit_ledger).
 *   6. Vérification des invariants de conservation financière à zéro fuite avant COMMIT.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Résolution de l'environnement (.env ou .env.dev)
const envPath = fs.existsSync(path.join(__dirname, '..', '.env'))
  ? path.join(__dirname, '..', '.env')
  : path.join(__dirname, '..', '.env.dev');
require('dotenv').config({ path: envPath });

const { pool } = require('../src/config/database');

async function migrateLegacyFinancials() {
  const isDryRun = process.argv.includes('--dry-run');
  const modeLabel = isDryRun ? 'SIMULATION (DRY-RUN)' : 'EXÉCUTION RÉELLE (LIVE CUTOVER)';

  console.log('\n===============================================================');
  console.log(`🚀 SYGIM — BASCULE FINALE VERS LE GRAND LIVRE [${modeLabel}]`);
  console.log('===============================================================\n');

  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Récupération de l'utilisateur système technique d'audit
    let [userRows] = await connection.query("SELECT id, username, role FROM users WHERE username = 'system_migration' LIMIT 1");
    let systemMigrationUserId;

    if (userRows.length === 0) {
      console.log("ℹ️ Création de l'utilisateur système 'system_migration'...");
      const [uRes] = await connection.query(`
        INSERT INTO users (username, password, first_name, last_name, role, status)
        VALUES ('system_migration', '$2a$10$dummyhashformigrationsystemuseronly0000', 'SYSTEM', 'MIGRATION', 'admin', 'active')
      `);
      systemMigrationUserId = uRes.insertId;
    } else {
      systemMigrationUserId = userRows[0].id;
    }
    console.log(`👤 Utilisateur d'audit système identifié : ID ${systemMigrationUserId} (system_migration)`);

    // 2. Nettoyage préalable des tables du domaine financier (Idempotence)
    console.log("🧹 Réinitialisation des tables du Grand Livre avant injection...");
    await connection.query('DELETE FROM payment_allocations');
    await connection.query('DELETE FROM tenant_credit_ledger');
    await connection.query('DELETE FROM payments');
    await connection.query('DELETE FROM invoices');
    await connection.query('DELETE FROM owner_settlements');

    // 3. Récupération de tous les clients Legacy
    const [clients] = await connection.query(`
      SELECT id, first_name, last_name, property_id, property_value, amount_due, amount_paid, created_at, status
      FROM clients
      ORDER BY id ASC
    `);

    console.log(`📊 Clients identifiés pour la migration : ${clients.length}`);

    let totalInvoicesCreated = 0;
    let totalPaymentsCreated = 0;
    let totalAllocationsCreated = 0;
    let totalOpeningBalancesCreated = 0;
    let totalAdvancesCount = 0;
    let totalAdvancesAmount = 0.00;

    for (const client of clients) {
      const clientId = client.id;
      const legacyDue = parseFloat(client.amount_due) || 0.00;
      const legacyPaid = parseFloat(client.amount_paid) || 0.00;
      let monthlyRent = parseFloat(client.property_value) || 0.00;
      if (monthlyRent <= 0) {
        monthlyRent = legacyDue > 0 ? legacyDue : 100000.00;
      }

      const clientInvoices = [];

      // A. Reconstitution de la facture d'échéance (Invoice)
      if (legacyDue > 0) {
        const invUuid = crypto.randomUUID();
        const invNum = `FAC-LEGACY-${clientId}-${Date.now().toString().slice(-4)}`;
        const baseDate = client.created_at ? new Date(client.created_at) : new Date('2025-01-01');

        const [invRes] = await connection.query(`
          INSERT INTO invoices (
            uuid, invoice_number, client_id, property_id, invoice_type,
            billing_period_start, billing_period_end, contract_rent_applied,
            base_amount, total_amount, paid_amount, status, due_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          invUuid,
          invNum,
          clientId,
          client.property_id || null,
          'RENT_FULL',
          baseDate,
          baseDate,
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

      // B. Récupération des transactions historiques traitées (processed)
      const [transactions] = await connection.query(`
        SELECT id, amount, method, status, date, created_at, reference, collector_id
        FROM transactions
        WHERE client_id = ? AND status = 'processed'
        ORDER BY COALESCE(date, created_at) ASC, id ASC
      `, [clientId]);

      const sumRealTransactions = transactions.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
      const clientPayments = [];

      // C. Création des paiements réels issus de transactions
      for (const tx of transactions) {
        const txAmount = parseFloat(tx.amount) || 0;
        if (txAmount <= 0) continue;

        const pUuid = crypto.randomUUID();
        const pRef = tx.reference || crypto.randomUUID();
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
      // Couvre les 11 clients sans transactions et tout écart de montant (legacyPaid > sumRealTransactions)
      if (legacyPaid > sumRealTransactions) {
        const balanceDeficit = parseFloat((legacyPaid - sumRealTransactions).toFixed(2));
        const initUuid = crypto.randomUUID();
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

      // E. Moteur FIFO d'affectation unitaire & Grand Livre des Avances
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
          `, [crypto.randomUUID(), p.id, inv.id, allocAmount, 'ACTIVE']);

          // Mise à jour de l'échéance (invoices)
          inv.balance_due = parseFloat((inv.balance_due - allocAmount).toFixed(2));
          await connection.query(`
            UPDATE invoices
            SET status = CASE WHEN (paid_amount + ?) >= total_amount THEN 'PAID' ELSE 'PARTIALLY_PAID' END,
                paid_amount = paid_amount + ?
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
            crypto.randomUUID(),
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

    // 4. Contrôle d'Audit & Invariants Comptables de Double Entrée
    const [invCheck] = await connection.query('SELECT COUNT(*) as c, SUM(total_amount) as s_tot, SUM(paid_amount) as s_paid, SUM(balance_due) as s_due FROM invoices');
    const [payCheck] = await connection.query('SELECT COUNT(*) as c, SUM(amount_received) as s_rec FROM payments');
    const [allocCheck] = await connection.query('SELECT COUNT(*) as c, SUM(allocated_amount) as s_alloc FROM payment_allocations');
    const [tclCheck] = await connection.query('SELECT COUNT(*) as c, SUM(amount) as s_adv FROM tenant_credit_ledger WHERE transaction_type = "CREDIT_ADVANCE"');

    const totalInvoicesAmount = parseFloat(invCheck[0].s_tot || 0);
    const totalPaidOnInvoices = parseFloat(invCheck[0].s_paid || 0);
    const totalResidualDue = parseFloat(invCheck[0].s_due || 0);
    const totalPaymentsReceived = parseFloat(payCheck[0].s_rec || 0);
    const totalAllocationsAmount = parseFloat(allocCheck[0].s_alloc || 0);
    const totalAdvancesEscrow = parseFloat(tclCheck[0].s_adv || 0);

    // Invariant 1 : Total Factures = Factures Payées + Dettes Résiduelles (balance_due)
    const invDelta = Math.abs(totalInvoicesAmount - (totalPaidOnInvoices + totalResidualDue));

    // Invariant 2 : Conservation stricte des paiements : Total Reçu = Allocations + Avances au Séquestre
    const payDelta = Math.abs(totalPaymentsReceived - (totalAllocationsAmount + totalAdvancesEscrow));

    // Invariant 3 : Concordance des allocations (Somme allouée sur factures = Somme des imputations)
    const allocDelta = Math.abs(totalPaidOnInvoices - totalAllocationsAmount);

    console.log('\n---------------------------------------------------------------');
    console.log('🔍 CONTRÔLE DES INVARIANTS COMPTABLES (AUDIT STRICT)');
    console.log('---------------------------------------------------------------');
    console.log(`• Invariant Facturation  : Total (${totalInvoicesAmount.toLocaleString('fr-FR')}) = Payé (${totalPaidOnInvoices.toLocaleString('fr-FR')}) + Dû (${totalResidualDue.toLocaleString('fr-FR')}) [Delta: ${invDelta.toFixed(2)} FCFA]`);
    console.log(`• Invariant Encaissements: Reçu (${totalPaymentsReceived.toLocaleString('fr-FR')}) = Alloué (${totalAllocationsAmount.toLocaleString('fr-FR')}) + Avances (${totalAdvancesEscrow.toLocaleString('fr-FR')}) [Delta: ${payDelta.toFixed(2)} FCFA]`);
    console.log(`• Invariant Imputations  : Alloué Factures (${totalPaidOnInvoices.toLocaleString('fr-FR')}) = Allocations (${totalAllocationsAmount.toLocaleString('fr-FR')}) [Delta: ${allocDelta.toFixed(2)} FCFA]`);

    if (invDelta > 0.01 || payDelta > 0.01 || allocDelta > 0.01) {
      console.error('\n❌ ÉCHEC DU CONTRÔLE D\'INTÉGRITÉ — FUITE DE VALEUR DÉTECTÉE !');
      await connection.rollback();
      throw new Error(`Invariants violés : invDelta=${invDelta}, payDelta=${payDelta}, allocDelta=${allocDelta}`);
    }

    if (isDryRun) {
      await connection.rollback();
      console.log('\n===============================================================');
      console.log('🔍 [DRY-RUN] SIMULATION TERMINÉE — AUCUNE MODIFICATION PERSISTÉE');
      console.log('===============================================================');
    } else {
      await connection.commit();
      console.log('\n===============================================================');
      console.log('✅ [LIVE] BASCULE EN PRODUCTION TERMINÉE AVEC SUCCÈS (COMMIT EFFECTUÉ)');
      console.log('===============================================================');
    }

    console.log(`- Factures (invoices) créées              : ${invCheck[0].c} (${totalInvoicesAmount.toLocaleString('fr-FR')} FCFA)`);
    console.log(`- Dettes résiduelles nettes (balance_due) : ${totalResidualDue.toLocaleString('fr-FR')} FCFA`);
    console.log(`- Paiements (payments) enregistrés        : ${payCheck[0].c} (${totalPaymentsReceived.toLocaleString('fr-FR')} FCFA)`);
    console.log(`- Écritures de reprise (LEGACY-BAL-INIT)  : ${totalOpeningBalancesCreated}`);
    console.log(`- Imputations unitaires (allocations)     : ${allocCheck[0].c} (${totalAllocationsAmount.toLocaleString('fr-FR')} FCFA)`);
    console.log(`- Écritures d'avance au Grand Livre       : ${tclCheck[0].c} (${totalAdvancesEscrow.toLocaleString('fr-FR')} FCFA)`);
    console.log(`- Écarts résiduels post-migration         : 0 (Zéro fuite de valeur)`);
    console.log('===============================================================\n');

  } catch (err) {
    await connection.rollback();
    console.error('\n❌ ERREUR CRITIQUE — TRANSACTION ROLLBACK :', err.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

migrateLegacyFinancials();
