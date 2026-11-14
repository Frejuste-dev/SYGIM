const BaseService = require('../../core/BaseService');
const PropertyRepository = require('./property.repository');
const OwnerRepository = require('../owners/owner.repository');
const ManagerAuditService = require('../../services/ManagerAuditService');
const AppError = require('../../utils/errors/AppError');

class PropertyService extends BaseService {
  constructor() {
    super(PropertyRepository);
  }

  async getProperties(filters) {
    const page  = parseInt(filters.page  || 1,  10);
    const limit = parseInt(filters.limit || 20,  10);
    const safeFilters = { ...filters, page, limit };

    const [data, total] = await Promise.all([
      this.repository.findAllWithDetails(safeFilters),
      this.repository.countAllWithDetails(safeFilters),
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

  async create(data, user) {
    if (!data.reference_code) {
      data.reference_code = await this.repository.getNextReferenceCode();
    }

    if (data.owner_id) {
      data.assigned_at = new Date();
      data.assigned_by = user?.id || null;
    }

    const created = await super.create(data, user);

    let ownerName = null;
    if (data.owner_id) {
      const owner = await OwnerRepository.findById(data.owner_id);
      ownerName = owner?.display_name || (owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() : null);

      // Enregistrement de l'attribution initiale dans l'historique
      await this.repository.assignOwner(created.id, data.owner_id, user?.id || 1, 'Attribution lors de la création');
    }

    const summary = `${created.reference_code || 'BIEN'} / ${ownerName || 'Non attribué'}`;

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'CREATE_PROPERTY',
      operationLabel: 'Enregistrement bien',
      propertyId: created.id,
      propertyRef: created.reference_code,
      ownerId: data.owner_id || null,
      ownerName: ownerName,
      targetSummary: summary,
      description: `Bien ${created.name} (${created.reference_code}) créé avec succès.${ownerName ? ' Attribué à ' + ownerName + '.' : ' Non attribué.'}`,
      newValues: data,
      status: 'SUCCESS',
      notification: {
        type: 'SUCCESS',
        category: 'PROPERTY',
        title: 'Nouveau bien enregistré',
        message: `Le bien ${created.name} (${created.reference_code}) a été enregistré.`,
      },
    });

    return await this.repository.findByIdWithDetails(created.id);
  }

  async update(id, data, user) {
    await this.checkOwnership(id, user);
    if (data.status === 'loue' && !data.tenant_id) {
      throw AppError.badRequest('Une propriété louée doit avoir un locataire assigné.');
    }

    const oldProperty = await this.repository.findByIdWithDetails(id);
    const updated = await super.update(id, data, user);

    const propertyRef = updated?.reference_code || oldProperty?.reference_code || `BIEN-${id}`;
    const ownerName = updated?.owner_display_name || oldProperty?.owner_first_name || 'Propriétaire';

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'UPDATE_PROPERTY',
      operationLabel: 'Modification bien',
      propertyId: id,
      propertyRef,
      ownerId: updated?.owner_id || oldProperty?.owner_id,
      ownerName,
      targetSummary: `${propertyRef} / ${ownerName}`,
      description: `Mise à jour des informations du bien ${updated?.name || propertyRef}.`,
      oldValues: oldProperty,
      newValues: data,
      status: 'SUCCESS',
      notification: {
        type: 'INFO',
        category: 'PROPERTY',
        title: 'Bien immobilier modifié',
        message: `Le bien ${propertyRef} a été modifié.`,
      },
    });

    return await this.repository.findByIdWithDetails(id);
  }

  async assignOwner(propertyId, ownerId, user, notes = null) {
    await this.checkOwnership(propertyId, user);
    const property = await this.repository.findByIdWithDetails(propertyId);
    if (!property) {
      throw AppError.notFound('Bien immobilier non trouvé');
    }

    const owner = await OwnerRepository.findById(ownerId);
    if (!owner) {
      throw AppError.notFound('Propriétaire cible non trouvé');
    }

    const ownerName = owner.display_name || `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
    const updatedProperty = await this.repository.assignOwner(propertyId, ownerId, user?.id || 1, notes);

    const summary = `${property.reference_code || 'BIEN'} / ${ownerName}`;

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'ASSIGN_PROPERTY',
      operationLabel: 'Attribution',
      propertyId,
      propertyRef: property.reference_code,
      ownerId,
      ownerName,
      targetSummary: summary,
      description: `Attribution du bien ${property.reference_code} (${property.name}) à ${ownerName}.${notes ? ' Motif: ' + notes : ''}`,
      newValues: { owner_id: ownerId, notes },
      status: 'SUCCESS',
      notification: {
        type: 'SUCCESS',
        category: 'ASSIGNMENT',
        title: 'Bien attribué avec succès',
        message: `Le bien ${property.reference_code} a été attribué à ${ownerName}.`,
      },
    });

    return updatedProperty;
  }

  async reassignOwner(propertyId, newOwnerId, user, notes = null) {
    await this.checkOwnership(propertyId, user);
    const property = await this.repository.findByIdWithDetails(propertyId);
    if (!property) {
      throw AppError.notFound('Bien immobilier non trouvé');
    }

    const previousOwnerId = property.owner_id;
    const newOwner = await OwnerRepository.findById(newOwnerId);
    if (!newOwner) {
      throw AppError.notFound('Nouveau propriétaire cible non trouvé');
    }

    const prevOwnerName = property.owner_first_name ? `${property.owner_first_name} ${property.owner_last_name || ''}`.trim() : `Propriétaire #${previousOwnerId}`;
    const newOwnerName = newOwner.display_name || `${newOwner.first_name || ''} ${newOwner.last_name || ''}`.trim();

    const updatedProperty = await this.repository.reassignOwner(propertyId, previousOwnerId, newOwnerId, user?.id || 1, notes);

    const summary = `${property.reference_code || 'BIEN'} / ${newOwnerName}`;

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'REASSIGN_PROPERTY',
      operationLabel: 'Réattribution',
      propertyId,
      propertyRef: property.reference_code,
      ownerId: newOwnerId,
      ownerName: newOwnerName,
      targetSummary: summary,
      description: `Réattribution du bien ${property.reference_code} : transféré de ${prevOwnerName} vers ${newOwnerName}.${notes ? ' Motif: ' + notes : ''}`,
      oldValues: { owner_id: previousOwnerId, owner_name: prevOwnerName },
      newValues: { owner_id: newOwnerId, owner_name: newOwnerName, notes },
      status: 'SUCCESS',
      notification: {
        type: 'INFO',
        category: 'ASSIGNMENT',
        title: 'Bien réattribué',
        message: `Le bien ${property.reference_code} a été transféré à ${newOwnerName}.`,
      },
    });

    return updatedProperty;
  }

  async getAssignments(filters = {}) {
    const page  = parseInt(filters.page  || 1,  10);
    const limit = parseInt(filters.limit || 50,  10);

    const [data, total] = await Promise.all([
      this.repository.findAssignments(filters),
      this.repository.countAssignments(filters),
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

  async getAssignmentHistory(filters = {}) {
    return await this.repository.findAssignmentHistory(filters);
  }

  async getStats(filters = {}) {
    return await this.repository.getFilteredStats(filters);
  }

  async getPropertyDetails(id) {
    const property = await this.repository.findByIdWithDetails(id);
    if (!property) {
      throw new Error('Propriété non trouvée');
    }
    return property;
  }

  async checkOwnership(id, user) {
    if (!user || !user.role) {
      return;
    }
    if (['admin', 'director', 'accounting', 'manager', 'collector_manager', 'gestionnaire'].includes(user.role)) {
      return;
    }

    const property = await this.repository.findById(id);
    if (!property) {
      return;
    }

    // Vérification Propriétaire
    if (user.role === 'owner') {
      const owner = await OwnerRepository.findByUserId(user.id);
      if (!owner || property.owner_id !== owner.id) {
        throw AppError.forbidden('Accès refusé. Cette propriété ne vous appartient pas.');
      }
    }

    // Vérification Collecteur
    if (user.role === 'collector') {
      if (!property.collector_id) {
        throw AppError.forbidden('Accès refusé. Cette propriété n\'a pas de collecteur assigné.');
      }
      const CollectorRepository = require('../collectors/collector.repository');
      const collector = await CollectorRepository.findByUserId(user.id);
      if (!collector || property.collector_id !== collector.id) {
        throw AppError.forbidden('Accès refusé. Cette propriété ne vous est pas assignée.');
      }
    }
  }

  async assignTenant(propertyId, data, user) {
    await this.checkOwnership(propertyId, user);

    const { pool } = require('../../config/database');
    const AppError = require('../../utils/errors/AppError');

    const prop = await this.repository.findById(propertyId);
    if (!prop) throw AppError.notFound('Propriété non trouvée');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let tenantId = data.clientId;
      const rent = parseFloat(data.rent || prop.rent || 0);
      const deposit = parseFloat(data.deposit || 0);
      const startDate = data.startDate || new Date().toISOString().slice(0, 10);

      if (!tenantId && data.newTenant) {
        const { firstName, lastName, phone, email, address } = data.newTenant;
        if (!lastName || !phone) {
          throw AppError.badRequest('Nom et téléphone du nouveau locataire sont requis');
        }

        let collectorId = data.newTenant.collectorId || prop.collector_id || null;
        if (user?.role === 'collector' && !collectorId) {
          const [colRows] = await conn.query('SELECT id FROM collectors WHERE user_id = ?', [user.id]);
          if (colRows.length > 0) collectorId = colRows[0].id;
        }

        const joinDate = new Date().toLocaleDateString('fr-FR');
        const [insertRes] = await conn.query(
          `INSERT INTO clients 
           (first_name, last_name, phone, email, address, property_id, property_name, property_value, 
            amount_due, amount_paid, status, deposit, contract_start, collector_id, owner_id, join_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?, ?, ?)`,
          [
            firstName || '', lastName, phone, email || null, address || prop.address || null,
            propertyId, prop.name, prop.value || 0,
            rent, deposit, startDate, collectorId, prop.owner_id || null, joinDate
          ]
        );
        tenantId = insertRes.insertId;
      } else if (tenantId) {
        const [cRows] = await conn.query('SELECT * FROM clients WHERE id = ?', [tenantId]);
        if (cRows.length === 0) throw AppError.notFound('Locataire existant introuvable');

        await conn.query(
          `UPDATE clients 
           SET property_id = ?, 
               property_name = ?, 
               amount_due = ?, 
               status = 'pending',
               contract_start = COALESCE(?, contract_start)
           WHERE id = ?`,
          [propertyId, prop.name, rent, startDate, tenantId]
        );
      } else {
        throw AppError.badRequest('Veuillez sélectionner un locataire ou créer un nouveau locataire');
      }

      // Mettre à jour la propriété en statut "loue"
      await conn.query(
        "UPDATE properties SET status = 'loue', tenant_id = ?, rent = COALESCE(?, rent) WHERE id = ?",
        [tenantId, rent, propertyId]
      );

      // Historique transaction
      const [tRows] = await conn.query('SELECT first_name, last_name FROM clients WHERE id = ?', [tenantId]);
      const tName = tRows.length > 0 ? `${tRows[0].last_name} ${tRows[0].first_name}`.trim() : 'Locataire';

      await conn.query(
        `INSERT INTO transactions (reference, date, client_id, client_name, description, amount, method, status, collector_id)
         VALUES (?, CURDATE(), ?, ?, ?, 0, 'assignment', 'processed', ?)`,
        [
          `ATTR-${propertyId}-${tenantId}`,
          tenantId,
          tName,
          `Attribution du bien : ${prop.name}`,
          prop.collector_id || null
        ]
      );

      await conn.commit();
      return { propertyId, tenantId, status: 'loue' };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new PropertyService();
