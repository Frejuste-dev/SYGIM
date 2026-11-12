const { pool } = require('../../config/database');

class RepairRepository {
  async findAll(filters = {}) {
    let sql = `
      SELECT tr.*, 
             c.first_name AS client_first_name, 
             c.last_name AS client_last_name, 
             c.phone AS client_phone,
             p.name AS property_name, 
             p.address AS property_address,
             CONCAT(col.first_name, ' ', col.last_name) AS collector_name
      FROM tenant_repairs tr
      JOIN clients c ON tr.client_id = c.id
      LEFT JOIN properties p ON tr.property_id = p.id
      LEFT JOIN collectors col ON tr.collector_id = col.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.clientId) {
      sql += ' AND tr.client_id = ?';
      params.push(filters.clientId);
    }
    if (filters.propertyId) {
      sql += ' AND tr.property_id = ?';
      params.push(filters.propertyId);
    }
    if (filters.collectorId) {
      sql += ' AND tr.collector_id = ?';
      params.push(filters.collectorId);
    }
    if (filters.status && filters.status !== 'all') {
      sql += ' AND tr.status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      sql += ' AND (tr.description LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR p.name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY tr.created_at DESC';

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT tr.*, 
              c.first_name AS client_first_name, 
              c.last_name AS client_last_name, 
              p.name AS property_name
       FROM tenant_repairs tr
       JOIN clients c ON tr.client_id = c.id
       LEFT JOIN properties p ON tr.property_id = p.id
       WHERE tr.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async findActiveByClientId(clientId) {
    const [rows] = await pool.query(
      `SELECT * FROM tenant_repairs 
       WHERE client_id = ? AND status = 'IN_PROGRESS' 
       ORDER BY id DESC LIMIT 1`,
      [clientId]
    );
    return rows[0] || null;
  }

  async create(data) {
    const totalCost = parseFloat(data.totalCost || data.total_cost || 0);
    const deductionMode = data.deductionMode || data.deduction_mode || 'monthly';
    let monthlyDeduction = parseFloat(data.monthlyDeduction || data.monthly_deduction || 0);
    if (deductionMode === 'immediate') {
      monthlyDeduction = totalCost;
    }

    const [result] = await pool.query(
      `INSERT INTO tenant_repairs 
       (client_id, property_id, collector_id, description, total_cost, deduction_mode, 
        monthly_deduction, reimbursed_amount, remaining_amount, repair_date, receipt_ref, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'IN_PROGRESS', ?)`,
      [
        data.clientId || data.client_id,
        data.propertyId || data.property_id || null,
        data.collectorId || data.collector_id || null,
        data.description,
        totalCost,
        deductionMode,
        monthlyDeduction,
        totalCost, // remaining starts at totalCost
        data.repairDate || data.repair_date || new Date().toISOString().slice(0, 10),
        data.receiptRef || data.receipt_ref || null,
        data.notes || null
      ]
    );

    return this.findById(result.insertId);
  }

  async update(id, data) {
    const fields = [];
    const values = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.reimbursed_amount !== undefined) {
      fields.push('reimbursed_amount = ?');
      values.push(data.reimbursed_amount);
    }
    if (data.remaining_amount !== undefined) {
      fields.push('remaining_amount = ?');
      values.push(data.remaining_amount);
    }
    if (data.monthly_deduction !== undefined) {
      fields.push('monthly_deduction = ?');
      values.push(data.monthly_deduction);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      values.push(data.notes);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await pool.query(`UPDATE tenant_repairs SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }
}

module.exports = new RepairRepository();

