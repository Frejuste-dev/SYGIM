const notificationService = require('./notification.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const result = await notificationService.getNotifications(req.user.id, req.query);
      return ApiResponse.success(res, result.notifications, 'Notifications récupérées', 200, {
        unreadCount: result.unreadCount,
      });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const success = await notificationService.markAsRead(req.params.id, req.user.id);
      return ApiResponse.success(res, { success }, 'Notification marquée comme lue');
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const count = await notificationService.markAllAsRead(req.user.id);
      return ApiResponse.success(res, { count }, `${count} notification(s) marquée(s) comme lue(s)`);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
