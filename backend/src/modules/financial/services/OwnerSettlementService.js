const { pool } = require('../../../config/database');
const ownerSettlementRepository = require('../repositories/owner-settlement.repository');
const AppError = require('../../../utils/errors/AppError');
const Logger = require('../../../utils/logger/Logger');

class OwnerSettlementService {
  /**
   * Récupère tous les paiements/reversements propriétaires + KPIs
   */
  async getSettlementsWithStats(filters = {}) {
    const rows = await ownerSettlementRepository.findAllWithDetails(filters);

    let totalDisbursed = 0;
    let totalPrefinanced = 0;
    let totalCommission = 0;
    let totalRemainingToPay = 0;

    const enriched = rows.map(row => {
      const netDue = parseFloat(row.net_owner_payout || 0);
      const paid = parseFloat(row.amount_paid ?? netDue);
      const remaining = Math.max(0, netDue - paid);
      const comm = parseFloat(row.agency_commission || 0);

      totalDisbursed += paid;
      totalCommission += comm;
      totalRemainingToPay += remaining;
      if ((row.is_prefinanced || row.payout_mode === 'prefinancing' || row.status === 'PREFINANCED') && String(row.status).toUpperCase() !== 'REIMBURSED') {
        totalPrefinanced += paid;
      }

      const ownerName = `${row.owner_first_name || ''} ${row.owner_last_name || ''}`.trim() || `Propriétaire #${row.owner_id}`;
      const normalizedStatus = String(row.status || 'PAID').toLowerCase();

      return {
        ...row,
        status: normalizedStatus,
        net_owner_payout: netDue,
        net_amount: netDue,
        amount_paid: paid,
        remaining_to_pay: remaining,
        agency_commission: comm,
        owner_full_name: ownerName,
        owner_name: ownerName,
        transaction_reference: row.payout_reference || `REV-${row.id}`
      };
    });

    return {
      settlements: enriched,
      data: enriched,
      stats: {
        count: enriched.length,
        totalDisbursed,
        totalPrefinanced,
        totalCommission,
        totalRemainingToPay
      }
    };
  }

  /**
   * Synthèse financière par propriétaire (biens, loyers attendus, loyers encaissés des locataires, impayés locataires)
   * Permet au comptable de voir immédiatement si un locataire n'a pas payé à temps et de déclencher un préfinancement
   */
  async getOwnersFinancialSummary() {
    const [owners] = await pool.query(`
      SELECT o.*
      FROM owners o
      WHERE o.active = 1
      ORDER BY o.last_name ASC, o.first_name ASC
    `);

    const [properties] = await pool.query(`
      SELECT p.id, p.name, p.address, p.type, p.status, p.rent, p.owner_id
      FROM properties p
      WHERE p.owner_id IS NOT NULL
      ORDER BY p.name ASC
    `);

    const [clients] = await pool.query(`
      SELECT c.id, c.first_name, c.last_name, c.property_id, c.amount_due, c.amount_paid, c.status
      FROM clients c
      WHERE c.property_id IS NOT NULL
    `);

    const [settlements] = await pool.query(`
      SELECT owner_id, SUM(amount_paid) AS total_paid_to_owner, SUM(CASE WHEN is_prefinanced = 1 THEN amount_paid ELSE 0 END) AS total_prefinanced
      FROM owner_settlements
      GROUP BY owner_id
    `);

    const [repairs] = await pool.query(`
      SELECT tr.*, p.owner_id
      FROM tenant_repairs tr
      JOIN properties p ON p.id = tr.property_id
      WHERE tr.status = 'IN_PROGRESS' OR tr.status = 'SETTLED'
    `);

    const settlementMap = {};
    for (const s of settlements) {
      settlementMap[s.owner_id] = {
        totalPaidToOwner: parseFloat(s.total_paid_to_owner || 0),
        totalPrefinanced: parseFloat(s.total_prefinanced || 0)
      };
    }

    const clientsByProperty = {};
    for (const c of clients) {
      if (!clientsByProperty[c.property_id]) clientsByProperty[c.property_id] = [];
      clientsByProperty[c.property_id].push(c);
    }

    const propsByOwner = {};
    for (const p of properties) {
      if (!propsByOwner[p.owner_id]) propsByOwner[p.owner_id] = [];
      const propClients = clientsByProperty[p.id] || [];
      const propDue = propClients.reduce((sum, c) => sum + parseFloat(c.amount_due || 0), 0) || parseFloat(p.rent || 0);
      const propPaid = propClients.reduce((sum, c) => sum + parseFloat(c.amount_paid || 0), 0);
      const propRepairs = repairs.filter(r => r.property_id === p.id);
      const propRepairDeduction = propRepairs.reduce((sum, r) => {
        const val = r.deduction_mode === 'immediate'
          ? parseFloat(r.remaining_amount || r.total_cost || 0)
          : Math.min(parseFloat(r.monthly_deduction || r.remaining_amount || 0), parseFloat(r.total_cost || 0));
        return sum + val;
      }, 0);

      propsByOwner[p.owner_id].push({
        ...p,
        rent: parseFloat(p.rent || 0),
        tenants: propClients,
        tenantDue: propDue,
        tenantPaid: propPaid,
        tenantUnpaid: Math.max(0, propDue - propPaid),
        repairDeduction: propRepairDeduction
      });
    }

    return owners.map(owner => {
      const ownerProps = propsByOwner[owner.id] || [];
      const expectedRent = ownerProps.reduce((s, p) => s + (p.tenantDue || p.rent || 0), 0);
      const collectedFromTenants = ownerProps.reduce((s, p) => s + (p.tenantPaid || 0), 0);
      const unpaidByTenants = Math.max(0, expectedRent - collectedFromTenants);
      const commRate = parseFloat(owner.commission_rate ?? 10);
      const totalMaintenanceDeductions = ownerProps.reduce((s, p) => s + (p.repairDeduction || 0), 0);
      const netExpected = Math.max(0, Math.round(expectedRent * (1 - commRate / 100) - totalMaintenanceDeductions));
      const netFromCollected = Math.max(0, Math.round(collectedFromTenants * (1 - commRate / 100) - totalMaintenanceDeductions));
      const settleInfo = settlementMap[owner.id] || { totalPaidToOwner: 0, totalPrefinanced: 0 };

      return {
        ...owner,
        full_name: `${owner.first_name || ''} ${owner.last_name || ''}`.trim(),
        properties: ownerProps,
        propertiesCount: ownerProps.length,
        expectedRent,
        collectedFromTenants,
        unpaidByTenants,
        hasTenantArrears: unpaidByTenants > 0,
        commissionRate: commRate,
        maintenanceDeductions: totalMaintenanceDeductions,
        netExpectedPayout: netExpected,
        netCollectedPayout: netFromCollected,
        alreadyPaidToOwner: settleInfo.totalPaidToOwner,
        totalPrefinanced: settleInfo.totalPrefinanced
      };
    });
  }

  /**
   * Enregistre un paiement au propriétaire (Intégral, Échelonné, ou Préfinancement)
   */
  async recordOwnerPayment(payload, userId = null) {
    const owner_id = payload.owner_id || payload.ownerId;
    const property_id = payload.property_id || payload.propertyId || null;
    const period_start = payload.period_start || payload.periodStart;
    const period_end = payload.period_end || payload.periodEnd;
    const expected_rent = payload.expected_rent ?? payload.expectedRent ?? 0;
    const total_collected = payload.total_collected ?? payload.totalCollected ?? 0;
    const commission_rate = payload.commission_rate ?? payload.commissionRate ?? 10;
    const maintenance_deductions = payload.maintenance_deductions ?? payload.maintenanceDeductions ?? 0;
    const amount_paid = payload.amount_paid ?? payload.amountPaid;
    const payment_method = payload.payment_method || payload.paymentMethod || 'bank_transfer';
    const payout_mode = payload.payout_mode || payload.payoutMode || 'full';
    const is_prefinanced = Boolean(payload.is_prefinanced ?? payload.isPrefinanced ?? false);
    const scheduled_date = payload.scheduled_date || payload.scheduledDate || null;
    const payout_reference = payload.payout_reference || payload.payoutReference || '';
    const notes = payload.notes || '';

    if (!owner_id) {
      throw AppError.badRequest('Veuillez sélectionner un propriétaire.');
    }

    const now = new Date();
    const firstDay = period_start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = period_end || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const prefinancedFlag = Boolean(is_prefinanced || payout_mode === 'prefinancing');
    const baseAmount = prefinancedFlag
      ? Math.max(parseFloat(expected_rent || 0), parseFloat(total_collected || 0))
      : (parseFloat(total_collected || 0) || parseFloat(expected_rent || 0));

    const rate = parseFloat(commission_rate ?? 10);
    const agencyCommission = parseFloat(((baseAmount * rate) / 100).toFixed(2));
    const deductions = parseFloat(parseFloat(maintenance_deductions || 0).toFixed(2));
    const netOwnerPayout = Math.max(0, parseFloat((baseAmount - agencyCommission - deductions).toFixed(2)));

    const actualAmountPaid = amount_paid !== undefined && amount_paid !== ''
      ? parseFloat(amount_paid)
      : netOwnerPayout;

    if (isNaN(actualAmountPaid) || actualAmountPaid <= 0) {
      throw AppError.badRequest('Le montant versé au propriétaire doit être supérieur à 0.');
    }

    let status = 'PAID';
    if (prefinancedFlag) {
      status = 'PREFINANCED';
    } else if (payout_mode === 'installment' && actualAmountPaid < netOwnerPayout) {
      status = 'PARTIAL';
    }

    const ref = payout_reference?.trim() || `${prefinancedFlag ? 'PREF' : 'REV'}-${Date.now().toString().slice(-6)}`;

    const settlement = await ownerSettlementRepository.createSettlement({
      owner_id: parseInt(owner_id, 10),
      property_id: property_id ? parseInt(property_id, 10) : null,
      period_start: firstDay,
      period_end: lastDay,
      expected_rent: parseFloat(expected_rent || baseAmount || 0),
      total_collected: parseFloat(total_collected || 0),
      commission_rate: rate,
      agency_commission: agencyCommission,
      maintenance_deductions: deductions,
      net_owner_payout: Math.max(netOwnerPayout, actualAmountPaid),
      amount_paid: actualAmountPaid,
      payment_method,
      payout_mode,
      is_prefinanced: prefinancedFlag,
      scheduled_date: scheduled_date || now.toISOString().slice(0, 10),
      status,
      payout_date: now,
      payout_reference: ref,
      notes,
      created_by: userId
    });

    Logger.info('Owner payment recorded successfully', {
      settlementId: settlement.id,
      ownerId: owner_id,
      amountPaid: actualAmountPaid,
      payoutMode: payout_mode,
      isPrefinanced: prefinancedFlag
    });

    return settlement;
  }

  /**
   * Génère le Grand Livre Comptable unifié (Entrées locataires + Sorties propriétaires + Préfinancements)
   */
  async getGeneralLedger(filters = {}) {
    // 1. Entrées : Encaissements locataires (table transactions)
    const [txRows] = await pool.query(`
      SELECT t.id,
             t.reference,
             t.date AS entry_date,
             t.amount,
             t.method AS payment_method,
             t.status,
             t.description,
             COALESCE(NULLIF(TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))), ''), t.client_name, 'Locataire') AS third_party,
             COALESCE(p.name, c.property_name, '—') AS property_name,
             'TENANT_PAYMENT' AS entry_type
      FROM transactions t
      LEFT JOIN clients c ON c.id = t.client_id
      LEFT JOIN properties p ON p.id = c.property_id
      WHERE t.status != 'cancelled'
      ORDER BY t.date DESC, t.id DESC
    `);

    // 2. Sorties : Reversements & Préfinancements propriétaires (table owner_settlements)
    const [osRows] = await pool.query(`
      SELECT os.id,
             os.payout_reference AS reference,
             COALESCE(os.payout_date, os.created_at) AS entry_date,
             os.amount_paid AS amount,
             os.agency_commission,
             os.payment_method,
             os.payout_mode,
             os.is_prefinanced,
             os.status,
             os.notes AS description,
             CONCAT(COALESCE(o.first_name, ''), ' ', COALESCE(o.last_name, '')) AS third_party,
             p.name AS property_name,
             'OWNER_PAYOUT' AS entry_type
      FROM owner_settlements os
      JOIN owners o ON o.id = os.owner_id
      LEFT JOIN properties p ON p.id = os.property_id
      ORDER BY os.created_at DESC
    `);

    const entries = [];

    for (const tx of txRows) {
      const amt = parseFloat(tx.amount || 0);
      if (amt <= 0) continue;
      entries.push({
        id: `TX-${tx.id}`,
        date: tx.entry_date,
        reference: tx.reference || `ENC-${tx.id}`,
        category: 'Encaissement Loyer',
        type: 'CREDIT',
        direction: 'CREDIT',
        third_party: (tx.third_party || '').trim() || 'Locataire',
        property_name: tx.property_name || '—',
        description: tx.description || 'Paiement loyer locataire',
        payment_method: tx.payment_method || 'cash',
        method: tx.payment_method || 'cash',
        credit: amt,
        debit: 0,
        status: tx.status || 'processed'
      });
    }

    for (const os of osRows) {
      const amt = parseFloat(os.amount_paid || 0);
      if (amt <= 0) continue;
      const isPref = Boolean(os.is_prefinanced || os.payout_mode === 'prefinancing' || os.status === 'PREFINANCED');
      const isInst = os.payout_mode === 'installment';
      const labelCat = isPref
        ? 'Préfinancement Propriétaire'
        : isInst
          ? 'Reversement Échelonné Propriétaire'
          : 'Reversement Propriétaire';

      entries.push({
        id: `OS-${os.id}`,
        date: os.entry_date,
        reference: os.reference || `REV-${os.id}`,
        category: labelCat,
        type: 'DEBIT',
        direction: 'DEBIT',
        third_party: (os.third_party || '').trim() || 'Propriétaire',
        property_name: os.property_name || 'Tous les biens du propriétaire',
        description: os.description || `${labelCat} (Commission agence: ${parseFloat(os.agency_commission || 0).toLocaleString('fr-FR')} FCFA)`,
        payment_method: os.payment_method || 'bank_transfer',
        method: os.payment_method || 'bank_transfer',
        credit: 0,
        debit: amt,
        status: os.status || 'PAID',
        is_prefinanced: isPref
      });
    }

    // Tri chronologique ascendant pour calculer le solde progressif (running balance)
    entries.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    let runningBalance = 0;
    let totalCredit = 0;
    let totalDebit = 0;
    let totalPrefinanced = 0;

    for (const item of entries) {
      totalCredit += item.credit;
      totalDebit += item.debit;
      if (item.is_prefinanced) totalPrefinanced += item.debit;
      runningBalance += (item.credit - item.debit);
      item.balance = runningBalance;
      item.running_balance = runningBalance;
    }

    // Retourner du plus récent au plus ancien pour l'affichage
    entries.reverse();

    return {
      entries,
      summary: {
        totalCredit,
        totalDebit,
        totalPrefinanced,
        netTreasuryBalance: totalCredit - totalDebit,
        netBalance: totalCredit - totalDebit,
        entriesCount: entries.length
      }
    };
  }

  /**
   * Calcule la reddition de compte d'un propriétaire sur une période (FIN-019, 020, 021)
   */
  async generateMonthlySettlement({
    ownerId,
    periodStart,
    periodEnd,
    commissionRate = 10.00,
    maintenanceDeductions = 0.00,
    paymentMethod = 'bank_transfer',
    payoutMode = 'full',
    isPrefinanced = false,
    amountPaid = null,
    scheduledDate = null,
    payoutReference = null,
    notes = null,
    createdBy = null
  }) {
    if (!ownerId || !periodStart || !periodEnd) {
      throw AppError.badRequest('Propriétaire et dates de période sont obligatoires.');
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    if (end <= start) {
      throw AppError.badRequest('La date de fin de période doit être postérieure à la date de début.');
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const sqlCollected = `
        SELECT COALESCE(SUM(pa.allocated_amount), 0.00) AS total_collected
        FROM payment_allocations pa
        JOIN payments p ON p.id = pa.payment_id
        JOIN invoices i ON i.id = pa.invoice_id
        JOIN properties prop ON prop.id = i.property_id
        WHERE prop.owner_id = ?
          AND pa.status = 'ACTIVE'
          AND p.is_reversed = FALSE
          AND p.payment_date >= ?
          AND p.payment_date <= ?
      `;

      const [collectedRows] = await connection.query(sqlCollected, [ownerId, start, end]);
      let totalCollected = parseFloat(collectedRows[0].total_collected || 0.00);

      // Fallback sur la table clients/properties si pas d'allocations FIFO sur la période
      const [propRentRows] = await connection.query(
        'SELECT COALESCE(SUM(rent), 0) AS expected_rent FROM properties WHERE owner_id = ?',
        [ownerId]
      );
      const expectedRent = parseFloat(propRentRows[0]?.expected_rent || 0);

      if (totalCollected === 0) {
        const [clientPaidRows] = await connection.query(
          `SELECT COALESCE(SUM(c.amount_paid), 0) AS client_paid
           FROM clients c
           JOIN properties prop ON prop.id = c.property_id
           WHERE prop.owner_id = ?`,
          [ownerId]
        );
        totalCollected = parseFloat(clientPaidRows[0]?.client_paid || 0);
      }

      const baseForCalc = isPrefinanced ? Math.max(expectedRent, totalCollected) : totalCollected;
      const rate = parseFloat(commissionRate);
      const agencyCommission = parseFloat(((baseForCalc * rate) / 100).toFixed(2));
      const deductions = parseFloat(parseFloat(maintenanceDeductions).toFixed(2));
      const netOwnerPayout = parseFloat((baseForCalc - agencyCommission - deductions).toFixed(2));
      const finalAmountPaid = amountPaid !== null ? parseFloat(amountPaid) : netOwnerPayout;

      const settlement = await ownerSettlementRepository.createSettlement({
        owner_id: ownerId,
        period_start: start,
        period_end: end,
        expected_rent: expectedRent,
        total_collected: totalCollected,
        commission_rate: rate,
        agency_commission: agencyCommission,
        maintenance_deductions: deductions,
        net_owner_payout: netOwnerPayout,
        amount_paid: finalAmountPaid,
        payment_method: paymentMethod,
        payout_mode: payoutMode,
        is_prefinanced: isPrefinanced,
        scheduled_date: scheduledDate,
        payout_reference: payoutReference,
        notes,
        created_by: createdBy,
        status: isPrefinanced ? 'PREFINANCED' : (finalAmountPaid >= netOwnerPayout ? 'PAID' : 'CALCULATED')
      }, connection);

      await connection.commit();
      return settlement;
    } catch (error) {
      await connection.rollback();
      Logger.error('Failed to generate owner settlement, transaction rolled back', error);
      throw error instanceof AppError ? error : AppError.internal('Erreur lors du calcul de la reddition propriétaire.');
    } finally {
      connection.release();
    }
  }

  /**
   * Valide et exécute le reversement net ou une tranche échelonnée au propriétaire (FIN-021)
   */
  async approveAndPaySettlement({ settlementId, payoutReference, additionalAmount = null, paymentMethod = null, notes = null, userId = null }) {
    if (!settlementId) {
      throw AppError.badRequest('Identifiant de règlement obligatoire.');
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const settlement = await ownerSettlementRepository.findByIdForUpdate(settlementId, connection);
      if (!settlement) {
        throw AppError.notFound('Décompte propriétaire introuvable.');
      }

      const ref = payoutReference || `TR-${Date.now().toString().slice(-6)}`;
      await ownerSettlementRepository.markAsPaid(settlementId, ref, additionalAmount, connection, {
        payment_method: paymentMethod || settlement.payment_method,
        notes,
        created_by: userId
      });
      await connection.commit();

      Logger.info('Owner settlement installment / payment recorded', { settlementId, payoutReference: ref, additionalAmount });
      return { success: true, settlementId };
    } catch (error) {
      await connection.rollback();
      Logger.error('Failed to approve owner settlement', error);
      throw error instanceof AppError ? error : AppError.internal('Erreur lors de la validation du reversement.');
    } finally {
      connection.release();
    }
  }

  /**
   * Remboursement / Régularisation automatique d'un préfinancement propriétaire
   * dès que le locataire règle son loyer en retard.
   */
  async reconcilePrefinancingForTenantPayment(clientId, amountReceived, externalConn = null) {
    const db = externalConn || pool;
    try {
      const [clientRows] = await db.query(
        `SELECT c.id, c.first_name, c.last_name, c.property_id, p.owner_id, p.name AS property_name
         FROM clients c
         LEFT JOIN properties p ON p.id = c.property_id
         WHERE c.id = ?`,
        [clientId]
      );
      if (!clientRows.length || !clientRows[0].owner_id) return null;

      const { owner_id: ownerId, property_id: propertyId, first_name, last_name } = clientRows[0];
      const tenantName = `${first_name || ''} ${last_name || ''}`.trim() || `Locataire #${clientId}`;

      // Chercher un préfinancement actif pour ce propriétaire (et ce bien ou tous ses biens)
      const [prefRows] = await db.query(
        `SELECT * FROM owner_settlements
         WHERE owner_id = ?
           AND (property_id = ? OR property_id IS NULL)
           AND (is_prefinanced = 1 OR payout_mode = 'prefinancing' OR UPPER(status) = 'PREFINANCED')
           AND UPPER(status) != 'REIMBURSED'
         ORDER BY created_at ASC
         LIMIT 1`,
        [ownerId, propertyId]
      );

      if (!prefRows.length) return null;

      const pref = prefRows[0];
      const newCollected = parseFloat(pref.total_collected || 0) + parseFloat(amountReceived || 0);
      const targetThreshold = parseFloat(pref.expected_rent || pref.net_owner_payout || pref.amount_paid || 0);
      const isFullyReimbursed = newCollected >= targetThreshold;
      const newStatus = isFullyReimbursed ? 'REIMBURSED' : 'PREFINANCED';
      const dateStr = new Date().toLocaleDateString('fr-FR');
      const updatedNotes = `${pref.notes ? pref.notes + ' | ' : ''}[Remboursé le ${dateStr} suite au paiement de ${Number(amountReceived).toLocaleString('fr-FR')} FCFA par ${tenantName}]`;

      await db.query(
        `UPDATE owner_settlements
         SET total_collected = ?,
             status = ?,
             notes = ?
         WHERE id = ?`,
        [newCollected, newStatus, updatedNotes, pref.id]
      );

      Logger.info('Prefinanced owner settlement automatically reconciled after tenant payment', {
        settlementId: pref.id,
        ownerId,
        clientId,
        amountReceived,
        newStatus
      });

      return { settlementId: pref.id, newStatus, newCollected };
    } catch (err) {
      Logger.warn('Erreur non-bloquante lors de la régularisation automatique du préfinancement', { error: err.message });
      return null;
    }
  }
}

module.exports = new OwnerSettlementService();
