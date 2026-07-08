/**
 * module: Auth Repository
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const { pool } = require('../../../config/db');

class AuthRepository {
  /**
   * Crée un nouveau refresh token en base
   */
  async createRefreshToken({ userId, token, expiresAt }) {
    const [result] = await pool.query(
      `INSERT INTO refresh_tokens (userId, token, expiresAt) 
       VALUES (?, ?, ?)`,
      [userId, token, expiresAt]
    );
    return result.insertId;
  }

  /**
   * Trouve un refresh token valide et retourne les infos user associées
   */
  async findRefreshToken(hashedToken) {
    const [rows] = await pool.query(
      `SELECT rt.*, u.role, u.active
       FROM refresh_tokens rt
       JOIN users u ON rt.userId = u.id
       WHERE rt.token = ? AND rt.revokedAt IS NULL`,
      [hashedToken]
    );
    return rows[0];
  }

  /**
   * Révoque un token spécifique
   */
  async revokeRefreshToken(hashedToken) {
    await pool.query(
      `UPDATE refresh_tokens 
       SET revokedAt = NOW() 
       WHERE token = ?`,
      [hashedToken]
    );
  }

  /**
   * Révoque tous les tokens d'un utilisateur
   */
  async revokeAllUserTokens(userId) {
    await pool.query(
      `UPDATE refresh_tokens 
       SET revokedAt = NOW() 
       WHERE userId = ?`,
      [userId]
    );
  }

  /**
   * Trouve un utilisateur par son username via l'index optimisé
   */
  async findByUsername(username) {
    const [rows] = await pool.query(
      `SELECT id as primaryKey, username, password_hash as password, role, active as isActive, deletedAt
       FROM users 
       WHERE username_normalized = ?`,
      [username.toLowerCase()]
    );
    return rows[0];
  }
}

module.exports = new AuthRepository();
