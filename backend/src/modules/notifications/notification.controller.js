const notificationService = require('./notification.service');
const ApiResponse = require('../../utils/responses/ApiResponse');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const result = await notificationService.getNotifications(req.user, req.query);
      return res.json(ApiResponse.success(result.notifications, 'Notifications récupérées', 200, {
        unreadCount: result.unreadCount,
      }));
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const success = await notificationService.markAsRead(req.params.id, req.user.id);
      return res.json(ApiResponse.success({ success }, 'Notification marquée comme lue'));
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const count = await notificationService.markAllAsRead(req.user.id);
      return res.json(ApiResponse.success({ count }, `${count} notification(s) marquée(s) comme lue(s)`));
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
