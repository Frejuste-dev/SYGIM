const BaseRepository = require('../../core/BaseRepository');
const { pool } = require('../../../config/db');

const VALID_OWNER_COLUMNS = [
  'first_name',
  'last_name',
  'display_name',
  'phone',
  'email',
  'address',
  'id_number',
  'bank_name',
  'bank_account',
  'notes',
  'preferred_payment_method',
  'payout_schedule',
  'preferred_payout_day',
  'commission_rate',
  'active'
];

class OwnerRepository extends BaseRepository {
  constructor() {
    super('owners');
  }

  sanitizeOwnerData(data = {}) {
    const clean = {};
    for (const col of VALID_OWNER_COLUMNS) {
      if (data[col] !== undefined) {
        clean[col] = data[col];
      }
    }
    if ((clean.first_name !== undefined || clean.last_name !== undefined) && !clean.display_name) {
      clean.display_name = `${clean.first_name || ''} ${clean.last_name || ''}`.trim();
    }
    return clean;
  }

  async assignProperties(ownerId, propertyIds) {
    if (!Array.isArray(propertyIds)) return;
    const numericIds = propertyIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);

    // Détacher les biens qui ne sont plus dans la sélection de ce propriétaire
    await pool.query('UPDATE properties SET owner_id = NULL WHERE owner_id = ?', [ownerId]);

    // Attribuer tous les biens sélectionnés à ce propriétaire
    if (numericIds.length > 0) {
      const placeholders = numericIds.map(() => '?').join(',');
      await pool.query(
        `UPDATE properties SET owner_id = ? WHERE id IN (${placeholders})`,
        [ownerId, ...numericIds]
      );
    }
  }

  async create(data) {
    const propertyIds = data.property_ids ?? data.propertyIds;
    const cleanData = this.sanitizeOwnerData(data);
    const created = await super.create(cleanData);
    if (Array.isArray(propertyIds)) {
      await this.assignProperties(created.id, propertyIds);
    }
    return await this.findByIdWithProperties(created.id);
  }

  async update(id, data) {
    const propertyIds = data.property_ids ?? data.propertyIds;
    const cleanData = this.sanitizeOwnerData(data);
    if (Object.keys(cleanData).length > 0) {
      await super.update(id, cleanData);
    }
    if (Array.isArray(propertyIds)) {
      await this.assignProperties(id, propertyIds);
    }
    return await this.findByIdWithProperties(id);
  }

  async findAll(filters = {}, user = null) {
    let sql = `SELECT o.*, 
                 (SELECT COUNT(*) FROM properties p WHERE p.owner_id = o.id) as propertiesCount,
                 (SELECT COALESCE(SUM(p.rent), 0) FROM properties p WHERE p.owner_id = o.id) as totalMonthlyRent
               FROM owners o WHERE 1=1`;
    const params = [];

    if (filters.search) {
      sql += ' AND (o.first_name LIKE ? OR o.last_name LIKE ? OR o.phone LIKE ? OR o.email LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    if (user && user.role) {
      if (user.role === 'owner') {
        sql += ' AND o.user_id = ?';
        params.push(user.id);
      } else if (user.role === 'collector') {
        sql += ` AND o.id IN (
          SELECT p.owner_id 
          FROM properties p
          JOIN collectors c ON c.id = p.collector_id
          WHERE c.user_id = ?
        )`;
        params.push(user.id);
      } else if (user.role === 'collector_manager') {
        sql += ` AND o.id IN (
          SELECT p.owner_id 
          FROM properties p
          JOIN collectors c ON c.id = p.collector_id
          WHERE c.manager_id = ? OR c.user_id = ?
        )`;
        params.push(user.id, user.id);
      }
    }

    sql += ' ORDER BY o.created_at DESC';

    const limit = parseInt(filters.limit || 50, 10);
    const offset = (parseInt(filters.page || 1, 10) - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);

    if (rows.length > 0) {
      const ownerIds = rows.map(r => r.id);
      const placeholders = ownerIds.map(() => '?').join(',');
      const [props] = await pool.query(
        `SELECT id, name, address, type, status, rent, owner_id FROM properties WHERE owner_id IN (${placeholders}) ORDER BY name`,
        ownerIds
      );

      const propMap = {};
      for (const p of props) {
        if (!propMap[p.owner_id]) propMap[p.owner_id] = [];
        propMap[p.owner_id].push(p);
      }

      for (const owner of rows) {
        owner.properties = propMap[owner.id] || [];
        owner.property_ids = owner.properties.map(p => p.id);
        owner.propertiesCount = owner.properties.length;
      }
    }

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

    return {
      ...ownerRows[0],
      properties,
      property_ids: properties.map(p => p.id),
      propertiesCount: properties.length
    };
  }

  async findByUserId(userId) {
    const [rows] = await pool.query('SELECT * FROM owners WHERE user_id = ?', [userId]);
    return rows.length > 0 ? rows[0] : null;
  }

  async isAccessibleByUser(ownerId, user) {
    if (!user || !user.role) return false;
    if (['admin', 'director', 'accounting', 'collector_manager', 'gestionnaire'].includes(user.role)) return true;

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

    return false;
  }
}

module.exports = new OwnerRepository();
