const BaseController = require('../../core/BaseController');
const ClientService = require('./client.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class ClientController extends BaseController {
  constructor() {
    super(ClientService);
  }

  async getAll(req, res, next) {
    try {
      const { status, collectorId, search, page, limit } = req.query;
      const result = await this.service.getClients(
        { status, collectorId, search, page, limit },
        req.user
      );
      const { data, pagination } = result;
      res.json(ApiResponse.paginated(data, pagination.page, pagination.limit, pagination.total));
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const { status, collectorId, search } = req.query;
      const data = await this.service.getStats(
        { status, collectorId, search },
        req.user
      );
      res.json(ApiResponse.success(data));
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
      res.status(200).json(ApiResponse.updated(data, 'Client modifié avec succès'));
    } catch (error) {
      next(error);
    }
  }

  async replaceTenant(req, res, next) {
    try {
      const data = await this.service.replaceTenant(req.params.id, req.body, req.user);
      res.json(ApiResponse.success(data, 'Remplacement effectué avec succès'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClientController();
