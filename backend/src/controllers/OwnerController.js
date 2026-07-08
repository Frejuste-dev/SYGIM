const BaseController = require('./BaseController');
const OwnerService = require('../services/OwnerService');

class OwnerController extends BaseController {
  constructor() {
    super(OwnerService);
  }

  async getAll(req, res, next) {
    try {
      const { search } = req.query;
      const data = await this.service.getOwners({ search });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await this.service.getOwnerDetails(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OwnerController();
