const BaseRepository = require('../../core/BaseRepository');
const { pool } = require('../../../config/db');

class OwnerRepository extends BaseRepository {
  constructor() {
    super('owners');
  }

  async findAll(filters = {}, user = null) {
    let sql = `SELECT o.*, 
                 (SELECT COUNT(*) FROM properties p WHERE p.owner_id = o.id) as propertiesCount
               FROM owners o WHERE 1=1`;
    const params = [];

    if (filters.search) {
      sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    if (user && user.role) {
      if (user.role === 'owner') {
        sql += ' AND user_id = ?';
        params.push(user.id);
      } else if (user.role === 'collector') {
        sql += ` AND id IN (
          SELECT p.owner_id 
          FROM properties p
          JOIN collectors c ON c.id = p.collector_id
          WHERE c.user_id = ?
        )`;
        params.push(user.id);
      } else if (user.role === 'collector_manager') {
        sql += ` AND id IN (
          SELECT p.owner_id 
          FROM properties p
          JOIN collectors c ON c.id = p.collector_id
          WHERE c.manager_id = ? OR c.user_id = ?
        )`;
        params.push(user.id, user.id);
      }
    }

    sql += ' ORDER BY created_at DESC';

    const limit = parseInt(filters.limit || 20);
    const offset = (parseInt(filters.page || 1) - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async count(filters = {}, user = null) {
    let sql = 'SELECT COUNT(*) as total FROM owners WHERE 1=1';
    const params = [];

    if (filters.search) {
      sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    if (user && user.role) {
      if (user.role === 'owner') {
        sql += ' AND user_id = ?';
        params.push(user.id);
      }
    }

    const [rows] = await pool.query(sql, params);
    return rows[0].total;
  }

  async getFilteredStats(filters = {}, user = null) {
    let sql = `SELECT 
                 COUNT(*) as totalOwners,
                 SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as activeOwners,
                 (SELECT COUNT(*) FROM properties WHERE owner_id IS NOT NULL) as totalProperties
               FROM owners WHERE 1=1`;
    const params = [];

    if (filters.search) {
      sql += ' AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    if (user && user.role) {
      if (user.role === 'owner') {
        sql += ' AND user_id = ?';
        params.push(user.id);
      }
    }

    const [rows] = await pool.query(sql, params);
    return {
      totalOwners: Number(rows[0].totalOwners) || 0,
      activeOwners: Number(rows[0].activeOwners) || 0,
      totalProperties: Number(rows[0].totalProperties) || 0
    };
  }

  async findByIdWithProperties(id) {
    const [ownerRows] = await pool.query('SELECT * FROM owners WHERE id = ?', [id]);
    if (ownerRows.length === 0) {
      return null;
    }

    const [properties] = await pool.query(
      'SELECT * FROM properties WHERE owner_id = ? ORDER BY name',
      [id]
    );

    return { ...ownerRows[0], properties };
  }

  async findByUserId(userId) {
    const [rows] = await pool.query('SELECT * FROM owners WHERE user_id = ?', [userId]);
    return rows.length > 0 ? rows[0] : null;
  }

  async isAccessibleByUser(ownerId, user) {
    if (!user || !user.role) return false;
    if (['admin', 'director', 'accounting'].includes(user.role)) return true;

    if (user.role === 'owner') {
      const [rows] = await pool.query('SELECT id FROM owners WHERE id = ? AND user_id = ?', [ownerId, user.id]);
      return rows.length > 0;
    }

    if (user.role === 'collector') {
      const [rows] = await pool.query(
        `SELECT p.id 
         FROM properties p
         JOIN collectors c ON c.id = p.collector_id
         WHERE p.owner_id = ? AND c.user_id = ?`,
        [ownerId, user.id]
      );
      return rows.length > 0;
    }

    if (user.role === 'collector_manager') {
      const [rows] = await pool.query(
        `SELECT p.id 
         FROM properties p
         JOIN collectors c ON c.id = p.collector_id
         WHERE p.owner_id = ? AND (c.manager_id = ? OR c.user_id = ?)`,
        [ownerId, user.id, user.id]
      );
      return rows.length > 0;
    }

    return false;
  }
}

module.exports = new OwnerRepository();
