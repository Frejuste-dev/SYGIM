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

      // Récupérer les locataires et unités pour chaque propriétaire/bien
      const ownerIds = [...new Set(rows.map(r => r.owner_id).filter(Boolean))];
      const unitsByOwner = {};
      if (ownerIds.length > 0) {
        try {
          const [unitRows] = await pool.query(
            `SELECT 
               p.id AS property_id,
               p.name AS property_name,
               p.address AS property_address,
               p.owner_id,
               COALESCE(p.rent, 0) AS property_rent,
               c.id AS tenant_id,
               CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) AS tenant_name,
               c.phone AS tenant_phone,
               COALESCE(c.amount_due, 0) AS tenant_due,
               COALESCE(c.amount_paid, 0) AS tenant_paid
             FROM properties p
             LEFT JOIN clients c ON (c.property_id = p.id AND c.status != 'departed')
             WHERE p.owner_id IN (?)
             ORDER BY p.name ASC`,
            [ownerIds]
          );
          for (const u of unitRows) {
            if (!unitsByOwner[u.owner_id]) unitsByOwner[u.owner_id] = [];
            const isVacant = !u.tenant_id;
            const expRent = Number(u.property_rent || u.tenant_due || 0);
            const colRent = Number(u.tenant_paid || 0);
            const arr = Math.max(0, Number(u.tenant_due || expRent) - colRent);
            unitsByOwner[u.owner_id].push({
              property_id: u.property_id,
              property_name: u.property_name,
              property_address: u.property_address,
              tenant_id: u.tenant_id,
              tenant_name: isVacant ? 'Logement vacant' : u.tenant_name.trim(),
              tenant_phone: u.tenant_phone || '',
              is_vacant: isVacant,
              expected_rent: expRent,
              collected_rent: colRent,
              arrears: arr,
              prefinanced_amount: 0
            });
          }
        } catch (err) {
          console.error('Erreur chargement unités settlement:', err);
        }
      }

      for (const r of rows) {
        r.installments = bySettlement[r.id] || [];
        const ownerUnits = unitsByOwner[r.owner_id] || [];
        if (r.property_id) {
          const matched = ownerUnits.filter(u => u.property_id === r.property_id);
          r.units = matched.length > 0 ? matched : [{
            property_id: r.property_id,
            property_name: r.property_name || 'Bien immobilier',
            tenant_name: 'Locataire en cours',
            tenant_phone: '',
            is_vacant: false,
            expected_rent: Number(r.expected_rent || 0),
            collected_rent: Number(r.total_collected || 0),
            arrears: Math.max(0, Number(r.expected_rent || 0) - Number(r.total_collected || 0)),
            prefinanced_amount: r.is_prefinanced ? Number(r.amount_paid || 0) : 0
          }];
        } else {
          r.units = ownerUnits;
        }
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
