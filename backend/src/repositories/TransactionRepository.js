const BaseRepository = require('./BaseRepository');
const { pool } = require('../../config/db');

class TransactionRepository extends BaseRepository {
  constructor() {
    super('transactions');
  }

  async findAll(filters = {}, user = null) {
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (filters.status && filters.status !== 'all') {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.method && filters.method !== 'all') {
      sql += ' AND method = ?';
      params.push(filters.method);
    }
    if (filters.clientId) {
      sql += ' AND client_id = ?';
      params.push(filters.clientId);
    }
    if (filters.dateFrom) {
      sql += ' AND date >= ?';
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      sql += ' AND date <= ?';
      params.push(filters.dateTo);
    }
    if (filters.search) {
      sql += ' AND (client_name LIKE ? OR reference LIKE ? OR description LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    if (user && user.role === 'collector') {
      const [userRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [user.id]);
      if (userRow.length > 0) {
        sql += ' AND collector_id = ?';
        params.push(userRow[0].id);
      }
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    if (filters.limit) {
      const offset = (parseInt(filters.page || 1) - 1) * parseInt(filters.limit);
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(filters.limit), offset);
    }

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getStats(period) {
    let dateFilter = '';
    if (period === 'day') {
      dateFilter = 'AND date = CURDATE()';
    } else if (period === 'month') {
      dateFilter = 'AND MONTH(date) = MONTH(CURDATE()) AND YEAR(date) = YEAR(CURDATE())';
    } else if (period === 'year') {
      dateFilter = 'AND YEAR(date) = YEAR(CURDATE())';
    }

    const [totalCollected] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'processed' ${dateFilter}`
    );
    const [totalPending] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = 'pending' ${dateFilter}`
    );
    const [countByMethod] = await pool.query(
      `SELECT method, COUNT(*) as count, COALESCE(SUM(amount), 0) as total 
       FROM transactions WHERE status = 'processed' ${dateFilter}
       GROUP BY method`
    );
    const [recentTransactions] = await pool.query(
      `SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10`
    );

    return {
      totalCollected: totalCollected[0].total,
      totalPending:   totalPending[0].total,
      byMethod:       countByMethod,
      recent:         recentTransactions
    };
  }

  async createWithClientUpdate(data, user) {
    let connection;
    try {
      let resolvedCollectorId = data.collectorId || null;
      if (user.role === 'collector' && !resolvedCollectorId) {
        const [collectorRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [user.id]);
        if (collectorRow.length > 0) {
          resolvedCollectorId = collectorRow[0].id;
        }
      }

      const ref = data.reference || `REC-${Date.now()}`;
      const dateDisplay = new Date().toLocaleDateString('fr-FR');

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO transactions 
         (reference, date, date_display, client_id, client_name, description, amount,
          method, status, payment_type, due_date, notes, collector_id, signature_data)
         VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ref, dateDisplay,
          data.clientId,
          data.clientName || null,
          data.description || null,
          data.amount,
          data.method || 'cash',
          data.status || 'processed',
          data.paymentType || null,
          data.dueDate || null,
          data.notes || null,
          resolvedCollectorId,
          data.signatureData || null
        ]
      );

      if (data.clientId && (data.status === 'processed' || !data.status)) {
        await connection.query(
          `UPDATE clients SET amount_paid = amount_paid + ?, 
           payment_method = ?,
           status = CASE 
              WHEN amount_paid + ? >= amount_due THEN 'paid'
              WHEN amount_paid + ? > 0 THEN 'partial'
              ELSE status 
           END
           WHERE id = ?`,
          [data.amount, data.method || 'cash', data.amount, data.amount, data.clientId]
        );
      }

      await connection.commit();
      return { id: result.insertId, reference: ref, amount: data.amount };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) connection.release();
    }
  }
}

module.exports = new TransactionRepository();
