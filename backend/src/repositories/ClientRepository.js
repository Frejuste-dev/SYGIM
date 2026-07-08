const BaseRepository = require('./BaseRepository');
const { pool } = require('../../config/db');

class ClientRepository extends BaseRepository {
  constructor() {
    super('clients');
  }

  async findAllWithCollector(filters = {}, userRole = null, userId = null) {
    let sql = `SELECT c.*, CONCAT(col.first_name, ' ', col.last_name) as collector_name
               FROM clients c
               LEFT JOIN collectors col ON c.collector_id = col.id
               WHERE 1=1`;
    const params = [];

    if (filters.status && filters.status !== 'all') {
      sql += ' AND c.status = ?';
      params.push(filters.status);
    }

    if (filters.collectorId) {
      sql += ' AND c.collector_id = ?';
      params.push(filters.collectorId);
    }

    if (userRole === 'collector') {
      const [collectorRows] = await pool.query('SELECT id FROM collectors WHERE user_id = ?', [userId]);
      if (collectorRows.length > 0) {
        sql += ' AND c.collector_id = ?';
        params.push(collectorRows[0].id);
      }
    }

    if (filters.search) {
      sql += ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY c.created_at DESC';
    
    // Pagination (simplified for now)
    if (filters.limit) {
      const offset = (parseInt(filters.page || 1) - 1) * parseInt(filters.limit);
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(filters.limit), offset);
    }

    const [rows] = await pool.query(sql, params);
    return rows;
  }
}

module.exports = new ClientRepository();
