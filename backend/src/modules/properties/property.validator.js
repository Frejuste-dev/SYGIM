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

const propertyValidator = [
  body('name')
    .notEmpty().withMessage('Le nom du bien est requis')
    .isString().withMessage('Le nom doit être une chaîne de caractères')
    .trim(),
  
  body('type')
    .notEmpty().withMessage('Le type de bien est requis')
    .isString().withMessage('Le type doit être une chaîne de caractères')
    .trim(),
    
  body('address')
    .notEmpty().withMessage('L\'adresse est requise')
    .isString().withMessage('L\'adresse doit être une chaîne de caractères')
    .trim(),

  body('value')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('La valeur doit être positive'),

  body('status')
    .optional()
    .isIn(['vacant', 'loue', 'en_renovation', 'vendu']).withMessage('Le statut est invalide'),

  body('owner_id')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('L\'identifiant du propriétaire doit être un entier positif'),

  body('tenant_id')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('L\'identifiant du locataire doit être un entier positif'),

  handleValidationErrors
];

const updatePropertyValidator = [
  body('name')
    .optional()
    .isString().withMessage('Le nom doit être une chaîne de caractères')
    .trim(),
  
  body('type')
    .optional()
    .isString().withMessage('Le type doit être une chaîne de caractères')
    .trim(),
    
  body('address')
    .optional()
    .isString().withMessage('L\'adresse doit être une chaîne de caractères')
    .trim(),

  body('value')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('La valeur doit être positive'),

  body('status')
    .optional()
    .isIn(['vacant', 'loue', 'en_renovation', 'vendu']).withMessage('Le statut est invalide'),

  body('owner_id')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('L\'identifiant du propriétaire doit être un entier positif'),

  body('tenant_id')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('L\'identifiant du locataire doit être un entier positif'),

  handleValidationErrors
];

module.exports = {
  propertyValidator,
  updatePropertyValidator
};
