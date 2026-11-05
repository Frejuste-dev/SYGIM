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
      query += ' AND property_id IN (SELECT id FROM properties WHERE owner_id = ?)';
      params.push(ownerId);
    }

    if (collectorId) {
      query += ' AND collector_id = ?';
      params.push(collectorId);
    }

    query += ' GROUP BY method, status';

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
      WHERE 1=1`;
    const params = [];

    if (ownerId) {
      query += ' AND owner_id = ?';
      params.push(ownerId);
    }

    query += ' GROUP BY status';

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
      query += ' AND o.id = ?';
      params.push(ownerId);
    }

    query += ' GROUP BY o.id';

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
      query += ' AND p.owner_id = ?';
      params.push(ownerId);
    }
    if (collectorId) {
      query += ' AND t.collector_id = ?';
      params.push(collectorId);
    }
    if (propertyId) {
      query += ' AND t.property_id = ?';
      params.push(propertyId);
    }

    query += ' ORDER BY t.date DESC';

    const [rows] = await db.query(query, params);
    return rows;
  }
  /**
   * KPIs scalaires pour le Dashboard
   * Une seule requête multi-agrégat, calculée en SQL
   */
  async getKpis() {
    // Phase 1 : Montant attendu et statuts depuis la table clients
    const [[clientStats]] = await db.query(`
      SELECT
        COALESCE(SUM(amount_due), 0)    AS totalDue,
        COUNT(*)                         AS totalClients,
        SUM(CASE WHEN status IN ('pending', 'overdue', 'late', 'partial') THEN 1 ELSE 0 END) AS pendingPaymentsCount
      FROM clients
    `);

    // Phase 2 : Montant encaissé filtré temporellement sur le mois courant
    const [[transactionStats]] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS totalRevenue
      FROM transactions
      WHERE status IN ('paid', 'processed', 'completed', 'partiel', 'partial')
        AND YEAR(date) = YEAR(CURRENT_DATE())
        AND MONTH(date) = MONTH(CURRENT_DATE())
    `);

    const [[propertyStats]] = await db.query(`
      SELECT
        COUNT(*) AS totalProperties,
        SUM(CASE WHEN status IN ('loue', 'partiel') OR tenant_id IS NOT NULL THEN 1 ELSE 0 END) AS occupiedCount
      FROM properties
    `);

    const totalRevenue      = Number(transactionStats.totalRevenue) || 0;
    const totalDue          = Number(clientStats.totalDue)          || 0;
    const totalClients      = Number(clientStats.totalClients)      || 0;
    const pendingPaymentsCount = Number(clientStats.pendingPaymentsCount) || 0;
    const totalProperties   = Number(propertyStats.totalProperties) || 0;
    const occupiedCount     = Number(propertyStats.occupiedCount)   || 0;

    // Phase 3 : Le ratio brut (peut dépasser 100 si arriérés payés)
    const rawRate = totalDue > 0 ? Math.round((totalRevenue / totalDue) * 100) : 0;
    
    // Plafonné à 100% pour la sécurité métier et l'affichage (AccountingDashboard / AdminDashboard)
    const collectionRate = Math.min(rawRate, 100);

    return {
      totalRevenue,
      totalDue,
      totalClients,
      pendingPaymentsCount,
      collectionRate,
      rawCollectionRate: rawRate,
      totalProperties,
      occupiedCount,
      occupancyRate: totalProperties > 0 ? Math.round((occupiedCount / totalProperties) * 100) : 0,
    };
  }
}

module.exports = new ReportRepository();
