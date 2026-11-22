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
    .notEmpty().withMessage('Le propriétaire bailleur est requis')
    .isInt({ min: 1 }).withMessage('L\'identifiant du propriétaire doit être un entier positif'),

  body('tenant_id')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('L\'identifiant du locataire doit être un entier positif'),

  body('commission_type')
    .optional()
    .isIn(['percentage', 'fixed']).withMessage('Le type de commission doit être "percentage" ou "fixed"'),

  body('commission_rate')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 }).withMessage('Le taux de commission doit être compris entre 0 et 100%'),

  body('commission_fixed_amount')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Le montant fixe de commission doit être positif'),

  body('floor_level')
    .optional({ nullable: true })
    .isString().withMessage('L\'étage doit être une chaîne de caractères')
    .trim(),

  body('unit_type')
    .optional({ nullable: true })
    .isString().withMessage('Le type d\'unité doit être une chaîne de caractères')
    .trim(),

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
    .notEmpty().withMessage('Le propriétaire bailleur est requis')
    .isInt({ min: 1 }).withMessage('L\'identifiant du propriétaire doit être un entier positif'),

  body('tenant_id')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('L\'identifiant du locataire doit être un entier positif'),

  body('commission_type')
    .optional()
    .isIn(['percentage', 'fixed']).withMessage('Le type de commission doit être "percentage" ou "fixed"'),

  body('commission_rate')
    .optional({ nullable: true })
    .isFloat({ min: 0, max: 100 }).withMessage('Le taux de commission doit être compris entre 0 et 100%'),

  body('commission_fixed_amount')
    .optional({ nullable: true })
    .isFloat({ min: 0 }).withMessage('Le montant fixe de commission doit être positif'),

  body('floor_level')
    .optional({ nullable: true })
    .isString().withMessage('L\'étage doit être une chaîne de caractères')
    .trim(),

  body('unit_type')
    .optional({ nullable: true })
    .isString().withMessage('Le type d\'unité doit être une chaîne de caractères')
    .trim(),

  handleValidationErrors
];

const assignOwnerValidator = [
  body('owner_id')
    .notEmpty().withMessage('L\'identifiant du propriétaire est requis')
    .isInt({ min: 1 }).withMessage('L\'identifiant du propriétaire doit être un entier positif'),

  body('notes')
    .optional({ nullable: true })
    .isString().withMessage('Les notes doivent être une chaîne de caractères')
    .trim(),

  handleValidationErrors
];

const reassignOwnerValidator = [
  body('new_owner_id')
    .notEmpty().withMessage('L\'identifiant du nouveau propriétaire est requis')
    .isInt({ min: 1 }).withMessage('L\'identifiant du nouveau propriétaire doit être un entier positif'),

  body('notes')
    .optional({ nullable: true })
    .isString().withMessage('Les notes doivent être une chaîne de caractères')
    .trim(),

  handleValidationErrors
];

const assignTenantValidator = [
  body('clientId')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 1 }).withMessage('L\'identifiant du locataire doit être un entier positif'),

  body('rent')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Le montant du loyer doit être positif ou nul'),

  body('deposit')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Le dépôt de garantie doit être positif ou nul'),

  body('startDate')
    .optional({ nullable: true, checkFalsy: true })
    .isDate({ format: 'YYYY-MM-DD' }).withMessage('Format de date de début invalide (YYYY-MM-DD)'),

  body('notes')
    .optional({ nullable: true })
    .isString().withMessage('Les notes doivent être une chaîne de caractères')
    .trim(),

  body('newTenant.lastName')
    .optional({ checkFalsy: true })
    .isString().withMessage('Le nom du nouveau locataire doit être une chaîne')
    .trim(),

  body('newTenant.phone')
    .optional({ checkFalsy: true })
    .isString().withMessage('Le téléphone du nouveau locataire doit être valide')
    .trim(),

  handleValidationErrors
];

module.exports = {
  propertyValidator,
  updatePropertyValidator,
  assignOwnerValidator,
  reassignOwnerValidator,
  assignTenantValidator
};
