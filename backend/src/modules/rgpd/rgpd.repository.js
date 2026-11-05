const BaseRepository = require('../../core/BaseRepository');
const { pool } = require('../../../config/db');

class RgpdRepository extends BaseRepository {
  constructor() {
    // Il n'y a pas de table 'rgpd', mais on peut passer null ou un nom factice
    super('users'); 
  }

  async exportUserData(userId) {
    const [userRows] = await pool.query(
      `SELECT id, username, role, first_name, last_name, display_name,
              email, phone, avatar, active, last_login, created_at
       FROM users WHERE id = ?`,
      [userId]
    );
    if (userRows.length === 0) {
      return null;
    }
    const user = userRows[0];

    const [clients] = await pool.query(
      `SELECT id, first_name, last_name, phone, email, address, property_name,
              amount_due, amount_paid, status, join_date
       FROM clients WHERE id IN (
         SELECT DISTINCT client_id FROM transactions WHERE collector_id IN (
           SELECT id FROM collectors WHERE user_id = ?))`,
      [userId]
    );

    const [transactions] = await pool.query(
      `SELECT reference, date, amount, method, status, client_name, description, created_at
       FROM transactions
       WHERE collector_id IN (SELECT id FROM collectors WHERE user_id = ?)
       ORDER BY created_at DESC`,
      [userId]
    );

    const [activityLogs] = await pool.query(
      `SELECT type, message, date, time
       FROM activity_logs WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return {
      user,
      clients,
      transactions,
      activityLogs
    };
  }

  async deleteUserData(userId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [collectorRows] = await conn.query(
        'SELECT id FROM collectors WHERE user_id = ?',
        [userId]
      );

      if (collectorRows.length > 0) {
        const collectorId = collectorRows[0].id;

        await conn.query(
          'UPDATE clients SET collector_id = NULL WHERE collector_id = ?',
          [collectorId]
        );
        await conn.query(
          'UPDATE transactions SET collector_id = NULL WHERE collector_id = ?',
          [collectorId]
        );
      }

      await conn.query('DELETE FROM activity_logs WHERE user_id = ?', [userId]);

      await conn.query(
        `UPDATE users SET
          username = CONCAT('deleted_', id),
          email = NULL,
          phone = NULL,
          first_name = '[Supprimé]',
          last_name = '[Supprimé]',
          display_name = '[Supprimé]',
          password_hash = '',
          active = 0,
          avatar = NULL
         WHERE id = ?`,
        [userId]
      );

      await conn.commit();
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async purgeOldLogs(days) {
    const [result] = await pool.query(
      'DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    return result.affectedRows;
  }
}

module.exports = new RgpdRepository();
