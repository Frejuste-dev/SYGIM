const BaseService = require('../../core/BaseService');
const PropertyRepository = require('./property.repository');

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

  async update(id, data, user) {
    if (data.status === 'loue' && !data.tenant_id) {
      const AppError = require('../../utils/errors/AppError');
      throw AppError.badRequest('Une propriété louée doit avoir un locataire assigné.');
    }
    return super.update(id, data, user);
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
    if (['admin', 'director', 'accounting'].includes(user.role)) {
      return;
    }

    const property = await this.repository.findById(id);
    if (!property) {
      return;
    } // NotFound géré ailleurs

    const AppError = require('../../utils/errors/AppError');

    // Vérification Propriétaire
    if (user.role === 'owner') {
      const OwnerRepository = require('../owners/owner.repository');
      const owner = await OwnerRepository.findByUserId(user.id);
      if (!owner || property.owner_id !== owner.id) {
        throw AppError.forbidden('Accès refusé. Cette propriété ne vous appartient pas.');
      }
    }

    // Vérification Collecteur
    if (user.role === 'collector' || user.role === 'collector_manager') {
      if (!property.collector_id) {
        if (user.role === 'collector') {
          throw AppError.forbidden('Accès refusé. Cette propriété n\'a pas de collecteur assigné.');
        }
        return; // manager a le droit de voir s'il n'y a pas de collecteur
      }

      const CollectorRepository = require('../collectors/collector.repository');

      if (user.role === 'collector') {
        const collector = await CollectorRepository.findByUserId(user.id);
        if (!collector || property.collector_id !== collector.id) {
          throw AppError.forbidden('Accès refusé. Cette propriété ne vous est pas assignée.');
        }
      } else if (user.role === 'collector_manager') {
        // manager_id checks can be done if we fetch the assigned collector
        const assignedCollector = await CollectorRepository.findById(property.collector_id);
        if (!assignedCollector || (assignedCollector.manager_id !== user.id && assignedCollector.user_id !== user.id)) {
          throw AppError.forbidden('Accès refusé. Cette propriété est gérée par un autre groupe.');
        }
      }
    }
  }

  async assignTenant(propertyId, data, user) {
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
