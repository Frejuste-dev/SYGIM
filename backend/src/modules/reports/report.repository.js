/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Persistence et agrégations SQL pour les rapports
 */

const { pool: db } = require('../../../config/db');

class ReportRepository {
  /**
   * Résumé des transactions par période
   * GROUP BY method, status
   */
  async getTransactionSummary({ startDate, endDate, ownerId, collectorId }) {
    let query = `
      SELECT 
        method,
        status,
        SUM(amount) as totalAmount,
        COUNT(*) as transactionCount
      FROM transactions
      WHERE date BETWEEN ? AND ?`;
    const params = [startDate, endDate];

    if (ownerId) {
      query += ` AND property_id IN (SELECT id FROM properties WHERE owner_id = ?)`;
      params.push(ownerId);
    }

    if (collectorId) {
      query += ` AND collector_id = ?`;
      params.push(collectorId);
    }

    query += ` GROUP BY method, status`;

    const [rows] = await db.query(query, params);
    return rows;
  }

  /**
   * Performance des collecteurs
   * GROUP BY collector_id
   */
  async getCollectorPerformance({ startDate, endDate }) {
    const [rows] = await db.query(
      `SELECT 
        c.id as collectorId,
        CONCAT(c.first_name, ' ', c.last_name) as collectorName,
        COUNT(t.id) as transactionCount,
        COALESCE(SUM(t.amount), 0) as totalCollected
       FROM collectors c
       LEFT JOIN transactions t ON c.id = t.collector_id 
          AND t.date BETWEEN ? AND ? 
          AND t.status = 'processed'
       WHERE c.deletedAt IS NULL
       GROUP BY c.id
       ORDER BY totalCollected DESC`,
      [startDate, endDate]
    );
    return rows;
  }

  /**
   * Taux d'occupation des propriétés
   * GROUP BY status
   */
  async getPropertyOccupancy({ ownerId }) {
    let query = `
      SELECT 
        status,
        COUNT(*) as count,
        SUM(rent) as totalRent
      FROM properties
      WHERE active = 1`;
    const params = [];

    if (ownerId) {
      query += ` AND owner_id = ?`;
      params.push(ownerId);
    }

    query += ` GROUP BY status`;

    const [rows] = await db.query(query, params);
    return rows;
  }

  /**
   * Revenus agrégés par propriétaire
   */
  async getRevenueByOwner({ startDate, endDate, ownerId }) {
    let query = `
      SELECT 
        o.id as ownerId,
        CONCAT(o.first_name, ' ', o.last_name) as ownerName,
        SUM(t.amount) as revenue
      FROM owners o
      JOIN properties p ON o.id = p.owner_id
      JOIN transactions t ON p.id = t.property_id
      WHERE t.date BETWEEN ? AND ? AND t.status = 'processed'`;
    const params = [startDate, endDate];

    if (ownerId) {
      query += ` AND o.id = ?`;
      params.push(ownerId);
    }

    query += ` GROUP BY o.id`;

    const [rows] = await db.query(query, params);
    return rows;
  }

  /**
   * Tendances mensuelles (données pour graphiques)
   */
  async getMonthlyTrends(year) {
    const [rows] = await db.query(
      `SELECT 
        MONTH(date) as month,
        SUM(amount) as total,
        COUNT(*) as count
       FROM transactions
       WHERE YEAR(date) = ? AND status = 'processed'
       GROUP BY MONTH(date)
       ORDER BY month`,
      [year]
    );
    return rows;
  }

  /**
   * Détails des transactions pour export
   */
  async getDetailedTransactions({ startDate, endDate, ownerId, collectorId, propertyId }) {
    let query = `
      SELECT 
        t.id, t.reference, t.date, t.amount, t.method, t.status, t.payment_type,
        p.name as propertyName,
        CONCAT(c.first_name, ' ', c.last_name) as collectorName
      FROM transactions t
      LEFT JOIN properties p ON t.property_id = p.id
      LEFT JOIN collectors c ON t.collector_id = c.id
      WHERE t.date BETWEEN ? AND ?`;
    const params = [startDate, endDate];

    if (ownerId) {
      query += ` AND p.owner_id = ?`;
      params.push(ownerId);
    }
    if (collectorId) {
      query += ` AND t.collector_id = ?`;
      params.push(collectorId);
    }
    if (propertyId) {
      query += ` AND t.property_id = ?`;
      params.push(propertyId);
    }

    query += ` ORDER BY t.date DESC`;

    const [rows] = await db.query(query, params);
    return rows;
  }
}

module.exports = new ReportRepository();
