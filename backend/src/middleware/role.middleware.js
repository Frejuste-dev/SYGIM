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
const normalizeRole = (r) => (r === 'collector_manager' ? 'manager' : r);

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // req.user est injecté par le middleware authenticate
    if (!req.user) {
      return next(new AppError('Accès refusé — non authentifié', 401));
    }
    const userRole = req.user.role;
    const normalizedUserRole = normalizeRole(userRole);
    const hasRole = allowedRoles.some((r) => r === userRole || normalizeRole(r) === normalizedUserRole);
    if (!hasRole) {
      return next(new AppError('Accès refusé — rôle insuffisant', 403));
    }
    next();
  };
};

module.exports = { checkRole };
