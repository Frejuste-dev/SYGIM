const { pool } = require('../../../config/db');

describe('Database Schema Integrity', () => {

  const getColumns = async (tableName) => {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ??`, [tableName]);
    return rows;
  };

  describe('users table', () => {
    let columns = [];
    
    beforeAll(async () => {
      columns = await getColumns('users');
    });

    test('should have deletedAt column for soft delete', () => {
      const deletedAt = columns.find(c => c.Field === 'deletedAt');
      expect(deletedAt).toBeDefined();
      expect(deletedAt.Type.toLowerCase()).toContain('datetime');
    });

    test('should have username_normalized column', () => {
      const usernameNormalized = columns.find(c => c.Field === 'username_normalized');
      expect(usernameNormalized).toBeDefined();
      expect(usernameNormalized.Type.toLowerCase()).toContain('varchar');
      // The Extra column in SHOW COLUMNS will show 'STORED GENERATED' or 'VIRTUAL GENERATED'
      expect(usernameNormalized.Extra.toLowerCase()).toContain('generated');
    });

    // collector_name is kept due to frontend legacy dependencies
    test('collector_name should exist (legacy frontend dependency)', () => {
      const collectorName = columns.find(c => c.Field === 'collector_name');
      expect(collectorName).toBeDefined();
    });
  });

  describe('collectors table', () => {
    let columns = [];
    
    beforeAll(async () => {
      columns = await getColumns('collectors');
    });

    test('should have deletedAt column for soft delete', () => {
      const deletedAt = columns.find(c => c.Field === 'deletedAt');
      expect(deletedAt).toBeDefined();
      expect(deletedAt.Type.toLowerCase()).toContain('datetime');
    });

    test('should have manager_id column', () => {
      const managerId = columns.find(c => c.Field === 'manager_id');
      expect(managerId).toBeDefined();
    });
  });

  describe('transactions table', () => {
    let columns = [];
    
    beforeAll(async () => {
      columns = await getColumns('transactions');
    });

    test('should have signature_data column', () => {
      const signatureData = columns.find(c => c.Field === 'signature_data');
      expect(signatureData).toBeDefined();
    });
  });

  describe('clients table', () => {
    let columns = [];
    
    beforeAll(async () => {
      columns = await getColumns('clients');
    });

    test('should have agent column for legacy import compatibility', () => {
      const agent = columns.find(c => c.Field === 'agent');
      expect(agent).toBeDefined();
    });

    test('should have collector_id column', () => {
      const collectorId = columns.find(c => c.Field === 'collector_id');
      expect(collectorId).toBeDefined();
    });
  });

  describe('DEBT-D03: transactions.client_id FK', () => {
    let testClientId = null;

    test('should have fk_transactions_client constraint with ON DELETE RESTRICT', async () => {
      const [rows] = await pool.query(`
        SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, DELETE_RULE
        FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'transactions'
          AND CONSTRAINT_NAME = 'fk_transactions_client'
      `);
      expect(rows.length).toBe(1);
      expect(rows[0].REFERENCED_TABLE_NAME).toBe('clients');
      expect(rows[0].DELETE_RULE).toBe('RESTRICT');
    });

    test('should reject inserting transaction with invalid client_id', async () => {
      try {
        await pool.query(`
          INSERT INTO transactions (date, amount, client_id)
          VALUES (NOW(), 100, 999999999)
        `);
        fail('Should have thrown a foreign key constraint error');
      } catch (error) {
        expect(error.code).toBe('ER_NO_REFERENCED_ROW_2');
      }
    });

    test('should allow deleting client without transactions', async () => {
      const [result] = await pool.query(`
        INSERT INTO clients (first_name, last_name, status)
        VALUES ('Test', 'NoTransaction', 'pending')
      `);
      const clientId = result.insertId;

      const [deleteResult] = await pool.query('DELETE FROM clients WHERE id = ?', [clientId]);
      expect(deleteResult.affectedRows).toBe(1);
    });

    test('should reject deleting client with transactions', async () => {
      const [clientResult] = await pool.query(`
        INSERT INTO clients (first_name, last_name, status)
        VALUES ('Test', 'HasTransaction', 'pending')
      `);
      testClientId = clientResult.insertId;

      await pool.query(`
        INSERT INTO transactions (date, amount, client_id)
        VALUES (NOW(), 100, ?)
      `, [testClientId]);

      try {
        await pool.query('DELETE FROM clients WHERE id = ?', [testClientId]);
        fail('Should have thrown a foreign key constraint error');
      } catch (error) {
        expect(error.code).toBe('ER_ROW_IS_REFERENCED_2');
      }

      await pool.query('DELETE FROM transactions WHERE client_id = ?', [testClientId]);
      await pool.query('DELETE FROM clients WHERE id = ?', [testClientId]);
    });
  });

  describe('DEBT-D04: Index Optimizations', () => {
    test('transactions table should have correct optimized indexes', async () => {
      const [rows] = await pool.query('SHOW INDEX FROM transactions');
      const indexNames = rows.map(r => r.Key_name);

      // Présence
      expect(indexNames).toContain('idx_transactions_client');
      expect(indexNames).toContain('idx_transactions_collector_status');
      expect(indexNames).toContain('idx_transactions_status_date');

      // Absence (supprimés)
      expect(indexNames).not.toContain('idx_transactions_collector');
      expect(indexNames).not.toContain('idx_transactions_status');
    });

    test('clients table should have correct optimized indexes', async () => {
      const [rows] = await pool.query('SHOW INDEX FROM clients');
      const indexNames = rows.map(r => r.Key_name);

      // Présence
      expect(indexNames).toContain('idx_clients_collector');
    });
  });
});
