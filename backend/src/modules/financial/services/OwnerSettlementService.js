const { pool } = require('../../../../config/db');
const ownerSettlementRepository = require('../repositories/owner-settlement.repository');
const AppError = require('../../../utils/errors/AppError');
const Logger = require('../../../utils/logger/Logger');

class OwnerSettlementService {
  /**
   * Génère le décompte de gérance mensuel d'un propriétaire basé EXCLUSIVEMENT
   * sur les encaissements réels imputés dans la période (FIN-019, FIN-020, FIN-021)
   *
   * @param {Object} params
   * @param {number} params.ownerId - Identifiant du propriétaire
   * @param {Date|string} params.periodStart - Début de la période de décompte
   * @param {Date|string} params.periodEnd - Fin de la période de décompte
   * @param {number} [params.commissionRate=8.00] - Taux de commission de gestion agence (%)
   * @param {number} [params.maintenanceDeductions=0.00] - Frais ou travaux déductibles
   */
  async generateMonthlySettlement({
    ownerId,
    periodStart,
    periodEnd,
    commissionRate = 8.00,
    maintenanceDeductions = 0.00
  }) {
    if (!ownerId || !periodStart || !periodEnd) {
      throw AppError.badRequest('Paramètres obligatoires manquants pour la reddition de compte propriétaire.');
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (end < start) {
      throw AppError.badRequest('La date de fin ne peut précéder la date de début.');
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Calcul de l'assiette d'encaissement effectif (FIN-020)
      // On somme UNIQUEMENT les allocations actives perçues dans la période pour les biens de ce propriétaire
      const sqlCollected = `
        SELECT COALESCE(SUM(pa.allocated_amount), 0.00) AS total_collected
        FROM payment_allocations pa
        JOIN payments p ON p.id = pa.payment_id
        JOIN invoices i ON i.id = pa.invoice_id
        JOIN properties prop ON prop.id = i.property_id
        WHERE prop.owner_id = ?
          AND pa.status = 'ACTIVE'
          AND p.status != 'REVERSED'
          AND p.payment_date >= ?
          AND p.payment_date <= ?
      `;

      const [collectedRows] = await connection.query(sqlCollected, [ownerId, start, end]);
      const totalCollected = parseFloat(collectedRows[0].total_collected || 0.00);

      // 2. Calcul de la commission de l'agence (FIN-019, FIN-020)
      const rate = parseFloat(commissionRate);
      const agencyCommission = parseFloat(((totalCollected * rate) / 100).toFixed(2));
      const deductions = parseFloat(parseFloat(maintenanceDeductions).toFixed(2));

      // 3. Montant net dû au propriétaire
      const netOwnerPayout = parseFloat((totalCollected - agencyCommission - deductions).toFixed(2));

      // 4. Création de l'enregistrement de reddition (statut CALCULATED, FIN-021)
      const settlement = await ownerSettlementRepository.createSettlement({
        owner_id: ownerId,
        period_start: start,
        period_end: end,
        total_collected: totalCollected,
        commission_rate: rate,
        agency_commission: agencyCommission,
        maintenance_deductions: deductions,
        net_owner_payout: netOwnerPayout,
        status: 'CALCULATED'
      }, connection);

      await connection.commit();

      Logger.info('Monthly owner settlement calculated successfully', {
        settlementId: settlement.id,
        ownerId,
        totalCollected,
        commissionRate: rate,
        agencyCommission,
        netOwnerPayout
      });

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
   * Valide et exécute le reversement net au propriétaire (FIN-021)
   */
  async approveAndPaySettlement({ settlementId, payoutReference }) {
    if (!settlementId || !payoutReference) {
      throw AppError.badRequest('Identifiant de règlement et référence de virement obligatoires.');
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const settlement = await ownerSettlementRepository.findById(settlementId);
      if (!settlement) {
        throw AppError.notFound('Décompte propriétaire introuvable.');
      }
      if (settlement.status === 'PAID') {
        throw AppError.badRequest('Ce décompte a déjà été payé.');
      }

      await ownerSettlementRepository.markAsPaid(settlementId, payoutReference, connection);
      await connection.commit();

      Logger.info('Owner settlement approved and marked as paid', { settlementId, payoutReference });
      return { success: true, settlementId, status: 'PAID' };
    } catch (error) {
      await connection.rollback();
      Logger.error('Failed to approve owner settlement', error);
      throw error instanceof AppError ? error : AppError.internal('Erreur lors de la validation du reversement.');
    } finally {
      connection.release();
    }
  }
}

module.exports = new OwnerSettlementService();
