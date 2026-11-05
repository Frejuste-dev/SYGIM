require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sibmlab@1014',
  database: 'sygim_characterization',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};

async function seed() {
  let connection;
  try {
    console.log('Connecting to sygim_characterization database...');
    connection = await mysql.createConnection(dbConfig);
    
    // Disable FK checks during insertion
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    
    // Truncate tables to ensure a clean slate
    const tables = ['users', 'owners', 'properties', 'collectors', 'clients', 'transactions', 'refresh_tokens', 'activity_logs'];
    for (const table of tables) {
      await connection.query(`TRUNCATE TABLE ${table}`);
      console.log(`Truncated ${table}`);
    }

    console.log('Inserting deterministic golden dataset...');

    const passwordHash = await bcrypt.hash('password123', 12);

    // 1. USERS
    await connection.query(`
      INSERT INTO users (id, username, email, password_hash, role, active, created_at, first_name, last_name, display_name, avatar) VALUES 
      (1, 'admin_sys', 'admin@sygim.com', ?, 'admin', 1, '2026-01-01 10:00:00', 'Admin', 'Sys', 'Admin Sys', 'AV'),
      (2, 'director_1', 'director@sygim.com', ?, 'director', 1, '2026-01-01 10:00:00', 'Dir', 'One', 'Director', 'AV'),
      (3, 'accounting_1', 'accounting@sygim.com', ?, 'accounting', 1, '2026-01-01 10:00:00', 'Acc', 'One', 'Accounting', 'AV'),
      (4, 'col_manager_1', 'col_manager@sygim.com', ?, 'collector_manager', 1, '2026-01-01 10:00:00', 'Mgr', 'One', 'Col Mgr', 'AV'),
      (5, 'col1', 'col1@sygim.com', ?, 'collector', 1, '2026-01-01 10:00:00', 'Col', 'One', 'Col One', 'AV'),
      (6, 'col2', 'col2@sygim.com', ?, 'collector', 1, '2026-01-01 10:00:00', 'Col', 'Two', 'Col Two', 'AV')
    `, Array(6).fill(passwordHash));

    // 2. OWNERS
    await connection.query(`
      INSERT INTO owners (id, first_name, last_name, phone, email, created_at) VALUES
      (1, 'Owner1', 'Alpha', '0101010101', 'owner1@sygim.com', '2026-01-01 10:00:00'),
      (2, 'Owner2', 'Beta', '0202020202', 'owner2@sygim.com', '2026-01-01 10:00:00')
    `);

    // 3. COLLECTORS
    await connection.query(`
      INSERT INTO collectors (id, first_name, last_name, phone, email, manager_id, user_id, created_at) VALUES
      (1, 'Coll', 'One', '0303030303', 'col1@sygim.com', 4, 5, '2026-01-01 10:00:00'),
      (2, 'Coll', 'Two', '0404040404', 'col2@sygim.com', 4, 6, '2026-01-01 10:00:00')
    `);

    // 4. PROPERTIES
    await connection.query(`
      INSERT INTO properties (id, name, address, type, status, rent, value, owner_id, collector_id, tenant_id, created_at) VALUES
      (1, 'Villa Riviera', '123 Beach St', 'villa', 'loue', 1000, 1000, 1, 1, NULL, '2026-01-01 10:00:00'),
      (2, 'Appart Central', '456 City Ave', 'appartement', 'loue', 500, 500, 2, 2, NULL, '2026-01-01 10:00:00'),
      (3, 'Studio Empty', '789 Null Rd', 'studio', 'disponible', 300, 300, 1, 1, NULL, '2026-01-01 10:00:00')
    `);

    // 5. CLIENTS / LOCATAIRES
    await connection.query(`
      INSERT INTO clients (id, first_name, last_name, phone, email, address, property_id, property_name, property_value, amount_due, amount_paid, status, collector_id, owner_id, created_at) VALUES
      (1, 'Tenant', 'One', '0505050505', 'tenant1@sygim.com', '123 Beach St', 1, 'Villa Riviera', 1000, 1000, 0, 'pending', 1, 1, '2026-01-01 10:00:00'),
      (2, 'Tenant', 'Two', '0606060606', 'tenant2@sygim.com', '456 City Ave', 2, 'Appart Central', 500, 500, 250, 'partial', 2, 2, '2026-01-01 10:00:00')
    `);

    // Link clients back to properties via tenant_id
    await connection.query(`UPDATE properties SET tenant_id = 1 WHERE id = 1`);
    await connection.query(`UPDATE properties SET tenant_id = 2 WHERE id = 2`);

    // 6. TRANSACTIONS
    await connection.query(`
      INSERT INTO transactions (id, reference, amount, method, status, date, client_id, collector_id, payment_type) VALUES
      (1, 'TX-1001', 250, 'cash', 'processed', '2026-01-02 10:00:00', 2, 2, 'loyer')
    `);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('Golden dataset seeded successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seed();
