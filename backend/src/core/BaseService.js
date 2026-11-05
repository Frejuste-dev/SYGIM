/**
 * Base Service - Logique métier centralisée
 * Les controllers appellent les services, jamais la base directement
 */

const Logger = require('../utils/logger/Logger');

class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  async checkOwnership(id, user) {
    // Cette méthode est censée être surchargée par les services enfants (ex: PropertyService, ClientService)
    // Si la ressource nécessite un contrôle IDOR, l'enfant doit lancer une exception AppError.forbidden()
    // si l'utilisateur n'a pas accès à l'ID demandé.

    // Par défaut, nous laissons passer (les rôles globaux ont déjà été filtrés par le middleware).
    // Les services enfants doivent implémenter leurs propres règles métier strictes.
    return;
  }

  async getAll(filters = {}, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      const [data, total] = await Promise.all([
        this.repository.findAll(filters, limit, offset),
        this.repository.count(filters)
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      Logger.error('Error in getAll', error);
      throw error;
    }
  }

  async getById(id, user) {
    await this.checkOwnership(id, user);
    Logger.debug(`Getting item with ID: ${id}`);
    return this.repository.findById(id);
  }

  async create(data, user) {
    Logger.info('Creating new item', { data });
    const result = await this.repository.create(data);
    Logger.info('Item created successfully', { id: result.id });
    return result;
  }

  async update(id, data, user) {
    await this.checkOwnership(id, user);
    Logger.info(`Updating item ${id}`, { data });
    const result = await this.repository.update(id, data);
    Logger.info(`Item ${id} updated successfully`);
    return result;
  }

  async delete(id, user) {
    await this.checkOwnership(id, user);
    Logger.info(`Deleting item ${id}`);
    const result = await this.repository.delete(id);
    Logger.info(`Item ${id} deleted successfully`);
    return result;
  }
}

module.exports = BaseService;
