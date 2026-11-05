const BaseController = require('../../core/BaseController');
const OwnerService = require('./owner.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class OwnerController extends BaseController {
  constructor() {
    super(OwnerService);
  }

  async getAll(req, res, next) {
    try {
      const { search, page, limit } = req.query;
      const result = await this.service.getOwners({ search, page, limit }, req.user);
      const { data, pagination } = result;
      res.json(ApiResponse.paginated(data, pagination.page, pagination.limit, pagination.total));
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const { search } = req.query;
      const data = await this.service.getStats({ search }, req.user);
      res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await this.service.getOwnerDetails(req.params.id, req.user);
      res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OwnerController();
