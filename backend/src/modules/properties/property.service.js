const BaseService = require('../../core/BaseService');
const PropertyRepository = require('./property.repository');

class PropertyService extends BaseService {
  constructor() {
    super(PropertyRepository);
  }

  async getProperties(filters) {
    const page  = parseInt(filters.page  || 1,  10);
    const limit = parseInt(filters.limit || 20,  10);
    const safeFilters = { ...filters, page, limit };

    const [data, total] = await Promise.all([
      this.repository.findAllWithDetails(safeFilters),
      this.repository.countAllWithDetails(safeFilters),
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

  async update(id, data, user) {
    if (data.status === 'loue' && !data.tenant_id) {
      const AppError = require('../../utils/errors/AppError');
      throw AppError.badRequest('Une propriété louée doit avoir un locataire assigné.');
    }
    return super.update(id, data, user);
  }

  async getStats(filters = {}) {
    return await this.repository.getFilteredStats(filters);
  }

  async getPropertyDetails(id) {
    const property = await this.repository.findByIdWithDetails(id);
    if (!property) {
      throw new Error('Propriété non trouvée');
    }
    return property;
  }
  async checkOwnership(id, user) {
    if (!user || !user.role) {
      return;
    }
    if (['admin', 'director', 'accounting'].includes(user.role)) {
      return;
    }

    const property = await this.repository.findById(id);
    if (!property) {
      return;
    } // NotFound géré ailleurs

    const AppError = require('../../utils/errors/AppError');

    // Vérification Propriétaire
    if (user.role === 'owner') {
      const OwnerRepository = require('../owners/owner.repository');
      const owner = await OwnerRepository.findByUserId(user.id);
      if (!owner || property.owner_id !== owner.id) {
        throw AppError.forbidden('Accès refusé. Cette propriété ne vous appartient pas.');
      }
    }

    // Vérification Collecteur
    if (user.role === 'collector' || user.role === 'collector_manager') {
      if (!property.collector_id) {
        if (user.role === 'collector') {
          throw AppError.forbidden('Accès refusé. Cette propriété n\'a pas de collecteur assigné.');
        }
        return; // manager a le droit de voir s'il n'y a pas de collecteur
      }

      const CollectorRepository = require('../collectors/collector.repository');

      if (user.role === 'collector') {
        const collector = await CollectorRepository.findByUserId(user.id);
        if (!collector || property.collector_id !== collector.id) {
          throw AppError.forbidden('Accès refusé. Cette propriété ne vous est pas assignée.');
        }
      } else if (user.role === 'collector_manager') {
        // manager_id checks can be done if we fetch the assigned collector
        const assignedCollector = await CollectorRepository.findById(property.collector_id);
        if (!assignedCollector || (assignedCollector.manager_id !== user.id && assignedCollector.user_id !== user.id)) {
          throw AppError.forbidden('Accès refusé. Cette propriété est gérée par un autre groupe.');
        }
      }
    }
  }
}

module.exports = new PropertyService();
