const BaseService = require('../../core/BaseService');
const ClientRepository = require('./client.repository');
const AppError = require('../../utils/errors/AppError');

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
    if (['admin', 'director', 'accounting'].includes(user.role)) {
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

    return await super.update(id, clientData, user);
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

    const result = await this.repository.replaceTenantAtomic(oldId, data, oldClient, property);
    return { oldTenantId: oldId, newTenantId: result.newTenantId, propertyId: property.id };
  }

  async departTenant(id, data, user) {
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
      departureNotes
    });

    return { id, status: 'inactive', departureDate, departureReason };
  }
}

module.exports = new ClientService();
