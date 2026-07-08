/**
 * Base Service - Logique métier centralisée
 * Les controllers appellent les services, jamais la base directement
 */

const Logger = require('../utils/logger/Logger');

class BaseService {
  constructor(repository) {
    this.repository = repository;
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

  async getById(id) {
    Logger.debug(`Getting item with ID: ${id}`);
    return this.repository.findById(id);
  }

  async create(data) {
    Logger.info('Creating new item', { data });
    const result = await this.repository.create(data);
    Logger.info('Item created successfully', { id: result.id });
    return result;
  }

  async update(id, data) {
    Logger.info(`Updating item ${id}`, { data });
    const result = await this.repository.update(id, data);
    Logger.info(`Item ${id} updated successfully`);
    return result;
  }

  async delete(id) {
    Logger.info(`Deleting item ${id}`);
    const result = await this.repository.delete(id);
    Logger.info(`Item ${id} deleted successfully`);
    return result;
  }
}

module.exports = BaseService;
