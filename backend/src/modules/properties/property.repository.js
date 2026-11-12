const BaseRepository = require('../../core/BaseRepository');
const { pool } = require('../../config/database');

class PropertyRepository extends BaseRepository {
  constructor() {
    super('properties');
  }

  async findAllWithDetails(filters = {}) {
    let sql = `SELECT p.*, o.first_name AS owner_first_name, o.last_name AS owner_last_name,
                      c.first_name AS tenant_first_name, c.last_name AS tenant_last_name, c.phone AS tenant_phone
               FROM properties p
               LEFT JOIN owners o ON p.owner_id = o.id
               LEFT JOIN clients c ON p.tenant_id = c.id
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

    const limit = parseInt(filters.limit || 20);
    const offset = (parseInt(filters.page || 1) - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async countAllWithDetails(filters = {}) {
    let sql = `SELECT COUNT(*) as total FROM properties p WHERE 1=1`;
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

    const [rows] = await pool.query(sql, params);
    return rows[0].total;
  }

  async getStats() {
    return this.getFilteredStats({});
  }

  async getFilteredStats(filters = {}) {
    let sql = `SELECT 
                 COUNT(*) as total,
                 SUM(CASE WHEN status = 'vacant' THEN 1 ELSE 0 END) as vacant,
                 SUM(CASE WHEN status = 'loue' THEN 1 ELSE 0 END) as loue,
                 SUM(CASE WHEN status = 'en_renovation' THEN 1 ELSE 0 END) as en_renovation,
                 COALESCE(SUM(value), 0) as totalValue,
                 COALESCE(SUM(CASE WHEN status = 'loue' THEN rent ELSE 0 END), 0) as totalRent
               FROM properties p
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

    const [rows] = await pool.query(sql, params);
    return {
      total: Number(rows[0].total) || 0,
      vacant: Number(rows[0].vacant) || 0,
      loue: Number(rows[0].loue) || 0,
      en_renovation: Number(rows[0].en_renovation) || 0,
      totalValue: Number(rows[0].totalValue) || 0,
      totalRent: Number(rows[0].totalRent) || 0
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

  async findByTenantId(tenantId) {
    const [rows] = await pool.query('SELECT * FROM properties WHERE tenant_id = ?', [tenantId]);
    return rows;
  }
}

module.exports = new PropertyRepository();
