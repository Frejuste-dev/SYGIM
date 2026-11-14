const notificationRepository = require('./notification.repository');

class NotificationService {
  async getNotifications(userId, filters = {}) {
    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.findByUserId(userId, filters),
      notificationRepository.countUnread(userId),
    ]);
    return {
      notifications,
      unreadCount,
    };
  }

  async markAsRead(id, userId) {
    return await notificationRepository.markAsRead(id, userId);
  }

  async markAllAsRead(userId) {
    return await notificationRepository.markAllAsRead(userId);
  }
}

module.exports = new NotificationService();
