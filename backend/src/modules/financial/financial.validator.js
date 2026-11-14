const { body, param, query, validationResult } = require('express-validator');
const ApiResponse = require('../../utils/responses/ApiResponse');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: firstError.msg,
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

const registerPaymentValidator = [
  body('clientId')
    .notEmpty().withMessage('Le clientId est obligatoire')
    .isInt({ min: 1 }).withMessage('clientId doit être un entier positif'),

  body('amountReceived')
    .notEmpty().withMessage('Le montant amountReceived est obligatoire')
    .isFloat({ min: 0.01 }).withMessage('amountReceived doit être supérieur à 0'),

  body('method')
    .notEmpty().withMessage('La méthode de paiement est obligatoire')
    .isIn(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'CHECK'])
    .withMessage('Méthode invalide (CASH, BANK_TRANSFER, MOBILE_MONEY, CHEQUE, CHECK)'),

  body('collectorId')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('collectorId doit être un entier positif'),

  body('propertyId')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('propertyId doit être un entier positif'),

  body('receiptNumber')
    .optional({ nullable: true })
    .isString().trim().isLength({ max: 50 }).withMessage('receiptNumber doit être une chaîne <= 50 caractères'),

  handleValidationErrors
];

const reversePaymentValidator = [
  param('id')
    .notEmpty().withMessage('L\'identifiant de paiement est requis')
    .isInt({ min: 1 }).withMessage('L\'identifiant de paiement doit être un entier valide'),

  body('reason')
    .notEmpty().withMessage('Le motif d\'extourne est obligatoire (FIN-007)')
    .isString().trim().isLength({ min: 5, max: 255 }).withMessage('Le motif doit comporter entre 5 et 255 caractères'),

  handleValidationErrors
];

const generateMonthlyInvoiceValidator = [
  body('clientId')
    .notEmpty().withMessage('Le clientId est obligatoire')
    .isInt({ min: 1 }).withMessage('clientId doit être un entier positif'),

  body('monthlyRent')
    .notEmpty().withMessage('monthlyRent est obligatoire')
    .isFloat({ min: 0.01 }).withMessage('monthlyRent doit être supérieur à 0'),

  body('periodStart')
    .notEmpty().withMessage('periodStart est obligatoire')
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format periodStart invalide (YYYY-MM-DD)'),

  body('periodEnd')
    .notEmpty().withMessage('periodEnd est obligatoire')
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format periodEnd invalide (YYYY-MM-DD)'),

  body('dueDate')
    .notEmpty().withMessage('dueDate est obligatoire')
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format dueDate invalide (YYYY-MM-DD)'),

  body('propertyId')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('propertyId doit être un entier positif'),

  handleValidationErrors
];

const generateSettlementValidator = [
  body('ownerId')
    .notEmpty().withMessage('ownerId est obligatoire')
    .isInt({ min: 1 }).withMessage('ownerId doit être un entier positif'),

  body('periodStart')
    .notEmpty().withMessage('periodStart est obligatoire')
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format periodStart invalide (YYYY-MM-DD)'),

  body('periodEnd')
    .notEmpty().withMessage('periodEnd est obligatoire')
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format periodEnd invalide (YYYY-MM-DD)'),

  body('commissionRate')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('commissionRate doit être un pourcentage entre 0 et 100'),

  body('maintenanceDeductions')
    .optional()
    .isFloat({ min: 0 }).withMessage('maintenanceDeductions doit être un montant positif ou nul'),

  handleValidationErrors
];

const tenantStatementValidator = [
  param('id')
    .notEmpty().withMessage('L\'identifiant du locataire est obligatoire')
    .isInt({ min: 1 }).withMessage('L\'identifiant du locataire doit être un entier positif'),

  handleValidationErrors
];

const recordOwnerPaymentValidator = [
  body('ownerId')
    .custom((val, { req }) => {
      const id = val || req.body.owner_id;
      if (!id || isNaN(parseInt(id, 10)) || parseInt(id, 10) <= 0) {
        throw new Error('L\'identifiant du propriétaire (ownerId) est obligatoire et doit être un entier positif');
      }
      return true;
    }),

  body('periodStart')
    .custom((val, { req }) => {
      const d = val || req.body.period_start;
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d))) {
        throw new Error('Format periodStart invalide (YYYY-MM-DD)');
      }
      return true;
    }),

  body('periodEnd')
    .custom((val, { req }) => {
      const end = val || req.body.period_end;
      const start = req.body.periodStart || req.body.period_start;
      if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end) || isNaN(Date.parse(end))) {
        throw new Error('Format periodEnd invalide (YYYY-MM-DD)');
      }
      if (start && new Date(end) < new Date(start)) {
        throw new Error('periodEnd doit être postérieur ou égal à periodStart');
      }
      return true;
    }),

  body('amount')
    .custom((val, { req }) => {
      const amt = val ?? req.body.amount_paid ?? req.body.amountPaid;
      if (amt === undefined || amt === null || isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) {
        throw new Error('Le montant (amount) est obligatoire et doit être supérieur à 0');
      }
      return true;
    }),

  body('paymentMethod')
    .custom((val, { req }) => {
      const method = (val || req.body.payment_method || '').toLowerCase();
      const validMethods = ['cash', 'check', 'cheque', 'bank_transfer', 'mobile_money'];
      if (!method || !validMethods.includes(method)) {
        throw new Error(`paymentMethod obligatoire et doit être l'un de : ${validMethods.join(', ')}`);
      }
      return true;
    }),

  body('reference')
    .optional({ nullable: true })
    .isString().trim(),

  body('payout_reference')
    .optional({ nullable: true })
    .isString().trim(),

  handleValidationErrors
];

const paySettlementValidator = [
  param('id')
    .notEmpty().withMessage('L\'identifiant du règlement est obligatoire')
    .isInt({ min: 1 }).withMessage('L\'identifiant du règlement doit être un entier positif'),

  body('paymentMethod')
    .custom((val, { req }) => {
      const method = (val || req.body.payment_method || '').toLowerCase();
      const validMethods = ['cash', 'check', 'cheque', 'bank_transfer', 'mobile_money'];
      if (!method || !validMethods.includes(method)) {
        throw new Error(`paymentMethod obligatoire et doit être l'un de : ${validMethods.join(', ')}`);
      }
      return true;
    }),

  body('reference')
    .optional({ nullable: true })
    .isString().trim(),

  body('payout_reference')
    .optional({ nullable: true })
    .isString().trim(),

  body('paidAt')
    .optional({ nullable: true })
    .isISO8601().withMessage('Format paidAt invalide (date ISO)'),

  handleValidationErrors
];

module.exports = {
  registerPaymentValidator,
  reversePaymentValidator,
  generateMonthlyInvoiceValidator,
  generateSettlementValidator,
  tenantStatementValidator,
  recordOwnerPaymentValidator,
  paySettlementValidator
};
