/**
 * module: Auth Service
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authRepository = require('./auth.repository');
const AppError = require('../../utils/errors/AppError');

class AuthService {
  /**
   * Login utilisateur
   */
  async login(username, password) {
    const user = await authRepository.findByUsername(username);

    if (!user) {
      throw new AppError('Identifiants invalides.', 401);
    }

    if (!user.isActive) {
      throw new AppError('Compte inactif. Contactez l\'administrateur.', 403);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Identifiants invalides.', 401);
    }

    const accessToken = this._generateAccessToken(user);
    const refreshToken = this._generateRefreshToken();
    
    // Hasher le refreshToken avant stockage
    const hashedToken = this._hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours

    await authRepository.createRefreshToken({
      userId: user.primaryKey,
      token: hashedToken,
      expiresAt
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.primaryKey,
        username: user.username,
        role: user.role
      }
    };
  }

  /**
   * Rafraîchir l'accessToken via un refreshToken
   */
  async refreshAccessToken(rawRefreshToken) {
    if (!rawRefreshToken) {
      throw new AppError('Refresh token requis.', 401);
    }

    const hashedToken = this._hashToken(rawRefreshToken);
    const tokenRecord = await authRepository.findRefreshToken(hashedToken);

    if (!tokenRecord) {
      throw new AppError('Token invalide ou révoqué.', 401);
    }

    if (new Date(tokenRecord.expiresAt) < new Date()) {
      throw new AppError('Token expiré.', 401);
    }

    if (!tokenRecord.active) {
      throw new AppError('Utilisateur inactif.', 403);
    }

    const accessToken = this._generateAccessToken({
      primaryKey: tokenRecord.userId,
      username: tokenRecord.username, // On pourrait avoir besoin de fetcher le user complet si on veut plus d'infos
      role: tokenRecord.role
    });

    return { accessToken };
  }

  /**
   * Logout (révocation du token)
   */
  async logout(rawRefreshToken) {
    if (rawRefreshToken) {
      const hashedToken = this._hashToken(rawRefreshToken);
      await authRepository.revokeRefreshToken(hashedToken);
    }
  }

  // ─── Méthodes privées ───────────────────────────────────────

  _generateAccessToken(user) {
    return jwt.sign(
      { id: user.primaryKey, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
  }

  _generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

module.exports = new AuthService();
