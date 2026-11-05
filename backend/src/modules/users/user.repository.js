/**
 * module: User Repository
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const BaseRepository = require('../../core/BaseRepository');
const { pool: db } = require('../../../config/db');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Surcharge de findAll pour exclure les utilisateurs supprimés et le mot de passe
   */
  async findAll(filters = {}, limit = 100, offset = 0) {
    const activeFilters = { ...filters, deletedAt: null };
    const users = await super.findAll(activeFilters, limit, offset);
    return users.map(u => {
      const { password_hash, ...safeUser } = u;
      return safeUser;
    });
  }

  /**
   * Surcharge de findById pour vérifier que l'utilisateur n'est pas supprimé et retirer le mot de passe
   */
  async findById(id) {
    const user = await super.findById(id);
    if (user && user.deletedAt) {
      const AppError = require('../../utils/errors/AppError');
      throw AppError.notFound('Utilisateur');
    }
    if (user) {
      const { password_hash, ...safeUser } = user;
      return safeUser;
    }
    return user;
  }

  /**
   * Suppression logique (Soft Delete)
   */
  async softDelete(userId) {
    return this.update(userId, { deletedAt: new Date() });
  }
}

module.exports = new UserRepository();
