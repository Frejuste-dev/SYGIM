const BaseRepository = require('../../../core/BaseRepository');
const { pool } = require('../../../../config/db');
const { randomUUID } = require('crypto');

class TenantCreditLedgerRepository extends BaseRepository {
  constructor() {
    super('tenant_credit_ledger');
  }

  /**
   * Obtient le solde courant (running_balance) avec verrouillage FOR UPDATE pour calcul atomique
   */
  async getLatestRunningBalance(clientId, connection = null, forUpdate = false) {
    const db = connection || pool;
    let sql = `
      SELECT running_balance 
      FROM tenant_credit_ledger 
      WHERE client_id = ? 
      ORDER BY id DESC 
      LIMIT 1
    `;
    if (forUpdate) {
      sql += ' FOR UPDATE';
    }
    const [rows] = await db.query(sql, [clientId]);
    return rows.length > 0 ? parseFloat(rows[0].running_balance) : 0.00;
  }

  /**
   * Ajoute une écriture au grand livre des avances
   */
  async appendEntry(entryData, connection = null) {
    const db = connection || pool;
    const uuid = entryData.uuid || randomUUID();

    const sql = `
      INSERT INTO tenant_credit_ledger (
        uuid, client_id, transaction_type, amount,
        running_balance, source_payment_id, consumed_invoice_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      uuid,
      entryData.client_id,
      entryData.transaction_type,
      entryData.amount,
      entryData.running_balance,
      entryData.source_payment_id || null,
      entryData.consumed_invoice_id || null
    ];

    const [result] = await db.query(sql, params);
    return { id: result.insertId, uuid, ...entryData };
  }
}

module.exports = new TenantCreditLedgerRepository();
