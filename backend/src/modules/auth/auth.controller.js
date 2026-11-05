/**
 * module: Auth Controller
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const authService = require('./auth.service');
const ApiResponse = require('../../utils/responses/ApiResponse');
const { accessTokenOptions, refreshTokenOptions } = require('../../config/cookie');

class AuthController {
  /**
   * Connexion utilisateur
   */
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);

      res.cookie('accessToken', result.accessToken, accessTokenOptions);
      res.cookie('refreshToken', result.refreshToken, refreshTokenOptions);

      return res.status(200).json(ApiResponse.success({ user: result.user }, 'Connexion réussie'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rafraîchissement du token
   */
  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      
      if (!refreshToken) {
        return res.status(401).json(ApiResponse.error('Refresh token manquant.', 401));
      }

      const result = await authService.refreshAccessToken(refreshToken);

      res.cookie('accessToken', result.accessToken, accessTokenOptions);
      res.cookie('refreshToken', result.refreshToken, refreshTokenOptions);

      return res.status(200).json(ApiResponse.success({ success: true }, 'Token rafraîchi'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Changement de mot de passe
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

      return res.status(200).json(ApiResponse.success(result, 'Mot de passe modifié avec succès. Toutes les sessions ont été déconnectées.'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupération du profil de l'utilisateur connecté
   */
  async getProfile(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user.id);
      return res.status(200).json(ApiResponse.success(profile));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mise à jour du profil
   */
  async updateProfile(req, res, next) {
    try {
      const profile = await authService.updateProfile(req.user.id, req.body);
      return res.status(200).json(ApiResponse.success(profile, 'Profil mis à jour avec succès.'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Déconnexion
   */
  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }

      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/api/auth/' });

      return res.status(200).json(ApiResponse.success(null, 'Déconnexion réussie'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
