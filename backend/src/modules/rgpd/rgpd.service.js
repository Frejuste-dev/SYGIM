const RgpdRepository = require('./rgpd.repository');
const Logger = require('../../utils/logger/Logger');

const LOG_RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS || '90');

class RgpdService {
  async exportUserData(userId) {
    const data = await RgpdRepository.exportUserData(userId);
    if (!data) return null;
    
    return {
      exportedAt: new Date().toISOString(),
      ...data
    };
  }

  async deleteUserData(userId) {
    try {
      await RgpdRepository.deleteUserData(userId);
      Logger.warn(`RGPD: User data deleted for user_id ${userId}`);
      return { success: true, message: 'Données personnelles supprimées' };
    } catch (error) {
      Logger.error('RGPD delete error', error);
      throw error;
    }
  }

  async purgeOldLogs(days = LOG_RETENTION_DAYS) {
    const deletedCount = await RgpdRepository.purgeOldLogs(days);
    Logger.info(`RGPD: Purged ${deletedCount} old activity logs (> ${days} days)`);
    return { deletedCount };
  }
}

module.exports = new RgpdService();
