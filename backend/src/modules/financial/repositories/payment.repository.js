const BaseRepository = require('../../../core/BaseRepository');
const { pool } = require('../../../../config/db');
const { randomUUID } = require('crypto');

class PaymentRepository extends BaseRepository {
  constructor() {
    super('payments');
  }

  /**
   * Enregistre un encaissement physique
   */
  async createPayment(paymentData, connection = null) {
    const db = connection || pool;
    const uuid = paymentData.uuid || randomUUID();
    const reference = paymentData.transaction_reference || randomUUID();

    const sql = `
      INSERT INTO payments (
        uuid, transaction_reference, receipt_number,
        client_id, collector_id, property_id,
        amount_received, payment_method, payment_date,
        status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      uuid,
      reference,
      paymentData.receipt_number || null,
      paymentData.client_id,
      paymentData.collector_id || null,
      paymentData.property_id || null,
      paymentData.amount_received,
      paymentData.payment_method,
      paymentData.payment_date || new Date(),
      paymentData.status || 'RECEIVED',
      paymentData.created_by
    ];

    const [result] = await db.query(sql, params);
    return { id: result.insertId, uuid, transaction_reference: reference, ...paymentData };
  }

  /**
   * Charge un paiement avec verrouillage exclusif (FOR UPDATE) au sein d'une transaction active (SEC-004-B)
   * @param {number} paymentId
   * @param {Object} connection - Connexion transactionnelle mysql2 obligatoire
   * @returns {Promise<Object|null>}
   */
  async findByIdForUpdate(paymentId, connection) {
    if (!connection) {
      throw new Error('Une connexion transactionnelle active est obligatoire pour findByIdForUpdate.');
    }
    const sql = 'SELECT * FROM payments WHERE id = ? FOR UPDATE';
    const [rows] = await connection.query(sql, [paymentId]);
    return rows[0] || null;
  }

  /**
   * Extourne formelle d'un paiement (FIN-006, FIN-007)
   */
  async reversePayment(paymentId, reversedByUserId, reason, connection = null) {
    const db = connection || pool;
    const sql = `
      UPDATE payments
      SET status = 'REVERSED',
          is_reversed = TRUE,
          reversed_at = CURRENT_TIMESTAMP,
          reversal_reason = ?,
          reversed_by = ?
      WHERE id = ? AND is_reversed = FALSE
    `;
    const [result] = await db.query(sql, [reason, reversedByUserId, paymentId]);
    return result.affectedRows > 0;
  }

  /**
   * Recherche par référence cryptographique
   */
  async findByReference(reference, connection = null) {
    const db = connection || pool;
    const [rows] = await db.query('SELECT * FROM payments WHERE transaction_reference = ? LIMIT 1', [reference]);
    return rows[0] || null;
  }
}

module.exports = new PaymentRepository();
