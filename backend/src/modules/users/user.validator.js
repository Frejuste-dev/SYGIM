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
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Le nom d\'utilisateur ne doit contenir que des lettres, chiffres et underscores')
    .trim(),
  
  body('role')
    .notEmpty().withMessage('Le rôle est requis')
    .isIn(['admin', 'collector', 'collector_manager', 'owner', 'accounting']).withMessage('Le rôle est invalide'),
    
  body('password')
    .notEmpty().withMessage('Le mot de passe est requis')
    .isLength({ min: 6 }).withMessage('Le mot de passe doit faire au moins 6 caractères'),

  handleValidationErrors
];

const updateUserValidator = [
  body('username')
    .optional()
    .isString().withMessage('Le nom d\'utilisateur doit être une chaîne')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Le nom d\'utilisateur ne doit contenir que des lettres, chiffres et underscores')
    .trim(),
  
  body('role')
    .optional()
    .isIn(['admin', 'collector', 'collector_manager', 'owner', 'accounting']).withMessage('Le rôle est invalide'),
    
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 6 }).withMessage('Le mot de passe doit faire au moins 6 caractères'),

  handleValidationErrors
];

module.exports = {
  userValidator,
  updateUserValidator
};
