const RgpdService = require('./rgpd.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class RgpdController {
  async exportData(req, res, next) {
    try {
      const data = await RgpdService.exportUserData(req.user.id);
      if (!data) {
        return res.status(404).json(ApiResponse.error('Utilisateur non trouvé', 404));
      }
      res.json(ApiResponse.success(data, 'Export des données personnelles'));
    } catch (error) {
      next(error);
    }
  }

  async deleteData(req, res, next) {
    try {
      const result = await RgpdService.deleteUserData(req.user.id);
      res.json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }

  async purgeLogs(req, res, next) {
    try {
      const result = await RgpdService.purgeOldLogs();
      res.json(ApiResponse.success(result));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RgpdController();
