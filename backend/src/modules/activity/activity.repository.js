const { pool } = require('../../config/database');

class ActivityRepository {
  async findManagerLogs(filters = {}) {
    let sql = `
      SELECT 
        l.id,
        l.user_id,
        COALESCE(u.display_name, u.username, 'Système') AS author_name,
        u.role AS author_role,
        l.operation_type,
        l.operation_label,
        l.property_id,
        l.property_ref,
        l.owner_id,
        l.owner_name,
        l.target_summary,
        l.description,
        l.old_values,
        l.new_values,
        l.status,
        l.created_at
      FROM manager_activity_logs l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.startDate) {
      sql += ' AND l.created_at >= ?';
      params.push(`${filters.startDate} 00:00:00`);
    }

    if (filters.endDate) {
      sql += ' AND l.created_at <= ?';
      params.push(`${filters.endDate} 23:59:59`);
    }

    if (filters.operationType && filters.operationType !== 'ALL') {
      sql += ' AND l.operation_type = ?';
      params.push(filters.operationType);
    }

    if (filters.propertyRef) {
      sql += ' AND l.property_ref LIKE ?';
      params.push(`%${filters.propertyRef}%`);
    }

    if (filters.ownerName) {
      sql += ' AND l.owner_name LIKE ?';
      params.push(`%${filters.ownerName}%`);
    }

    if (filters.status && filters.status !== 'ALL') {
      sql += ' AND l.status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      sql += ' AND (l.target_summary LIKE ? OR l.description LIKE ? OR l.property_ref LIKE ? OR l.owner_name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    // Tri chronologique décroissant
    sql += ' ORDER BY l.created_at DESC';

    const page = Math.max(1, parseInt(filters.page || 1, 10));
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit || 20, 10)));
    const offset = (page - 1) * limit;

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);

    // Parsing old_values and new_values if JSON string
    return rows.map((r) => {
      let oldVals = r.old_values;
      let newVals = r.new_values;
      if (typeof oldVals === 'string') {
        try { oldVals = JSON.parse(oldVals); } catch (_) {}
      }
      if (typeof newVals === 'string') {
        try { newVals = JSON.parse(newVals); } catch (_) {}
      }
      return {
        ...r,
        old_values: oldVals,
        new_values: newVals,
      };
    });
  }

  async countManagerLogs(filters = {}) {
    let sql = 'SELECT COUNT(*) as total FROM manager_activity_logs l WHERE 1=1';
    const params = [];

    if (filters.startDate) {
      sql += ' AND l.created_at >= ?';
      params.push(`${filters.startDate} 00:00:00`);
    }

    if (filters.endDate) {
      sql += ' AND l.created_at <= ?';
      params.push(`${filters.endDate} 23:59:59`);
    }

    if (filters.operationType && filters.operationType !== 'ALL') {
      sql += ' AND l.operation_type = ?';
      params.push(filters.operationType);
    }

    if (filters.propertyRef) {
      sql += ' AND l.property_ref LIKE ?';
      params.push(`%${filters.propertyRef}%`);
    }

    if (filters.ownerName) {
      sql += ' AND l.owner_name LIKE ?';
      params.push(`%${filters.ownerName}%`);
    }

    if (filters.status && filters.status !== 'ALL') {
      sql += ' AND l.status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      sql += ' AND (l.target_summary LIKE ? OR l.description LIKE ? OR l.property_ref LIKE ? OR l.owner_name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.total || 0);
  }
}

module.exports = new ActivityRepository();
