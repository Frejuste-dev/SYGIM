const { pool } = require('../../../config/database');
const invoiceRepository = require('../repositories/invoice.repository');
const tenantCreditLedgerRepository = require('../repositories/tenant-credit-ledger.repository');
const paymentAllocationRepository = require('../repositories/payment-allocation.repository');
const paymentRepository = require('../repositories/payment.repository');
const AppError = require('../../../utils/errors/AppError');
const Logger = require('../../../utils/logger/Logger');

class RentBillingService {
  /**
   * Calcule le nombre réel de jours dans le mois d'une date donnée
   */
  getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  /**
   * Formule déterministe du prorata au réel calendaire (FIN-014)
   * Prorata = (Loyer Mensuel / Jours Réels du Mois) * Jours d'Occupation
   */
  calculateProrataAmount(monthlyRent, totalDaysInMonth, occupiedDays) {
    if (occupiedDays >= totalDaysInMonth) return parseFloat(monthlyRent);
    if (occupiedDays <= 0) return 0.00;
    const raw = (monthlyRent / totalDaysInMonth) * occupiedDays;
    return parseFloat(raw.toFixed(2));
  }

  /**
   * Génère une facture périodique de loyer avec détection automatique du prorata
   * et apurement immédiat par le solde d'avance locataire disponible (FIN-011, FIN-012, FIN-014, FIN-017)
   *
   * @param {Object} params
   * @param {number} params.clientId - Identifiant du locataire
   * @param {number} [params.propertyId] - Identifiant du bien
   * @param {number} params.monthlyRent - Montant contractuel du loyer
   * @param {Date|string} params.periodStart - Début de la période de facturation
   * @param {Date|string} params.periodEnd - Fin de la période de facturation
   * @param {Date|string} params.dueDate - Date limite d'exigibilité
   * @param {string} [params.invoiceNumber] - Numéro légal de la facture
   * @param {number} params.createdBy - Utilisateur émetteur
   */
  async generateInvoice({
    clientId,
    propertyId = null,
    monthlyRent,
    periodStart,
    periodEnd,
    dueDate,
    invoiceNumber,
    createdBy
  }) {
    if (!clientId || !monthlyRent || !periodStart || !periodEnd || !dueDate) {
      throw AppError.badRequest('Paramètres obligatoires manquants pour la facturation de loyer.');
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (end < start) {
      throw AppError.badRequest('La date de fin de période ne peut précéder la date de début.');
    }

    const year = start.getFullYear();
    const month = start.getMonth();
    const daysInMonth = this.getDaysInMonth(year, month);

    // Calcul du nombre de jours d'occupation inclus dans la période
    const diffTime = Math.abs(end - start);
    const occupiedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Détermination prorata vs mois complet (FIN-012, FIN-014)
    let invoiceType = 'RENT_FULL';
    let baseAmount = parseFloat(monthlyRent);
    let totalAmount = baseAmount;

    if (occupiedDays < daysInMonth) {
      invoiceType = 'RENT_PRORATA';
      totalAmount = this.calculateProrataAmount(baseAmount, daysInMonth, occupiedDays);
    }

    const num = invoiceNumber || `FAC-${year}${String(month + 1).padStart(2, '0')}-${clientId}-${Date.now().toString().slice(-4)}`;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Insertion de la facture
      const invoice = await invoiceRepository.createInvoice({
        invoice_number: num,
        client_id: clientId,
        property_id: propertyId,
        invoice_type: invoiceType,
        billing_period_start: start,
        billing_period_end: end,
        contract_rent_applied: baseAmount,
        base_amount: baseAmount,
        total_amount: totalAmount,
        paid_amount: 0.00,
        status: 'PENDING',
        due_date: new Date(dueDate)
      }, connection);

      // 2. Vérification du solde créditeur / avances du locataire (FIN-016, FIN-017)
      // Utilisation du verrou pessimiste FOR UPDATE pour lecture atomique du solde
      const availableCredit = await tenantCreditLedgerRepository.getLatestRunningBalance(clientId, connection, true);

      let creditConsumed = 0.00;
      let newBalance = availableCredit;

      if (availableCredit > 0) {
        // Détermination du montant d'avance à consommer
        creditConsumed = Math.min(availableCredit, totalAmount);
        newBalance = parseFloat((availableCredit - creditConsumed).toFixed(2));

        // Enregistrement d'un paiement automatique lié à la consommation de l'avance
        const advancePayment = await paymentRepository.createPayment({
          client_id: clientId,
          property_id: propertyId,
          amount_received: creditConsumed,
          payment_method: 'BANK_TRANSFER', // Compensation interne d'avance
          receipt_number: `REC-ADV-${invoice.id}`,
          created_by: createdBy || 1,
          payment_date: new Date(),
          status: 'RECONCILED'
        }, connection);

        // Création de l'imputation
        await paymentAllocationRepository.createAllocation({
          payment_id: advancePayment.id,
          invoice_id: invoice.id,
          allocated_amount: creditConsumed,
          status: 'ACTIVE'
        }, connection);

        // Débit au grand livre du compte d'avance locataire (FIN-017)
        await tenantCreditLedgerRepository.appendEntry({
          client_id: clientId,
          transaction_type: 'DEBIT_CONSUMPTION',
          amount: creditConsumed,
          running_balance: newBalance,
          source_payment_id: advancePayment.id,
          consumed_invoice_id: invoice.id
        }, connection);

        // Mise à jour de la facture
        await invoiceRepository.applyPaymentAllocation(invoice.id, creditConsumed, connection);
      }

      await connection.commit();

      Logger.info('Rent invoice generated successfully', {
        invoiceId: invoice.id,
        invoiceNumber: num,
        totalAmount,
        invoiceType,
        advanceConsumed: creditConsumed,
        remainingCreditBalance: newBalance
      });

      return {
        invoice: { ...invoice, total_amount: totalAmount, paid_amount: creditConsumed },
        occupiedDays,
        daysInMonth,
        creditConsumed,
        remainingCreditBalance: newBalance
      };
    } catch (error) {
      await connection.rollback();
      Logger.error('Failed to generate rent invoice, transaction rolled back', error);
      throw error instanceof AppError ? error : AppError.internal('Erreur lors de la génération de la facture de loyer.');
    } finally {
      connection.release();
    }
  }
}

module.exports = new RentBillingService();
