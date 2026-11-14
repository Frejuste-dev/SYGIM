const { pool } = require('../../config/database');

class NotificationRepository {
  async findByUserId(user, filters = {}) {
    const userId = typeof user === 'object' && user !== null ? user.id : user;
    const userRole = typeof user === 'object' && user !== null ? user.role : null;
    const isElevated = userRole === 'admin' || userRole === 'super_admin' || userRole === 'director';

    let sql = `
      SELECT id, user_id, type, category, title, message, reference_link, is_read, created_at
      FROM user_notifications
      WHERE ${isElevated ? '(user_id = ? OR 1=1)' : 'user_id = ?'}
    `;
    const params = [userId];

    if (filters.isRead !== undefined && filters.isRead !== 'all') {
      sql += ' AND is_read = ?';
      params.push(filters.isRead === 'true' || filters.isRead === true || filters.isRead === '1' ? 1 : 0);
    }

    if (filters.category && filters.category !== 'all') {
      sql += ' AND category = ?';
      params.push(filters.category);
    }

    sql += ' ORDER BY created_at DESC';

    const limit = Math.max(1, Math.min(100, parseInt(filters.limit || 50, 10)));
    sql += ' LIMIT ?';
    params.push(limit);

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async countUnread(user) {
    const userId = typeof user === 'object' && user !== null ? user.id : user;
    const userRole = typeof user === 'object' && user !== null ? user.role : null;
    const isElevated = userRole === 'admin' || userRole === 'super_admin' || userRole === 'director';

    const [rows] = await pool.query(
      `SELECT COUNT(*) as unreadCount FROM user_notifications WHERE ${isElevated ? '(user_id = ? OR 1=1)' : 'user_id = ?'} AND is_read = 0`,
      [userId]
    );
    return Number(rows[0]?.unreadCount || 0);
  }

  async markAsRead(id, userId) {
    const [result] = await pool.query(
      'UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows > 0;
  }

  async markAllAsRead(userId) {
    const [result] = await pool.query(
      'UPDATE user_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [userId]
    );
    return result.affectedRows;
  }
}

module.exports = new NotificationRepository();
