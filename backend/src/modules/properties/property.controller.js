const BaseController = require('../../core/BaseController');
const PropertyService = require('./property.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class PropertyController extends BaseController {
  constructor() {
    super(PropertyService);
  }

  async getAll(req, res, next) {
    try {
      const { status, type, ownerId, search, page, limit } = req.query;
      const result = await this.service.getProperties(
        { status, type, ownerId, search, page, limit }
      );
      const { data, pagination } = result;
      res.json(ApiResponse.paginated(data, pagination.page, pagination.limit, pagination.total));
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const { status, type, ownerId, search } = req.query;
      const data = await this.service.getStats({ status, type, ownerId, search });
      res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await this.service.getPropertyDetails(req.params.id);
      res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async assignTenant(req, res, next) {
    try {
      const data = await this.service.assignTenant(req.params.id, req.body, req.user);
      res.json(ApiResponse.success(data, 'Bien attribué avec succès au locataire'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PropertyController();
