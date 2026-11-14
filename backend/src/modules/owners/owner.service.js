const BaseService = require('../../core/BaseService');
const OwnerRepository = require('./owner.repository');
const ManagerAuditService = require('../../services/ManagerAuditService');
const AppError = require('../../utils/errors/AppError');

class OwnerService extends BaseService {
  constructor() {
    super(OwnerRepository);
  }

  async getOwners(filters, user) {
    const page  = parseInt(filters.page  || 1,  10);
    const limit = parseInt(filters.limit || 20,  10);
    const safeFilters = { ...filters, page, limit };

    const [data, total] = await Promise.all([
      this.repository.findAll(safeFilters, user),
      this.repository.count(safeFilters, user),
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
    return await this.repository.getFilteredStats(filters, user);
  }

  async checkOwnership(id, user) {
    if (!user || !user.role) return;
    if (['admin', 'director', 'accounting', 'manager', 'collector_manager', 'gestionnaire'].includes(user.role)) {
      return;
    }
    const isAccessible = await this.repository.isAccessibleByUser(id, user);
    if (!isAccessible) {
      throw AppError.forbidden('Accès refusé. Vous n\'avez pas la permission de consulter ou modifier ce propriétaire.');
    }
  }

  async getOwnerDetails(id, user) {
    await this.checkOwnership(id, user);
    const owner = await this.repository.findByIdWithProperties(id);
    if (!owner) {
      throw AppError.notFound('Propriétaire non trouvé');
    }
    return owner;
  }

  async create(data, user) {
    const duplicate = await this.repository.findDuplicate(data);
    const ownerName = data.display_name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Nouveau Propriétaire';

    if (duplicate) {
      await ManagerAuditService.logAction({
        userId: user?.id,
        operationType: 'CREATE_OWNER',
        operationLabel: 'Création propriétaire',
        ownerName,
        targetSummary: ownerName,
        description: `Tentative de création rejetée : doublon détecté (${duplicate.duplicateBy === 'email' ? 'email déjà utilisé' : 'numéro de téléphone déjà utilisé'}).`,
        newValues: data,
        status: 'FAILED',
        notification: {
          type: 'WARNING',
          category: 'OWNER',
          title: 'Échec de création propriétaire',
          message: `Un propriétaire avec ces coordonnées existe déjà (${duplicate.owner.display_name || duplicate.owner.phone}).`,
        },
      });

      throw new AppError(
        `Conflit de données : un propriétaire existe déjà avec cet email ou ce numéro de téléphone (${duplicate.owner.display_name || duplicate.owner.phone}).`,
        409
      );
    }

    const created = await super.create(data, user);

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'CREATE_OWNER',
      operationLabel: 'Création propriétaire',
      ownerId: created.id,
      ownerName: created.display_name || ownerName,
      targetSummary: created.display_name || ownerName,
      description: `Propriétaire ${created.display_name || ownerName} enregistré avec succès.`,
      newValues: data,
      status: 'SUCCESS',
      notification: {
        type: 'SUCCESS',
        category: 'OWNER',
        title: 'Nouveau propriétaire enregistré',
        message: `Le propriétaire ${created.display_name || ownerName} a été créé avec succès.`,
      },
    });

    return created;
  }

  async update(id, data, user) {
    await this.checkOwnership(id, user);
    const oldOwner = await this.repository.findById(id);

    const duplicate = await this.repository.findDuplicate({ ...data, excludeId: id });
    const ownerName = data.display_name || oldOwner?.display_name || `${oldOwner?.first_name || ''} ${oldOwner?.last_name || ''}`.trim();

    if (duplicate) {
      await ManagerAuditService.logAction({
        userId: user?.id,
        operationType: 'UPDATE_OWNER',
        operationLabel: 'Modification propriétaire',
        ownerId: id,
        ownerName,
        targetSummary: ownerName,
        description: `Tentative de modification rejetée : doublon détecté (${duplicate.duplicateBy}).`,
        oldValues: oldOwner,
        newValues: data,
        status: 'FAILED',
        notification: {
          type: 'WARNING',
          category: 'OWNER',
          title: 'Échec de modification propriétaire',
          message: `Conflit de coordonnées avec le propriétaire ${duplicate.owner.display_name || duplicate.owner.phone}.`,
        },
      });

      throw new AppError(
        `Conflit : ces coordonnées correspondent déjà à un autre propriétaire (${duplicate.owner.display_name || duplicate.owner.phone}).`,
        409
      );
    }

    const updated = await super.update(id, data, user);

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'UPDATE_OWNER',
      operationLabel: 'Modification propriétaire',
      ownerId: id,
      ownerName: updated.display_name || ownerName,
      targetSummary: updated.display_name || ownerName,
      description: `Informations du propriétaire ${updated.display_name || ownerName} mises à jour.`,
      oldValues: oldOwner,
      newValues: data,
      status: 'SUCCESS',
      notification: {
        type: 'INFO',
        category: 'OWNER',
        title: 'Propriétaire mis à jour',
        message: `Les coordonnées du propriétaire ${updated.display_name || ownerName} ont été modifiées.`,
      },
    });

    return updated;
  }

  async delete(id, user) {
    await this.checkOwnership(id, user);
    const oldOwner = await this.repository.findById(id);
    const result = await super.delete(id, user);

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'DELETE_OWNER',
      operationLabel: 'Suppression propriétaire',
      ownerId: id,
      ownerName: oldOwner?.display_name || `Propriétaire #${id}`,
      targetSummary: oldOwner?.display_name || `Propriétaire #${id}`,
      description: `Propriétaire supprimé.`,
      oldValues: oldOwner,
      status: 'SUCCESS',
    });

    return result;
  }
}

module.exports = new OwnerService();
