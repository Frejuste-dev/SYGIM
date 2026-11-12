const { pool } = require('../../config/database');

class AlertRepository {
  async findOverduePayments(filters = {}, userRole = null, userId = null) {
    let sql = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.phone,
        c.email,
        c.property_name,
        p.address as property_address,
        CONCAT(col.first_name, ' ', col.last_name) as collector_name,
        col.phone as collector_phone,
        o.first_name as owner_first_name,
        o.last_name as owner_last_name,
        c.amount_due as rent_due,
        c.amount_paid,
        (c.amount_due - COALESCE(c.amount_paid, 0)) as amount_owed,
        c.status,
        DATEDIFF(CURDATE(), DATE(c.contract_start)) as days_since_contract,
        t.last_payment_date,
        CASE
          WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due * 2 THEN 'critique'
          WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due THEN 'haute'
          WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > 0 THEN 'normale'
          ELSE 'basse'
        END as severity
      FROM clients c
      LEFT JOIN properties p ON c.property_id = p.id
      LEFT JOIN collectors col ON c.collector_id = col.id
      LEFT JOIN owners o ON c.owner_id = o.id
      LEFT JOIN (
        SELECT client_id, MAX(date) as last_payment_date
        FROM transactions
        GROUP BY client_id
      ) t ON c.id = t.client_id
      WHERE c.status IN ('late', 'pending', 'partial')
        AND c.amount_due > 0
        AND (c.amount_due - COALESCE(c.amount_paid, 0)) > 0
    `;

    const params = [];

    if (userRole === 'collector') {
      const [collectorRows] = await pool.query(
        'SELECT id FROM collectors WHERE user_id = ?', [userId]
      );
      if (collectorRows.length > 0) {
        sql += ' AND c.collector_id = ?';
        params.push(collectorRows[0].id);
      }
    } else if (filters.collectorId) {
      sql += ' AND c.collector_id = ?';
      params.push(filters.collectorId);
    }

    if (filters.severity && filters.severity !== 'all') {
      sql += `
        AND CASE
          WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due * 2 THEN 'critique'
          WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due THEN 'haute'
          WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > 0 THEN 'normale'
          ELSE 'basse'
        END = ?
      `;
      params.push(filters.severity);
    }

    sql += ' ORDER BY amount_owed DESC, days_since_contract DESC';

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async findDashboardData() {
    const [totalOwed] = await pool.query(`
      SELECT
        SUM(amount_due - COALESCE(amount_paid, 0)) as total_owed,
        COUNT(*) as client_count,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
      FROM clients
      WHERE amount_due > 0 AND amount_paid < amount_due
    `);

    const [topOverdue] = await pool.query(`
      SELECT
        c.id,
        CONCAT(c.first_name, ' ', c.last_name) as client_name,
        c.property_name,
        (c.amount_due - COALESCE(c.amount_paid, 0)) as amount_owed,
        c.status
      FROM clients c
      WHERE c.amount_due > 0 AND c.amount_paid < c.amount_due
      ORDER BY amount_owed DESC
      LIMIT 5
    `);

    const [byCollector] = await pool.query(`
      SELECT
        CONCAT(col.first_name, ' ', col.last_name) as collector_name,
        COUNT(c.id) as overdue_count,
        SUM(c.amount_due - COALESCE(c.amount_paid, 0)) as total_owed
      FROM clients c
      LEFT JOIN collectors col ON c.collector_id = col.id
      WHERE c.amount_due > 0 AND c.amount_paid < c.amount_due
      GROUP BY col.id
      ORDER BY total_owed DESC
    `);

    const [todayCollections] = await pool.query(`
      SELECT
        COUNT(*) as transaction_count,
        SUM(amount) as total_collected,
        COUNT(DISTINCT client_id) as client_count
      FROM transactions
      WHERE DATE(date) = CURDATE() AND status = 'processed'
    `);

    return {
      totalOwed: totalOwed[0],
      topOverdueClients: topOverdue,
      byCollector,
      todayCollections: todayCollections[0] || { transaction_count: 0, total_collected: 0, client_count: 0 }
    };
  }

  async findSummary() {
    const [rows] = await pool.query(`
      SELECT
        CASE
          WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due * 2 THEN 'critique'
          WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > c.amount_due THEN 'haute'
          WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > 0 THEN 'normale'
          ELSE 'basse'
        END as severity,
        COUNT(*) as count,
        SUM(c.amount_due - COALESCE(c.amount_paid, 0)) as total_amount
      FROM clients c
      WHERE c.amount_due > 0 AND c.amount_paid < c.amount_due
      GROUP BY severity
      ORDER BY FIELD(severity, 'critique', 'haute', 'normale', 'basse')
    `);
    return rows;
  }

  async acknowledge(clientId, userId) {
    await pool.query(
      `INSERT INTO alert_acknowledgements (client_id, acknowledged_by, acknowledged_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE acknowledged_at = NOW()`,
      [clientId, userId]
    );
    return { success: true, clientId };
  }
}

module.exports = new AlertRepository();
