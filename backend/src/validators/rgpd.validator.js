/**
 * Module   : RGPD
 * Auteur   : SYGIM Team
 * Créé le  : 2026-08-05
 * Rôle     : Validation des entrées RGPD
 */

const { body, validationResult } = require('express-validator');

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

const purgeLogsValidator = [
  body('days')
    .optional()
    .isInt({ min: 1, max: 365 }).withMessage('Le nombre de jours doit être entre 1 et 365'),

  handleValidationErrors
];

module.exports = {
  purgeLogsValidator,
  handleValidationErrors
};
