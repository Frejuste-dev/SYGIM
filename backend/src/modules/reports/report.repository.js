/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Persistence et agrégations SQL pour les rapports & analytics
 */

const { pool: db } = require('../../../config/db');

class ReportRepository {
  /**
   * Synthèse complète pour la page Rapports & Analyses (Vue d'ensemble)
   */
  async getTransactionSummary({ startDate, endDate, ownerId, collectorId } = {}) {
    const dateFilterTx = [];
    const txParams = [];

    if (startDate) {
      dateFilterTx.push('DATE(COALESCE(t.date, t.created_at)) >= ?');
      txParams.push(startDate);
    }
    if (endDate) {
      dateFilterTx.push('DATE(COALESCE(t.date, t.created_at)) <= ?');
      txParams.push(endDate);
    }
    if (ownerId) {
      dateFilterTx.push('p.owner_id = ?');
      txParams.push(ownerId);
    }
    if (collectorId) {
      dateFilterTx.push('t.collector_id = ?');
      txParams.push(collectorId);
    }

    const whereTx = dateFilterTx.length > 0 ? `AND ${dateFilterTx.join(' AND ')}` : '';

    // 1. Total revenus & nombre de transactions validées
    const [[revRow]] = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN t.status IN ('processed', 'paid', 'completed', 'partial', 'partiel') THEN t.amount ELSE 0 END), 0) AS totalRevenue,
         COUNT(t.id) AS totalTransactions,
         SUM(CASE WHEN t.status IN ('processed', 'paid', 'completed') THEN 1 ELSE 0 END) AS processedTransactions
       FROM transactions t
       LEFT JOIN clients c ON c.id = t.client_id
       LEFT JOIN properties p ON p.id = c.property_id
       WHERE t.status != 'cancelled' ${whereTx}`,
      txParams
    );

    // 2. Occupation des biens & loyers mensuels attendus
    const [[propRow]] = await db.query(
      `SELECT
         COUNT(*) AS totalProperties,
         SUM(CASE WHEN status IN ('loue', 'partiel') OR tenant_id IS NOT NULL THEN 1 ELSE 0 END) AS occupiedCount,
         SUM(CASE WHEN status = 'vacant' AND tenant_id IS NULL THEN 1 ELSE 0 END) AS vacantCount,
         COALESCE(SUM(rent), 0) AS portfolioMonthlyRent,
         COALESCE(SUM(value), 0) AS portfolioTotalValue
       FROM properties
       ${ownerId ? 'WHERE owner_id = ?' : ''}`,
      ownerId ? [ownerId] : []
    );

    // 3. Créances / Impayés locataires
    const [[overdueRow]] = await db.query(
      `SELECT
         COALESCE(SUM(GREATEST(0, c.amount_due - COALESCE(c.amount_paid, 0))), 0) AS totalOverdue,
         COALESCE(SUM(c.amount_due), 0) AS totalExpectedRent,
         COALESCE(SUM(c.amount_paid), 0) AS totalPaidByClients,
         COUNT(CASE WHEN (c.amount_due - COALESCE(c.amount_paid, 0)) > 0 THEN 1 END) AS overdueClientsCount,
         COUNT(*) AS totalClients
       FROM clients c
       LEFT JOIN properties p ON p.id = c.property_id
       WHERE 1=1 ${ownerId ? 'AND p.owner_id = ?' : ''}`,
      ownerId ? [ownerId] : []
    );

    // 4. Reversements propriétaires & Préfinancements
    let settlementStats = {
      totalDisbursed: 0,
      totalPrefinanced: 0,
      activePrefinanced: 0,
      reimbursedPrefinanced: 0,
      totalCommission: 0,
      prefinancedCount: 0,
      settlementsCount: 0
    };
    try {
      const [[osRow]] = await db.query(
        `SELECT
           COUNT(*) AS settlementsCount,
           COALESCE(SUM(amount_paid), 0) AS totalDisbursed,
           COALESCE(SUM(agency_commission), 0) AS totalCommission,
           COALESCE(SUM(CASE WHEN is_prefinanced = 1 OR payout_mode = 'prefinancing' OR UPPER(status) IN ('PREFINANCED', 'REIMBURSED') THEN amount_paid ELSE 0 END), 0) AS totalPrefinanced,
           COALESCE(SUM(CASE WHEN (is_prefinanced = 1 OR payout_mode = 'prefinancing' OR UPPER(status) = 'PREFINANCED') AND UPPER(status) != 'REIMBURSED' THEN amount_paid ELSE 0 END), 0) AS activePrefinanced,
           COALESCE(SUM(CASE WHEN UPPER(status) = 'REIMBURSED' THEN amount_paid ELSE 0 END), 0) AS reimbursedPrefinanced,
           SUM(CASE WHEN is_prefinanced = 1 OR payout_mode = 'prefinancing' OR UPPER(status) IN ('PREFINANCED', 'REIMBURSED') THEN 1 ELSE 0 END) AS prefinancedCount
         FROM owner_settlements
         ${ownerId ? 'WHERE owner_id = ?' : ''}`,
        ownerId ? [ownerId] : []
      );
      if (osRow) {
        settlementStats = {
          settlementsCount: Number(osRow.settlementsCount || 0),
          totalDisbursed: Number(osRow.totalDisbursed || 0),
          totalCommission: Number(osRow.totalCommission || 0),
          totalPrefinanced: Number(osRow.totalPrefinanced || 0),
          activePrefinanced: Number(osRow.activePrefinanced || 0),
          reimbursedPrefinanced: Number(osRow.reimbursedPrefinanced || 0),
          prefinancedCount: Number(osRow.prefinancedCount || 0)
        };
      }
    } catch {
      // Table owner_settlements optionnelle si non initialisée
    }

    // 5. Répartition par mode de paiement
    const [byMethodRows] = await db.query(
      `SELECT
         COALESCE(t.method, 'cash') AS method,
         COUNT(*) AS count,
         COALESCE(SUM(t.amount), 0) AS totalAmount
       FROM transactions t
       LEFT JOIN clients c ON c.id = t.client_id
       LEFT JOIN properties p ON p.id = c.property_id
       WHERE t.status IN ('processed', 'paid', 'completed', 'partial', 'partiel') ${whereTx}
       GROUP BY COALESCE(t.method, 'cash')
       ORDER BY totalAmount DESC`,
      txParams
    );

    // 6. Dernières transactions
    const [recentRows] = await db.query(
      `SELECT
         t.id,
         t.reference,
         COALESCE(NULLIF(TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))), ''), t.client_name, 'Locataire') AS client,
         COALESCE(p.name, c.property_name, '—') AS propertyName,
         t.amount,
         t.method,
         t.status,
         COALESCE(t.date, t.created_at) AS date
       FROM transactions t
       LEFT JOIN clients c ON c.id = t.client_id
       LEFT JOIN properties p ON p.id = c.property_id
       WHERE t.status != 'cancelled' ${whereTx}
       ORDER BY COALESCE(t.date, t.created_at) DESC, t.id DESC
       LIMIT 12`,
      txParams
    );

    const totalProperties = Number(propRow?.totalProperties || 0);
    const occupiedCount = Number(propRow?.occupiedCount || 0);
    const occupancyRate = totalProperties > 0 ? Math.round((occupiedCount / totalProperties) * 100) : 0;

    const totalRevenue = Number(revRow?.totalRevenue || 0);
    const totalExpectedRent = Number(overdueRow?.totalExpectedRent || 0);
    const collectionRate = totalExpectedRent > 0 ? Math.min(100, Math.round((totalRevenue / totalExpectedRent) * 100)) : 0;

    return {
      totalRevenue,
      totalTransactions: Number(revRow?.totalTransactions || 0),
      processedTransactions: Number(revRow?.processedTransactions || 0),
      occupancyRate,
      totalProperties,
      occupiedCount,
      vacantCount: Number(propRow?.vacantCount || 0),
      portfolioMonthlyRent: Number(propRow?.portfolioMonthlyRent || 0),
      portfolioTotalValue: Number(propRow?.portfolioTotalValue || 0),
      totalOverdue: Number(overdueRow?.totalOverdue || 0),
      totalExpectedRent,
      totalPaidByClients: Number(overdueRow?.totalPaidByClients || 0),
      overdueClientsCount: Number(overdueRow?.overdueClientsCount || 0),
      totalClients: Number(overdueRow?.totalClients || 0),
      collectionRate,
      ...settlementStats,
      byMethod: byMethodRows.map(r => ({
        method: r.method,
        count: Number(r.count || 0),
        totalAmount: Number(r.totalAmount || 0)
      })),
      recentTransactions: recentRows.map(r => ({
        id: r.id,
        reference: r.reference || `TX-${r.id}`,
        client: r.client,
        propertyName: r.propertyName,
        amount: Number(r.amount || 0),
        method: r.method || 'cash',
        status: r.status || 'processed',
        date: r.date
      }))
    };
  }

  /**
   * Performance des collecteurs
   * GROUP BY collector_id (sans filtrage destructif quand startDate/endDate sont absents)
   */
  async getCollectorPerformance({ startDate, endDate } = {}) {
    let txDateClause = '';
    const params = [];

    if (startDate) {
      txDateClause += ' AND DATE(COALESCE(t.date, t.created_at)) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      txDateClause += ' AND DATE(COALESCE(t.date, t.created_at)) <= ?';
      params.push(endDate);
    }

    const [rows] = await db.query(
      `SELECT 
        c.id AS collectorId,
        CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) AS collectorName,
        c.phone,
        c.zone,
        (SELECT COUNT(*) FROM properties p WHERE p.collector_id = c.id) AS assignedPropertiesCount,
        (SELECT COUNT(*) FROM clients cl WHERE cl.collector_id = c.id) AS assignedClientsCount,
        (SELECT COALESCE(SUM(cl.amount_due), 0) FROM clients cl WHERE cl.collector_id = c.id) AS targetAmount,
        COUNT(t.id) AS transactionCount,
        COALESCE(SUM(t.amount), 0) AS totalCollected
       FROM collectors c
       LEFT JOIN transactions t ON c.id = t.collector_id 
          AND t.status IN ('processed', 'paid', 'completed', 'partial', 'partiel')
          ${txDateClause}
       WHERE c.deletedAt IS NULL
       GROUP BY c.id
       ORDER BY totalCollected DESC, transactionCount DESC`,
      params
    );

    return rows.map(r => {
      const target = Number(r.targetAmount || 0);
      const collected = Number(r.totalCollected || 0);
      const recoveryRate = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : (collected > 0 ? 100 : 0);
      return {
        collectorId: r.collectorId,
        collectorName: (r.collectorName || '').trim() || `Collecteur #${r.collectorId}`,
        phone: r.phone || '—',
        zone: r.zone || 'Toutes zones',
        assignedPropertiesCount: Number(r.assignedPropertiesCount || 0),
        assignedClientsCount: Number(r.assignedClientsCount || 0),
        targetAmount: target,
        transactionCount: Number(r.transactionCount || 0),
        totalCollected: collected,
        remainingToCollect: Math.max(0, target - collected),
        recoveryRate
      };
    });
  }

  /**
   * Taux d'occupation des propriétés
   * GROUP BY status
   */
  async getPropertyOccupancy({ ownerId } = {}) {
    let query = `
      SELECT 
        status,
        COUNT(*) AS count,
        COALESCE(SUM(rent), 0) AS totalRent,
        COALESCE(SUM(value), 0) AS totalValue
      FROM properties
      WHERE 1=1`;
    const params = [];

    if (ownerId) {
      query += ' AND owner_id = ?';
      params.push(ownerId);
    }

    query += ' GROUP BY status ORDER BY count DESC';

    const [rows] = await db.query(query, params);
    const totalCount = rows.reduce((s, r) => s + Number(r.count || 0), 0);

    return rows.map(r => ({
      status: r.status || 'vacant',
      count: Number(r.count || 0),
      totalRent: Number(r.totalRent || 0),
      totalValue: Number(r.totalValue || 0),
      percentage: totalCount > 0 ? Math.round((Number(r.count || 0) / totalCount) * 100) : 0
    }));
  }

  /**
   * Rapport complet de Préfinancement & Reversements Propriétaires
   * - Synthèse des préfinancements (actifs, remboursés, total avancé, commissions)
   * - Journal détaillé des préfinancements accordés
   * - Dossiers de propriétaires dont les locataires sont en impayé (éligibles au préfinancement)
   */
  async getPrefinancingReport({ startDate, endDate, ownerId } = {}) {
    const whereClauses = [
      "(os.is_prefinanced = 1 OR os.payout_mode = 'prefinancing' OR UPPER(os.status) IN ('PREFINANCED', 'REIMBURSED'))"
    ];
    const params = [];

    if (startDate) {
      whereClauses.push('DATE(COALESCE(os.payout_date, os.created_at)) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      whereClauses.push('DATE(COALESCE(os.payout_date, os.created_at)) <= ?');
      params.push(endDate);
    }
    if (ownerId) {
      whereClauses.push('os.owner_id = ?');
      params.push(ownerId);
    }

    const [prefRows] = await db.query(
      `SELECT
         os.*,
         o.first_name AS owner_first_name,
         o.last_name AS owner_last_name,
         o.phone AS owner_phone,
         o.email AS owner_email,
         o.bank_name,
         o.bank_account,
         p.name AS property_name,
         p.address AS property_address
       FROM owner_settlements os
       JOIN owners o ON o.id = os.owner_id
       LEFT JOIN properties p ON p.id = os.property_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY COALESCE(os.payout_date, os.created_at) DESC, os.id DESC`,
      params
    );

    // Récupérer les tranches associées si existantes
    const settlementIds = prefRows.map(r => r.id);
    const installmentsBySettlement = {};
    if (settlementIds.length > 0) {
      try {
        const [instRows] = await db.query(
          `SELECT * FROM owner_settlement_installments WHERE settlement_id IN (?) ORDER BY installment_number ASC`,
          [settlementIds]
        );
        for (const inst of instRows) {
          if (!installmentsBySettlement[inst.settlement_id]) {
            installmentsBySettlement[inst.settlement_id] = [];
          }
          installmentsBySettlement[inst.settlement_id].push(inst);
        }
      } catch {
        // Table optionnelle
      }
    }

    let totalPrefinancedAmount = 0;
    let activePrefinancedAmount = 0;
    let reimbursedAmount = 0;
    let totalRecoveredFromTenants = 0;
    let totalAgencyCommission = 0;
    let activeCount = 0;
    let reimbursedCount = 0;

    const prefinancings = prefRows.map(row => {
      const expectedRent = Number(row.expected_rent || 0);
      const netOwnerPayout = Number(row.net_owner_payout || 0);
      const amountPaid = Number(row.amount_paid ?? netOwnerPayout);
      const recovered = Number(row.total_collected || 0);
      const commission = Number(row.agency_commission || 0);
      const isReimbursed = String(row.status || '').toUpperCase() === 'REIMBURSED' || (expectedRent > 0 && recovered >= expectedRent);
      const unrecoveredExposure = isReimbursed ? 0 : Math.max(0, amountPaid - recovered);

      totalPrefinancedAmount += amountPaid;
      totalAgencyCommission += commission;
      totalRecoveredFromTenants += Math.min(amountPaid, recovered);

      if (isReimbursed) {
        reimbursedAmount += amountPaid;
        reimbursedCount += 1;
      } else {
        activePrefinancedAmount += amountPaid;
        activeCount += 1;
      }

      const ownerName = `${row.owner_first_name || ''} ${row.owner_last_name || ''}`.trim() || `Propriétaire #${row.owner_id}`;

      return {
        id: row.id,
        reference: row.payout_reference || `PREF-${row.id}`,
        transaction_reference: row.payout_reference || `PREF-${row.id}`,
        owner_id: row.owner_id,
        owner_name: ownerName,
        owner_phone: row.owner_phone || '—',
        owner_email: row.owner_email || '—',
        bank_name: row.bank_name || '',
        bank_account: row.bank_account || '',
        property_id: row.property_id,
        property_name: row.property_name || 'Tous les biens du propriétaire',
        property_address: row.property_address || '',
        period_start: row.period_start,
        period_end: row.period_end,
        payout_date: row.payout_date || row.created_at,
        scheduled_date: row.scheduled_date,
        expected_rent: expectedRent,
        total_collected: recovered,
        commission_rate: Number(row.commission_rate || 10),
        agency_commission: commission,
        maintenance_deductions: Number(row.maintenance_deductions || 0),
        net_owner_payout: netOwnerPayout,
        net_amount: netOwnerPayout,
        amount_paid: amountPaid,
        unrecovered_amount: unrecoveredExposure,
        remaining_to_pay: Math.max(0, netOwnerPayout - amountPaid),
        payment_method: row.payment_method || 'bank_transfer',
        payout_mode: row.payout_mode || 'prefinancing',
        is_prefinanced: true,
        status: isReimbursed ? 'reimbursed' : 'prefinanced',
        notes: row.notes || 'Préfinancement agence sur loyer impayé',
        installments: installmentsBySettlement[row.id] || []
      };
    });

    // Dossiers éligibles au préfinancement : Locataires en retard rattachés à un bien ayant un propriétaire
    const [eligibleRows] = await db.query(
      `SELECT
         c.id AS client_id,
         CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) AS tenant_name,
         c.phone AS tenant_phone,
         c.status AS tenant_status,
         c.amount_due AS rent_due,
         COALESCE(c.amount_paid, 0) AS rent_paid,
         GREATEST(0, c.amount_due - COALESCE(c.amount_paid, 0)) AS tenant_arrears,
         p.id AS property_id,
         p.name AS property_name,
         p.address AS property_address,
         o.id AS owner_id,
         CONCAT(COALESCE(o.first_name, ''), ' ', COALESCE(o.last_name, '')) AS owner_name,
         o.phone AS owner_phone,
         COALESCE(o.preferred_payment_method, 'bank_transfer') AS preferred_payment_method,
         COALESCE(o.preferred_payout_day, '5') AS preferred_payout_day,
         COALESCE(o.commission_rate, 10) AS commission_rate
       FROM clients c
       JOIN properties p ON p.id = c.property_id
       JOIN owners o ON o.id = p.owner_id
       WHERE (c.amount_due - COALESCE(c.amount_paid, 0)) > 0
         ${ownerId ? 'AND o.id = ?' : ''}
       ORDER BY tenant_arrears DESC`,
      ownerId ? [ownerId] : []
    );

    const eligibleCases = eligibleRows.map(r => {
      const arrears = Number(r.tenant_arrears || 0);
      const commRate = Number(r.commission_rate || 10);
      const agencyComm = Math.round((arrears * commRate) / 100);
      const netPrefinanceSuggested = Math.max(0, arrears - agencyComm);
      return {
        client_id: r.client_id,
        tenant_name: (r.tenant_name || '').trim() || `Locataire #${r.client_id}`,
        tenant_phone: r.tenant_phone || '—',
        tenant_status: r.tenant_status || 'late',
        rent_due: Number(r.rent_due || 0),
        rent_paid: Number(r.rent_paid || 0),
        tenant_arrears: arrears,
        property_id: r.property_id,
        property_name: r.property_name || '—',
        property_address: r.property_address || '—',
        owner_id: r.owner_id,
        owner_name: (r.owner_name || '').trim() || `Propriétaire #${r.owner_id}`,
        owner_phone: r.owner_phone || '—',
        preferred_payment_method: r.preferred_payment_method,
        preferred_payout_day: r.preferred_payout_day,
        commission_rate: commRate,
        agency_commission: agencyComm,
        net_prefinance_suggested: netPrefinanceSuggested
      };
    });

    const totalEligibleArrears = eligibleCases.reduce((s, e) => s + e.tenant_arrears, 0);
    const totalSuggestedNetPrefinance = eligibleCases.reduce((s, e) => s + e.net_prefinance_suggested, 0);
    const reimbursementRate = totalPrefinancedAmount > 0
      ? Math.min(100, Math.round((reimbursedAmount / totalPrefinancedAmount) * 100))
      : 0;

    const summaryData = {
        totalPrefinancedAmount,
        activePrefinancedAmount,
        reimbursedAmount,
        totalRecoveredFromTenants,
        unrecoveredExposure: Math.max(0, totalPrefinancedAmount - reimbursedAmount),
        totalAgencyCommission,
        totalCount: prefinancings.length,
        activeCount,
        reimbursedCount,
        reimbursementRate,
        eligibleCount: eligibleCases.length,
        totalEligibleArrears,
        totalSuggestedNetPrefinance
      };

    return {
      summary: summaryData,
      kpis: summaryData,
      prefinancings,
      eligibleCases
    };
  }

  /**
   * Revenus agrégés par propriétaire
   */
  async getRevenueByOwner({ startDate, endDate, ownerId } = {}) {
    let query = `
      SELECT 
        o.id AS ownerId,
        CONCAT(COALESCE(o.first_name, ''), ' ', COALESCE(o.last_name, '')) AS ownerName,
        COALESCE(SUM(t.amount), 0) AS revenue
      FROM owners o
      JOIN properties p ON o.id = p.owner_id
      JOIN clients c ON p.id = c.property_id
      JOIN transactions t ON c.id = t.client_id
      WHERE t.status IN ('processed', 'paid', 'completed')`;
    const params = [];

    if (startDate) {
      query += ' AND DATE(COALESCE(t.date, t.created_at)) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(COALESCE(t.date, t.created_at)) <= ?';
      params.push(endDate);
    }
    if (ownerId) {
      query += ' AND o.id = ?';
      params.push(ownerId);
    }

    query += ' GROUP BY o.id ORDER BY revenue DESC';

    const [rows] = await db.query(query, params);
    return rows;
  }

  /**
   * Tendances mensuelles (données pour graphiques)
   */
  async getMonthlyTrends(year) {
    const targetYear = year || new Date().getFullYear();
    const [rows] = await db.query(
      `SELECT 
        MONTH(COALESCE(date, created_at)) AS month,
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS count
       FROM transactions
       WHERE YEAR(COALESCE(date, created_at)) = ? AND status IN ('processed', 'paid', 'completed')
       GROUP BY MONTH(COALESCE(date, created_at))
       ORDER BY month`,
      [targetYear]
    );
    return rows;
  }

  /**
   * Détails des transactions pour export
   */
  async getDetailedTransactions({ startDate, endDate, ownerId, collectorId, propertyId } = {}) {
    let query = `
      SELECT 
        t.id,
        t.reference,
        COALESCE(t.date, t.created_at) AS date,
        COALESCE(NULLIF(TRIM(CONCAT(COALESCE(cl.first_name, ''), ' ', COALESCE(cl.last_name, ''))), ''), t.client_name, 'Locataire') AS clientName,
        t.amount,
        t.method,
        t.status,
        COALESCE(p.name, cl.property_name, '—') AS propertyName,
        CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) AS collectorName
      FROM transactions t
      LEFT JOIN clients cl ON t.client_id = cl.id
      LEFT JOIN properties p ON cl.property_id = p.id
      LEFT JOIN collectors c ON t.collector_id = c.id
      WHERE t.status != 'cancelled'`;
    const params = [];

    if (startDate) {
      query += ' AND DATE(COALESCE(t.date, t.created_at)) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND DATE(COALESCE(t.date, t.created_at)) <= ?';
      params.push(endDate);
    }
    if (ownerId) {
      query += ' AND p.owner_id = ?';
      params.push(ownerId);
    }
    if (collectorId) {
      query += ' AND t.collector_id = ?';
      params.push(collectorId);
    }
    if (propertyId) {
      query += ' AND cl.property_id = ?';
      params.push(propertyId);
    }

    query += ' ORDER BY COALESCE(t.date, t.created_at) DESC';

    const [rows] = await db.query(query, params);
    return rows;
  }

  /**
   * KPIs scalaires pour le Dashboard
   */
  async getKpis() {
    const [[clientStats]] = await db.query(`
      SELECT
        COALESCE(SUM(amount_due), 0) AS totalDue,
        COUNT(*) AS totalClients,
        SUM(CASE WHEN status IN ('pending', 'overdue', 'late', 'partial') THEN 1 ELSE 0 END) AS pendingPaymentsCount
      FROM clients
    `);

    const [[transactionStats]] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS totalRevenue
      FROM transactions
      WHERE status IN ('paid', 'processed', 'completed', 'partiel', 'partial')
        AND YEAR(COALESCE(date, created_at)) = YEAR(CURRENT_DATE())
        AND MONTH(COALESCE(date, created_at)) = MONTH(CURRENT_DATE())
    `);

    const [[propertyStats]] = await db.query(`
      SELECT
        COUNT(*) AS totalProperties,
        SUM(CASE WHEN status IN ('loue', 'partiel') OR tenant_id IS NOT NULL THEN 1 ELSE 0 END) AS occupiedCount
      FROM properties
    `);

    const totalRevenue = Number(transactionStats.totalRevenue) || 0;
    const totalDue = Number(clientStats.totalDue) || 0;
    const totalClients = Number(clientStats.totalClients) || 0;
    const pendingPaymentsCount = Number(clientStats.pendingPaymentsCount) || 0;
    const totalProperties = Number(propertyStats.totalProperties) || 0;
    const occupiedCount = Number(propertyStats.occupiedCount) || 0;

    const rawRate = totalDue > 0 ? Math.round((totalRevenue / totalDue) * 100) : 0;
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
