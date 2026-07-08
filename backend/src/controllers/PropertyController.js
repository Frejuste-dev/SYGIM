const BaseController = require('./BaseController');
const PropertyService = require('../services/PropertyService');

class PropertyController extends BaseController {
  constructor() {
    super(PropertyService);
  }

  async getAll(req, res, next) {
    try {
      const { status, type, ownerId, search, page, limit } = req.query;
      const data = await this.service.getProperties(
        { status, type, ownerId, search, page, limit }
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const data = await this.service.getStats();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const data = await this.service.getPropertyDetails(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PropertyController();
