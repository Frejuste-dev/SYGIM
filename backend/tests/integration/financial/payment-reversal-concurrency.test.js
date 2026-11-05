/**
 * Tests d'Intégration & Concurrence Réelle (SEC-004-B)
 * Vérifie l'atomicité, le verrouillage pessimiste InnoDB, la protection contre la double extourne
 * et la gestion des échecs / rollbacks de PaymentService.reversePayment.
 */

// Mock de l'import défaillant historique de invoice.repository pour isoler les tests
jest.mock('../../../src/modules/financial/repositories/invoice.repository', () => ({}));

const { pool } = require('../../../config/db');
const { randomUUID } = require('crypto');
const paymentService = require('../../../src/modules/financial/services/PaymentService');
const paymentRepository = require('../../../src/modules/financial/repositories/payment.repository');
const paymentAllocationRepository = require('../../../src/modules/financial/repositories/payment-allocation.repository');
const tenantCreditLedgerRepository = require('../../../src/modules/financial/repositories/tenant-credit-ledger.repository');
const AppError = require('../../../src/utils/errors/AppError');

describe('SEC-004-B : Concurrence et Atomicité de reversePayment (MySQL InnoDB)', () => {
  let testClientId;
  let testUserId = 1;

  beforeAll(async () => {
    // Nettoyer ou créer un client de test dédié
    const [clientRes] = await pool.query(`
      INSERT INTO clients (first_name, last_name, email, phone, status)
      VALUES ('TestConcurrence', 'SEC004', 'sec004@test.com', '0102030405', 'active')
    `);
    testClientId = clientRes.insertId;
  });

  afterAll(async () => {
    // Nettoyage en cascade
    if (testClientId) {
      await pool.query('DELETE FROM tenant_credit_ledger WHERE client_id = ?', [testClientId]);
      await pool.query('DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE client_id = ?)', [testClientId]);
      await pool.query('DELETE FROM payments WHERE client_id = ?', [testClientId]);
      await pool.query('DELETE FROM invoices WHERE client_id = ?', [testClientId]);
      await pool.query('DELETE FROM clients WHERE id = ?', [testClientId]);
    }
  });

  // Helper pour créer un jeu de données financier complet pour un test
  async function setupTestPaymentFixture({ invoiceAmount = 100000, allocatedAmount = 100000, advanceAmount = 0 }) {
    const totalPayment = allocatedAmount + advanceAmount;

    // 1. Facture
    const [invRes] = await pool.query(`
      INSERT INTO invoices (
        uuid, invoice_number, client_id, invoice_type,
        billing_period_start, billing_period_end, contract_rent_applied,
        base_amount, total_amount, paid_amount, status, due_date
      ) VALUES (?, ?, ?, 'RENT_FULL', '2026-01-01', '2026-01-31', ?, ?, ?, ?, ?, '2026-01-05')
    `, [
      randomUUID(), `FAC-SEC004-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      testClientId, invoiceAmount, invoiceAmount, invoiceAmount, allocatedAmount,
      allocatedAmount >= invoiceAmount ? 'PAID' : 'PARTIALLY_PAID'
    ]);
    const invoiceId = invRes.insertId;

    // 2. Paiement
    const [payRes] = await pool.query(`
      INSERT INTO payments (
        uuid, transaction_reference, receipt_number, client_id,
        amount_received, payment_method, payment_date, status, is_reversed, created_by
      ) VALUES (?, ?, ?, ?, ?, 'CASH', NOW(), 'RECEIVED', FALSE, ?)
    `, [
      randomUUID(), `REF-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      `REC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      testClientId, totalPayment, testUserId
    ]);
    const paymentId = payRes.insertId;

    // 3. Allocation
    let allocationId = null;
    if (allocatedAmount > 0) {
      const [allocRes] = await pool.query(`
        INSERT INTO payment_allocations (
          uuid, payment_id, invoice_id, allocated_amount, status
        ) VALUES (?, ?, ?, ?, 'ACTIVE')
      `, [randomUUID(), paymentId, invoiceId, allocatedAmount]);
      allocationId = allocRes.insertId;
    }

    // 4. Avance éventuelle dans le ledger
    if (advanceAmount > 0) {
      const currentBalance = await tenantCreditLedgerRepository.getLatestRunningBalance(testClientId, pool);
      const newBalance = currentBalance + advanceAmount;
      await tenantCreditLedgerRepository.appendEntry({
        client_id: testClientId,
        transaction_type: 'CREDIT_ADVANCE',
        amount: advanceAmount,
        running_balance: newBalance,
        source_payment_id: paymentId,
        consumed_invoice_id: null
      }, pool);
    }

    return { invoiceId, paymentId, allocationId, totalPayment, allocatedAmount, advanceAmount };
  }

  // --- 1. Extourne normale ---
  test('1. Extourne normale d\'un paiement : réouverture de dette et statut REVERSED', async () => {
    const fixture = await setupTestPaymentFixture({ invoiceAmount: 80000, allocatedAmount: 80000 });

    const result = await paymentService.reversePayment({
      paymentId: fixture.paymentId,
      reversedByUserId: testUserId,
      reason: 'Erreur de caisse'
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('REVERSED');

    // Vérifier l'état du paiement en base
    const [payRows] = await pool.query('SELECT * FROM payments WHERE id = ?', [fixture.paymentId]);
    expect(payRows[0].is_reversed).toBe(1);
    expect(payRows[0].status).toBe('REVERSED');
    expect(payRows[0].reversal_reason).toBe('Erreur de caisse');

    // Vérifier la réouverture de la facture
    const [invRows] = await pool.query('SELECT * FROM invoices WHERE id = ?', [fixture.invoiceId]);
    expect(parseFloat(invRows[0].paid_amount)).toBe(0.00);
    expect(invRows[0].status).toBe('PENDING');

    // Vérifier l'extourne de l'allocation
    const [allocRows] = await pool.query('SELECT * FROM payment_allocations WHERE id = ?', [fixture.allocationId]);
    expect(allocRows[0].status).toBe('REVERSED');
  });

  // --- 2. Paiement inexistant ---
  test('2. Échec avec erreur 404 si le paiement est inexistant', async () => {
    await expect(paymentService.reversePayment({
      paymentId: 99999999,
      reversedByUserId: testUserId,
      reason: 'Paiement fantôme'
    })).rejects.toThrow('Paiement introuvable.');
  });

  // --- 3. Paiement déjà extourné ---
  test('3. Échec avec erreur si le paiement est déjà extourné', async () => {
    const fixture = await setupTestPaymentFixture({ invoiceAmount: 50000, allocatedAmount: 50000 });

    // Première extourne
    await paymentService.reversePayment({
      paymentId: fixture.paymentId,
      reversedByUserId: testUserId,
      reason: 'Première extourne légitime'
    });

    // Seconde extourne consécutive
    await expect(paymentService.reversePayment({
      paymentId: fixture.paymentId,
      reversedByUserId: testUserId,
      reason: 'Tentative de double extourne'
    })).rejects.toThrow('Ce paiement a déjà été extourné.');
  });

  // --- 4, 5, 6, 7. Test de concurrence réelle (Deux requêtes simultanées) ---
  test('4, 5, 6, 7. Concurrence réelle : exactement une seule extourne aboutit, aucune double réduction ni double débit', async () => {
    const fixture = await setupTestPaymentFixture({
      invoiceAmount: 120000,
      allocatedAmount: 100000,
      advanceAmount: 50000
    });

    // Lancement de 2 requêtes concurrentes simultanées via Promise.allSettled
    const [resA, resB] = await Promise.allSettled([
      paymentService.reversePayment({
        paymentId: fixture.paymentId,
        reversedByUserId: testUserId,
        reason: 'Concurrence Req A'
      }),
      paymentService.reversePayment({
        paymentId: fixture.paymentId,
        reversedByUserId: testUserId,
        reason: 'Concurrence Req B'
      })
    ]);

    // 5. Exactement une seule des deux doit avoir réussi
    const fulfilled = [resA, resB].filter(r => r.status === 'fulfilled');
    const rejected = [resA, resB].filter(r => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(fulfilled[0].value.status).toBe('REVERSED');

    // L'échec doit être une erreur explicite de déjà extourné ou de conflit de concurrence
    const rejectionReason = rejected[0].reason.message;
    expect(
      rejectionReason.includes('déjà été extourné') || rejectionReason.includes('Conflit de concurrence')
    ).toBe(true);

    // 6. Vérifier qu'une seule série d'ajustements de facture a été effectuée
    // Facture initiale : paid_amount = 100 000. Après UNE extourne de 100 000 : paid_amount doit être exactement 0 (pas -100 000)
    const [invRows] = await pool.query('SELECT * FROM invoices WHERE id = ?', [fixture.invoiceId]);
    expect(parseFloat(invRows[0].paid_amount)).toBe(0.00);
    expect(invRows[0].status).toBe('PENDING');

    // 7. Vérifier qu'une seule écriture compensatoire a été créée dans tenant_credit_ledger
    const [ledgerDebits] = await pool.query(`
      SELECT * FROM tenant_credit_ledger
      WHERE source_payment_id = ? AND transaction_type = 'DEBIT_CONSUMPTION'
    `, [fixture.paymentId]);

    expect(ledgerDebits).toHaveLength(1);
    expect(parseFloat(ledgerDebits[0].amount)).toBe(50000.00);
  });

  // --- 8. Échec lors de la mise à jour d'une facture & Rollback ---
  test('8, 10. Rollback complet si incohérence détectée sur une facture (paid_amount < allocatedAmount)', async () => {
    const fixture = await setupTestPaymentFixture({ invoiceAmount: 60000, allocatedAmount: 60000 });

    // Altérer artificiellement la facture pour simuler une incohérence (ex: paid_amount corrompu à 10 000 < 60 000 alloué)
    await pool.query('UPDATE invoices SET paid_amount = 10000.00 WHERE id = ?', [fixture.invoiceId]);

    // Tenter l'extourne -> doit lever une exception d'incohérence financière
    await expect(paymentService.reversePayment({
      paymentId: fixture.paymentId,
      reversedByUserId: testUserId,
      reason: 'Test échec facture'
    })).rejects.toThrow();

    // 10. Vérifier le ROLLBACK complet : le paiement doit être resté intact (is_reversed = FALSE)
    const [payRows] = await pool.query('SELECT is_reversed, status FROM payments WHERE id = ?', [fixture.paymentId]);
    expect(payRows[0].is_reversed).toBe(0);
    expect(payRows[0].status).toBe('RECEIVED');

    // L'allocation doit être restée ACTIVE
    const [allocRows] = await pool.query('SELECT status FROM payment_allocations WHERE id = ?', [fixture.allocationId]);
    expect(allocRows[0].status).toBe('ACTIVE');

    // La facture doit conserver sa valeur avant extourne
    const [invRows] = await pool.query('SELECT paid_amount FROM invoices WHERE id = ?', [fixture.invoiceId]);
    expect(parseFloat(invRows[0].paid_amount)).toBe(10000.00);
  });

  // --- 9. Échec lors de l'insertion dans le ledger & Rollback ---
  test('9, 10. Rollback complet si l\'avance locataire a déjà été consommée (newBalance < 0)', async () => {
    const fixture = await setupTestPaymentFixture({
      invoiceAmount: 50000,
      allocatedAmount: 50000,
      advanceAmount: 70000 // Avance de 70k créée
    });

    // Simuler la consommation intégrale de l'avance par une autre opération (solde retombe à 0)
    await tenantCreditLedgerRepository.appendEntry({
      client_id: testClientId,
      transaction_type: 'DEBIT_CONSUMPTION',
      amount: 70000,
      running_balance: 0.00,
      source_payment_id: null,
      consumed_invoice_id: null
    }, pool);

    // Tenter l'extourne du paiement qui avait généré les 70k -> impossible car solde < montant avance
    await expect(paymentService.reversePayment({
      paymentId: fixture.paymentId,
      reversedByUserId: testUserId,
      reason: 'Test échec avance consommée'
    })).rejects.toThrow('l\'avance générée a déjà été consommée');

    // 10. Vérifier le ROLLBACK complet
    const [payRows] = await pool.query('SELECT is_reversed, status FROM payments WHERE id = ?', [fixture.paymentId]);
    expect(payRows[0].is_reversed).toBe(0);
    expect(payRows[0].status).toBe('RECEIVED');

    const [allocRows] = await pool.query('SELECT status FROM payment_allocations WHERE id = ?', [fixture.allocationId]);
    expect(allocRows[0].status).toBe('ACTIVE');
  });

  // --- 11. Libération garantie de la connexion après succès et après échec ---
  test('11. Libération de la connexion (connection.release) garantie en succès et en échec', async () => {
    const origGetConnection = pool.getConnection.bind(pool);
    let releaseCalledCount = 0;

    const fixtureSuccess = await setupTestPaymentFixture({ invoiceAmount: 40000, allocatedAmount: 40000 });

    // Espionner la connexion
    jest.spyOn(pool, 'getConnection').mockImplementation(async () => {
      const conn = await origGetConnection();
      const origRelease = conn.release.bind(conn);
      conn.release = () => {
        releaseCalledCount++;
        return origRelease();
      };
      return conn;
    });

    // 1. Succès
    await paymentService.reversePayment({
      paymentId: fixtureSuccess.paymentId,
      reversedByUserId: testUserId,
      reason: 'Test libération succès'
    });
    expect(releaseCalledCount).toBe(1);

    // 2. Échec
    try {
      await paymentService.reversePayment({
        paymentId: fixtureSuccess.paymentId, // Déjà extourné -> déclenche throw
        reversedByUserId: testUserId,
        reason: 'Test libération échec'
      });
    } catch (err) {
      // Attendu
    }
    expect(releaseCalledCount).toBe(2);

    pool.getConnection.mockRestore();
  });
});

