const BaseService = require('../../core/BaseService');
const OwnerRepository = require('./owner.repository');

class OwnerService extends BaseService {
  constructor() {
    super(OwnerRepository);
  }

  async getOwners(filters, user) {
    const page  = parseInt(filters.page  || 1,  10);
    const limit = parseInt(filters.limit || 20,  10);
    const safeFilters = { ...filters, page, limit };

    const [data, total] = await Promise.all([
      this.repository.findAll(safeFilters, user),
      this.repository.count(safeFilters, user),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext:     page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async getStats(filters = {}, user = null) {
    return await this.repository.getFilteredStats(filters, user);
  }

  async checkOwnership(id, user) {
    const isAccessible = await this.repository.isAccessibleByUser(id, user);
    if (!isAccessible) {
      const AppError = require('../../utils/errors/AppError');
      throw AppError.forbidden('Accès refusé. Vous n\'avez pas la permission de consulter ou modifier ce propriétaire.');
    }
  }

  async getOwnerDetails(id, user) {
    await this.checkOwnership(id, user);
    const owner = await this.repository.findByIdWithProperties(id);
    if (!owner) {
      const AppError = require('../../utils/errors/AppError');
      throw AppError.notFound('Propriétaire non trouvé');
    }
    return owner;
  }

  async update(id, data, user) {
    await this.checkOwnership(id, user);
    return await super.update(id, data, user);
  }

  async delete(id, user) {
    await this.checkOwnership(id, user);
    return await super.delete(id, user);
  }
}

module.exports = new OwnerService();
