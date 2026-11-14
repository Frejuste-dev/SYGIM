const BaseRepository = require('../../core/BaseRepository');
const { pool } = require('../../config/database');
const { randomUUID } = require('crypto');
class TransactionRepository extends BaseRepository {
  constructor() {
    super('transactions');
  }

  _buildWhereClause(filters) {
    let sql = '';
    const params = [];

    if (filters.status && filters.status !== 'all') {
      sql += ' AND t.status = ?';
      params.push(filters.status);
    }
    if (filters.method && filters.method !== 'all') {
      sql += ' AND t.method = ?';
      params.push(filters.method);
    }
    if (filters.clientId) {
      sql += ' AND t.client_id = ?';
      params.push(filters.clientId);
    }
    if (filters.dateFrom) {
      sql += ' AND t.date >= ?';
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      sql += ' AND t.date <= ?';
      params.push(filters.dateTo);
    }
    if (filters.search) {
      sql += ' AND (t.client_name LIKE ? OR t.reference LIKE ? OR t.description LIKE ? OR col.first_name LIKE ? OR col.last_name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s);
    }

    return { sql, params };
  }

  async findAll(filters = {}, user = null) {
    const { sql: where, params } = this._buildWhereClause(filters);
    let sql = `SELECT t.*,
                      CONCAT(COALESCE(col.first_name, ''), ' ', COALESCE(col.last_name, '')) AS collector_name,
                      col.phone AS collector_phone,
                      col.zone AS collector_zone,
                      COALESCE(p.name, cl.property_name, '—') AS property_name,
                      cl.phone AS client_phone,
                      COALESCE(u.display_name, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')), u.username) AS validator_name
               FROM transactions t
               LEFT JOIN collectors col ON col.id = t.collector_id
               LEFT JOIN clients cl ON cl.id = t.client_id
               LEFT JOIN properties p ON p.id = cl.property_id
               LEFT JOIN users u ON u.id = t.validated_by
               WHERE 1=1${where}`;

    if (user && user.role === 'collector') {
      const [userRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [user.id]);
      if (userRow.length > 0) {
        sql += ' AND t.collector_id = ?';
        params.push(userRow[0].id);
      }
    }

    sql += ' ORDER BY t.date DESC, t.created_at DESC';

    const limit = parseInt(filters.limit || 20);
    const offset = (parseInt(filters.page || 1) - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async countAll(filters = {}, user = null) {
    const { sql: where, params } = this._buildWhereClause(filters);
    let sql = `SELECT COUNT(*) as total 
               FROM transactions t
               LEFT JOIN collectors col ON col.id = t.collector_id
               WHERE 1=1${where}`;

    if (user && user.role === 'collector') {
      const [userRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [user.id]);
      if (userRow.length > 0) {
        sql += ' AND t.collector_id = ?';
        params.push(userRow[0].id);
      }
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].total;
  }

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT t.*,
              CONCAT(COALESCE(col.first_name, ''), ' ', COALESCE(col.last_name, '')) AS collector_name,
              col.phone AS collector_phone,
              col.zone AS collector_zone,
              COALESCE(p.name, cl.property_name, '—') AS property_name,
              cl.phone AS client_phone,
              COALESCE(u.display_name, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')), u.username) AS validator_name
       FROM transactions t
       LEFT JOIN collectors col ON col.id = t.collector_id
       LEFT JOIN clients cl ON cl.id = t.client_id
       LEFT JOIN properties p ON p.id = cl.property_id
       LEFT JOIN users u ON u.id = t.validated_by
       WHERE t.id = ?`,
      [id]
    );
    return rows.length ? rows[0] : null;
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
      `SELECT
         CASE
           WHEN LOWER(TRIM(method)) IN ('cash', 'especes', 'espece', 'espèce', 'espèces') THEN 'Espèces'
           WHEN LOWER(TRIM(method)) IN ('mobile_money', 'mobile money', 'wave', 'orange_money', 'orange money', 'mtn', 'moov') THEN 'Mobile Money'
           WHEN LOWER(TRIM(method)) IN ('cheque', 'check', 'chèque') THEN 'Chèque'
           WHEN LOWER(TRIM(method)) IN ('transfer', 'bank_transfer', 'virement', 'virement bancaire', 'virement_bancaire') THEN 'Virement bancaire'
           ELSE 'Espèces'
         END AS method,
         COUNT(*) as count,
         COALESCE(SUM(amount), 0) as total 
       FROM transactions
       WHERE status = 'processed'
         AND amount > 0
         AND COALESCE(payment_type, 'payment') NOT IN ('assignment', 'departure')
         AND COALESCE(method, '') NOT IN ('assignment', 'departure', '')
         ${dateFilter}
       GROUP BY 
         CASE
           WHEN LOWER(TRIM(method)) IN ('cash', 'especes', 'espece', 'espèce', 'espèces') THEN 'Espèces'
           WHEN LOWER(TRIM(method)) IN ('mobile_money', 'mobile money', 'wave', 'orange_money', 'orange money', 'mtn', 'moov') THEN 'Mobile Money'
           WHEN LOWER(TRIM(method)) IN ('cheque', 'check', 'chèque') THEN 'Chèque'
           WHEN LOWER(TRIM(method)) IN ('transfer', 'bank_transfer', 'virement', 'virement bancaire', 'virement_bancaire') THEN 'Virement bancaire'
           ELSE 'Espèces'
         END`
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
                       CASE
                         WHEN LOWER(TRIM(method)) IN ('cash', 'especes', 'espece', 'espèce', 'espèces') THEN 'Espèces'
                         WHEN LOWER(TRIM(method)) IN ('mobile_money', 'mobile money', 'wave', 'orange_money', 'orange money', 'mtn', 'moov') THEN 'Mobile Money'
                         WHEN LOWER(TRIM(method)) IN ('cheque', 'check', 'chèque') THEN 'Chèque'
                         WHEN LOWER(TRIM(method)) IN ('transfer', 'bank_transfer', 'virement', 'virement bancaire', 'virement_bancaire') THEN 'Virement bancaire'
                         ELSE 'Espèces'
                       END as name, 
                       COALESCE(SUM(amount), 0) as value 
                     FROM transactions 
                     WHERE status = 'processed'
                       AND amount > 0
                       AND COALESCE(payment_type, 'payment') NOT IN ('assignment', 'departure')
                       AND COALESCE(method, '') NOT IN ('assignment', 'departure', '')
                       ${where}`;

    if (user && user.role === 'collector') {
      const [userRow] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [user.id]);
      if (userRow.length > 0) {
        sql += ' AND collector_id = ?';
        methodSql += ' AND collector_id = ?';
        params.push(userRow[0].id);
      }
    }

    methodSql += ` GROUP BY 
                    CASE
                      WHEN LOWER(TRIM(method)) IN ('cash', 'especes', 'espece', 'espèce', 'espèces') THEN 'Espèces'
                      WHEN LOWER(TRIM(method)) IN ('mobile_money', 'mobile money', 'wave', 'orange_money', 'orange money', 'mtn', 'moov') THEN 'Mobile Money'
                      WHEN LOWER(TRIM(method)) IN ('cheque', 'check', 'chèque') THEN 'Chèque'
                      WHEN LOWER(TRIM(method)) IN ('transfer', 'bank_transfer', 'virement', 'virement bancaire', 'virement_bancaire') THEN 'Virement bancaire'
                      ELSE 'Espèces'
                    END`;

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
        // Amortissement de la réparation locataire active si existante
        let dedAllowed = 0;
        try {
          const [repRows] = await connection.query(
            "SELECT * FROM tenant_repairs WHERE client_id = ? AND status = 'IN_PROGRESS' ORDER BY id ASC LIMIT 1 FOR UPDATE",
            [data.clientId]
          );
          if (repRows.length > 0) {
            const rep = repRows[0];
            dedAllowed = rep.deduction_mode === 'immediate'
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
          // non-bloquant
        }

        // Le loyer satisfait = versement espèces + crédit déduction travaux
        const totalCredited = parseFloat(data.amount || 0) + dedAllowed;
        await connection.query(
          `UPDATE clients SET amount_paid = amount_paid + ?, 
           payment_method = ?,
           status = CASE 
              WHEN amount_paid + ? >= amount_due THEN 'paid'
              WHEN amount_paid + ? > 0 THEN 'partial'
              ELSE status 
           END
           WHERE id = ?`,
          [totalCredited, data.method || 'cash', totalCredited, totalCredited, data.clientId]
        );
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

  /**
   * Valide formellement une transaction collecteur lors de la réception physique des fonds par le comptable
   * Met à jour le statut en 'processed', crédite le client et applique les déductions travaux éventuelles
   */
  async validateTransaction(id, validatorUserId, notes = null) {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [rows] = await connection.query(
        'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
        [id]
      );
      if (rows.length === 0) {
        const error = new Error('Transaction introuvable');
        error.statusCode = 404;
        throw error;
      }
      const tx = rows[0];

      if (tx.status === 'processed') {
        const error = new Error('Cette transaction est déjà validée');
        error.statusCode = 400;
        throw error;
      }
      if (tx.status === 'cancelled' || tx.status === 'refunded') {
        const error = new Error('Impossible de valider une transaction annulée ou remboursée');
        error.statusCode = 400;
        throw error;
      }

      // 1. Mettre à jour la transaction
      const validationNotes = notes ? `${tx.notes ? tx.notes + ' | ' : ''}Validé: ${notes}` : tx.notes;
      await connection.query(
        `UPDATE transactions 
         SET status = 'processed',
             validated_by = ?,
             validated_at = NOW(),
             notes = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [validatorUserId, validationNotes, id]
      );

      // 2. Amortissement réparation locataire active si existante & Créditer le locataire
      if (tx.client_id) {
        let dedAllowed = 0;
        try {
          const [repRows] = await connection.query(
            "SELECT * FROM tenant_repairs WHERE client_id = ? AND status = 'IN_PROGRESS' ORDER BY id ASC LIMIT 1 FOR UPDATE",
            [tx.client_id]
          );
          if (repRows.length > 0) {
            const rep = repRows[0];
            dedAllowed = rep.deduction_mode === 'immediate'
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
          // non-bloquant
        }

        // Le loyer satisfait = versement espèces + déduction travaux locataire
        const totalCredited = parseFloat(tx.amount || 0) + dedAllowed;
        await connection.query(
          `UPDATE clients 
           SET amount_paid = amount_paid + ?, 
               payment_method = ?,
               status = CASE 
                  WHEN amount_paid + ? >= amount_due THEN 'paid'
                  WHEN amount_paid + ? > 0 THEN 'partial'
                  ELSE status 
               END,
               updated_at = NOW()
           WHERE id = ?`,
          [totalCredited, tx.method || 'cash', totalCredited, totalCredited, tx.client_id]
        );
      }

      await connection.commit();
      return { ...tx, status: 'processed', validated_by: validatorUserId, validated_at: new Date() };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) connection.release();
    }
  }

  /**
   * Rejette une transaction d'encaissement (si les fonds ne correspondent pas ou erreur de saisie terrain)
   */
  async rejectTransaction(id, validatorUserId, reason = null) {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [rows] = await connection.query(
        'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
        [id]
      );
      if (rows.length === 0) {
        const error = new Error('Transaction introuvable');
        error.statusCode = 404;
        throw error;
      }
      const tx = rows[0];

      if (tx.status === 'processed') {
        const error = new Error('Une transaction déjà validée ne peut pas être rejetée (utiliser une extourne)');
        error.statusCode = 400;
        throw error;
      }

      const rejectionNotes = reason ? `${tx.notes ? tx.notes + ' | ' : ''}Rejeté par comptabilité: ${reason}` : tx.notes;
      await connection.query(
        `UPDATE transactions 
         SET status = 'cancelled',
             validated_by = ?,
             validated_at = NOW(),
             notes = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [validatorUserId, rejectionNotes, id]
      );

      await connection.commit();
      return { ...tx, status: 'cancelled', validated_by: validatorUserId, validated_at: new Date() };
    } catch (err) {
      if (connection) await connection.rollback();
      throw err;
    } finally {
      if (connection) connection.release();
    }
  }
}

module.exports = new TransactionRepository();
