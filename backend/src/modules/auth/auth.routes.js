/**
 * module: Auth Routes
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const express = require('express');
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authentification utilisateur & génération des tokens
 * @access  Public
 */
router.post('/login', authLimiter, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Rafraîchissement de l'accessToken
 * @access  Public (nécessite refreshToken)
 */
router.post('/refresh', authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Révocation du refreshToken
 * @access  Privé
 */
router.post('/logout', authenticate, authController.logout);

module.exports = router;
