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

const ownerValidator = [
  body('first_name')
    .notEmpty().withMessage('Le prénom est requis')
    .isString().withMessage('Le prénom doit être une chaîne de caractères')
    .trim(),
  
  body('last_name')
    .notEmpty().withMessage('Le nom est requis')
    .isString().withMessage('Le nom doit être une chaîne de caractères')
    .trim(),
    
  body('phone')
    .notEmpty().withMessage('Le numéro de téléphone est requis')
    .isString().withMessage('Le format du téléphone est invalide')
    .trim(),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('L\'adresse email est invalide')
    .normalizeEmail(),

  body('address')
    .optional({ checkFalsy: true })
    .isString().withMessage('L\'adresse doit être une chaîne de caractères')
    .trim(),

  body('commissionRate')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 }).withMessage('Le taux de commission doit être entre 0 et 100'),

  body('active')
    .optional()
    .isBoolean().withMessage('Le champ actif doit être un booléen')
    .toBoolean(),

  handleValidationErrors
];

const updateOwnerValidator = [
  body('first_name')
    .optional()
    .isString().withMessage('Le prénom doit être une chaîne de caractères')
    .trim(),
  
  body('last_name')
    .optional()
    .isString().withMessage('Le nom doit être une chaîne de caractères')
    .trim(),
    
  body('phone')
    .optional()
    .isString().withMessage('Le format du téléphone est invalide')
    .trim(),

  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('L\'adresse email est invalide')
    .normalizeEmail(),

  body('address')
    .optional({ checkFalsy: true })
    .isString().withMessage('L\'adresse doit être une chaîne de caractères')
    .trim(),

  body('commissionRate')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 }).withMessage('Le taux de commission doit être entre 0 et 100'),

  body('active')
    .optional()
    .isBoolean().withMessage('Le champ actif doit être un booléen')
    .toBoolean(),

  handleValidationErrors
];

module.exports = {
  ownerValidator,
  updateOwnerValidator
};
