/**
 * Module   : Auth
 * Auteur   : SYGIM Team
 * Créé le  : 2026-08-01
 * Rôle     : Validation des entrées d'authentification
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

const loginValidator = [
  body('username')
    .notEmpty().withMessage('Le nom d\'utilisateur est requis')
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Le nom d\'utilisateur doit faire entre 3 et 50 caractères')
    .matches(/^[a-zA-Z0-9_@.-]+$/).withMessage('Le nom d\'utilisateur contient des caractères invalides'),

  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
    .isLength({ min: 1, max: 128 }).withMessage('Le mot de passe doit faire entre 1 et 128 caractères'),

  handleValidationErrors
];

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty().withMessage('Le mot de passe actuel est requis')
    .isLength({ min: 8, max: 128 }).withMessage('Le mot de passe actuel doit faire entre 8 et 128 caractères'),

  body('newPassword')
    .notEmpty().withMessage('Le nouveau mot de passe est requis')
    .isLength({ min: 8, max: 128 }).withMessage('Le nouveau mot de passe doit faire entre 8 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'),

  handleValidationErrors
];

const registerValidator = [
  body('username')
    .notEmpty().withMessage('Le nom d\'utilisateur est requis')
    .trim()
    .isLength({ min: 3, max: 50 }).withMessage('Le nom d\'utilisateur doit faire entre 3 et 50 caractères')
    .matches(/^[a-zA-Z0-9_@.-]+$/).withMessage('Le nom d\'utilisateur contient des caractères invalides'),

  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
    .isLength({ min: 8, max: 128 }).withMessage('Le mot de passe doit faire entre 8 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Format email invalide')
    .normalizeEmail(),

  handleValidationErrors
];

module.exports = {
  loginValidator,
  changePasswordValidator,
  registerValidator
};
