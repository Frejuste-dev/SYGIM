const BaseService = require('./BaseService');
const PropertyRepository = require('../repositories/PropertyRepository');

class PropertyService extends BaseService {
  constructor() {
    super(PropertyRepository);
  }

  async getProperties(filters) {
    return await this.repository.findAllWithDetails(filters);
  }

  async getStats() {
    return await this.repository.getStats();
  }

  async getPropertyDetails(id) {
    const property = await this.repository.findByIdWithDetails(id);
    if (!property) {
      throw new Error('Propriété non trouvée');
    }
    return property;
  }
}

module.exports = new PropertyService();
