const BaseRepository = require('../../../core/BaseRepository');
const { pool } = require('../../../../config/db');
const { randomUUID } = require('crypto');

class OwnerSettlementRepository extends BaseRepository {
  constructor() {
    super('owner_settlements');
  }

  /**
   * Crée un règlement / reversement / préfinancement propriétaire
   */
  async createSettlement(settlementData, connection = null) {
    const db = connection || pool;
    const uuid = settlementData.uuid || randomUUID();

    const sql = `
      INSERT INTO owner_settlements (
        uuid, owner_id, property_id, period_start, period_end,
        expected_rent, total_collected, commission_rate, agency_commission,
        maintenance_deductions, net_owner_payout, amount_paid,
        payment_method, payout_mode, is_prefinanced, scheduled_date,
        status, payout_date, payout_reference, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      uuid,
      settlementData.owner_id,
      settlementData.property_id || null,
      settlementData.period_start,
      settlementData.period_end,
      settlementData.expected_rent || 0.00,
      settlementData.total_collected || 0.00,
      settlementData.commission_rate ?? 10.00,
      settlementData.agency_commission || 0.00,
      settlementData.maintenance_deductions || 0.00,
      settlementData.net_owner_payout || 0.00,
      settlementData.amount_paid ?? settlementData.net_owner_payout ?? 0.00,
      settlementData.payment_method || 'bank_transfer',
      settlementData.payout_mode || 'full',
      settlementData.is_prefinanced ? 1 : 0,
      settlementData.scheduled_date || null,
      settlementData.status || 'PAID',
      settlementData.payout_date || new Date(),
      settlementData.payout_reference || `REV-${Date.now().toString().slice(-6)}`,
      settlementData.notes || null,
      settlementData.created_by || null
    ];

    const [result] = await db.query(sql, params);
    const settlementId = result.insertId;
    const paidAmt = parseFloat(settlementData.amount_paid ?? settlementData.net_owner_payout ?? 0);

    if (paidAmt > 0) {
      await db.query(
        `INSERT INTO owner_settlement_installments
         (settlement_id, installment_number, amount, payment_method, payment_date, reference, notes, created_by)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?)`,
        [
          settlementId,
          paidAmt,
          settlementData.payment_method || 'bank_transfer',
          settlementData.payout_date || new Date(),
          settlementData.payout_reference || `TR1-${settlementId}`,
          settlementData.payout_mode === 'installment' ? (settlementData.notes || '1ère tranche (Acompte)') : (settlementData.notes || 'Règlement initial'),
          settlementData.created_by || null
        ]
      );
    }

    return { id: settlementId, uuid, ...settlementData };
  }

  /**
   * Liste tous les paiements propriétaires avec détails propriétaire et bien
   */
  async findAllWithDetails(filters = {}) {
    let sql = `
      SELECT os.*,
             o.first_name AS owner_first_name,
             o.last_name AS owner_last_name,
             o.phone AS owner_phone,
             o.email AS owner_email,
             o.bank_name AS owner_bank_name,
             o.bank_account AS owner_bank_account,
             o.preferred_payment_method,
             o.payout_schedule,
             p.name AS property_name,
             p.address AS property_address
      FROM owner_settlements os
      JOIN owners o ON o.id = os.owner_id
      LEFT JOIN properties p ON p.id = os.property_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.owner_id) {
      sql += ' AND os.owner_id = ?';
      params.push(parseInt(filters.owner_id, 10));
    }

    if (filters.payout_mode) {
      sql += ' AND os.payout_mode = ?';
      params.push(filters.payout_mode);
    }

    if (filters.status) {
      sql += ' AND os.status = ?';
      params.push(filters.status);
    }

    if (filters.search) {
      sql += ' AND (o.first_name LIKE ? OR o.last_name LIKE ? OR os.payout_reference LIKE ? OR p.name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY os.created_at DESC';

    const [rows] = await pool.query(sql, params);
    if (rows.length > 0) {
      const ids = rows.map(r => r.id);
      const [instRows] = await pool.query(
        `SELECT * FROM owner_settlement_installments WHERE settlement_id IN (?) ORDER BY installment_number ASC, id ASC`,
        [ids]
      );
      const bySettlement = {};
      for (const inst of instRows) {
        if (!bySettlement[inst.settlement_id]) bySettlement[inst.settlement_id] = [];
        bySettlement[inst.settlement_id].push(inst);
      }
      for (const r of rows) {
        r.installments = bySettlement[r.id] || [];
      }
    }
    return rows;
  }

  /**
   * Ajoute une tranche / un versement complémentaire ou solde le paiement échelonné
   */
  async markAsPaid(settlementId, payoutReference, additionalAmount = null, connection = null, extra = {}) {
    const db = connection || pool;
    const existing = await this.findById(settlementId);
    const currentPaid = parseFloat(existing.amount_paid || 0);
    const netDue = parseFloat(existing.net_owner_payout || 0);
    const remaining = Math.max(0, netDue - currentPaid);

    const addedAmount = additionalAmount !== null && !isNaN(additionalAmount) && additionalAmount > 0
      ? parseFloat(additionalAmount)
      : remaining;

    const newAmountPaid = currentPaid + addedAmount;
    const newStatus = newAmountPaid >= netDue
      ? (existing.is_prefinanced ? 'PREFINANCED' : 'PAID')
      : 'PARTIAL';

    const [[{ cnt }]] = await db.query(
      'SELECT COUNT(*) AS cnt FROM owner_settlement_installments WHERE settlement_id = ?',
      [settlementId]
    );
    const nextNumber = (cnt || 0) + 1;
    const method = extra.payment_method || existing.payment_method || 'bank_transfer';
    const ref = payoutReference || `TR${nextNumber}-${Date.now().toString().slice(-5)}`;
    const notes = extra.notes || `Versement tranche N°${nextNumber}`;

    if (addedAmount > 0) {
      await db.query(
        `INSERT INTO owner_settlement_installments
         (settlement_id, installment_number, amount, payment_method, payment_date, reference, notes, created_by)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`,
        [settlementId, nextNumber, addedAmount, method, ref, notes, extra.created_by || null]
      );
    }

    const sql = `
      UPDATE owner_settlements
      SET status = ?,
          amount_paid = ?,
          payment_method = ?,
          payout_date = CURRENT_TIMESTAMP,
          payout_reference = COALESCE(?, payout_reference)
      WHERE id = ?
    `;
    const [result] = await db.query(sql, [newStatus, newAmountPaid, method, ref, settlementId]);
    return result.affectedRows > 0;
  }
}

module.exports = new OwnerSettlementRepository();
