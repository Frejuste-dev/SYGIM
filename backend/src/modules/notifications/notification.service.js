const notificationRepository = require('./notification.repository');

class NotificationService {
  async getNotifications(user, filters = {}) {
    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.findByUserId(user, filters),
      notificationRepository.countUnread(user),
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
