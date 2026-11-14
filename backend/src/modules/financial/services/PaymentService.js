const { pool } = require('../../../config/database');
const invoiceRepository = require('../repositories/invoice.repository');
const paymentRepository = require('../repositories/payment.repository');
const paymentAllocationRepository = require('../repositories/payment-allocation.repository');
const tenantCreditLedgerRepository = require('../repositories/tenant-credit-ledger.repository');
const ownerSettlementService = require('./OwnerSettlementService');
const AppError = require('../../../utils/errors/AppError');
const Logger = require('../../../utils/logger/Logger');

class PaymentService {
  /**
   * Enregistre un encaissement physique avec apurement FIFO automatique et mise en avance du reliquat (FIN-001, FIN-002, FIN-003, FIN-004)
   *
   * @param {Object} params
   * @param {number} params.clientId - Identifiant du locataire/client
   * @param {number} params.amountReceived - Montant encaissé physiquement
   * @param {string} params.method - Mode de règlement ('CASH', 'BANK_TRANSFER', etc.)
   * @param {number} [params.collectorId] - Identifiant du collecteur
   * @param {number} [params.propertyId] - Bien concerné (optionnel si multi-baux)
   * @param {string} [params.receiptNumber] - Numéro du reçu délivré
   * @param {number} params.createdBy - Utilisateur effectuant la saisie
   */
  async registerPayment({
    clientId,
    amountReceived,
    method,
    collectorId = null,
    propertyId = null,
    receiptNumber = null,
    createdBy
  }) {
    if (!clientId || !amountReceived || amountReceived <= 0 || !method || !createdBy) {
      throw AppError.badRequest('Paramètres de paiement incomplets ou montant invalide.');
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 0. Contrôle d'idempotence anti-double-clic (60 secondes) si aucun numéro de reçu explicite
      if (!receiptNumber) {
        const [recentDuplicates] = await connection.query(`
          SELECT id, created_at FROM payments 
          WHERE client_id = ? 
            AND amount_received = ? 
            AND created_at >= (NOW() - INTERVAL 60 SECOND)
            AND status != 'REVERSED'
          LIMIT 1 FOR UPDATE
        `, [clientId, amountReceived]);

        if (recentDuplicates.length > 0) {
          throw AppError.conflict('Un paiement identique pour ce locataire a déjà été enregistré il y a moins de 60 secondes.');
        }
      }
      // 1. Création de l'enregistrement de paiement initial
      const payment = await paymentRepository.createPayment({
        client_id: clientId,
        collector_id: collectorId,
        property_id: propertyId,
        amount_received: amountReceived,
        payment_method: method,
        receipt_number: receiptNumber,
        created_by: createdBy,
        payment_date: new Date(),
        status: 'RECEIVED'
      }, connection);

      let remainingAmountToAllocate = parseFloat(amountReceived);

      // 2. Récupération des factures impayées du client dans l'ordre chronologique strict (FIFO, FIN-002)
      // Utilisation de FOR UPDATE pour verrouiller les factures pendant la transaction
      const unpaidInvoices = await invoiceRepository.findUnpaidInvoicesFIFO(clientId, connection, true);

      const allocationsCreated = [];

      // 3. Boucle d'imputation FIFO
      for (const invoice of unpaidInvoices) {
        if (remainingAmountToAllocate <= 0) break;

        const balanceDue = parseFloat(invoice.balance_due);
        if (balanceDue <= 0) continue;

        // Montant à allouer sur cette facture précise
        const allocationAmount = Math.min(remainingAmountToAllocate, balanceDue);

        // Création de l'imputation unitaire
        const allocation = await paymentAllocationRepository.createAllocation({
          payment_id: payment.id,
          invoice_id: invoice.id,
          allocated_amount: allocationAmount,
          status: 'ACTIVE'
        }, connection);

        allocationsCreated.push(allocation);

        // Mise à jour de la facture (paid_amount et recalcul du statut)
        await invoiceRepository.applyPaymentAllocation(invoice.id, allocationAmount, connection);

        remainingAmountToAllocate = parseFloat((remainingAmountToAllocate - allocationAmount).toFixed(2));
      }

      // 4. Traitement du surplus éventuel -> Conservation comme avance locataire (FIN-001, FIN-016)
      let advanceCreated = null;
      if (remainingAmountToAllocate > 0) {
        const currentBalance = await tenantCreditLedgerRepository.getLatestRunningBalance(clientId, connection, true);
        const newRunningBalance = parseFloat((currentBalance + remainingAmountToAllocate).toFixed(2));

        advanceCreated = await tenantCreditLedgerRepository.appendEntry({
          client_id: clientId,
          transaction_type: 'CREDIT_ADVANCE',
          amount: remainingAmountToAllocate,
          running_balance: newRunningBalance,
          source_payment_id: payment.id,
          consumed_invoice_id: null
        }, connection);
      }

      // 5. Synchronisation de l'état du client (mise à jour du montant payé et du statut)
      if (clientId) {
        await connection.query(`
          UPDATE clients
          SET amount_paid = amount_paid + ?,
              payment_method = ?,
              status = CASE
                WHEN amount_paid + ? >= amount_due THEN 'paid'
                WHEN amount_paid + ? > 0 THEN 'partial'
                ELSE status
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [amountReceived, (method || 'cash').toLowerCase(), amountReceived, amountReceived, clientId]);
      }

      // 6. Synchronisation de la table des transactions (historique et tableau de bord)
      try {
        const [clientRows] = await connection.query('SELECT first_name, last_name FROM clients WHERE id = ?', [clientId]);
        const clientName = clientRows.length > 0 ? `${clientRows[0].first_name} ${clientRows[0].last_name}` : null;
        const now = new Date();
        const dateDisplay = now.toLocaleDateString('fr-FR');
        const txRef = receiptNumber || `RC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${payment.id}`;

        await connection.query(`
          INSERT INTO transactions
           (reference, date, date_display, client_id, client_name, description, amount,
            method, status, payment_type, collector_id)
          VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, 'processed', 'rent', ?)
        `, [
          txRef,
          dateDisplay,
          clientId,
          clientName,
          `Encaissement loyer ${receiptNumber || ''}`.trim(),
          amountReceived,
          (method || 'cash').toLowerCase(),
          collectorId || null
        ]);
      } catch (txErr) {
        Logger.warn('Erreur non-bloquante lors de la synchronisation de transactions', { error: txErr.message });
      }

      // 7. Régularisation / Remboursement automatique d'un préfinancement propriétaire éventuel
      await ownerSettlementService.reconcilePrefinancingForTenantPayment(clientId, amountReceived, connection);

      // 8. Épongement / Amortissement automatique d'une réparation active prise en charge
      try {
        const [repairs] = await connection.query(`
          SELECT * FROM tenant_repairs 
          WHERE client_id = ? AND status = 'IN_PROGRESS' 
          ORDER BY id ASC LIMIT 1 FOR UPDATE
        `, [clientId]);

        if (repairs.length > 0) {
          const repair = repairs[0];
          const deductionAllowed = repair.deduction_mode === 'immediate'
            ? parseFloat(repair.remaining_amount)
            : Math.min(parseFloat(repair.monthly_deduction || repair.remaining_amount), parseFloat(repair.remaining_amount));

          if (deductionAllowed > 0) {
            const newReimbursed = parseFloat((parseFloat(repair.reimbursed_amount) + deductionAllowed).toFixed(2));
            const newRemaining = Math.max(0, parseFloat((parseFloat(repair.remaining_amount) - deductionAllowed).toFixed(2)));
            const newStatus = newRemaining <= 0 ? 'SETTLED' : 'IN_PROGRESS';

            await connection.query(`
              UPDATE tenant_repairs 
              SET reimbursed_amount = ?, 
                  remaining_amount = ?, 
                  status = ?
              WHERE id = ?
            `, [newReimbursed, newRemaining, newStatus, repair.id]);

            Logger.info('Amortissement réparation locataire appliqué', {
              repairId: repair.id,
              deductionApplied: deductionAllowed,
              newRemaining,
              newStatus
            });
          }
        }
      } catch (repErr) {
        Logger.warn('Erreur non-bloquante lors de la déduction de réparation', { error: repErr.message });
      }

      await connection.commit();

      Logger.info('Payment registered successfully with FIFO allocations', {
        paymentId: payment.id,
        clientId,
        amountReceived,
        allocationsCount: allocationsCreated.length,
        surplusAdvance: remainingAmountToAllocate
      });

      return {
        payment,
        allocations: allocationsCreated,
        advance: advanceCreated,
        unallocatedSurplus: remainingAmountToAllocate
      };
    } catch (error) {
      await connection.rollback();
      Logger.error('Failed to register payment, transaction rolled back', error);
      throw error instanceof AppError ? error : AppError.internal('Erreur lors de l\'enregistrement transactionnel du paiement.');
    } finally {
      connection.release();
    }
  }

  /**
   * Extourne formellement un paiement et ses allocations sans suppression physique (FIN-006, FIN-007, FIN-008, SEC-004-B)
   *
   * @param {Object} params
   * @param {number} params.paymentId - Identifiant du paiement
   * @param {number} params.reversedByUserId - Identifiant du superviseur (Direction / RAF)
   * @param {string} params.reason - Motif légal de l'annulation
   */
  async reversePayment({ paymentId, reversedByUserId, reason }) {
    if (!paymentId || !reversedByUserId || !reason) {
      throw AppError.badRequest('Le paiement, le motif et l\'identité du superviseur sont obligatoires pour une extourne.');
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Verrouillage pessimiste immédiat et chargement transactionnel du paiement (SEC-004-B)
      const payment = await paymentRepository.findByIdForUpdate(paymentId, connection);
      if (!payment) {
        throw AppError.notFound('Paiement introuvable.');
      }
      if (payment.is_reversed || payment.status === 'REVERSED') {
        throw AppError.badRequest('Ce paiement a déjà été extourné.');
      }

      // 2. Mise à jour conditionnelle avec contrôle strict de concurrence (SEC-004-B)
      const paymentUpdated = await paymentRepository.reversePayment(paymentId, reversedByUserId, reason, connection);
      if (!paymentUpdated) {
        throw AppError.conflict('Conflit de concurrence : ce paiement a déjà été extourné par une opération concurrente.');
      }

      // 3. Récupérer et verrouiller exclusivement les allocations ACTIVES associées
      const allocations = await paymentAllocationRepository.findActiveByPaymentId(paymentId, connection, true);

      // 4. Si des allocations actives existent, les extourner et vérifier la concordance stricte
      if (allocations.length > 0) {
        const reversedCount = await paymentAllocationRepository.reverseAllocationsByPaymentId(paymentId, connection);
        if (reversedCount !== allocations.length) {
          throw AppError.conflict('Conflit de concurrence lors de l\'extourne des allocations.');
        }

        // Tri déterministe par invoice_id ascendant pour prévenir les interblocages (deadlocks)
        const sortedAllocations = [...allocations].sort((a, b) => a.invoice_id - b.invoice_id);

        // 5. Rouvrir les dettes des factures de manière vérifiée sans masque artificiel
        for (const allocation of sortedAllocations) {
          const [invRows] = await connection.query(
            'SELECT id, total_amount, paid_amount, status FROM invoices WHERE id = ? FOR UPDATE',
            [allocation.invoice_id]
          );

          if (invRows.length === 0) {
            throw AppError.notFound(`Facture #${allocation.invoice_id} associée à l'allocation introuvable.`);
          }

          const invoice = invRows[0];
          const allocatedAmount = parseFloat(allocation.allocated_amount);
          const currentPaid = parseFloat(invoice.paid_amount);

          if (currentPaid < allocatedAmount) {
            throw AppError.internal(
              `Incohérence financière détectée : le montant payé de la facture #${invoice.id} (${currentPaid}) est inférieur au montant alloué à extourner (${allocatedAmount}).`
            );
          }

          const newPaidAmount = parseFloat((currentPaid - allocatedAmount).toFixed(2));
          const newStatus = newPaidAmount <= 0 ? 'PENDING' : 'PARTIALLY_PAID';

          const updateInvoiceSql = `
            UPDATE invoices
            SET paid_amount = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `;
          await connection.query(updateInvoiceSql, [newPaidAmount, newStatus, invoice.id]);
        }
      }

      // 6. Extourne du crédit éventuel créé dans le ledger par ce paiement (idempotente)
      const [ledgerRows] = await connection.query(
        'SELECT * FROM tenant_credit_ledger WHERE source_payment_id = ? AND transaction_type = "CREDIT_ADVANCE" FOR UPDATE',
        [paymentId]
      );

      if (ledgerRows.length > 0) {
        // Vérifier si une compensation DEBIT_CONSUMPTION n'a pas déjà été enregistrée pour ce paiement
        const [existingCompensations] = await connection.query(
          'SELECT id FROM tenant_credit_ledger WHERE source_payment_id = ? AND transaction_type = "DEBIT_CONSUMPTION" LIMIT 1 FOR UPDATE',
          [paymentId]
        );

        if (existingCompensations.length === 0) {
          const advanceEntry = ledgerRows[0];
          const advanceAmount = parseFloat(advanceEntry.amount);

          const currentBalance = await tenantCreditLedgerRepository.getLatestRunningBalance(payment.client_id, connection, true);
          const newBalance = parseFloat((currentBalance - advanceAmount).toFixed(2));

          if (newBalance < 0) {
            throw AppError.badRequest('Impossible d\'extourner ce paiement : l\'avance générée a déjà été consommée sur d\'autres échéances.');
          }

          await tenantCreditLedgerRepository.appendEntry({
            client_id: payment.client_id,
            transaction_type: 'DEBIT_CONSUMPTION',
            amount: advanceAmount,
            running_balance: newBalance,
            source_payment_id: paymentId,
            consumed_invoice_id: null
          }, connection);
        }
      }

      // 5. Synchronisation de l'état du client lors de l'extourne
      if (payment.client_id) {
        await connection.query(`
          UPDATE clients
          SET amount_paid = GREATEST(0, amount_paid - ?),
              status = CASE
                WHEN GREATEST(0, amount_paid - ?) = 0 THEN 'pending'
                WHEN GREATEST(0, amount_paid - ?) < amount_due THEN 'partial'
                ELSE 'paid'
              END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [payment.amount_received, payment.amount_received, payment.amount_received, payment.client_id]);
      }

      // 6. Synchronisation de la transaction correspondante (annulation)
      if (payment.receipt_number) {
        await connection.query(`
          UPDATE transactions
          SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
          WHERE reference = ?
        `, [payment.receipt_number]);
      }

      await connection.commit();

      Logger.info('Payment reversed successfully', {
        paymentId,
        reversedByUserId,
        allocationsReversedCount: allocations.length
      });

      return { success: true, paymentId, status: 'REVERSED' };
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        Logger.error('Erreur lors du rollback transactionnel', rollbackErr);
      }
      Logger.error('Failed to reverse payment, transaction rolled back', error);
      throw error instanceof AppError ? error : AppError.internal('Erreur lors de l\'extourne transactionnelle du paiement.');
    } finally {
      connection.release();
    }
  }
}

module.exports = new PaymentService();
