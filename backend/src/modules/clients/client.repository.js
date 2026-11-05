const BaseRepository = require('../../core/BaseRepository');
const { pool } = require('../../../config/db');

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

    const limit = parseInt(filters.limit || 20);
    const offset = (parseInt(filters.page || 1) - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async countAllWithCollector(filters = {}, userRole = null, userId = null) {
    let sql = `SELECT COUNT(*) as total
               FROM clients c
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

    const [rows] = await pool.query(sql, params);
    return rows[0].total;
  }

  async getFilteredStats(filters = {}, userRole = null, userId = null) {
    let sql = `SELECT 
                 COUNT(*) as totalClients,
                 COALESCE(SUM(amount_due), 0) as totalDue,
                 COALESCE(SUM(amount_paid), 0) as totalPaid,
                 SUM(CASE WHEN c.status IN ('pending', 'overdue', 'late', 'partial') THEN 1 ELSE 0 END) as overdueCount
               FROM clients c
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

    const [rows] = await pool.query(sql, params);
    return {
      totalClients: Number(rows[0].totalClients) || 0,
      totalDue: Number(rows[0].totalDue) || 0,
      totalPaid: Number(rows[0].totalPaid) || 0,
      overdueCount: Number(rows[0].overdueCount) || 0
    };
  }

  async findByPhone(phone, excludeId = 0) {
    const [rows] = await pool.query('SELECT id FROM clients WHERE phone = ? AND id != ?', [phone, excludeId]);
    return rows;
  }

  async findByEmail(email, excludeId = 0) {
    const [rows] = await pool.query('SELECT id FROM clients WHERE email = ? AND id != ?', [email, excludeId]);
    return rows;
  }

  async checkCollectorActive(collectorId) {
    const [rows] = await pool.query('SELECT id FROM collectors WHERE id = ? AND active = 1', [collectorId]);
    return rows.length > 0;
  }

  async createWithPropertyUpdate(clientData) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const columns = Object.keys(clientData).join(',');
      const placeholders = Object.keys(clientData).fill('?').join(',');

      const [insertResult] = await conn.query(
        `INSERT INTO clients (${columns}) VALUES (${placeholders})`,
        Object.values(clientData)
      );

      if (clientData.property_id) {
        await conn.query(
          'UPDATE properties SET status = \'loue\', tenant_id = ? WHERE id = ?',
          [insertResult.insertId, clientData.property_id]
        );
      }

      await conn.commit();
      return insertResult.insertId;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async deleteWithPropertyUpdate(id) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query('UPDATE properties SET status = \'vacant\', tenant_id = NULL WHERE tenant_id = ?', [id]);

      const [result] = await conn.query('DELETE FROM clients WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        throw new Error('NOT_FOUND');
      }

      await conn.commit();
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async replaceTenantAtomic(oldId, data, oldClient, property) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Marquer l'ancien locataire comme inactif
      await conn.query(
        'UPDATE clients SET status = \'inactive\', contract_end = ?, departure_reason = ?, departure_notes = ? WHERE id = ?',
        [data.endDate, data.departureReason, data.departureNotes || null, oldId]
      );

      // 2. Créer ou utiliser le nouveau locataire
      let newTenantId;
      let newTenantName;

      if (data.existingTenantId) {
        newTenantId = data.existingTenantId;
        const [existRows] = await conn.query('SELECT first_name, last_name FROM clients WHERE id = ?', [data.existingTenantId]);
        newTenantName = existRows[0] ? `${existRows[0].last_name} ${existRows[0].first_name}` : 'Inconnu';

        await conn.query(
          'UPDATE clients SET property_id = ?, property_name = ?, property_value = ?, amount_due = ?, collector_id = ? WHERE id = ?',
          [property.id, property.name, property.value, data.newRent, oldClient.collector_id, data.existingTenantId]
        );
      } else if (data.newTenant) {
        const joinDate = new Date().toLocaleDateString('fr-FR');
        const [insertResult] = await conn.query(
          `INSERT INTO clients (first_name, last_name, phone, email, address, property_id, property_name, 
           property_value, amount_due, amount_paid, status, collector_id, owner_id, contract_start, join_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?, ?)`,
          [
            data.newTenant.firstName || '', data.newTenant.lastName,
            data.newTenant.phone, data.newTenant.email || null,
            property.address, property.id, property.name,
            property.value, data.newRent, oldClient.collector_id,
            property.owner_id, data.newStartDate, joinDate
          ]
        );
        newTenantId = insertResult.insertId;
        newTenantName = `${data.newTenant.lastName} ${data.newTenant.firstName || ''}`.trim();
      }

      // 3. Mettre à jour la propriété
      await conn.query(
        'UPDATE properties SET tenant_id = ?, rent = ? WHERE id = ?',
        [newTenantId, data.newRent, property.id]
      );

      // 4. Créer une transaction de remplacement
      await conn.query(
        `INSERT INTO transactions (reference, date, client_name, description, amount, method, status, collector_id)
         VALUES (?, CURDATE(), ?, ?, 0, 'replacement', 'processed', ?)`,
        [
          `REPL-${oldId}-${newTenantId}`,
          newTenantName,
          `Remplacement locataire — ${oldClient.last_name} ${oldClient.first_name}`,
          oldClient.collector_id
        ]
      );

      await conn.commit();
      return { newTenantId };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }
}

module.exports = new ClientRepository();
