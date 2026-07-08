/**
 * Module   : Collectors
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Validation des entrées collecteurs
 */

const { body } = require('express-validator');

const collectorValidator = [
  body('lastName')
    .notEmpty().withMessage('Le nom est requis')
    .isLength({ min: 2, max: 100 }).withMessage('Le nom doit faire entre 2 et 100 caractères'),
  
  body('firstName')
    .optional()
    .isLength({ max: 100 }).withMessage('Le prénom ne peut excéder 100 caractères'),

  body('phone')
    .optional({ checkFalsy: true })
    .matches(/^\+225\d{10}$/).withMessage('Le téléphone doit être au format +225XXXXXXXXXX'),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Format email invalide'),

  body('userId')
    .optional({ checkFalsy: true })
    .isInt().withMessage('L\'ID utilisateur doit être un entier')
];

module.exports = collectorValidator;
