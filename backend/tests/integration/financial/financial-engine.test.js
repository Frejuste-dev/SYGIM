const { pool } = require('../../../src/config/database');
const fs = require('fs');
const path = require('path');

const paymentService = require('../../../src/modules/financial/services/PaymentService');
const rentBillingService = require('../../../src/modules/financial/services/RentBillingService');
const ownerSettlementService = require('../../../src/modules/financial/services/OwnerSettlementService');

const invoiceRepository = require('../../../src/modules/financial/repositories/invoice.repository');
const paymentRepository = require('../../../src/modules/financial/repositories/payment.repository');
const paymentAllocationRepository = require('../../../src/modules/financial/repositories/payment-allocation.repository');
const tenantCreditLedgerRepository = require('../../../src/modules/financial/repositories/tenant-credit-ledger.repository');
const ownerSettlementRepository = require('../../../src/modules/financial/repositories/owner-settlement.repository');

describe('Financial Engine Integration Tests (Phase 5.6)', () => {
  let testClientId;
  let testOwnerId;
  let testPropertyId;
  let testUserId = 1; // Default admin/user

  beforeAll(async () => {
    // 1. S'assurer que les tables du domaine financier existent dans la BDD de test
    const migrationSqlPath = path.join(
      __dirname,
      '../../../src/infrastructure/database/migrations/011_create_financial_domain_tables.sql'
    );
    const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');

    // Découper et exécuter les instructions de création si non existantes
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await pool.query(statement);
    }

    // 2. Créer ou récupérer un client de test, un propriétaire et un bien
    const [clientRes] = await pool.query(`
      INSERT INTO clients (first_name, last_name, phone, email, rent, deposit, status)
      VALUES ('TestTenant', 'Financial', '0199887766', 'tenant.financial@test.com', 100000, 200000, 'active')
    `);
    testClientId = clientRes.insertId;

    const [ownerRes] = await pool.query(`
      INSERT INTO owners (first_name, last_name, phone, email)
      VALUES ('TestOwner', 'Financial', '0188776655', 'owner.financial@test.com')
    `);
    testOwnerId = ownerRes.insertId;

    const [propRes] = await pool.query(`
      INSERT INTO properties (name, address, type, price, status, owner_id)
      VALUES ('Appartement 101', '123 Rue de la Paix', 'apartment', 100000, 'rented', ?)
    `, [testOwnerId]);
    testPropertyId = propRes.insertId;
  });

  afterAll(async () => {
    // Nettoyage en cascade dans l'ordre inverse des contraintes de clés étrangères
    await pool.query('DELETE FROM payment_allocations WHERE invoice_id IN (SELECT id FROM invoices WHERE client_id = ?)', [testClientId]);
    await pool.query('DELETE FROM tenant_credit_ledger WHERE client_id = ?', [testClientId]);
    await pool.query('DELETE FROM payments WHERE client_id = ?', [testClientId]);
    await pool.query('DELETE FROM invoices WHERE client_id = ?', [testClientId]);
    await pool.query('DELETE FROM owner_settlements WHERE owner_id = ?', [testOwnerId]);

    await pool.query('DELETE FROM properties WHERE id = ?', [testPropertyId]);
    await pool.query('DELETE FROM owners WHERE id = ?', [testOwnerId]);
    await pool.query('DELETE FROM clients WHERE id = ?', [testClientId]);
  });

  /**
   * Scénario 1 : Le Prorata Calendaire (RentBillingService)
   */
  test('Scénario 1 : RentBillingService - Calcul déterministe du prorata calendaire (FIN-012, FIN-014)', async () => {
    // Février 2025 (année non bissextile de 28 jours), entrée le 15 février -> 14 jours d'occupation
    const res = await rentBillingService.generateInvoice({
      clientId: testClientId,
      propertyId: testPropertyId,
      monthlyRent: 100000,
      periodStart: '2025-02-15',
      periodEnd: '2025-02-28',
      dueDate: '2025-02-15',
      createdBy: testUserId
    });

    expect(res).toBeDefined();
    expect(res.daysInMonth).toBe(28);
    expect(res.occupiedDays).toBe(14);
    expect(res.invoice.invoice_type).toBe('RENT_PRORATA');
    expect(res.invoice.status).toBe('PENDING');

    // (100000 / 28) * 14 = 50000.00
    const expectedProrata = 50000.00;
    expect(parseFloat(res.invoice.total_amount)).toBeCloseTo(expectedProrata, 2);
    expect(parseFloat(res.invoice.paid_amount)).toBe(0.00);
  });

  /**
   * Scénario 2 : L'Apurement FIFO & Le Reste à charge (PaymentService)
   */
  describe('Scénario 2 : Apurement FIFO chronologique strict (FIN-002, FIN-003, FIN-004)', () => {
    let inv1, inv2, inv3;
    let registeredPayment;

    beforeAll(async () => {
      // Création de 3 factures impayées de 100 000 chacune (Janvier, Février, Mars 2025)
      inv1 = await invoiceRepository.createInvoice({
        invoice_number: `FAC-TEST-M1-${Date.now()}`,
        client_id: testClientId,
        property_id: testPropertyId,
        invoice_type: 'RENT_FULL',
        billing_period_start: '2025-01-01',
        billing_period_end: '2025-01-31',
        contract_rent_applied: 100000,
        base_amount: 100000,
        total_amount: 100000,
        paid_amount: 0.00,
        status: 'PENDING',
        due_date: '2025-01-05'
      });

      inv2 = await invoiceRepository.createInvoice({
        invoice_number: `FAC-TEST-M2-${Date.now()}`,
        client_id: testClientId,
        property_id: testPropertyId,
        invoice_type: 'RENT_FULL',
        billing_period_start: '2025-02-01',
        billing_period_end: '2025-02-28',
        contract_rent_applied: 100000,
        base_amount: 100000,
        total_amount: 100000,
        paid_amount: 0.00,
        status: 'PENDING',
        due_date: '2025-02-05'
      });

      inv3 = await invoiceRepository.createInvoice({
        invoice_number: `FAC-TEST-M3-${Date.now()}`,
        client_id: testClientId,
        property_id: testPropertyId,
        invoice_type: 'RENT_FULL',
        billing_period_start: '2025-03-01',
        billing_period_end: '2025-03-31',
        contract_rent_applied: 100000,
        base_amount: 100000,
        total_amount: 100000,
        paid_amount: 0.00,
        status: 'PENDING',
        due_date: '2025-03-05'
      });
    });

    test('Devrait imputer 150 000 : solder M1 à 100k et entamer M2 à 50k, laissant M3 intacte', async () => {
      const result = await paymentService.registerPayment({
        clientId: testClientId,
        amountReceived: 150000,
        method: 'CASH',
        propertyId: testPropertyId,
        receiptNumber: `REC-TEST-FIFO-${Date.now()}`,
        createdBy: testUserId
      });

      registeredPayment = result.payment;
      expect(result.allocations).toHaveLength(2);
      expect(result.unallocatedSurplus).toBe(0);

      // Recharger les factures depuis la BDD
      const [rowsM1] = await pool.query('SELECT * FROM invoices WHERE id = ?', [inv1.id]);
      const [rowsM2] = await pool.query('SELECT * FROM invoices WHERE id = ?', [inv2.id]);
      const [rowsM3] = await pool.query('SELECT * FROM invoices WHERE id = ?', [inv3.id]);

      // M1 doit être totalement payée
      expect(rowsM1[0].status).toBe('PAID');
      expect(parseFloat(rowsM1[0].paid_amount)).toBe(100000.00);
      expect(parseFloat(rowsM1[0].balance_due)).toBe(0.00);

      // M2 doit être partiellement payée
      expect(rowsM2[0].status).toBe('PARTIALLY_PAID');
      expect(parseFloat(rowsM2[0].paid_amount)).toBe(50000.00);
      expect(parseFloat(rowsM2[0].balance_due)).toBe(50000.00);

      // M3 doit rester intouchée
      expect(rowsM3[0].status).toBe('PENDING');
      expect(parseFloat(rowsM3[0].paid_amount)).toBe(0.00);
      expect(parseFloat(rowsM3[0].balance_due)).toBe(100000.00);

      // Vérification des PaymentAllocations en BDD
      const allocations = await paymentAllocationRepository.findByPaymentId(registeredPayment.id);
      expect(allocations).toHaveLength(2);
      expect(parseFloat(allocations[0].allocated_amount)).toBe(100000.00);
      expect(parseFloat(allocations[1].allocated_amount)).toBe(50000.00);
    });

    /**
     * Scénario 4 : L'Extourne Transactionnelle (PaymentService)
     */
    test('Scénario 4 : reversePayment - Réouverture des dettes et neutralisation des allocations (FIN-006, FIN-007)', async () => {
      const reversal = await paymentService.reversePayment({
        paymentId: registeredPayment.id,
        reversedByUserId: testUserId,
        reason: 'Erreur de saisie caissier'
      });

      expect(reversal.success).toBe(true);
      expect(reversal.status).toBe('REVERSED');

      // Recharger les factures
      const [rowsM1] = await pool.query('SELECT * FROM invoices WHERE id = ?', [inv1.id]);
      const [rowsM2] = await pool.query('SELECT * FROM invoices WHERE id = ?', [inv2.id]);

      // M1 doit être réouverte
      expect(rowsM1[0].status).toBe('PENDING');
      expect(parseFloat(rowsM1[0].paid_amount)).toBe(0.00);
      expect(parseFloat(rowsM1[0].balance_due)).toBe(100000.00);

      // M2 doit être réouverte
      expect(rowsM2[0].status).toBe('PENDING');
      expect(parseFloat(rowsM2[0].paid_amount)).toBe(0.00);
      expect(parseFloat(rowsM2[0].balance_due)).toBe(100000.00);

      // Allocations doivent être marquées REVERSED sans suppression
      const allocations = await paymentAllocationRepository.findByPaymentId(registeredPayment.id);
      expect(allocations).toHaveLength(2);
      expect(allocations[0].status).toBe('REVERSED');
      expect(allocations[1].status).toBe('REVERSED');
    });
  });

  /**
   * Scénario 3 : Le Surpaiement et l'Avance Automatique (FIN-001, FIN-016, FIN-017)
   */
  test('Scénario 3 : Surpaiement générant une avance et consommation automatique à la facture suivante', async () => {
    // 1. Création d'une facture de 50 000
    const invoiceShort = await invoiceRepository.createInvoice({
      invoice_number: `FAC-TEST-SHORT-${Date.now()}`,
      client_id: testClientId,
      property_id: testPropertyId,
      invoice_type: 'RENT_FULL',
      billing_period_start: '2025-04-01',
      billing_period_end: '2025-04-30',
      contract_rent_applied: 50000,
      base_amount: 50000,
      total_amount: 50000,
      paid_amount: 0.00,
      status: 'PENDING',
      due_date: '2025-04-05'
    });

    // 2. Paiement de 150 000 (doit solder les 50k et générer 100k d'avance au ledger)
    const paymentRes = await paymentService.registerPayment({
      clientId: testClientId,
      amountReceived: 150000,
      method: 'BANK_TRANSFER',
      propertyId: testPropertyId,
      receiptNumber: `REC-TEST-SURPLUS-${Date.now()}`,
      createdBy: testUserId
    });

    expect(paymentRes.unallocatedSurplus).toBe(100000.00);
    expect(paymentRes.advance).toBeDefined();
    expect(paymentRes.advance.transaction_type).toBe('CREDIT_ADVANCE');
    expect(parseFloat(paymentRes.advance.amount)).toBe(100000.00);
    expect(parseFloat(paymentRes.advance.running_balance)).toBe(100000.00);

    // Vérifier que la facture est soldée
    const [invRows] = await pool.query('SELECT * FROM invoices WHERE id = ?', [invoiceShort.id]);
    expect(invRows[0].status).toBe('PAID');

    // 3. Génération d'une nouvelle facture de 100 000 pour Mai 2025
    // Elle doit consommer automatiquement les 100 000 d'avance et passer directement à PAID
    const nextInvoiceRes = await rentBillingService.generateInvoice({
      clientId: testClientId,
      propertyId: testPropertyId,
      monthlyRent: 100000,
      periodStart: '2025-05-01',
      periodEnd: '2025-05-31',
      dueDate: '2025-05-05',
      createdBy: testUserId
    });

    expect(nextInvoiceRes.creditConsumed).toBe(100000.00);
    expect(nextInvoiceRes.remainingCreditBalance).toBe(0.00);

    // Recharger la facture générée en BDD
    const [m5Rows] = await pool.query('SELECT * FROM invoices WHERE id = ?', [nextInvoiceRes.invoice.id]);
    expect(m5Rows[0].status).toBe('PAID');
    expect(parseFloat(m5Rows[0].paid_amount)).toBe(100000.00);
    expect(parseFloat(m5Rows[0].balance_due)).toBe(0.00);

    // Vérifier l'écriture de DEBIT_CONSUMPTION au grand livre
    const latestBalance = await tenantCreditLedgerRepository.getLatestRunningBalance(testClientId);
    expect(latestBalance).toBe(0.00);
  });

  /**
   * Scénario 5 : Reddition de Comptes (OwnerSettlementService)
   */
  test('Scénario 5 : OwnerSettlementService - Calcul sur encaissements effectifs réels (FIN-019, FIN-020, FIN-021)', async () => {
    // Dans les tests précédents, des paiements et allocations ont été enregistrés sur le bien du testOwnerId
    const settlement = await ownerSettlementService.generateMonthlySettlement({
      ownerId: testOwnerId,
      periodStart: '2025-01-01',
      periodEnd: '2025-12-31',
      commissionRate: 8.00,
      maintenanceDeductions: 0.00
    });

    expect(settlement).toBeDefined();
    expect(settlement.status).toBe('CALCULATED');
    expect(parseFloat(settlement.commission_rate)).toBe(8.00);

    const totalCollected = parseFloat(settlement.total_collected);
    const agencyCommission = parseFloat(settlement.agency_commission);
    const netPayout = parseFloat(settlement.net_owner_payout);

    expect(totalCollected).toBeGreaterThan(0);
    expect(agencyCommission).toBeCloseTo((totalCollected * 8.00) / 100, 2);
    expect(netPayout).toBeCloseTo(totalCollected - agencyCommission, 2);

    // Test de l'approbation et du paiement du reversement (FIN-021)
    const payRes = await ownerSettlementService.approveAndPaySettlement({
      settlementId: settlement.id,
      payoutReference: 'VIR-OWNER-2025-001'
    });

    expect(payRes.success).toBe(true);
    expect(payRes.status).toBe('PAID');

    const [settleRows] = await pool.query('SELECT * FROM owner_settlements WHERE id = ?', [settlement.id]);
    expect(settleRows[0].status).toBe('PAID');
    expect(settleRows[0].payout_reference).toBe('VIR-OWNER-2025-001');
  });
});
