jest.mock('../../../src/config/database', () => ({
  pool: {
    query: jest.fn()
  }
}));

const { pool } = require('../../../src/config/database');
const authRepository = require('../../../src/modules/auth/auth.repository');

describe('AuthRepository Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findRefreshToken', () => {
    it('should load the username required to generate the refreshed access token', async () => {
      const tokenRecord = {
        userId: 1,
        username: 'testuser',
        role: 'admin',
        active: true
      };
      pool.query.mockResolvedValue([[tokenRecord]]);

      const result = await authRepository.findRefreshToken('hashed-token');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('rt.token = ?'),
        ['hashed-token']
      );
      expect(result).toEqual(tokenRecord);
    });
  });
});
