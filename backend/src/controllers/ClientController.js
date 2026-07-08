const BaseController = require('./BaseController');
const ClientService = require('../services/ClientService');

class ClientController extends BaseController {
  constructor() {
    super(ClientService);
  }

  async getAll(req, res, next) {
    try {
      const { status, collectorId, search, page, limit } = req.query;
      const data = await this.service.getClients(
        { status, collectorId, search, page, limit },
        req.user
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async replaceTenant(req, res, next) {
    try {
      const data = await this.service.replaceTenant(req.params.id, req.body);
      res.json({
        success: true,
        message: 'Remplacement effectué avec succès',
        data
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClientController();
