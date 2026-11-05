const AlertService = require('./alert.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class AlertController {
  async getOverduePayments(req, res, next) {
    try {
      const { daysThreshold = 15, collectorId, severity = 'all' } = req.query;
      const result = await AlertService.getOverduePayments(
        { collectorId, severity, daysThreshold },
        req.user
      );
      res.json({
        success: true,
        data: result.alerts,
        stats: result.stats,
        daysThreshold: parseInt(daysThreshold)
      });
    } catch (error) {
      next(error);
    }
  }

  async getDashboard(req, res, next) {
    try {
      const data = await AlertService.getDashboard();
      res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req, res, next) {
    try {
      const data = await AlertService.getSummary();
      res.json(ApiResponse.success(data));
    } catch (error) {
      next(error);
    }
  }

  async acknowledge(req, res, next) {
    try {
      const { clientId } = req.params;
      await AlertService.acknowledge(clientId, req.user);
      res.json(ApiResponse.success(null, 'Alerte marquée comme reconnue'));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AlertController();
