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
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentification requise. Token manquant.', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new AppError('Token invalide ou expiré.', 401));
  }
};

/**
 * Middleware d'autorisation par rôle
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
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
