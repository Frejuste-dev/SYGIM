const BaseRepository = require('../../core/BaseRepository');
const { pool } = require('../../../config/db');
const { randomUUID } = require('crypto');
class TransactionRepository extends BaseRepository {
  constructor() {
    super('transactions');
  }

  _buildWhereClause(filters) {
    let sql = '';
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

    return { sql, params };
  }

  async findAll(filters = {}, user = null) {
    const { sql: where, params } = this._buildWhereClause(filters);
    let sql = `SELECT * FROM transactions WHERE 1=1${where}`;

    if (user && user.role === 'collector') {
      const [userRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [user.id]);
      if (userRow.length > 0) {
        sql += ' AND collector_id = ?';
        params.push(userRow[0].id);
      }
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    const limit = parseInt(filters.limit || 20);
    const offset = (parseInt(filters.page || 1) - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async countAll(filters = {}, user = null) {
    const { sql: where, params } = this._buildWhereClause(filters);
    let sql = `SELECT COUNT(*) as total FROM transactions WHERE 1=1${where}`;

    if (user && user.role === 'collector') {
      const [userRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [user.id]);
      if (userRow.length > 0) {
        sql += ' AND collector_id = ?';
        params.push(userRow[0].id);
      }
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].total;
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
      'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10'
    );

    return {
      totalCollected: totalCollected[0].total,
      totalPending:   totalPending[0].total,
      byMethod:       countByMethod,
      recent:         recentTransactions
    };
  }

  async getFilteredStats(filters = {}, user = null) {
    const { sql: where, params } = this._buildWhereClause(filters);
    let sql = `SELECT 
                 COUNT(*) as transactionCount,
                 SUM(CASE WHEN status = 'processed' THEN amount ELSE 0 END) as totalCollected,
                 SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as totalPending,
                 SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processedCount,
                 SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
                 SUM(CASE WHEN status = 'processed' AND DATE(COALESCE(date, created_at)) = CURDATE() THEN amount ELSE 0 END) as todayCollected
               FROM transactions WHERE 1=1${where}`;

    let methodSql = `SELECT 
                       method as name, 
                       SUM(amount) as value 
                     FROM transactions 
                     WHERE status = 'processed' ${where}`;

    if (user && user.role === 'collector') {
      const [userRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [user.id]);
      if (userRow.length > 0) {
        sql += ' AND collector_id = ?';
        methodSql += ' AND collector_id = ?';
        params.push(userRow[0].id);
      }
    }

    methodSql += ' GROUP BY method';

    const [rows] = await pool.query(sql, params);
    const [methodRows] = await pool.query(methodSql, params);

    return {
      transactionCount: Number(rows[0].transactionCount) || 0,
      totalCollected: Number(rows[0].totalCollected) || 0,
      totalPending: Number(rows[0].totalPending) || 0,
      processedCount: Number(rows[0].processedCount) || 0,
      pendingCount: Number(rows[0].pendingCount) || 0,
      todayCollected: Number(rows[0].todayCollected) || 0,
      methodStats: methodRows.map(r => ({ name: r.name || 'Inconnu', value: Number(r.value) || 0 }))
    };
  }

  async getClientForTransaction(clientId) {
    const [rows] = await pool.query('SELECT id, collector_id FROM clients WHERE id = ?', [clientId]);
    return rows.length ? rows[0] : null;
  }

  async getCollectorByUserId(userId) {
    const [rows] = await pool.query('SELECT id FROM collectors WHERE user_id = ? AND active = 1', [userId]);
    return rows.length ? rows[0] : null;
  }

  async getManagedCollectors(userId) {
    const [rows] = await pool.query('SELECT id FROM collectors WHERE manager_id = ? OR user_id = ?', [userId, userId]);
    return rows.map(r => r.id);
  }

  async createWithClientUpdate(data) {
    let connection;
    try {
      const resolvedCollectorId = data.collectorId || null;
      
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      
      const ref = data.reference || `RC-${dd}${mm}${yyyy}-${randomSuffix}`;
      const dateDisplay = now.toLocaleDateString('fr-FR');

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

        // Amortissement de la réparation locataire active si existante
        try {
          const [repRows] = await connection.query(
            "SELECT * FROM tenant_repairs WHERE client_id = ? AND status = 'IN_PROGRESS' ORDER BY id ASC LIMIT 1",
            [data.clientId]
          );
          if (repRows.length > 0) {
            const rep = repRows[0];
            const dedAllowed = rep.deduction_mode === 'immediate'
              ? parseFloat(rep.remaining_amount)
              : Math.min(parseFloat(rep.monthly_deduction || rep.remaining_amount), parseFloat(rep.remaining_amount));
            if (dedAllowed > 0) {
              const newReimbursed = parseFloat((parseFloat(rep.reimbursed_amount) + dedAllowed).toFixed(2));
              const newRemaining = Math.max(0, parseFloat((parseFloat(rep.remaining_amount) - dedAllowed).toFixed(2)));
              const newStatus = newRemaining <= 0 ? 'SETTLED' : 'IN_PROGRESS';
              await connection.query(
                "UPDATE tenant_repairs SET reimbursed_amount = ?, remaining_amount = ?, status = ? WHERE id = ?",
                [newReimbursed, newRemaining, newStatus, rep.id]
              );
            }
          }
        } catch (repErr) {
          // ignore non-blocking
        }
      }

      await connection.commit();
      return { id: result.insertId, reference: ref, amount: data.amount };
    } catch (err) {
      if (connection) {
        await connection.rollback();
      }
      throw err;
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
}

module.exports = new TransactionRepository();
