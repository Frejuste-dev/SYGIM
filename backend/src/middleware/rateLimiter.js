/**
 * Middleware de limitation du débit (Rate Limiting)
 * Protège l'API contre les attaques par force brute et les abus
 */

const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/responses/ApiResponse');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Limiteur général pour toute l'API.
 * En développement : 500 req/15min (React StrictMode double les appels)
 * En production : 200 req/15min
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Ne jamais bloquer la validation de session (appelée à chaque navigation)
    return req.path === '/auth/me';
  },
  handler: (req, res) => {
    res.status(429).json(
      ApiResponse.error(
        'Trop de requêtes, veuillez réessayer plus tard.',
        429,
        'TOO_MANY_REQUESTS'
      )
    );
  }
});

/**
 * Limiteur strict pour les routes sensibles (Login)
 * 10 tentatives maximum par fenêtre de 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res) => {
    res.status(429).json(
      ApiResponse.error(
        'Trop de tentatives de connexion, veuillez réessayer plus tard.',
        429,
        'TOO_MANY_LOGIN_ATTEMPTS'
      )
    );
  }
});

module.exports = { apiLimiter, authLimiter };
