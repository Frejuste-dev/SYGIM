/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Utilitaires de Validation                     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

/**
 * Valider un email
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Valider un numéro de téléphone
 * Format: +XXX XXXXXXXXX ou variations
 * @param {string} phone
 * @returns {boolean}
 */
function validatePhone(phone) {
  // Accepte: +223 XX XX XX XX, 223XXXXXXXX, +223XXXXXXXX, etc.
  const regex = /^\+?[0-9]{1,3}[\s-]?[0-9]{6,14}$/;
  return regex.test(phone.replace(/[\s-]/g, ''));
}

/**
 * Valider un montant monétaire
 * @param {number} amount
 * @returns {boolean}
 */
function validateAmount(amount) {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 999999999.99;
}

/**
 * Valider une décimale (max 2 décimales)
 * @param {number} value
 * @returns {boolean}
 */
function validateDecimal(value, maxDecimals = 2) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return false;
  }
  const decimalPart = value.toString().split('.')[1];
  if (!decimalPart) {
    return true;
  } // Entier c'est ok
  return decimalPart.length <= maxDecimals;
}

/**
 * Valider un username
 * Lettres minuscules, chiffres, points, tirets
 * @param {string} username
 * @returns {boolean}
 */
function validateUsername(username) {
  const regex = /^[a-z0-9._@-]+$/;
  return regex.test(username) && username.length >= 3 && username.length <= 100;
}

/**
 * Valider un mot de passe
 * Min 6 caractères (peut être renforcé)
 * @param {string} password
 * @returns {boolean}
 */
function validatePassword(password) {
  return password && password.length >= 6 && password.length <= 255;
}

/**
 * Nettoyer et valider un objet
 * @param {object} data
 * @param {object} schema - {fieldName: {type, required, validate}}
 * @returns {object} {valid: boolean, errors: {}, cleaned: {}}
 */
function validateObject(data, schema) {
  const errors = {};
  const cleaned = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Vérifier si requis
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors[field] = `${field} est requis`;
      continue;
    }

    // Sauter si optionnel et vide
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Vérifier le type
    if (rules.type && typeof value !== rules.type) {
      if (!(rules.type === 'number' && !isNaN(value))) {
        errors[field] = `${field} doit être un ${rules.type}`;
        continue;
      }
    }

    // Vérifier la fonction de validation custom
    if (rules.validate && !rules.validate(value)) {
      errors[field] = rules.errorMessage || `${field} est invalide`;
      continue;
    }

    // Nettoyer et ajouter
    if (rules.type === 'string') {
      cleaned[field] = String(value).trim();
    } else if (rules.type === 'number') {
      cleaned[field] = parseFloat(value);
    } else {
      cleaned[field] = value;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    cleaned
  };
}

module.exports = {
  validateEmail,
  validatePhone,
  validateAmount,
  validateDecimal,
  validateUsername,
  validatePassword,
  validateObject
};
