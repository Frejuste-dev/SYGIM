const { body, validationResult } = require('express-validator');

const normalizeOwnerBody = (req, res, next) => {
  if (req.body) {
    if (req.body.firstName && !req.body.first_name) req.body.first_name = req.body.firstName;
    if (req.body.lastName && !req.body.last_name) req.body.last_name = req.body.lastName;
    if (req.body.preferredPaymentMethod && !req.body.preferred_payment_method) req.body.preferred_payment_method = req.body.preferredPaymentMethod;
    if (req.body.payoutSchedule && !req.body.payout_schedule) req.body.payout_schedule = req.body.payoutSchedule;
    if (req.body.preferredPayoutDay && !req.body.preferred_payout_day) req.body.preferred_payout_day = req.body.preferredPayoutDay;
    if (req.body.bankName && !req.body.bank_name) req.body.bank_name = req.body.bankName;
    if (req.body.accountNumber && !req.body.account_number) req.body.account_number = req.body.accountNumber;
    if (req.body.commissionRate !== undefined && req.body.commission_rate === undefined) req.body.commission_rate = req.body.commissionRate;
  }
  next();
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res.status(400).json({
      success: false,
      error: firstError.msg,
      message: firstError.msg
    });
  }
  next();
};

const ownerValidator = [
  normalizeOwnerBody,
  body('first_name')
    .optional({ checkFalsy: true })
    .isString().withMessage('Le prénom doit être une chaîne de caractères')
    .trim(),
  
  body('last_name')
    .notEmpty().withMessage('Le nom est requis')
    .isString().withMessage('Le nom doit être une chaîne de caractères')
    .trim(),
    
  body('phone')
    .optional({ checkFalsy: true })
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

  body('preferred_payment_method')
    .optional({ checkFalsy: true })
    .isString()
    .trim(),

  body('payout_schedule')
    .optional({ checkFalsy: true })
    .isString()
    .trim(),

  body('preferred_payout_day')
    .optional({ checkFalsy: true })
    .isString()
    .trim(),

  body('commission_rate')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 }).withMessage('Le taux de commission doit être entre 0 et 100'),

  body('property_ids')
    .optional()
    .isArray().withMessage('La liste des biens doit être un tableau'),

  body('active')
    .optional()
    .isBoolean().withMessage('Le champ actif doit être un booléen')
    .toBoolean(),

  handleValidationErrors
];

const updateOwnerValidator = [
  normalizeOwnerBody,
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

  body('preferred_payment_method')
    .optional({ checkFalsy: true })
    .isString()
    .trim(),

  body('payout_schedule')
    .optional({ checkFalsy: true })
    .isString()
    .trim(),

  body('preferred_payout_day')
    .optional({ checkFalsy: true })
    .isString()
    .trim(),

  body('commission_rate')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 }).withMessage('Le taux de commission doit être entre 0 et 100'),

  body('property_ids')
    .optional()
    .isArray().withMessage('La liste des biens doit être un tableau'),

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
