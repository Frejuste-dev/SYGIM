/**
 * Base Controller - Gestion des requêtes HTTP
 * Format cohérent, gestion d'erreurs, logging
 */

const ApiResponse = require('../utils/responses/ApiResponse');
const AppError = require('../utils/errors/AppError');
const Logger = require('../utils/logger/Logger');

class BaseController {
  constructor(service) {
    this.service = service;
  }

  async list(req, res, next) {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;

      const result = await this.service.getAll(
        filters,
        parseInt(page),
        parseInt(limit)
      );

      res.status(200).json(
        ApiResponse.paginated(
          result.data,
          result.pagination.page,
          result.pagination.limit,
          result.pagination.total
        )
      );
    } catch (error) {
      next(error);
    }
  }

  async getOne(req, res, next) {
    try {
      const { id } = req.params;
      const data = await this.service.getById(id, req.user);

      res.status(200).json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const data = await this.service.create(req.body, req.user);

      res.status(201).json(ApiResponse.created(data));
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = await this.service.update(id, req.body, req.user);

      res.status(200).json(ApiResponse.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await this.service.delete(id, req.user);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    return this.list(req, res, next);
  }

  async getById(req, res, next) {
    return this.getOne(req, res, next);
  }

  // Wrapper pour capturer les erreurs async
  catch(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

module.exports = BaseController;
