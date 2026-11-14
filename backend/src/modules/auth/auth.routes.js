/**
 * module: Auth Routes
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const express = require('express');
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authLimiter } = require('../../middleware/rateLimiter');
const { loginValidator, changePasswordValidator } = require('./auth.validator');

const router = express.Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authentification utilisateur & génération des tokens
 * @access  Public
 */
router.post('/login', authLimiter, loginValidator, authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Rafraîchissement de l'accessToken
 * @access  Public (nécessite refreshToken)
 */
router.post('/refresh', authLimiter, authController.refresh);

/**
 * @route   POST /api/auth/logout
 * @desc    Révocation du refreshToken
 * @access  Privé
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/change-password
 * @desc    Modification du mot de passe de l'utilisateur connecté
 * @access  Privé
 */
router.post('/change-password', authenticate, authLimiter, changePasswordValidator, authController.changePassword);

/**
 * @route   GET /api/auth/me
 * @desc    Récupération du profil de l'utilisateur connecté
 * @access  Privé
 */
router.get('/me', authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Mise à jour du profil (champs autorisés uniquement)
 * @access  Privé
 */
router.put('/profile', authenticate, authController.updateProfile);

module.exports = router;
