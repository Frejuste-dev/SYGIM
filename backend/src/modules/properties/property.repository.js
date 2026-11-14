const BaseRepository = require('../../core/BaseRepository');
const { pool } = require('../../config/database');

class PropertyRepository extends BaseRepository {
  constructor() {
    super('properties');
  }

  async findAllWithDetails(filters = {}) {
    let sql = `SELECT p.*, 
                      o.first_name AS owner_first_name, 
                      o.last_name AS owner_last_name,
                      COALESCE(o.display_name, CONCAT(o.first_name, ' ', o.last_name)) AS owner_display_name,
                      o.phone AS owner_phone,
                      c.first_name AS tenant_first_name, 
                      c.last_name AS tenant_last_name, 
                      c.phone AS tenant_phone,
                      COALESCE(u.display_name, u.username) AS assigned_by_name
               FROM properties p
               LEFT JOIN owners o ON p.owner_id = o.id
               LEFT JOIN clients c ON p.tenant_id = c.id
               LEFT JOIN users u ON p.assigned_by = u.id
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
    if (filters.assignmentStatus === 'assigned') {
      sql += ' AND p.owner_id IS NOT NULL';
    } else if (filters.assignmentStatus === 'unassigned') {
      sql += ' AND p.owner_id IS NULL';
    }
    if (filters.zone && filters.zone !== 'all') {
      sql += ' AND p.zone = ?';
      params.push(filters.zone);
    }
    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.address LIKE ? OR p.reference_code LIKE ? OR p.zone LIKE ? OR o.first_name LIKE ? OR o.last_name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s, s);
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
    let sql = `SELECT COUNT(*) as total 
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
    if (filters.assignmentStatus === 'assigned') {
      sql += ' AND p.owner_id IS NOT NULL';
    } else if (filters.assignmentStatus === 'unassigned') {
      sql += ' AND p.owner_id IS NULL';
    }
    if (filters.zone && filters.zone !== 'all') {
      sql += ' AND p.zone = ?';
      params.push(filters.zone);
    }
    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.address LIKE ? OR p.reference_code LIKE ? OR p.zone LIKE ? OR o.first_name LIKE ? OR o.last_name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s, s);
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
    if (filters.assignmentStatus === 'assigned') {
      sql += ' AND p.owner_id IS NOT NULL';
    } else if (filters.assignmentStatus === 'unassigned') {
      sql += ' AND p.owner_id IS NULL';
    }
    if (filters.zone && filters.zone !== 'all') {
      sql += ' AND p.zone = ?';
      params.push(filters.zone);
    }
    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.address LIKE ? OR p.reference_code LIKE ? OR p.zone LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
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

  async getNextReferenceCode() {
    const [rows] = await pool.query(
      "SELECT reference_code FROM properties WHERE reference_code LIKE 'BIEN-%' ORDER BY id DESC LIMIT 1"
    );
    if (rows.length === 0 || !rows[0].reference_code) {
      const [maxId] = await pool.query('SELECT MAX(id) as maxId FROM properties');
      const nextNum = (maxId[0]?.maxId || 0) + 1;
      return `BIEN-${String(nextNum).padStart(3, '0')}`;
    }
    const match = rows[0].reference_code.match(/^BIEN-(\d+)$/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `BIEN-${String(nextNum).padStart(3, '0')}`;
    }
    const [maxId] = await pool.query('SELECT MAX(id) as maxId FROM properties');
    const nextNum = (maxId[0]?.maxId || 0) + 1;
    return `BIEN-${String(nextNum).padStart(3, '0')}`;
  }

  async assignOwner(propertyId, ownerId, userId, notes = null) {
    await pool.query(
      'UPDATE properties SET owner_id = ?, assigned_at = NOW(), assigned_by = ? WHERE id = ?',
      [ownerId, userId, propertyId]
    );
    await pool.query(
      `INSERT INTO property_owner_assignments (property_id, previous_owner_id, new_owner_id, action_type, performed_by, notes, created_at)
       VALUES (?, NULL, ?, 'INITIAL_ASSIGNMENT', ?, ?, NOW())`,
      [propertyId, ownerId, userId, notes]
    );
    return await this.findByIdWithDetails(propertyId);
  }

  async reassignOwner(propertyId, previousOwnerId, newOwnerId, userId, notes = null) {
    await pool.query(
      'UPDATE properties SET owner_id = ?, assigned_at = NOW(), assigned_by = ? WHERE id = ?',
      [newOwnerId, userId, propertyId]
    );
    await pool.query(
      `INSERT INTO property_owner_assignments (property_id, previous_owner_id, new_owner_id, action_type, performed_by, notes, created_at)
       VALUES (?, ?, ?, 'REASSIGNMENT', ?, ?, NOW())`,
      [propertyId, previousOwnerId, newOwnerId, userId, notes]
    );
    return await this.findByIdWithDetails(propertyId);
  }

  async findAssignments(filters = {}) {
    let sql = `
      SELECT p.id, p.reference_code, p.name, p.zone, p.address, p.type, p.rent, p.status,
             p.owner_id, p.assigned_at, p.assigned_by,
             COALESCE(o.display_name, CONCAT(o.first_name, ' ', o.last_name)) AS owner_name,
             o.phone AS owner_phone, o.email AS owner_email,
             COALESCE(u.display_name, u.username) AS assigned_by_name
      FROM properties p
      LEFT JOIN owners o ON p.owner_id = o.id
      LEFT JOIN users u ON p.assigned_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.assignmentStatus === 'assigned') {
      sql += ' AND p.owner_id IS NOT NULL';
    } else if (filters.assignmentStatus === 'unassigned') {
      sql += ' AND p.owner_id IS NULL';
    }

    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.reference_code LIKE ? OR p.zone LIKE ? OR p.address LIKE ? OR o.first_name LIKE ? OR o.last_name LIKE ? OR o.phone LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    sql += ' ORDER BY CASE WHEN p.owner_id IS NULL THEN 0 ELSE 1 END, p.assigned_at DESC, p.created_at DESC';

    const page = Math.max(1, parseInt(filters.page || 1, 10));
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit || 50, 10)));
    const offset = (page - 1) * limit;

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async countAssignments(filters = {}) {
    let sql = `
      SELECT COUNT(*) as total
      FROM properties p
      LEFT JOIN owners o ON p.owner_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.assignmentStatus === 'assigned') {
      sql += ' AND p.owner_id IS NOT NULL';
    } else if (filters.assignmentStatus === 'unassigned') {
      sql += ' AND p.owner_id IS NULL';
    }

    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.reference_code LIKE ? OR p.zone LIKE ? OR p.address LIKE ? OR o.first_name LIKE ? OR o.last_name LIKE ? OR o.phone LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    const [rows] = await pool.query(sql, params);
    return Number(rows[0]?.total || 0);
  }

  async findAssignmentHistory(filters = {}) {
    let sql = `
      SELECT h.id, h.property_id, h.previous_owner_id, h.new_owner_id, h.action_type, h.notes, h.created_at,
             p.reference_code AS property_ref, p.name AS property_name, p.zone AS property_zone,
             COALESCE(prev_o.display_name, CONCAT(prev_o.first_name, ' ', prev_o.last_name)) AS previous_owner_name,
             COALESCE(new_o.display_name, CONCAT(new_o.first_name, ' ', new_o.last_name)) AS new_owner_name,
             COALESCE(u.display_name, u.username) AS performed_by_name
      FROM property_owner_assignments h
      JOIN properties p ON h.property_id = p.id
      LEFT JOIN owners prev_o ON h.previous_owner_id = prev_o.id
      JOIN owners new_o ON h.new_owner_id = new_o.id
      LEFT JOIN users u ON h.performed_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.propertyId) {
      sql += ' AND h.property_id = ?';
      params.push(filters.propertyId);
    }
    if (filters.ownerId) {
      sql += ' AND (h.previous_owner_id = ? OR h.new_owner_id = ?)';
      params.push(filters.ownerId, filters.ownerId);
    }
    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.reference_code LIKE ? OR new_o.first_name LIKE ? OR new_o.last_name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY h.created_at DESC';

    const page = Math.max(1, parseInt(filters.page || 1, 10));
    const limit = Math.max(1, Math.min(100, parseInt(filters.limit || 50, 10)));
    const offset = (page - 1) * limit;

    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return rows;
  }
}

module.exports = new PropertyRepository();
