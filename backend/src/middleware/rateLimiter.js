/**
 * Middleware de limitation du débit (Rate Limiting)
 * Protège l'API contre les attaques par force brute et les abus
 */

const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/responses/ApiResponse');

/**
 * Limiteur général pour toute l'API
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  standardHeaders: true, // Retourne les infos de limite dans les headers `RateLimit-*`
  legacyHeaders: false, // Désactive les headers `X-RateLimit-*`
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
 * Limiteur strict pour les routes sensibles (Login, Register)
 */
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 tentatives par heure
  handler: (req, res) => {
    res.status(429).json(
      ApiResponse.error(
        'Trop de tentatives de connexion, veuillez réessayer dans une heure.',
        429,
        'TOO_MANY_LOGIN_ATTEMPTS'
      )
    );
  }
});

module.exports = { apiLimiter, authLimiter };
