/**
 * Middleware de validation des requêtes
 * Centralise la validation avec des règles réutilisables
 */

const AppError = require('../utils/errors/AppError');

class Validator {
  static required(value, fieldName) {
    if (!value) {
      throw AppError.validation(`${fieldName} est requis`, fieldName);
    }
    return true;
  }

  static email(value, fieldName = 'Email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw AppError.validation(`${fieldName} invalide`, fieldName);
    }
    return true;
  }

  static minLength(value, min, fieldName) {
    if (value.length < min) {
      throw AppError.validation(
        `${fieldName} doit contenir au moins ${min} caractères`,
        fieldName
      );
    }
    return true;
  }

  static maxLength(value, max, fieldName) {
    if (value.length > max) {
      throw AppError.validation(
        `${fieldName} ne doit pas dépasser ${max} caractères`,
        fieldName
      );
    }
    return true;
  }

  static number(value, fieldName) {
    if (isNaN(value) || value === '') {
      throw AppError.validation(`${fieldName} doit être un nombre`, fieldName);
    }
    return true;
  }

  static range(value, min, max, fieldName) {
    if (value < min || value > max) {
      throw AppError.validation(
        `${fieldName} doit être entre ${min} et ${max}`,
        fieldName
      );
    }
    return true;
  }

  static enum(value, allowedValues, fieldName) {
    if (!allowedValues.includes(value)) {
      throw AppError.validation(
        `${fieldName} doit être l'un de: ${allowedValues.join(', ')}`,
        fieldName
      );
    }
    return true;
  }

  static validateBody(schema) {
    return (req, res, next) => {
      try {
        for (const [field, rules] of Object.entries(schema)) {
          const value = req.body[field];

          for (const rule of rules) {
            rule(value, field);
          }
        }
        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

module.exports = Validator;
