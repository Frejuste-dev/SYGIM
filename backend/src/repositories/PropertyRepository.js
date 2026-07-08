const BaseRepository = require('./BaseRepository');
const { pool } = require('../../config/db');

class PropertyRepository extends BaseRepository {
  constructor() {
    super('properties');
  }

  async findAllWithDetails(filters = {}) {
    let sql = `SELECT p.*, o.first_name AS owner_first_name, o.last_name AS owner_last_name
               FROM properties p
               LEFT JOIN owners o ON p.owner_id = o.id
               WHERE 1=1`;
    const params = [];

    if (filters.status && filters.status !== 'all') {
      sql += ' AND p.status = ?';
      params.push(filters.status);
    }
    if (filters.type && filters.type !== 'all') {
      sql += ' AND p.type = ?';
      params.push(filters.type);
    }
    if (filters.ownerId) {
      sql += ' AND p.owner_id = ?';
      params.push(filters.ownerId);
    }
    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.address LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s);
    }

    sql += ' ORDER BY p.created_at DESC';

    if (filters.limit) {
      const offset = (parseInt(filters.page || 1) - 1) * parseInt(filters.limit);
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(filters.limit), offset);
    }

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async getStats() {
    const [total]   = await pool.query('SELECT COUNT(*) as count FROM properties');
    const [vacant]  = await pool.query("SELECT COUNT(*) as count FROM properties WHERE status = 'vacant'");
    const [loue]    = await pool.query("SELECT COUNT(*) as count FROM properties WHERE status = 'loue'");
    const [renov]   = await pool.query("SELECT COUNT(*) as count FROM properties WHERE status = 'en_renovation'");
    const [sumVal]  = await pool.query('SELECT COALESCE(SUM(value), 0) as total FROM properties');
    const [sumRent] = await pool.query("SELECT COALESCE(SUM(rent), 0) as total FROM properties WHERE status = 'loue'");

    return {
      total:        total[0].count,
      vacant:       vacant[0].count,
      loue:         loue[0].count,
      en_renovation: renov[0].count,
      totalValue:   sumVal[0].total,
      totalRent:    sumRent[0].total
    };
  }

  async findByIdWithDetails(id) {
    const [rows] = await pool.query(
      `SELECT p.*, o.first_name AS owner_first_name, o.last_name AS owner_last_name,
              c.first_name AS tenant_first_name, c.last_name AS tenant_last_name
       FROM properties p
       LEFT JOIN owners o ON p.owner_id = o.id
       LEFT JOIN clients c ON p.tenant_id = c.id
       WHERE p.id = ?`,
      [id]
    );
    return rows[0];
  }
}

module.exports = new PropertyRepository();
