/**
 * module: Auth Middleware
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const jwt = require('jsonwebtoken');
const AppError = require('../utils/errors/AppError');

/**
 * Middleware d'authentification JWT pour la V2
 */
const authenticate = (req, res, next) => {
  let token = null;

  // 1. Priorité au cookie (sécurité maximale)
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      // Rejet immédiat si le cookie est présent mais invalide/expiré (PAS DE FALLBACK)
      return next(new AppError('Token invalide ou expiré.', 401));
    }
  }

  // 2. Fallback sur le header Authorization (compatibilité legacy)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (error) {
      return next(new AppError('Token invalide ou expiré.', 401));
    }
  }

  // 3. Aucun token trouvé
  return next(new AppError('Authentification requise. Token manquant.', 401));
};

/**
 * Middleware d'autorisation par rôle
 */
const normalizeRole = (r) => (r === 'collector_manager' ? 'manager' : r);

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentification requise.', 401));
    }
    const userRole = req.user.role;
    const normalizedUserRole = normalizeRole(userRole);
    const hasRole = roles.some((r) => r === userRole || normalizeRole(r) === normalizedUserRole);
    if (!hasRole) {
      return next(new AppError('Accès interdit. Rôle insuffisant.', 403));
    }
    next();
  };
};

/**
 * Générer un token JWT
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name || user.displayName || ''
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

module.exports = { authenticate, authorize, generateToken };
