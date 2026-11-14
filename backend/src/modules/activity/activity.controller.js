const activityService = require('./activity.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class ActivityController {
  async getManagerLogs(req, res, next) {
    try {
      const result = await activityService.getManagerLogs(req.query);
      return ApiResponse.success(res, result.data, 'Historique des activités récupéré', 200, result.pagination);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ActivityController();
