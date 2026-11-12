/**
 * Module   : Reports
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Persistence et agrégations SQL pour les rapports & analytics
 */

const { pool: db } = require('../../config/database');

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
      const osDateClauses = [];
      const osParams = [];
      if (ownerId) {
        osDateClauses.push('os.owner_id = ?');
        osParams.push(ownerId);
      }
      if (startDate) {
        osDateClauses.push('DATE(COALESCE(os.payout_date, os.period_start, os.created_at)) >= ?');
        osParams.push(startDate);
      }
      if (endDate) {
        osDateClauses.push('DATE(COALESCE(os.payout_date, os.period_start, os.created_at)) <= ?');
        osParams.push(endDate);
      }
      const osWhere = osDateClauses.length > 0 ? `WHERE ${osDateClauses.join(' AND ')}` : '';

      const [[osRow]] = await db.query(
        `SELECT
           COUNT(*) AS settlementsCount,
           COALESCE(SUM(amount_paid), 0) AS totalDisbursed,
           COALESCE(SUM(agency_commission), 0) AS totalCommission,
           COALESCE(SUM(CASE WHEN is_prefinanced = 1 OR payout_mode = 'prefinancing' OR UPPER(status) IN ('PREFINANCED', 'REIMBURSED') THEN amount_paid ELSE 0 END), 0) AS totalPrefinanced,
           COALESCE(SUM(CASE WHEN (is_prefinanced = 1 OR payout_mode = 'prefinancing' OR UPPER(status) = 'PREFINANCED') AND UPPER(status) != 'REIMBURSED' THEN amount_paid ELSE 0 END), 0) AS activePrefinanced,
           COALESCE(SUM(CASE WHEN UPPER(status) = 'REIMBURSED' THEN amount_paid ELSE 0 END), 0) AS reimbursedPrefinanced,
           SUM(CASE WHEN is_prefinanced = 1 OR payout_mode = 'prefinancing' OR UPPER(status) IN ('PREFINANCED', 'REIMBURSED') THEN 1 ELSE 0 END) AS prefinancedCount
         FROM owner_settlements os
         ${osWhere}`,
        osParams
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
         COALESCE(NULLIF(TRIM(CONCAT(COALESCE(cu.first_name, ''), ' ', COALESCE(cu.last_name, ''))), ''), col.zone, 'Agence') AS collectorName,
         t.amount,
         t.method,
         t.status,
         COALESCE(t.date, t.created_at) AS date
       FROM transactions t
       LEFT JOIN clients c ON c.id = t.client_id
       LEFT JOIN properties p ON p.id = c.property_id
       LEFT JOIN collectors col ON col.id = t.collector_id
       LEFT JOIN users cu ON cu.id = col.user_id
       WHERE t.status != 'cancelled' ${whereTx}
       ORDER BY COALESCE(t.date, t.created_at) DESC, t.id DESC
       LIMIT 25`,
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

    // Récupérer les locataires et unités pour chaque propriétaire/bien préfinancé
    const ownerIds = [...new Set(prefRows.map(r => r.owner_id).filter(Boolean))];
    const unitsByOwner = {};
    if (ownerIds.length > 0) {
      try {
        const [unitRows] = await db.query(
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
        console.error('Erreur chargement unités prefinancing:', err);
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

      const ownerUnits = unitsByOwner[row.owner_id] || [];
      const rowUnits = row.property_id
        ? (ownerUnits.filter(u => u.property_id === row.property_id).length > 0
            ? ownerUnits.filter(u => u.property_id === row.property_id)
            : [{
                property_id: row.property_id,
                property_name: row.property_name || 'Bien préfinancé',
                tenant_name: 'Locataire en retard',
                tenant_phone: '',
                is_vacant: false,
                expected_rent: expectedRent,
                collected_rent: recovered,
                arrears: unrecoveredExposure,
                prefinanced_amount: amountPaid
              }])
        : ownerUnits;

      if (rowUnits.length === 1 && amountPaid > 0) {
        rowUnits[0].prefinanced_amount = amountPaid;
      }

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
        installments: installmentsBySettlement[row.id] || [],
        units: rowUnits
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

  /**
   * Rapport hiérarchique Décompte Bailleurs & Locataires (Master-Detail)
   * Ligne Propriétaire: Loyer Global | Loyer Encaissé | Reste | Préfinancé | Commission | Net
   * Sous-lignes Locataires: Locataire | Bien | Loyer Attendu | Loyer Payé | Arriéré | Préfinancé
   */
  async getOwnerStatements({ month, startDate: qStartDate, endDate: qEndDate, search, ownerId } = {}) {
    let startDate = qStartDate;
    let endDate = qEndDate;
    let targetMonth = month;

    if (!startDate || !endDate) {
      targetMonth = month || new Date().toISOString().slice(0, 7); // e.g. '2026-11'
      const [yearStr, monthStr] = targetMonth.split('-');
      const year = parseInt(yearStr, 10);
      const monthNum = parseInt(monthStr, 10);
      startDate = `${targetMonth}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      endDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;
    } else {
      targetMonth = startDate.slice(0, 7);
    }

    // 1. Récupérer les propriétaires
    let ownersQuery = `
      SELECT 
        o.id,
        o.first_name,
        o.last_name,
        o.display_name,
        o.phone,
        o.email,
        o.bank_name,
        o.bank_account,
        o.preferred_payment_method,
        o.preferred_payout_day,
        COALESCE(o.commission_rate, 10) AS commission_rate
      FROM owners o
      WHERE o.active = 1
    `;
    const ownerParams = [];
    if (ownerId) {
      ownersQuery += ' AND o.id = ?';
      ownerParams.push(ownerId);
    }
    ownersQuery += ' ORDER BY o.last_name ASC, o.first_name ASC';
    const [ownersRows] = await db.query(ownersQuery, ownerParams);

    // 2. Récupérer tous les biens et leurs locataires (actifs ou ayant occupé/payé sur la période)
    const [propertyRows] = await db.query(`
      SELECT 
        p.id AS property_id,
        p.name AS property_name,
        p.address AS property_address,
        p.type AS property_type,
        p.status AS property_status,
        COALESCE(p.rent, 0) AS property_rent,
        p.commission_type,
        p.commission_rate,
        p.commission_fixed_amount,
        p.owner_id,
        c.id AS tenant_id,
        c.first_name AS tenant_first_name,
        c.last_name AS tenant_last_name,
        c.phone AS tenant_phone,
        c.status AS tenant_status,
        c.departure_date,
        COALESCE(c.amount_due, 0) AS tenant_amount_due,
        COALESCE(c.amount_paid, 0) AS tenant_amount_paid
      FROM properties p
      LEFT JOIN clients c ON (
        (c.property_id = p.id AND c.status != 'departed')
        OR (c.id = p.tenant_id)
        OR (
          c.departure_date >= ?
          AND (
            (SELECT property_id FROM tenant_repairs WHERE client_id = c.id ORDER BY id DESC LIMIT 1) = p.id
            OR (SELECT property_id FROM invoices WHERE client_id = c.id ORDER BY id DESC LIMIT 1) = p.id
          )
        )
      )
      ORDER BY p.name ASC
    `, [startDate]);

    // 3. Récupérer les encaissements réels validés sur la période pour chaque locataire / bien
    const [txRows] = await db.query(`
      SELECT 
        t.client_id,
        COALESCE(c.property_id, (SELECT property_id FROM tenant_repairs WHERE client_id = t.client_id ORDER BY id DESC LIMIT 1)) AS property_id,
        SUM(t.amount) AS total_collected
      FROM transactions t
      JOIN clients c ON c.id = t.client_id
      WHERE t.status IN ('processed', 'paid', 'completed')
        AND DATE(COALESCE(t.date, t.created_at)) >= ?
        AND DATE(COALESCE(t.date, t.created_at)) <= ?
      GROUP BY t.client_id, property_id
    `, [startDate, endDate]);

    const collectedByProperty = {};
    const collectedByClient = {};
    for (const tx of txRows) {
      if (tx.property_id) {
        collectedByProperty[tx.property_id] = (collectedByProperty[tx.property_id] || 0) + Number(tx.total_collected || 0);
      }
      if (tx.client_id) {
        collectedByClient[tx.client_id] = (collectedByClient[tx.client_id] || 0) + Number(tx.total_collected || 0);
      }
    }

    // 3. Récupérer les factures pour ce mois précis
    const [invoicesRows] = await db.query(`
      SELECT 
        property_id,
        client_id,
        total_amount,
        paid_amount,
        status
      FROM invoices
      WHERE DATE(billing_period_start) >= ? AND DATE(billing_period_start) <= ?
    `, [startDate, endDate]);

    const invoicesByProperty = {};
    for (const inv of invoicesRows) {
      invoicesByProperty[inv.property_id] = inv;
    }

    // 4. Récupérer les préfinancements pour ce mois
    const [prefinRows] = await db.query(`
      SELECT 
        owner_id,
        property_id,
        amount_paid,
        status,
        payout_reference
      FROM owner_settlements
      WHERE (is_prefinanced = 1 OR payout_mode = 'prefinancing')
        AND DATE(period_start) <= ? AND DATE(period_end) >= ?
    `, [endDate, startDate]);

    const prefinByProperty = {};
    const prefinByOwnerGeneral = {};
    for (const pref of prefinRows) {
      if (pref.property_id) {
        prefinByProperty[pref.property_id] = (prefinByProperty[pref.property_id] || 0) + Number(pref.amount_paid || 0);
      } else {
        prefinByOwnerGeneral[pref.owner_id] = (prefinByOwnerGeneral[pref.owner_id] || 0) + Number(pref.amount_paid || 0);
      }
    }

    // 4b. Récupérer les déductions travaux / réparations locataires sur la période
    const [repairsRows] = await db.query(`
      SELECT 
        tr.property_id,
        tr.client_id,
        tr.total_cost,
        tr.deduction_mode,
        tr.monthly_deduction,
        tr.reimbursed_amount,
        tr.remaining_amount,
        tr.status,
        p.owner_id
      FROM tenant_repairs tr
      JOIN properties p ON p.id = tr.property_id
      WHERE (tr.status = 'IN_PROGRESS' OR tr.status = 'SETTLED')
        AND (DATE(tr.created_at) <= ? OR DATE(tr.repair_date) <= ?)
    `, [endDate, endDate]);

    const repairsByProperty = {};
    const repairsByOwner = {};
    for (const r of repairsRows) {
      const val = r.deduction_mode === 'immediate'
        ? Number(r.reimbursed_amount || r.total_cost || 0)
        : Number(r.reimbursed_amount || r.monthly_deduction || 0);
      if (r.property_id) {
        repairsByProperty[r.property_id] = (repairsByProperty[r.property_id] || 0) + val;
      }
      if (r.owner_id) {
        repairsByOwner[r.owner_id] = (repairsByOwner[r.owner_id] || 0) + val;
      }
    }

    // 5. Indexer les biens par propriétaire
    const propertiesByOwner = {};
    for (const prop of propertyRows) {
      if (!propertiesByOwner[prop.owner_id]) {
        propertiesByOwner[prop.owner_id] = [];
      }
      propertiesByOwner[prop.owner_id].push(prop);
    }

    const searchLower = (search || '').trim().toLowerCase();

    // 6. Construire le tableau hiérarchique
    const statements = [];
    let globalExpected = 0;
    let globalCollected = 0;
    let globalArrears = 0;
    let globalPrefinanced = 0;
    let globalCommission = 0;
    let globalNetPayout = 0;

    for (const o of ownersRows) {
      const ownerProps = propertiesByOwner[o.id] || [];
      const units = [];
      let totalExpected = 0;
      let totalCollected = 0;
      let totalArrears = 0;
      let totalPrefinanced = prefinByOwnerGeneral[o.id] || 0;

      let matchedByTenant = false;

      for (const p of ownerProps) {
        const hasTenant = Boolean(p.tenant_id);
        const inv = invoicesByProperty[p.property_id];
        
        let tenantName = '';
        let expectedRent = 0;
        let collectedRent = 0;
        let arrears = 0;
        let prefinancedAmount = prefinByProperty[p.property_id] || 0;
        let isVacant = false;

        if (hasTenant) {
          const departureNotice = p.departure_date ? ` (Sortie le ${new Date(p.departure_date).toLocaleDateString('fr-FR')})` : '';
          tenantName = `${p.tenant_first_name || ''} ${p.tenant_last_name || ''}`.trim() + departureNotice || `Locataire #${p.tenant_id}`;
          expectedRent = inv ? Number(inv.total_amount || 0) : Number(p.property_rent || p.tenant_amount_due || 0);
          
          const txCash = collectedByProperty[p.property_id] ?? collectedByClient[p.tenant_id] ?? null;
          const repairVal = repairsByProperty[p.property_id] || 0;

          if (txCash !== null && txCash !== undefined) {
            collectedRent = Math.min(expectedRent, txCash + repairVal);
          } else if (inv) {
            collectedRent = Math.min(expectedRent, Number(inv.paid_amount || 0));
          } else {
            collectedRent = 0;
          }
          arrears = Math.max(0, expectedRent - collectedRent);
        } else {
          // Logement vacant (inclus explicitement avec mention)
          tenantName = '(Logement vacant - 0 XOF)';
          expectedRent = 0;
          collectedRent = 0;
          arrears = 0;
          isVacant = true;
        }

        totalExpected += expectedRent;
        totalCollected += collectedRent;
        totalArrears += arrears;
        totalPrefinanced += prefinancedAmount;

        const tenantMatchesSearch = searchLower && (
          tenantName.toLowerCase().includes(searchLower) ||
          (p.property_name || '').toLowerCase().includes(searchLower) ||
          (p.property_address || '').toLowerCase().includes(searchLower)
        );
        if (tenantMatchesSearch) {
          matchedByTenant = true;
        }

        units.push({
          property_id: p.property_id,
          property_name: p.property_name,
          property_address: p.property_address,
          property_type: p.property_type,
          commission_type: p.commission_type || 'percentage',
          commission_rate: Number(p.commission_rate ?? o.commission_rate ?? 10),
          commission_fixed_amount: Number(p.commission_fixed_amount || 0),
          tenant_id: p.tenant_id || null,
          tenant_name: tenantName,
          tenant_phone: p.tenant_phone || '—',
          tenant_status: p.tenant_status || (isVacant ? 'vacant' : 'active'),
          expected_rent: expectedRent,
          collected_rent: collectedRent,
          arrears,
          prefinanced_amount: prefinancedAmount,
          is_vacant: isVacant,
          matches_search: Boolean(tenantMatchesSearch)
        });
      }

      const ownerName = `${o.first_name || ''} ${o.last_name || ''}`.trim() || o.display_name || `Propriétaire #${o.id}`;
      const ownerMatchesSearch = searchLower && ownerName.toLowerCase().includes(searchLower);

      // Si recherche active, ne garder que ceux qui correspondent au propriétaire ou à l'un de ses locataires
      if (searchLower && !ownerMatchesSearch && !matchedByTenant) {
        continue;
      }

      // Calcul de la commission par bien (pourcentage ou montant fixe)
      let ownerTotalCommission = 0;
      for (const p of ownerProps) {
        const pCollected = units.find(u => u.property_id === p.property_id)?.collected_rent || 0;
        if (pCollected > 0) {
          if (p.commission_type === 'fixed') {
            ownerTotalCommission += Math.min(pCollected, Number(p.commission_fixed_amount || 0));
          } else {
            const propRate = Number(p.commission_rate ?? o.commission_rate ?? 10);
            ownerTotalCommission += Math.round((pCollected * propRate) / 100);
          }
        }
      }
      const commRate = Number(o.commission_rate || 10);
      const agencyCommission = ownerTotalCommission > 0 ? ownerTotalCommission : Math.round((totalCollected * commRate) / 100);
      const maintenanceDeductions = repairsByOwner[o.id] || 0;
      const netOwnerPayout = Math.max(0, totalCollected - agencyCommission - maintenanceDeductions);

      globalExpected += totalExpected;
      globalCollected += totalCollected;
      globalArrears += totalArrears;
      globalPrefinanced += totalPrefinanced;
      globalCommission += agencyCommission;
      globalNetPayout += netOwnerPayout;

      statements.push({
        owner_id: o.id,
        owner_name: ownerName,
        phone: o.phone || '—',
        email: o.email || '—',
        bank_name: o.bank_name || '—',
        bank_account: o.bank_account || '—',
        preferred_payment_method: o.preferred_payment_method || 'bank_transfer',
        preferred_payout_day: o.preferred_payout_day || '5',
        commission_rate: commRate,
        properties_count: ownerProps.length,
        tenants_count: ownerProps.filter(p => p.tenant_id).length,
        total_expected_rent: totalExpected,
        total_collected_rent: totalCollected,
        total_arrears: totalArrears,
        total_prefinanced: totalPrefinanced,
        agency_commission: agencyCommission,
        maintenance_deductions: maintenanceDeductions,
        net_owner_payout: netOwnerPayout,
        matched_by_tenant: matchedByTenant,
        units
      });
    }

    return {
      month: targetMonth,
      period_label: new Date(`${targetMonth}-01`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      totals: {
        total_owners: statements.length,
        global_expected: globalExpected,
        global_collected: globalCollected,
        global_arrears: globalArrears,
        global_prefinanced: globalPrefinanced,
        global_commission: globalCommission,
        global_net_payout: globalNetPayout,
        recovery_rate: globalExpected > 0 ? Math.round((globalCollected / globalExpected) * 100) : 0
      },
      statements
    };
  }
}

module.exports = new ReportRepository();
