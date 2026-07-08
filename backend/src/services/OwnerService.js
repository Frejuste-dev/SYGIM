const BaseService = require('./BaseService');
const OwnerRepository = require('../repositories/OwnerRepository');

class OwnerService extends BaseService {
  constructor() {
    super(OwnerRepository);
  }

  async getOwners(filters) {
    return await this.repository.findAll(filters);
  }

  async getOwnerDetails(id) {
    const owner = await this.repository.findByIdWithProperties(id);
    if (!owner) {
      throw new Error('Propriétaire non trouvé');
    }
    return owner;
  }
}

module.exports = new OwnerService();
