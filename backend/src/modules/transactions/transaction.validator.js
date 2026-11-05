/**
 * Module   : Transactions
 * Auteur   : SYGIM Team
 * Créé le  : 2026-08-01
 * Rôle     : Validation des entrées de transactions
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

const transactionValidator = [
  body('amount')
    .notEmpty().withMessage('Le montant est requis')
    .isFloat({ min: 0 }).withMessage('Le montant doit être positif'),

  body('clientId')
    .notEmpty().withMessage('L\'identifiant du client est requis')
    .isInt({ min: 1 }).withMessage('L\'identifiant du client doit être un entier positif'),

  body('method')
    .notEmpty().withMessage('Le moyen de paiement est requis')
    .isIn(['cash', 'mobile_money', 'bank_transfer', 'check', 'card']).withMessage('Moyen de paiement invalide'),

  body('status')
    .optional()
    .isIn(['processed', 'pending', 'cancelled', 'refunded']).withMessage('Statut invalide'),

  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('La description ne doit pas dépasser 500 caractères'),

  handleValidationErrors
];

const updateTransactionValidator = [
  body('amount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Le montant doit être positif'),

  body('method')
    .optional()
    .isIn(['cash', 'mobile_money', 'bank_transfer', 'check', 'card']).withMessage('Moyen de paiement invalide'),

  body('status')
    .optional()
    .isIn(['processed', 'pending', 'cancelled', 'refunded']).withMessage('Statut invalide'),

  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('La description ne doit pas dépasser 500 caractères'),

  handleValidationErrors
];

module.exports = {
  transactionValidator,
  updateTransactionValidator
};
