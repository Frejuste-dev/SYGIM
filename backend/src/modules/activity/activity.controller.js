const activityService = require('./activity.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class ActivityController {
  async getManagerLogs(req, res, next) {
    try {
      const result = await activityService.getManagerLogs(req.query);
      return res.json(ApiResponse.paginated(
        result.data,
        result.pagination.page,
        result.pagination.limit,
        result.pagination.total,
        'Historique des activités récupéré'
      ));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ActivityController();
