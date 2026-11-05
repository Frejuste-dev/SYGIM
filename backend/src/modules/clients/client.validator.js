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

const clientValidator = [
  body('firstName')
    .optional({ checkFalsy: true })
    .isString().withMessage('Le prénom doit être une chaîne de caractères')
    .trim(),
  
  body('lastName')
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

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'paid', 'partial', 'late']).withMessage('Le statut est invalide'),

  body('id_number')
    .optional({ checkFalsy: true })
    .isString().withMessage('Le numéro d\'identité doit être une chaîne')
    .trim(),

  handleValidationErrors
];

const updateClientValidator = [
  body('firstName')
    .optional()
    .isString().withMessage('Le prénom doit être une chaîne de caractères')
    .trim(),
  
  body('lastName')
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

  body('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'paid', 'partial', 'late']).withMessage('Le statut est invalide'),

  body('id_number')
    .optional({ checkFalsy: true })
    .isString().withMessage('Le numéro d\'identité doit être une chaîne')
    .trim(),

  handleValidationErrors
];

module.exports = {
  clientValidator,
  updateClientValidator
};
