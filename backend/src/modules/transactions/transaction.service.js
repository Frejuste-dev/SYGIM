const BaseService = require('../../core/BaseService');
const TransactionRepository = require('./transaction.repository');
const { validateAmount } = require('../../utils/validators');

const DEFAULT_LIMIT = 20;

class TransactionService extends BaseService {
  constructor() {
    super(TransactionRepository);
  }

  async getTransactions(filters, user) {
    const page  = parseInt(filters.page  || 1,            10);
    const limit = parseInt(filters.limit || DEFAULT_LIMIT, 10);
    const safeFilters = { ...filters, page, limit };

    const [data, total] = await Promise.all([
      this.repository.findAll(safeFilters, user),
      this.repository.countAll(safeFilters, user),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext:     page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }


  async getStats(filters = {}, user = null) {
    // Si un paramètre period est fourni, utiliser l'ancienne méthode globale (pour la rétrocompatibilité)
    if (filters.period && !filters.search && !filters.status && !filters.clientId) {
      return await this.repository.getStats(filters.period);
    }
    // Sinon, calculer les stats avec les filtres
    return await this.repository.getFilteredStats(filters, user);
  }

  async checkOwnership(id, user) {
    if (!user || !user.role) {
      return;
    }
    if (['admin', 'director', 'accounting'].includes(user.role)) {
      return;
    }

    const transaction = await this.repository.findById(id);
    if (!transaction) {
      return;
    } // NotFound géré ailleurs

    const AppError = require('../../utils/errors/AppError');

    // Vérification Collecteur
    if (user.role === 'collector' || user.role === 'collector_manager') {
      if (!transaction.collector_id) {
        if (user.role === 'collector') {
          throw AppError.forbidden('Accès refusé. Cette transaction n\'a pas de collecteur assigné.');
        }
        return; // manager a le droit de voir
      }

      const CollectorRepository = require('../collectors/collector.repository');

      if (user.role === 'collector') {
        const collector = await CollectorRepository.findByUserId(user.id);
        if (!collector || transaction.collector_id !== collector.id) {
          throw AppError.forbidden('Accès refusé. Cette transaction ne vous appartient pas.');
        }
      } else if (user.role === 'collector_manager') {
        const assignedCollector = await CollectorRepository.findById(transaction.collector_id);
        if (!assignedCollector || (assignedCollector.manager_id !== user.id && assignedCollector.user_id !== user.id)) {
          throw AppError.forbidden('Accès refusé. Cette transaction est gérée par un autre groupe.');
        }
      }
    }
  }

  async createTransaction(data, user) {
    // Validation
    if (!data.amount) {
      throw new Error('Le montant est requis');
    }
    if (!validateAmount(data.amount)) {
      throw new Error('Montant invalide');
    }
    if (!data.clientId) {
      throw new Error('Une transaction DOIT être liée à un client');
    }

    // Check client existence and ownership for IDOR protection
    const client = await this.repository.getClientForTransaction(data.clientId);
    if (!client) {
      throw new Error(`Client ${data.clientId} inexistant`);
    }

    // Resolve collectorId
    let resolvedCollectorId = data.collectorId || null;

    // IDOR check for collectors
    if (user && (user.role === 'collector' || user.role === 'collector_manager')) {
      const AppError = require('../../utils/errors/AppError');

      if (user.role === 'collector') {
        const collector = await this.repository.getCollectorByUserId(user.id);
        if (!collector || client.collector_id !== collector.id) {
          throw AppError.forbidden('Accès refusé. Ce client ne vous est pas assigné.');
        }
        // Force the collectorId to the collector's own ID
        resolvedCollectorId = collector.id;
      } else if (user.role === 'collector_manager') {
        const managedIds = await this.repository.getManagedCollectors(user.id);
        if (client.collector_id !== null && !managedIds.includes(client.collector_id)) {
          throw AppError.forbidden('Accès refusé. Ce client appartient à un collecteur hors de votre équipe.');
        }
        
        // If the manager provided a collectorId in the payload, ensure it's in their team
        if (data.collectorId && !managedIds.includes(data.collectorId)) {
          throw AppError.forbidden('Accès refusé. Vous ne pouvez assigner la transaction qu\'à un collecteur de votre équipe.');
        }
      }
    }

    // Règle Métier : Si la saisie est faite par un collecteur sur le terrain,
    // le statut est STRICTEMENT mis en attente ('pending') de validation comptable.
    // L'argent n'est crédité que lorsque le comptable reçoit physiquement les fonds.
    if (user && user.role === 'collector') {
      data.status = 'pending';
    } else if (!data.status) {
      data.status = 'processed';
    }

    data.collectorId = resolvedCollectorId;
    const createdTx = await this.repository.createWithClientUpdate(data);

    // Régularisation automatique d'un éventuel préfinancement UNIQUEMENT si la transaction est traitée/validée
    if (data.status === 'processed') {
      try {
        const ownerSettlementService = require('../financial/services/OwnerSettlementService');
        await ownerSettlementService.reconcilePrefinancingForTenantPayment(data.clientId, data.amount);
      } catch (e) {
        // non-bloquant
      }
    }

    return createdTx;
  }

  /**
   * Validation d'un encaissement collecteur par le comptable lors de la remise des fonds
   */
  async validateTransaction(id, user, notes = null) {
    if (!user || !['admin', 'director', 'accounting'].includes(user.role)) {
      const AppError = require('../../utils/errors/AppError');
      throw AppError.forbidden('Seul le comptable, le directeur ou un administrateur peut valider un encaissement');
    }

    const validatedTx = await this.repository.validateTransaction(id, user.id, notes);

    // Régularisation automatique d'un éventuel préfinancement dès que les fonds sont formellement validés
    try {
      const ownerSettlementService = require('../financial/services/OwnerSettlementService');
      await ownerSettlementService.reconcilePrefinancingForTenantPayment(validatedTx.client_id, validatedTx.amount);
    } catch (e) {
      // non-bloquant
    }

    return validatedTx;
  }

  /**
   * Rejet d'une transaction terrain par le comptable
   */
  async rejectTransaction(id, user, reason = null) {
    if (!user || !['admin', 'director', 'accounting'].includes(user.role)) {
      const AppError = require('../../utils/errors/AppError');
      throw AppError.forbidden('Seul le comptable, le directeur ou un administrateur peut rejeter un encaissement');
    }

    return await this.repository.rejectTransaction(id, user.id, reason);
  }
}

module.exports = new TransactionService();
