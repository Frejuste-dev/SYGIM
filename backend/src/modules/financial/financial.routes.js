const express = require('express');
const router = express.Router();
const financialController = require('./financial.controller');
const {
  registerPaymentValidator,
  reversePaymentValidator,
  generateMonthlyInvoiceValidator,
  generateSettlementValidator,
  tenantStatementValidator
} = require('./financial.validator');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Toutes les routes financières requièrent une authentification active
router.use(authenticate);

/**
 * @route   POST /api/financial/payments
 * @desc    Enregistrer un encaissement physique avec apurement FIFO automatique et mise en avance du surplus
 * @access  Admin, Director, Accounting, CollectorManager, Collector
 */
router.post(
  '/payments',
  authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'),
  registerPaymentValidator,
  financialController.registerPayment
);

/**
 * @route   POST /api/financial/payments/:id/reverse
 * @desc    Extourne stricte d'un paiement (Révocation formelle, FIN-006)
 * @access  Admin, Director, Accounting uniquement
 */
router.post(
  '/payments/:id/reverse',
  authorize('admin', 'director', 'accounting'),
  reversePaymentValidator,
  financialController.reversePayment
);

/**
 * @route   POST /api/financial/invoices/generate-monthly
 * @desc    Générer une facture de loyer (avec calcul de prorata et compensation automatique d'avance)
 * @access  Admin, Director, Accounting, CollectorManager
 */
router.post(
  '/invoices/generate-monthly',
  authorize('admin', 'director', 'accounting', 'collector_manager'),
  generateMonthlyInvoiceValidator,
  financialController.generateMonthlyInvoice
);

/**
 * @route   POST /api/financial/settlements/generate
 * @desc    Calculer la reddition de compte propriétaire mensuelle sur encaissements réels (FIN-019, 020, 021)
 * @access  Admin, Director, Accounting
 */
router.post(
  '/settlements/generate',
  authorize('admin', 'director', 'accounting'),
  generateSettlementValidator,
  financialController.generateSettlement
);

/**
 * @route   GET /api/financial/tenants/:id/statement
 * @desc    Relevé de compte locataire exhaustif (Grand Livre) : factures, paiements, extournes, solde d'avance
 * @access  Admin, Director, Accounting, CollectorManager, Collector
 */
router.get(
  '/tenants/:id/statement',
  authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'),
  tenantStatementValidator,
  financialController.getTenantStatement
);

module.exports = router;
