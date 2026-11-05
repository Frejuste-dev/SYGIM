const TransactionRepository = require('../../../src/modules/transactions/transaction.repository');
const { pool } = require('../../../config/db');
const { randomUUID } = require('crypto');

jest.mock('../../../config/db', () => ({
  pool: {
    getConnection: jest.fn()
  }
}));

describe('TransactionRepository', () => {
  let mockConnection;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = {
      beginTransaction: jest.fn(),
      query: jest.fn().mockResolvedValue([{ insertId: 1 }]),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn()
    };
    pool.getConnection.mockResolvedValue(mockConnection);
  });

  describe('createWithClientUpdate (TECH-002)', () => {
    it('should use explicit reference if provided', async () => {
      const data = { clientId: 1, amount: 100, reference: 'EXPLICIT-123' };
      await TransactionRepository.createWithClientUpdate(data);

      expect(mockConnection.query).toHaveBeenCalledTimes(2);
      const insertCall = mockConnection.query.mock.calls[0];
      const sqlParams = insertCall[1];
      // sqlParams[0] is reference
      expect(sqlParams[0]).toBe('EXPLICIT-123');
    });

    it('should generate a reference with randomUUID if none provided', async () => {
      const data = { clientId: 1, amount: 100 };
      await TransactionRepository.createWithClientUpdate(data);

      const insertCall = mockConnection.query.mock.calls[0];
      const sqlParams = insertCall[1];
      const generatedRef = sqlParams[0];
      
      expect(generatedRef).toMatch(/^RC-\d{8}-[A-Z0-9]{4}$/);
      expect(generatedRef.length).toBeLessThanOrEqual(100); // fits in VARCHAR(100) constraint
    });

    it('should generate different references for successive calls', async () => {
      const data1 = { clientId: 1, amount: 100 };
      const data2 = { clientId: 1, amount: 100 };

      await TransactionRepository.createWithClientUpdate(data1);
      await TransactionRepository.createWithClientUpdate(data2);

      const call1 = mockConnection.query.mock.calls[0][1][0];
      const call2 = mockConnection.query.mock.calls[2][1][0]; // second transaction insert

      expect(call1).toMatch(/^RC-/);
      expect(call2).toMatch(/^RC-/);
      expect(call1).not.toBe(call2);
    });
  });
});
