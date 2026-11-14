const BaseService = require('../../core/BaseService');
const ClientRepository = require('./client.repository');
const AppError = require('../../utils/errors/AppError');
const ManagerAuditService = require('../../services/ManagerAuditService');
const { pool } = require('../../config/database');

class ClientService extends BaseService {
  constructor() {
    super(ClientRepository);
  }

  async getStats(filters = {}, user = {}) {
    return await this.repository.getFilteredStats(filters, user.role, user.id);
  }

  async checkOwnership(id, user) {
    if (!user || !user.role) {
      return;
    }
    if (['admin', 'director', 'accounting', 'manager', 'collector_manager', 'gestionnaire'].includes(user.role)) {
      return;
    }

    const client = await this.repository.findById(id);
    if (!client) {
      return;
    } // NotFound géré ailleurs

    // Vérification Propriétaire
    if (user.role === 'owner') {
      const OwnerRepository = require('../owners/owner.repository');
      const owner = await OwnerRepository.findByUserId(user.id);
      if (!owner || client.owner_id !== owner.id) {
        throw AppError.forbidden('Accès refusé. Ce client n\'est pas lié à vos propriétés.');
      }
    }

    // Vérification Collecteur
    if (user.role === 'collector' || user.role === 'collector_manager') {
      if (!client.collector_id) {
        if (user.role === 'collector') {
          throw AppError.forbidden('Accès refusé. Ce client n\'a pas de collecteur assigné.');
        }
        return; // manager a le droit de voir s'il n'y a pas de collecteur
      }

      const CollectorRepository = require('../collectors/collector.repository');

      if (user.role === 'collector') {
        const collector = await CollectorRepository.findByUserId(user.id);
        if (!collector || client.collector_id !== collector.id) {
          throw AppError.forbidden('Accès refusé. Ce client ne vous est pas assigné.');
        }
      } else if (user.role === 'collector_manager') {
        const assignedCollector = await CollectorRepository.findById(client.collector_id);
        if (!assignedCollector || (assignedCollector.manager_id !== user.id && assignedCollector.user_id !== user.id)) {
          throw AppError.forbidden('Accès refusé. Ce client est géré par un autre groupe.');
        }
      }
    }
  }

  async getClients(filters, user) {
    const page  = parseInt(filters.page  || 1,  10);
    const limit = parseInt(filters.limit || 20,  10);
    const safeFilters = { ...filters, page, limit };

    const [data, total] = await Promise.all([
      this.repository.findAllWithCollector(safeFilters, user.role, user.id),
      this.repository.countAllWithCollector(safeFilters, user.role, user.id),
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
    const { validateEmail, validatePhone, validateAmount } = require('../../utils/validators');

    const lastName = data.lastName || data.last_name;
    const firstName = data.firstName || data.first_name || '';
    const phone = data.phone;
    const email = data.email || null;
    const address = data.address || null;
    const amountDue = data.amountDue !== undefined ? data.amountDue : (data.amount_due !== undefined ? data.amount_due : 0);
    const deposit = data.deposit !== undefined ? data.deposit : 0;
    const propertyId = data.propertyId !== undefined ? data.propertyId : (data.property_id !== undefined ? data.property_id : null);
    const contractStart = data.contractStart || data.contract_start || null;
    const contractEnd = data.contractEnd || data.contract_end || null;
    let collectorId = data.collectorId || data.collector_id || null;

    if (!lastName || !phone) {
      throw AppError.badRequest('Nom et téléphone sont requis');
    }
    if (!validatePhone(phone)) {
      throw AppError.badRequest('Format téléphone invalide (exemple: +225 07 00 00 00 00)');
    }
    if (email && !validateEmail(email)) {
      throw AppError.badRequest('Format email invalide');
    }
    if (amountDue && !validateAmount(amountDue)) {
      throw AppError.badRequest('Montant invalide (doit être > 0)');
    }

    // Uniqueness checks via repository
    const existingPhone = await this.repository.findByPhone(phone);
    if (existingPhone.length > 0) {
      throw AppError.conflict('Ce numéro de téléphone est déjà utilisé');
    }

    if (email) {
      const existingEmail = await this.repository.findByEmail(email);
      if (existingEmail.length > 0) {
        throw AppError.conflict('Cet email est déjà utilisé');
      }
    }

    // Si l'utilisateur est un collecteur, lier automatiquement le locataire à son ID collecteur
    if (user && user.role === 'collector' && !collectorId) {
      const CollectorRepository = require('../collectors/collector.repository');
      const collector = await CollectorRepository.findByUserId(user.id);
      if (collector) {
        collectorId = collector.id;
      }
    }

    if (collectorId) {
      const isCollectorActive = await this.repository.checkCollectorActive(collectorId);
      if (!isCollectorActive) {
        throw AppError.badRequest('Collecteur non trouvé ou inactif');
      }
      
      // IDOR check for collectorId
      if (user && user.role === 'collector_manager') {
        const CollectorRepository = require('../collectors/collector.repository');
        const assignedCollector = await CollectorRepository.findById(collectorId);
        if (!assignedCollector || (assignedCollector.manager_id !== user.id && assignedCollector.user_id !== user.id)) {
          throw AppError.forbidden('Accès refusé. Vous ne pouvez assigner qu\'à un collecteur de votre équipe.');
        }
      }
    }

    const joinDate = new Date().toLocaleDateString('fr-FR');
    const clientData = {
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      email: email,
      address: address,
      property_id: propertyId,
      property_name: data.propertyName || data.property_name || null,
      property_value: data.propertyValue || data.property_value || 0,
      amount_due: amountDue,
      amount_paid: 0,
      status: data.status || 'pending',
      collector_id: collectorId,
      owner_id: data.ownerId || data.owner_id || null,
      deposit: deposit,
      contract_start: contractStart,
      contract_end: contractEnd,
      join_date: joinDate
    };

    try {
      const newId = await this.repository.createWithPropertyUpdate(clientData);

      // Si un bien est directement associé, insérer dans l'historique d'attribution locataire
      if (clientData.property_id) {
        try {
          await pool.query(
            `INSERT INTO property_tenant_assignments 
             (property_id, owner_id, previous_client_id, new_client_id, action_type, rent_amount, performed_by, notes, created_at)
             VALUES (?, ?, NULL, ?, 'INITIAL_ASSIGNMENT', ?, ?, ?, NOW())`,
            [
              clientData.property_id,
              clientData.owner_id || null,
              newId,
              clientData.amount_due || null,
              user?.id || null,
              'Attribution lors de la création du locataire'
            ]
          );
        } catch (histErr) {
          console.warn('[ClientService] Historisation attribution échouée:', histErr.message);
        }
      }

      await ManagerAuditService.logAction({
        userId: user?.id,
        operationType: 'CREATE_TENANT',
        operationLabel: 'Création locataire',
        propertyId: clientData.property_id || null,
        ownerId: clientData.owner_id || null,
        targetSummary: `Locataire : ${lastName} ${firstName}`.trim(),
        description: `Nouveau locataire ${lastName} ${firstName || ''} créé avec succès.${clientData.property_name ? ' Affecté au bien ' + clientData.property_name + '.' : ''}`,
        newValues: clientData,
        status: 'SUCCESS',
        notification: {
          type: 'SUCCESS',
          category: 'CLIENT',
          title: 'Nouveau locataire enregistré',
          message: `Le locataire ${lastName} ${firstName || ''} a été enregistré dans le système.`,
        },
      });

      return { id: newId, lastName: lastName, firstName: firstName };
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw AppError.conflict('Ce client existe déjà');
      }
      throw error;
    }
  }

  async delete(id, user) {
    await this.checkOwnership(id, user);

    try {
      await this.repository.deleteWithPropertyUpdate(id);
      return { success: true, id };
    } catch (error) {
      if (error.message === 'NOT_FOUND') {
        throw AppError.notFound('Client non trouvé');
      }
      throw error;
    }
  }

  async update(id, data, user) {
    const fieldMap = {
      firstName:        'first_name',
      lastName:         'last_name',
      phone:            'phone',
      email:            'email',
      address:          'address',
      propertyId:       'property_id',
      propertyName:     'property_name',
      propertyValue:    'property_value',
      amountDue:        'amount_due',
      amountPaid:       'amount_paid',
      paymentMethod:    'payment_method',
      status:           'status',
      collectorId:      'collector_id',
      agent:            'agent',
      ownerId:          'owner_id',
      deposit:          'deposit',
      advancePayment:   'advance_payment',
      contractStart:    'contract_start',
      contractEnd:      'contract_end',
      departureReason:  'departure_reason',
      departureNotes:   'departure_notes'
    };

    const clientData = {};
    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        clientData[col] = data[key];
      }
    }

    if (Object.keys(clientData).length === 0) {
      throw AppError.badRequest('Aucun champ à modifier');
    }

    const updated = await super.update(id, clientData, user);

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'UPDATE_TENANT',
      operationLabel: 'Modification locataire',
      propertyId: clientData.property_id || null,
      targetSummary: `Locataire #${id}`,
      description: `Mise à jour des informations du locataire #${id}.`,
      newValues: clientData,
      status: 'SUCCESS',
      notification: {
        type: 'INFO',
        category: 'CLIENT',
        title: 'Dossier locataire mis à jour',
        message: `Les informations du locataire #${id} ont été actualisées.`,
      },
    });

    return updated;
  }

  async replaceTenant(oldId, data, user) {
    await this.checkOwnership(oldId, user);

    const oldClient = await this.repository.findById(oldId);
    if (!oldClient) {
      throw AppError.notFound('Ancien locataire non trouvé');
    }

    const PropertyRepository = require('../properties/property.repository');
    const propRows = await PropertyRepository.findByTenantId(oldId);
    
    if (propRows.length === 0) {
      throw AppError.notFound('Aucun bien trouvé pour ce locataire');
    }
    const property = propRows[0];

    data.performedBy = user?.id || null;
    const result = await this.repository.replaceTenantAtomic(oldId, data, oldClient, property);

    const oldName = `${oldClient.last_name} ${oldClient.first_name || ''}`.trim();
    const newName = result.newTenantName || 'Nouveau locataire';
    const propRef = property.reference_code || `BIEN-${property.id}`;

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'REASSIGN_PROPERTY',
      operationLabel: 'Changement de locataire',
      propertyId: property.id,
      propertyRef: propRef,
      ownerId: property.owner_id || null,
      targetSummary: `${propRef} / Nouveau locataire : ${newName}`,
      description: `Changement de locataire sur le bien ${propRef} : ${oldName} remplacé par ${newName}.${data.departureReason ? ' Motif départ: ' + data.departureReason : ''}`,
      oldValues: { oldTenantId: oldId, tenantName: oldName },
      newValues: { newTenantId: result.newTenantId, newTenantName: newName, rent: data.newRent || property.rent },
      status: 'SUCCESS',
      notification: {
        type: 'INFO',
        category: 'ASSIGNMENT',
        title: 'Changement de locataire',
        message: `Le bien ${propRef} a été réattribué à ${newName} (départ de ${oldName}).`,
      },
    });

    return { oldTenantId: oldId, newTenantId: result.newTenantId, propertyId: property.id };
  }

  async departTenant(id, data, user) {
    await this.checkOwnership(id, user);

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw AppError.notFound('Locataire non trouvé');
    }

    const departureDate = data.departureDate || new Date().toISOString().slice(0, 10);
    const departureReason = data.departureReason || 'Fin de bail / Départ';
    const departureNotes = data.departureNotes || null;

    await this.repository.departTenant(id, {
      departureDate,
      departureReason,
      departureNotes,
      performedBy: user?.id || null
    });

    const tenantName = `${existing.last_name} ${existing.first_name || ''}`.trim();
    const propRef = existing.property_name || (existing.property_id ? `BIEN-${existing.property_id}` : 'Bien');

    await ManagerAuditService.logAction({
      userId: user?.id,
      operationType: 'DEPART_TENANT',
      operationLabel: 'Libération du bien',
      propertyId: existing.property_id || null,
      targetSummary: `Départ locataire : ${tenantName} / Bien libéré`,
      description: `Départ du locataire ${tenantName} enregistré (${departureReason}). Le bien associé a été remis en statut disponible (vacant).`,
      oldValues: { tenantId: id, name: tenantName, propertyId: existing.property_id, amountDue: existing.amount_due },
      newValues: { status: 'inactive', departureDate, departureReason, departureNotes },
      status: 'SUCCESS',
      notification: {
        type: 'WARNING',
        category: 'ASSIGNMENT',
        title: 'Bien libéré (Départ locataire)',
        message: `Le locataire ${tenantName} a quitté le bien. Ce dernier est désormais vacant et prêt à être réattribué.`,
      },
    });

    return { id, status: 'inactive', departureDate, departureReason };
  }
}

module.exports = new ClientService();
