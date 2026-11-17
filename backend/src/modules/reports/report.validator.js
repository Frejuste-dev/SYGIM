/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Validation des paramètres de rapport
 */

const { query, param, validationResult } = require('express-validator');

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: firstError.msg
    });
  }
  next();
};

const reportValidator = [
  query('startDate')
    .optional({ checkFalsy: true })
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format date invalide (YYYY-MM-DD)'),

  query('endDate')
    .optional({ checkFalsy: true })
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format date invalide (YYYY-MM-DD)'),

  query('ownerId')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('ownerId doit être un entier positif'),

  query('type')
    .optional({ checkFalsy: true })
    .isIn(['dashboard', 'collectors', 'properties', 'transactions', 'prefinancing', 'overdue']).withMessage('Type de rapport invalide'),

  handleValidationErrors
];

const ownerReportParamValidator = [
  param('ownerId')
    .notEmpty().withMessage('L\'identifiant propriétaire est requis')
    .isInt({ min: 1 }).withMessage('L\'identifiant propriétaire doit être un entier positif'),

  query('month')
    .optional({ checkFalsy: true })
    .matches(/^([1-9]|1[0-2]|\d{4}-(0[1-9]|1[0-2]))$/).withMessage('Format du mois invalide (1-12 ou YYYY-MM)'),

  query('year')
    .optional({ checkFalsy: true })
    .isInt({ min: 2000, max: 2100 }).withMessage('Année invalide (2000-2100)'),

  query('startDate')
    .optional({ checkFalsy: true })
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format date invalide (YYYY-MM-DD)'),

  query('endDate')
    .optional({ checkFalsy: true })
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format date invalide (YYYY-MM-DD)'),

  query('commissionRate')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 }).withMessage('Taux de commission invalide (0-100)'),

  handleValidationErrors
];

const agedReceivablesValidator = [
  query('search')
    .optional()
    .isString().trim(),

  query('zone')
    .optional()
    .isString().trim(),

  query('limit')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 500 }).withMessage('Limite invalide (1-500)'),

  query('offset')
    .optional({ checkFalsy: true })
    .isInt({ min: 0 }).withMessage('Offset invalide (doit être >= 0)'),

  handleValidationErrors
];

const depositsValidator = [
  query('status')
    .optional({ checkFalsy: true })
    .isIn(['held', 'restituted', 'partially_restituted', 'disputed', 'all']).withMessage('Statut de dépôt invalide'),

  query('search')
    .optional()
    .isString().trim(),

  query('limit')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 500 }).withMessage('Limite invalide (1-500)'),

  handleValidationErrors
];

const taxDeclarationValidator = [
  param('ownerId')
    .notEmpty().withMessage('L\'identifiant propriétaire est requis')
    .isInt({ min: 1 }).withMessage('L\'identifiant propriétaire doit être un entier positif'),

  query('year')
    .optional({ checkFalsy: true })
    .isInt({ min: 2000, max: 2100 }).withMessage('Année fiscale invalide (2000-2100)'),

  handleValidationErrors
];

const vacancyLossValidator = [
  query('year')
    .optional({ checkFalsy: true })
    .isInt({ min: 2000, max: 2100 }).withMessage('Année invalide (2000-2100)'),

  query('zone')
    .optional()
    .isString().trim(),

  handleValidationErrors
];

const performanceDashboardValidator = [
  query('granularity')
    .optional({ checkFalsy: true })
    .isIn(['day', 'week', 'month', 'quarter', 'year']).withMessage('Granularité invalide (day, week, month, quarter, year)'),

  query('period')
    .optional({ checkFalsy: true })
    .isIn(['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'all']).withMessage('Période invalide'),

  query('startDate')
    .optional({ checkFalsy: true })
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format date début invalide (YYYY-MM-DD)'),

  query('endDate')
    .optional({ checkFalsy: true })
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format date fin invalide (YYYY-MM-DD)'),

  handleValidationErrors
];

const managerDashboardValidator = [
  query('month')
    .optional({ checkFalsy: true })
    .matches(/^([1-9]|1[0-2]|\d{4}-(0[1-9]|1[0-2]))$/).withMessage('Format du mois invalide (1-12 ou YYYY-MM)'),

  query('year')
    .optional({ checkFalsy: true })
    .isInt({ min: 2000, max: 2100 }).withMessage('Année invalide (2000-2100)'),

  handleValidationErrors
];

const exportTypeValidator = [
  param('type')
    .notEmpty().withMessage('Le type de rapport est requis')
    .isIn([
      'dashboard',
      'collectors',
      'properties',
      'transactions',
      'prefinancing',
      'overdue',
      'owner_statements',
      'aged_receivables',
      'deposits',
      'mandate_bfr',
      'vacancy_loss'
    ]).withMessage('Type de rapport invalide pour l\'export'),

  handleValidationErrors
];

module.exports = {
  reportValidator,
  exportTypeValidator,
  ownerReportParamValidator,
  agedReceivablesValidator,
  depositsValidator,
  taxDeclarationValidator,
  vacancyLossValidator,
  performanceDashboardValidator,
  managerDashboardValidator,
  handleValidationErrors
};
