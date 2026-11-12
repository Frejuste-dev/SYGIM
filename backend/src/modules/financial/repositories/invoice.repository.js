const BaseRepository = require('../../../core/BaseRepository');
const { pool } = require('../../../config/database');
const { randomUUID } = require('crypto');

class InvoiceRepository extends BaseRepository {
  constructor() {
    super('invoices');
  }

  /**
   * Crée une facture avec génération automatique d'UUID si omis
   */
  async createInvoice(invoiceData, connection = null) {
    const db = connection || pool;
    const uuid = invoiceData.uuid || randomUUID();
    
    const sql = `
      INSERT INTO invoices (
        uuid, invoice_number, client_id, property_id,
        invoice_type, billing_period_start, billing_period_end,
        contract_rent_applied, base_amount, total_amount, paid_amount,
        status, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      uuid,
      invoiceData.invoice_number,
      invoiceData.client_id,
      invoiceData.property_id || null,
      invoiceData.invoice_type,
      invoiceData.billing_period_start,
      invoiceData.billing_period_end,
      invoiceData.contract_rent_applied,
      invoiceData.base_amount,
      invoiceData.total_amount,
      invoiceData.paid_amount || 0.00,
      invoiceData.status || 'PENDING',
      invoiceData.due_date
    ];

    const [result] = await db.query(sql, params);
    return { id: result.insertId, uuid, ...invoiceData };
  }

  /**
   * Récupère les factures impayées d'un client dans l'ordre chronologique strict (FIFO, FIN-002)
   * avec support de verrouillage pessimiste sous transaction
   */
  async findUnpaidInvoicesFIFO(clientId, connection = null, forUpdate = false) {
    const db = connection || pool;
    let sql = `
      SELECT * FROM invoices
      WHERE client_id = ? AND status IN ('PENDING', 'PARTIALLY_PAID') AND balance_due > 0
      ORDER BY due_date ASC, id ASC
    `;
    if (forUpdate) {
      sql += ' FOR UPDATE';
    }
    const [rows] = await db.query(sql, [clientId]);
    return rows;
  }

  /**
   * Met à jour le montant réglé et le statut d'une facture sous transaction
   */
  async applyPaymentAllocation(invoiceId, additionalAmount, connection = null) {
    const db = connection || pool;
    
    const updateSql = `
      UPDATE invoices
      SET paid_amount = paid_amount + ?,
          status = CASE
            WHEN paid_amount >= total_amount THEN 'PAID'
            ELSE 'PARTIALLY_PAID'
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    const [result] = await db.query(updateSql, [additionalAmount, invoiceId]);
    return result.affectedRows > 0;
  }

  /**
   * Annulation d'une facture avec motif (FIN-007)
   */
  async cancelInvoice(invoiceId, reason, connection = null) {
    const db = connection || pool;
    const sql = `
      UPDATE invoices
      SET status = 'CANCELLED',
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    const [result] = await db.query(sql, [reason, invoiceId]);
    return result.affectedRows > 0;
  }
}

module.exports = new InvoiceRepository();
