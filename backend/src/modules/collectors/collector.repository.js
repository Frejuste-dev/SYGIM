/**
 * Module   : Collectors
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Persistence pour les récolteurs/agents
 */

const { pool: db } = require('../../config/database');

class CollectorRepository {
  /**
   * Liste paginée des collecteurs
   */
  async findAll(filters = {}, limit = 50, offset = 0, user = null) {
    let query = `SELECT c.*, u.username, u.email as user_email, u.phone as user_phone,
                   (SELECT COUNT(*) FROM properties p WHERE p.collector_id = c.id) as assignedPropsCount,
                   (SELECT COUNT(*) FROM clients cl WHERE cl.collector_id = c.id) as assignedClientsCount,
                   (SELECT COALESCE(SUM(amount_due), 0) FROM clients cl WHERE cl.collector_id = c.id) as totalDue,
                   (SELECT COALESCE(SUM(amount), 0) FROM transactions t WHERE t.collector_id = c.id AND t.status IN ('processed', 'paid') AND DATE_FORMAT(COALESCE(t.date, t.created_at), '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')) as totalCollected
                 FROM collectors c
                 LEFT JOIN users u ON c.user_id = u.id
                 WHERE c.deletedAt IS NULL`;
    const params = [];

    if (filters.active !== undefined && filters.active !== 'all') {
      query += ' AND c.active = ?';
      params.push(filters.active ? 1 : 0);
    }

    if (filters.search) {
      query += ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.zone LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }

    if (user && user.role === 'collector_manager') {
      query += ' AND c.manager_id = ?';
      params.push(user.id);
    }

    query += ' ORDER BY c.last_name, c.first_name LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  /**
   * Comptage pour pagination
   */
  async count(filters = {}, user = null) {
    let query = 'SELECT COUNT(*) as total FROM collectors WHERE deletedAt IS NULL';
    const params = [];

    if (filters.active !== undefined && filters.active !== 'all') {
      query += ' AND active = ?';
      params.push(filters.active ? 1 : 0);
    }

    if (user && user.role === 'collector_manager') {
      query += ' AND manager_id = ?';
      params.push(user.id);
    }

    const [rows] = await db.query(query, params);
    return rows[0].total;
  }

  /**
   * Recherche par ID
   */
  async findById(id) {
    const [rows] = await db.query(
      `SELECT c.*, u.username, u.email as user_email, u.phone as user_phone
       FROM collectors c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.id = ? AND c.deletedAt IS NULL`,
      [id]
    );
    return rows[0];
  }

  /**
   * Recherche par User ID
   */
  async findByUserId(userId) {
    const [rows] = await db.query(
      `SELECT c.*, u.username, u.email as user_email, u.phone as user_phone
       FROM collectors c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.user_id = ? AND c.deletedAt IS NULL`,
      [userId]
    );
    return rows[0] || null;
  }

  /**
   * Collecteurs liés à un propriétaire
   */
  async findByOwnerId(ownerId) {
    // Les collecteurs sont liés via les propriétés des propriétaires
    const [rows] = await db.query(
      `SELECT DISTINCT c.* 
       FROM collectors c
       JOIN properties p ON c.id = p.collector_id
       WHERE p.owner_id = ? AND c.deletedAt IS NULL`,
      [ownerId]
    );
    return rows;
  }

  /**
   * Création
   */
  async create(data) {
    const [result] = await db.query(
      `INSERT INTO collectors (first_name, last_name, phone, email, zone, user_id, active, manager_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.firstName || '',
        data.lastName,
        data.phone || null,
        data.email || null,
        data.zone || null,
        data.userId || null,
        data.active !== undefined ? data.active : 1,
        data.managerId || null
      ]
    );
    return { primaryKey: result.insertId, ...data };
  }

  /**
   * Mise à jour
   */
  async update(id, data) {
    const fields = [];
    const values = [];
    const fieldMap = {
      firstName: 'first_name',
      lastName: 'last_name',
      phone: 'phone',
      email: 'email',
      zone: 'zone',
      active: 'active',
      userId: 'user_id',
      managerId: 'manager_id'
    };

    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) {
      return null;
    }

    values.push(id);
    await db.query(`UPDATE collectors SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  /**
   * Suppression logique
   */
  async softDelete(id) {
    await db.query('UPDATE collectors SET deletedAt = NOW(), active = 0 WHERE id = ?', [id]);
  }

  /**
   * Collector + statistiques agrégées
   */
  async findWithStats(id) {
    const [rows] = await db.query(
      `SELECT 
        c.*,
        COUNT(t.id) as transactionCount,
        COALESCE(SUM(t.amount), 0) as totalCollected
       FROM collectors c
       LEFT JOIN transactions t ON c.id = t.collector_id AND t.status = 'processed'
       WHERE c.id = ? AND c.deletedAt IS NULL
       GROUP BY c.id`,
      [id]
    );
    return rows[0];
  }

  /**
   * Assigner des propriétés à un collecteur
   */
  async assignProperties(collectorId, propertyIds) {
    await db.query('UPDATE properties SET collector_id = ? WHERE id IN (?)', [collectorId, propertyIds]);
  }

  /**
   * Vérifier si le collecteur a des transactions actives
   */
  async hasActiveTransactions(id) {
    const [rows] = await db.query(
      'SELECT COUNT(*) as count FROM transactions WHERE collector_id = ? AND status = "processed" LIMIT 1',
      [id]
    );
    return rows[0].count > 0;
  }
}

module.exports = new CollectorRepository();
