const BaseService = require('./BaseService');
const ClientRepository = require('../repositories/ClientRepository');

class ClientService extends BaseService {
  constructor() {
    super(ClientRepository);
  }

  async getClients(filters, user) {
    return await this.repository.findAllWithCollector(filters, user.role, user.id);
  }

  async replaceTenant(oldId, data) {
    // This logic needs to access the DB directly or via repos.
    // Since I don't have a transaction manager in BaseService yet, I will use pool from db.js for now.
    const { pool } = require('../../config/db');
    
    // ... (logic from routes/clients.routes.js's replace endpoint)
    // Note: I will need to be careful to maintain the same logic.
    // Re-implementing logic:
    
    const [oldRows] = await pool.query('SELECT * FROM clients WHERE id = ?', [oldId]);
    if (oldRows.length === 0) throw new Error('Ancien locataire non trouvé');
    const oldClient = oldRows[0];

    const [propRows] = await pool.query('SELECT * FROM properties WHERE tenant_id = ?', [oldId]);
    if (propRows.length === 0) throw new Error('Aucun bien trouvé pour ce locataire');
    const property = propRows[0];

    // 2. Marquer l'ancien locataire comme inactif
    await pool.query(
      `UPDATE clients SET status = 'inactive', contract_end = ?, departure_reason = ?, departure_notes = ? WHERE id = ?`,
      [data.endDate, data.departureReason, data.departureNotes || null, oldId]
    );

    // 3. Créer ou utiliser le nouveau locataire
    let newTenantId;
    let newTenantName;

    if (data.existingTenantId) {
      newTenantId = data.existingTenantId;
      const [existRows] = await pool.query('SELECT first_name, last_name FROM clients WHERE id = ?', [data.existingTenantId]);
      newTenantName = existRows[0] ? `${existRows[0].last_name} ${existRows[0].first_name}` : 'Inconnu';

      // Mettre à jour le locataire existant avec le même collecteur
      await pool.query(
        `UPDATE clients SET property_id = ?, property_name = ?, property_value = ?, amount_due = ?, collector_id = ? WHERE id = ?`,
        [property.id, property.name, property.value, data.newRent, oldClient.collector_id, data.existingTenantId]
      );
    } else if (data.newTenant) {
      const joinDate = new Date().toLocaleDateString('fr-FR');
      const [insertResult] = await pool.query(
        `INSERT INTO clients (first_name, last_name, phone, email, address, property_id, property_name, 
         property_value, amount_due, amount_paid, status, collector_id, owner_id, contract_start, join_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?, ?)`,
        [
          data.newTenant.firstName || '', data.newTenant.lastName,
          data.newTenant.phone, data.newTenant.email || null,
          property.address, property.id, property.name,
          property.value, data.newRent, oldClient.collector_id,
          property.owner_id, data.newStartDate, joinDate
        ]
      );
      newTenantId = insertResult.insertId;
      newTenantName = `${data.newTenant.lastName} ${data.newTenant.firstName || ''}`.trim();
    }

    // 4. Mettre à jour la propriété
    await pool.query(
      `UPDATE properties SET tenant_id = ?, rent = ? WHERE id = ?`,
      [newTenantId, data.newRent, property.id]
    );

    // 5. Créer une transaction de remplacement
    await pool.query(
      `INSERT INTO transactions (reference, date, client_name, description, amount, method, status, collector_id)
       VALUES (?, CURDATE(), ?, ?, 0, 'replacement', 'processed', ?)`,
      [
        `REPL-${oldId}-${newTenantId}`,
        newTenantName,
        `Remplacement locataire — ${oldClient.last_name} ${oldClient.first_name}`,
        oldClient.collector_id
      ]
    );

    return { oldTenantId: oldId, newTenantId, propertyId: property.id };
  }
}

module.exports = new ClientService();
