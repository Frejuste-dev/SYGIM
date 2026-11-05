const BaseRepository = require('../../../core/BaseRepository');
const { pool } = require('../../../../config/db');
const { randomUUID } = require('crypto');

class PaymentAllocationRepository extends BaseRepository {
  constructor() {
    super('payment_allocations');
  }

  /**
   * Crée une imputation unitaire
   */
  async createAllocation(allocationData, connection = null) {
    const db = connection || pool;
    const uuid = allocationData.uuid || randomUUID();

    const sql = `
      INSERT INTO payment_allocations (
        uuid, payment_id, invoice_id, allocated_amount, status
      ) VALUES (?, ?, ?, ?, ?)
    `;

    const params = [
      uuid,
      allocationData.payment_id,
      allocationData.invoice_id,
      allocationData.allocated_amount,
      allocationData.status || 'ACTIVE'
    ];

    const [result] = await db.query(sql, params);
    return { id: result.insertId, uuid, ...allocationData };
  }

  /**
   * Récupère et verrouille les allocations ACTIVES d'un paiement donné (SEC-004-B)
   * @param {number} paymentId
   * @param {Object} connection - Connexion transactionnelle mysql2
   * @param {boolean} forUpdate - Verrouiller les lignes avec FOR UPDATE
   */
  async findActiveByPaymentId(paymentId, connection = null, forUpdate = false) {
    const db = connection || pool;
    let sql = `
      SELECT pa.*, i.invoice_number, i.billing_period_start, i.billing_period_end
      FROM payment_allocations pa
      JOIN invoices i ON i.id = pa.invoice_id
      WHERE pa.payment_id = ? AND pa.status = 'ACTIVE'
    `;
    if (forUpdate) {
      sql += ' FOR UPDATE';
    }
    const [rows] = await db.query(sql, [paymentId]);
    return rows;
  }

  /**
   * Récupère toutes les allocations d'un paiement donné
   */
  async findByPaymentId(paymentId, connection = null) {
    const db = connection || pool;
    const sql = `
      SELECT pa.*, i.invoice_number, i.billing_period_start, i.billing_period_end
      FROM payment_allocations pa
      JOIN invoices i ON i.id = pa.invoice_id
      WHERE pa.payment_id = ?
    `;
    const [rows] = await db.query(sql, [paymentId]);
    return rows;
  }

  /**
   * Extourne les allocations associées à un paiement
   */
  async reverseAllocationsByPaymentId(paymentId, connection = null) {
    const db = connection || pool;
    const sql = `
      UPDATE payment_allocations
      SET status = 'REVERSED'
      WHERE payment_id = ? AND status = 'ACTIVE'
    `;
    const [result] = await db.query(sql, [paymentId]);
    return result.affectedRows;
  }
}

module.exports = new PaymentAllocationRepository();
