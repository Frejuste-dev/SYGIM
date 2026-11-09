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
 */
router.post(
  '/invoices/generate-monthly',
  authorize('admin', 'director', 'accounting', 'collector_manager'),
  generateMonthlyInvoiceValidator,
  financialController.generateMonthlyInvoice
);

/**
 * @route   GET /api/financial/settlements
 * @desc    Lister les paiements propriétaires (Reversements intégraux, échelonnés & préfinancements)
 */
router.get(
  '/settlements',
  authorize('admin', 'director', 'accounting', 'collector_manager'),
  financialController.getSettlements
);

/**
 * @route   POST /api/financial/settlements
 * @desc    Enregistrer un paiement propriétaire (Intégral, Échelonné ou Préfinancement sur impayé locataire)
 */
router.post(
  '/settlements',
  authorize('admin', 'director', 'accounting'),
  financialController.recordOwnerPayment
);

/**
 * @route   PUT /api/financial/settlements/:id/pay
 * @desc    Compléter ou solder un paiement propriétaire échelonné
 */
router.put(
  '/settlements/:id/pay',
  authorize('admin', 'director', 'accounting'),
  financialController.paySettlement
);

/**
 * @route   GET /api/financial/owners-summary
 * @desc    Synthèse financière par propriétaire (biens, loyers attendus, encaissés, impayés locataires)
 */
router.get(
  '/owners-summary',
  authorize('admin', 'director', 'accounting', 'collector_manager'),
  financialController.getOwnersFinancialSummary
);

/**
 * @route   GET /api/financial/ledger
 * @desc    Grand Livre Comptable Général (Encaissements Locataires + Reversements & Préfinancements Propriétaires)
 */
router.get(
  '/ledger',
  authorize('admin', 'director', 'accounting'),
  financialController.getGeneralLedger
);

/**
 * @route   POST /api/financial/settlements/generate
 * @desc    Calculer la reddition de compte propriétaire mensuelle sur encaissements réels
 */
router.post(
  '/settlements/generate',
  authorize('admin', 'director', 'accounting'),
  generateSettlementValidator,
  financialController.generateSettlement
);

/**
 * @route   GET /api/financial/tenants/:id/statement
 * @desc    Relevé de compte locataire exhaustif (Grand Livre)
 */
router.get(
  '/tenants/:id/statement',
  authorize('admin', 'director', 'accounting', 'collector_manager', 'collector'),
  tenantStatementValidator,
  financialController.getTenantStatement
);

module.exports = router;
