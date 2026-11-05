const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authService = require('../../../src/modules/auth/auth.service');
const authRepository = require('../../../src/modules/auth/auth.repository');
const AppError = require('../../../src/utils/errors/AppError');

// Mock dependencies
jest.mock('../../../src/modules/auth/auth.repository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockUser = {
      primaryKey: 1,
      username: 'testuser',
      password: 'hashedpassword',
      role: 'admin',
      isActive: true
    };

    it('should throw error if user not found', async () => {
      authRepository.findByUsername.mockResolvedValue(null);

      await expect(authService.login('wronguser', 'password'))
        .rejects.toThrow(AppError);
      
      try {
        await authService.login('wronguser', 'password');
      } catch (err) {
        expect(err.statusCode).toBe(401);
        expect(err.message).toBe('Identifiants invalides.');
      }
    });

    it('should throw error if user is inactive', async () => {
      authRepository.findByUsername.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(authService.login('testuser', 'password'))
        .rejects.toThrow(AppError);
    });

    it('should throw error if password is wrong', async () => {
      authRepository.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login('testuser', 'wrongpassword'))
        .rejects.toThrow(AppError);
    });

    it('should return tokens and user info on success', async () => {
      authRepository.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-access-token');
      authRepository.createRefreshToken.mockResolvedValue(true);

      const result = await authService.login('testuser', 'password');

      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toEqual({
        id: 1,
        username: 'testuser',
        role: 'admin'
      });
      expect(authRepository.createRefreshToken).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should throw error if no token provided', async () => {
      await expect(authService.refreshAccessToken(null))
        .rejects.toThrow('Refresh token requis.');
    });

    it('should throw error if token not found in db', async () => {
      authRepository.findRefreshToken.mockResolvedValue(null);
      await expect(authService.refreshAccessToken('some-token'))
        .rejects.toThrow('Token invalide ou révoqué.');
    });

    it('should generate new access token', async () => {
      const mockDbToken = {
        userId: 1,
        username: 'testuser',
        role: 'admin',
        expiresAt: new Date(Date.now() + 10000), // future
        active: true
      };
      authRepository.findRefreshToken.mockResolvedValue(mockDbToken);
      jwt.sign.mockReturnValue('new-mock-access-token');

      const result = await authService.refreshAccessToken('some-token');
      expect(result).toHaveProperty('accessToken', 'new-mock-access-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: 1, username: 'testuser', role: 'admin' },
        process.env.JWT_SECRET,
        expect.any(Object)
      );
    });
  });
});
