const { body, validationResult } = require('express-validator');

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

const userValidator = [
  body('username')
    .notEmpty().withMessage('Le nom d\'utilisateur est requis')
    .isString().withMessage('Le nom d\'utilisateur doit être une chaîne')
    .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Le nom d\'utilisateur ne doit contenir que des lettres, chiffres, points, tirets et underscores')
    .trim(),
  
  body('role')
    .notEmpty().withMessage('Le rôle est requis')
    .isIn(['admin', 'super_admin', 'director', 'manager', 'collector_manager', 'accounting', 'collector', 'owner']).withMessage('Le rôle est invalide'),
    
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères')
    .matches(/[A-Za-z]/).withMessage('Le mot de passe doit contenir au moins une lettre')
    .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre'),

  handleValidationErrors
];

const updateUserValidator = [
  body('username')
    .optional()
    .isString().withMessage('Le nom d\'utilisateur doit être une chaîne')
    .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Le nom d\'utilisateur ne doit contenir que des lettres, chiffres, points, tirets et underscores')
    .trim(),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Adresse email invalide')
    .normalizeEmail(),

  body('phone')
    .optional({ checkFalsy: true })
    .isString().withMessage('Le téléphone doit être une chaîne')
    .trim(),
  
  body('role')
    .optional()
    .isIn(['admin', 'super_admin', 'director', 'manager', 'collector_manager', 'accounting', 'collector', 'owner']).withMessage('Le rôle est invalide'),
    
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères')
    .matches(/[A-Za-z]/).withMessage('Le mot de passe doit contenir au moins une lettre')
    .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre'),

  handleValidationErrors
];

const resetPasswordValidator = [
  body('autoGenerate')
    .optional()
    .isBoolean().withMessage('autoGenerate doit être un booléen'),

  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères')
    .matches(/[A-Za-z]/).withMessage('Le mot de passe doit contenir au moins une lettre')
    .matches(/[0-9]/).withMessage('Le mot de passe doit contenir au moins un chiffre'),

  handleValidationErrors
];

module.exports = {
  userValidator,
  updateUserValidator,
  resetPasswordValidator
};
