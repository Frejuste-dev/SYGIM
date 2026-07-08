/**
 * module: Auth Service Tests
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const authService = require('../auth.service');
const authRepository = require('../auth.repository');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../../../utils/errors/AppError');

// Mock des dépendances
jest.mock('../auth.repository');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService Unit Tests', () => {
  const mockUser = {
    primaryKey: 1,
    username: 'testuser',
    password: 'hashedpassword',
    role: 'admin',
    isActive: true,
    deletedAt: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'a'.repeat(64);
  });

  describe('login()', () => {
    test('1. login() — identifiants invalides (user inexistant) → AppError 401', async () => {
      authRepository.findByUsername.mockResolvedValue(null);

      await expect(authService.login('unknown', 'pwd'))
        .rejects.toThrow(new AppError('Identifiants invalides.', 401));
    });

    test('2. login() — mauvais password → AppError 401', async () => {
      authRepository.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login('testuser', 'wrongpwd'))
        .rejects.toThrow(new AppError('Identifiants invalides.', 401));
    });

    test('3. login() — compte inactif → AppError 403', async () => {
      authRepository.findByUsername.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(authService.login('testuser', 'pwd'))
        .rejects.toThrow(new AppError('Compte inactif. Contactez l\'administrateur.', 403));
    });

    test('4. login() — succès → retourne accessToken + refreshToken', async () => {
      authRepository.findByUsername.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mockAccessToken');
      authRepository.createRefreshToken.mockResolvedValue(1);

      const result = await authService.login('testuser', 'pwd');

      expect(result).toHaveProperty('accessToken', 'mockAccessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.username).toBe('testuser');
      expect(authRepository.createRefreshToken).toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken()', () => {
    test('5. refreshAccessToken() — token inconnu → AppError 401', async () => {
      authRepository.findRefreshToken.mockResolvedValue(null);

      await expect(authService.refreshAccessToken('invalidToken'))
        .rejects.toThrow(new AppError('Token invalide ou révoqué.', 401));
    });

    test('6. refreshAccessToken() — token révoqué → handled by findRefreshToken returning null', async () => {
      authRepository.findRefreshToken.mockResolvedValue(null);

      await expect(authService.refreshAccessToken('revokedToken'))
        .rejects.toThrow(new AppError('Token invalide ou révoqué.', 401));
    });

    test('7. refreshAccessToken() — token expiré → AppError 401', async () => {
      const expiredToken = {
        userId: 1,
        expiresAt: new Date(Date.now() - 10000), // Expire il y a 10s
        active: true
      };
      authRepository.findRefreshToken.mockResolvedValue(expiredToken);

      await expect(authService.refreshAccessToken('expiredToken'))
        .rejects.toThrow(new AppError('Token expiré.', 401));
    });

    test('8. refreshAccessToken() — succès → retourne nouvel accessToken', async () => {
      const validToken = {
        userId: 1,
        username: 'testuser',
        role: 'admin',
        expiresAt: new Date(Date.now() + 100000),
        active: true
      };
      authRepository.findRefreshToken.mockResolvedValue(validToken);
      jwt.sign.mockReturnValue('newAccessToken');

      const result = await authService.refreshAccessToken('validRefreshToken');

      expect(result).toEqual({ accessToken: 'newAccessToken' });
      expect(jwt.sign).toHaveBeenCalled();
    });
  });

  describe('logout()', () => {
    test('9. logout() — révoque le token en DB', async () => {
      await authService.logout('tokenToRevoke');
      expect(authRepository.revokeRefreshToken).toHaveBeenCalled();
    });

    test('10. logout() — token déjà révoqué → comportement idempotent', async () => {
      authRepository.revokeRefreshToken.mockResolvedValue();
      await authService.logout('alreadyRevoked');
      expect(authRepository.revokeRefreshToken).toHaveBeenCalled();
    });
  });
});
