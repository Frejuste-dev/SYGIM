/**
 * Module   : Collectors
 * Auteur   : SYGIM Team
 * Créé le  : 2026-06-16
 * Rôle     : Logique métier pour les récolteurs
 */

const collectorRepository = require('./collector.repository');
const cacheService = require('../../infrastructure/cache/cache.service');
const AppError = require('../../utils/errors/AppError');

class CollectorService {
  /**
   * Vérification des accès manager
   */
  async checkManagerAccess(collectorId, user) {
    if (!user) return;

    if (user.role === 'collector_manager') {
      const collector = await collectorRepository.findById(collectorId);
      if (collector && collector.manager_id !== user.id) {
        throw new AppError('Accès refusé. Ce collecteur ne fait pas partie de votre équipe.', 403);
      }
    } else if (user.role === 'collector') {
      const collector = await collectorRepository.findById(collectorId);
      if (collector && collector.user_id !== user.id) {
        throw new AppError('Accès refusé. Vous ne pouvez consulter que votre propre profil.', 403);
      }
    }
  }

  /**
   * Liste paginée
   */
  async getAllCollectors(filters = {}, page = 1, limit = 50, user = null) {
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 50;
    const offset = (parsedPage - 1) * parsedLimit;

    const [data, total] = await Promise.all([
      collectorRepository.findAll(filters, parsedLimit, offset, user),
      collectorRepository.count(filters, user)
    ]);

    return {
      data,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit)
      }
    };
  }

  /**
   * Détails par ID
   */
  async getCollectorById(id, user) {
    await this.checkManagerAccess(id, user);
    const collector = await collectorRepository.findById(id);
    if (!collector) {
      throw new AppError('Collecteur introuvable', 404);
    }
    return collector;
  }

  /**
   * Détails avec statistiques (Cache Redis 300s)
   */
  async getCollectorWithStats(id, user) {
    await this.checkManagerAccess(id, user);
    const cacheKey = `collector:stats:${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await collectorRepository.findWithStats(id);
    if (!stats) {
      throw new AppError('Collecteur introuvable', 404);
    }

    await cacheService.set(cacheKey, stats, 300);
    return stats;
  }

  /**
   * Liste par propriétaire
   */
  async getCollectorsByOwner(ownerId) {
    return collectorRepository.findByOwnerId(ownerId);
  }

  /**
   * Création
   */
  async createCollector(data) {
    if (!data.lastName) {
      throw new AppError('Le nom du collecteur est obligatoire', 400);
    }

    const collector = await collectorRepository.create(data);

    // Invalider les caches potentiels
    if (data.ownerId) {
      await cacheService.del(`owner:collectors:${data.ownerId}`);
    }

    return collector;
  }

  /**
   * Mise à jour
   */
  async updateCollector(id, data, user) {
    await this.checkManagerAccess(id, user);
    const collector = await collectorRepository.update(id, data);
    if (!collector) {
      throw new AppError('Collecteur introuvable', 404);
    }

    // Invalidation cache
    await cacheService.del(`collector:stats:${id}`);

    return collector;
  }

  /**
   * Assigner des propriétés à un collecteur
   */
  async assignProperties(collectorId, propertyIds, user) {
    const collector = await collectorRepository.findById(collectorId);
    if (!collector) {
      throw new AppError('Collecteur introuvable', 404);
    }
    if (user && user.role === 'collector_manager' && collector.manager_id !== user.id) {
      throw new AppError('Ce collecteur ne fait pas partie de votre équipe', 403);
    }
    await collectorRepository.assignProperties(collectorId, propertyIds);
    await cacheService.del(`collector:stats:${collectorId}`);
    return { success: true, assignedCount: propertyIds.length };
  }

  /**
   * Suppression logique
   */
  async deleteCollector(id, user) {
    await this.checkManagerAccess(id, user);
    const collector = await this.getCollectorById(id);

    // Règle métier : Ne pas supprimer si transactions actives
    const hasTx = await collectorRepository.hasActiveTransactions(id);
    if (hasTx) {
      throw new AppError('Impossible de supprimer un collecteur ayant des transactions traitées. Veuillez le désactiver à la place.', 409);
    }

    await collectorRepository.softDelete(id);

    // Invalidation cache
    await cacheService.del(`collector:stats:${id}`);

    return { success: true, message: 'Collecteur supprimé avec succès' };
  }
}

module.exports = new CollectorService();
