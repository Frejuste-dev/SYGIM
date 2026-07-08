/**
 * module: User Repository
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const BaseRepository = require('../../repositories/BaseRepository');
const { pool: db } = require('../../../config/db');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  /**
   * Surcharge de findAll pour exclure les utilisateurs supprimés
   */
  async findAll(filters = {}, limit = 100, offset = 0) {
    const activeFilters = { ...filters, deletedAt: null };
    return super.findAll(activeFilters, limit, offset);
  }

  /**
   * Surcharge de findById pour vérifier que l'utilisateur n'est pas supprimé
   */
  async findById(id) {
    const user = await super.findById(id);
    if (user && user.deletedAt) {
      const AppError = require('../../utils/errors/AppError');
      throw AppError.notFound('Utilisateur');
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
