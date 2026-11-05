/**
 * Module   : Alerts
 * Auteur   : SYGIM Team
 * Créé le  : 2026-08-05
 * Rôle     : Validation des entrées d'alertes
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

const overduePaymentsValidator = [
  query('daysThreshold')
    .optional()
    .isInt({ min: 1, max: 365 }).withMessage('Le seuil de jours doit être entre 1 et 365'),

  query('collectorId')
    .optional()
    .isInt({ min: 1 }).withMessage('L\'identifiant du collecteur doit être un entier positif'),

  query('severity')
    .optional()
    .isIn(['critique', 'haute', 'normale', 'basse', 'all']).withMessage('Sévérité invalide'),

  handleValidationErrors
];

const acknowledgeValidator = [
  param('clientId')
    .notEmpty().withMessage('L\'identifiant du client est requis')
    .isInt({ min: 1 }).withMessage('L\'identifiant du client doit être un entier positif'),

  handleValidationErrors
];

module.exports = {
  overduePaymentsValidator,
  acknowledgeValidator,
  handleValidationErrors
};
