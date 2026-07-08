/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Validation des paramètres de rapport
 */

const { query } = require('express-validator');

const reportValidator = [
  query('startDate')
    .optional()
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format date invalide (YYYY-MM-DD)'),
  
  query('endDate')
    .optional()
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format date invalide (YYYY-MM-DD)'),

  query('ownerId')
    .optional()
    .isInt({ min: 1 }).withMessage('ownerId doit être un entier positif'),

  query('type')
    .optional()
    .isIn(['dashboard', 'collectors', 'properties', 'transactions']).withMessage('Type de rapport invalide')
];

module.exports = reportValidator;
