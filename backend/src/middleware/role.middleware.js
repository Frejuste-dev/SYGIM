/**
 * Module   : Auth
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Middleware de vérification des rôles
 */

const AppError = require('../utils/errors/AppError');

/**
 * Vérifie si l'utilisateur possède l'un des rôles autorisés
 * @param {string[]} allowedRoles - Tableau des rôles autorisés
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // req.user est injecté par le middleware authenticate
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(new AppError('Accès refusé — rôle insuffisant', 403));
    }
    next();
  };
};

module.exports = { checkRole };
