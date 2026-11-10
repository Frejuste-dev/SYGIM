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

const exportTypeValidator = [
  param('type')
    .notEmpty().withMessage('Le type de rapport est requis')
    .isIn(['dashboard', 'collectors', 'properties', 'transactions', 'prefinancing', 'overdue']).withMessage('Type de rapport invalide'),

  handleValidationErrors
];

module.exports = {
  reportValidator,
  exportTypeValidator,
  handleValidationErrors
};
