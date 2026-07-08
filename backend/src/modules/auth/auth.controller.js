/**
 * module: Auth Controller
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const authService = require('./auth.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class AuthController {
  /**
   * Connexion utilisateur
   */
  async login(req, res, next) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      
      return res.status(200).json(ApiResponse.success(result, 'Connexion réussie'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rafraîchissement du token
   */
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshAccessToken(refreshToken);
      
      return res.status(200).json(ApiResponse.success(result, 'Token rafraîchi'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Déconnexion
   */
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      
      return res.status(200).json(ApiResponse.success(null, 'Déconnexion réussie'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
