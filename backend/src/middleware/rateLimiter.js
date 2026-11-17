/**
 * Middleware de limitation du débit (Rate Limiting)
 * Protège l'API contre les attaques par force brute et les abus
 */

const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/responses/ApiResponse');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Limiteur général pour toute l'API.
 * En développement : 10000 req/15min
 * En production : 1000 req/15min
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
 * En dev : 500 tentatives (évite le blocage des suites E2E et reloads React)
 * En production : 15 tentatives par fenêtre de 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 15,
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

/**
 * Limiteur pour les exports lourds (PDF / Excel / CSV)
 * Évite le déni de service (DoS) par saturation CPU / mémoire
 * En dev : 200 exports / 15 min
 * En prod : 30 exports / 15 min
 */
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(
      ApiResponse.error(
        'Trop de demandes d\'exportation de rapports. Veuillez patienter avant de relancer un export.',
        429,
        'TOO_MANY_EXPORT_REQUESTS'
      )
    );
  }
});

module.exports = { apiLimiter, authLimiter, exportLimiter };
