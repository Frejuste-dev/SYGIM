const BaseRepository = require('../../../core/BaseRepository');
const { pool } = require('../../../../config/db');
const { randomUUID } = require('crypto');

class OwnerSettlementRepository extends BaseRepository {
  constructor() {
    super('owner_settlements');
  }

  /**
   * Crée un décompte de gérance
   */
  async createSettlement(settlementData, connection = null) {
    const db = connection || pool;
    const uuid = settlementData.uuid || randomUUID();

    const sql = `
      INSERT INTO owner_settlements (
        uuid, owner_id, period_start, period_end,
        total_collected, commission_rate, agency_commission,
        maintenance_deductions, net_owner_payout, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      uuid,
      settlementData.owner_id,
      settlementData.period_start,
      settlementData.period_end,
      settlementData.total_collected,
      settlementData.commission_rate,
      settlementData.agency_commission,
      settlementData.maintenance_deductions || 0.00,
      settlementData.net_owner_payout,
      settlementData.status || 'CALCULATED'
    ];

    const [result] = await db.query(sql, params);
    return { id: result.insertId, uuid, ...settlementData };
  }

  /**
   * Valide et marque le décompte comme payé avec référence bancaire
   */
  async markAsPaid(settlementId, payoutReference, connection = null) {
    const db = connection || pool;
    const sql = `
      UPDATE owner_settlements
      SET status = 'PAID',
          payout_date = CURRENT_TIMESTAMP,
          payout_reference = ?
      WHERE id = ?
    `;
    const [result] = await db.query(sql, [payoutReference, settlementId]);
    return result.affectedRows > 0;
  }
}

module.exports = new OwnerSettlementRepository();
