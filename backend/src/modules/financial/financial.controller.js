const paymentService = require('./services/PaymentService');
const rentBillingService = require('./services/RentBillingService');
const ownerSettlementService = require('./services/OwnerSettlementService');
const tenantCreditLedgerRepository = require('./repositories/tenant-credit-ledger.repository');
const { pool } = require('../../../config/db');
const ApiResponse = require('../../utils/responses/ApiResponse');
const AppError = require('../../utils/errors/AppError');

class FinancialController {
  /**
   * POST /api/financial/payments
   * Enregistre un encaissement physique avec apurement FIFO et avance automatique
   */
  async registerPayment(req, res, next) {
    try {
      const {
        clientId,
        amountReceived,
        method,
        collectorId,
        propertyId,
        receiptNumber
      } = req.body;

      const createdBy = req.user.id;
      let resolvedCollectorId = collectorId ? parseInt(collectorId, 10) : null;
      if (!resolvedCollectorId && req.user?.role === 'collector') {
        const [colRows] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [req.user.id]);
        if (colRows.length > 0) resolvedCollectorId = colRows[0].id;
      }

      const normalizedMethod = (method === 'CHECK' ? 'CHEQUE' : method);

      const result = await paymentService.registerPayment({
        clientId: parseInt(clientId, 10),
        amountReceived: parseFloat(amountReceived),
        method: normalizedMethod,
        collectorId: resolvedCollectorId,
        propertyId: propertyId ? parseInt(propertyId, 10) : null,
        receiptNumber: receiptNumber || null,
        createdBy
      });

      return res.status(201).json(ApiResponse.created(result, 'Paiement enregistré et affecté avec succès (FIFO).'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/financial/payments/:id/reverse
   * Extourne formelle d'un paiement (Direction / RAF uniquement, FIN-006)
   */
  async reversePayment(req, res, next) {
    try {
      const paymentId = parseInt(req.params.id, 10);
      const { reason } = req.body;
      const reversedByUserId = req.user.id;

      const result = await paymentService.reversePayment({
        paymentId,
        reversedByUserId,
        reason
      });

      return res.json(ApiResponse.success(result, 'Paiement extourné avec succès.'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/financial/invoices/generate-monthly
   * Batch ou génération unitaire de facture avec calcul de prorata et déduction d'avance
   */
  async generateMonthlyInvoice(req, res, next) {
    try {
      const {
        clientId,
        propertyId,
        monthlyRent,
        periodStart,
        periodEnd,
        dueDate,
        invoiceNumber
      } = req.body;

      const createdBy = req.user.id;

      const result = await rentBillingService.generateInvoice({
        clientId: parseInt(clientId, 10),
        propertyId: propertyId ? parseInt(propertyId, 10) : null,
        monthlyRent: parseFloat(monthlyRent),
        periodStart,
        periodEnd,
        dueDate,
        invoiceNumber,
        createdBy
      });

      return res.status(201).json(ApiResponse.created(result, 'Facture de loyer générée avec succès.'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/financial/settlements
   * Liste des paiements, reversements et préfinancements propriétaires
   */
  async getSettlements(req, res, next) {
    try {
      const { owner_id, payout_mode, status, search } = req.query;
      const result = await ownerSettlementService.getSettlementsWithStats({
        owner_id,
        payout_mode,
        status,
        search
      });
      return res.json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/financial/owners-summary
   * Situation locative et financière de chaque propriétaire (loyers attendus, encaissés, impayés pour préfinancement)
   */
  async getOwnersFinancialSummary(req, res, next) {
    try {
      const data = await ownerSettlementService.getOwnersFinancialSummary();
      return res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/financial/settlements
   * Enregistrer un paiement propriétaire (Intégral, Échelonné, ou Préfinancement)
   */
  async recordOwnerPayment(req, res, next) {
    try {
      const settlement = await ownerSettlementService.recordOwnerPayment(req.body, req.user?.id);
      return res.status(201).json(ApiResponse.created(settlement, 'Paiement propriétaire enregistré avec succès.'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/financial/settlements/:id/pay
   * Compléter ou solder un paiement propriétaire échelonné (nouvelle tranche)
   */
  async paySettlement(req, res, next) {
    try {
      const settlementId = parseInt(req.params.id, 10);
      const { payout_reference, additional_amount, payment_method, notes } = req.body;
      const result = await ownerSettlementService.approveAndPaySettlement({
        settlementId,
        payoutReference: payout_reference,
        additionalAmount: additional_amount !== undefined && additional_amount !== null ? parseFloat(additional_amount) : null,
        paymentMethod: payment_method || null,
        notes: notes || null,
        userId: req.user?.id || null
      });
      return res.json(ApiResponse.success(result, 'Tranche / versement propriétaire enregistré avec succès.'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/financial/settlements/generate
   * Génération de la reddition de compte propriétaire pour la période M
   */
  async generateSettlement(req, res, next) {
    try {
      const {
        ownerId,
        periodStart,
        periodEnd,
        commissionRate,
        maintenanceDeductions
      } = req.body;

      const settlement = await ownerSettlementService.generateMonthlySettlement({
        ownerId: parseInt(ownerId, 10),
        periodStart,
        periodEnd,
        commissionRate: commissionRate ? parseFloat(commissionRate) : 10.00,
        maintenanceDeductions: maintenanceDeductions ? parseFloat(maintenanceDeductions) : 0.00,
        createdBy: req.user?.id
      });

      return res.status(201).json(ApiResponse.created(settlement, 'Décompte propriétaire calculé avec succès.'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/financial/ledger
   * Grand Livre Comptable Général (Encaissements Locataires + Reversements & Préfinancements Propriétaires)
   */
  async getGeneralLedger(req, res, next) {
    try {
      const result = await ownerSettlementService.getGeneralLedger(req.query);
      return res.json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/financial/tenants/:id/statement
   * Relevé de compte locataire complet (Grand Livre)
   */
  async getTenantStatement(req, res, next) {
    try {
      const clientId = parseInt(req.params.id, 10);

      const [clientRows] = await pool.query('SELECT * FROM clients WHERE id = ?', [clientId]);
      if (clientRows.length === 0) {
        throw AppError.notFound('Locataire introuvable.');
      }
      const client = clientRows[0];

      const [invoices] = await pool.query(`
        SELECT id, uuid, invoice_number, invoice_type, billing_period_start, billing_period_end,
               total_amount, paid_amount, balance_due, status, due_date, created_at
        FROM invoices
        WHERE client_id = ?
        ORDER BY due_date DESC, id DESC
      `, [clientId]);

      const [payments] = await pool.query(`
        SELECT p.id, p.uuid, p.transaction_reference, p.receipt_number, p.amount_received,
               p.payment_method, p.payment_date, p.status, p.is_reversed, p.reversal_reason, p.reversed_at
        FROM payments p
        WHERE p.client_id = ?
        ORDER BY p.payment_date DESC
      `, [clientId]);

      const [ledgerEntries] = await pool.query(`
        SELECT id, uuid, transaction_type, amount, running_balance, source_payment_id, consumed_invoice_id, created_at
        FROM tenant_credit_ledger
        WHERE client_id = ?
        ORDER BY id DESC
      `, [clientId]);

      const currentAdvanceBalance = await tenantCreditLedgerRepository.getLatestRunningBalance(clientId);
      const totalDue = invoices
        .filter(inv => inv.status !== 'CANCELLED')
        .reduce((sum, inv) => sum + parseFloat(inv.balance_due), 0);

      const netBalance = parseFloat((totalDue - currentAdvanceBalance).toFixed(2));

      return res.json(ApiResponse.success({
        client: {
          id: client.id,
          name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
          email: client.email,
          phone: client.phone
        },
        summary: {
          totalDebtRemaining: totalDue,
          creditAdvanceBalance: currentAdvanceBalance,
          netPosition: netBalance > 0 ? `DOIT_${netBalance}` : (netBalance < 0 ? `CREDITEUR_${Math.abs(netBalance)}` : 'A_JOUR')
        },
        invoices,
        payments,
        ledger: ledgerEntries
      }, 'Relevé de compte locataire généré.'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FinancialController();
