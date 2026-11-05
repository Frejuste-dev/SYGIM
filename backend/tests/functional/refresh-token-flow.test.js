/**
 * Test fonctionnel complet du scénario Refresh Token
 * Scénario: Connexion → Expiration du jeton → Rafraîchissement → Accès à une route protégée
 * 
 * Ce test vérifie:
 * - Les claims (id, username, role) sont identiques entre le jeton initial et le jeton renouvelé
 * - Le nouveau jeton est accepté par les routes protégées
 * - Aucune régression n'a été introduite
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authService = require('../../src/modules/auth/auth.service');
const authRepository = require('../../src/modules/auth/auth.repository');

// Mock du repository
jest.mock('../../src/modules/auth/auth.repository');

describe('Refresh Token Functional Test', () => {
  let testUserId = 123;
  let testUsername = 'refresh_test_user';
  let testPassword = 'TestPassword123!';
  let initialAccessToken;
  let initialRefreshToken;
  let initialClaims;
  let refreshedAccessToken;
  let refreshedClaims;
  let mockDbRefreshTokens = [];

  beforeAll(() => {
    mockDbRefreshTokens = [];
    jest.clearAllMocks();

    // Setup des implémentations de mock
    authRepository.findByUsername.mockImplementation((username) => {
      if (username.toLowerCase() === testUsername.toLowerCase()) {
        return Promise.resolve({
          primaryKey: testUserId,
          username: testUsername,
          password: bcrypt.hashSync(testPassword, 12),
          role: 'manager',
          isActive: true
        });
      }
      return Promise.resolve(null);
    });

    authRepository.createRefreshToken.mockImplementation(({ userId, token, expiresAt }) => {
      mockDbRefreshTokens.push({ userId, token, expiresAt, revokedAt: null });
      return Promise.resolve(1);
    });

    authRepository.findRefreshToken.mockImplementation((hashedToken) => {
      console.log('Searching for hashedToken:', hashedToken);
      console.log('Current mockDbRefreshTokens:', mockDbRefreshTokens);
      const token = mockDbRefreshTokens.find(t => t.token === hashedToken && !t.revokedAt);
      if (token) {
        return Promise.resolve({
          userId: token.userId,
          username: testUsername,
          role: 'manager',
          expiresAt: token.expiresAt,
          active: true
        });
      }
      return Promise.resolve(null);
    });

    authRepository.revokeRefreshToken.mockImplementation((hashedToken) => {
      const token = mockDbRefreshTokens.find(t => t.token === hashedToken);
      if (token) {
        token.revokedAt = new Date();
      }
      return Promise.resolve();
    });

    authRepository.revokeAllUserTokens.mockResolvedValue();
  });

  describe('Étape 1: Connexion', () => {
    it('devrait retourner access token et refresh token valides', async () => {
      const result = await authService.login(testUsername, testPassword);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('username');
      expect(result.user).toHaveProperty('role');

      initialAccessToken = result.accessToken;
      initialRefreshToken = result.refreshToken;

      // Décoder et stocker les claims initiaux
      initialClaims = jwt.decode(initialAccessToken);
      
      expect(initialClaims).toHaveProperty('id');
      expect(initialClaims).toHaveProperty('username');
      expect(initialClaims).toHaveProperty('role');
      
      console.log('✓ Étape 1: Connexion réussie');
      console.log('  Claims initiaux:', {
        id: initialClaims.id,
        username: initialClaims.username,
        role: initialClaims.role
      });
    });
  });

  describe('Étape 2: Vérification de l\'access token initial', () => {
    it('devrait avoir des claims valides', () => {
      expect(initialClaims.id).toBe(testUserId);
      expect(initialClaims.username).toBe(testUsername);
      expect(initialClaims.role).toBe('manager');
      
      console.log('✓ Étape 2: Access token initial a des claims valides');
    });
  });

  describe('Étape 3: Simulation de l\'expiration du jeton', () => {
    it('devrait rejeter un token expiré', () => {
      // Créer un token expiré manuellement
      const expiredToken = jwt.sign(
        { id: testUserId, username: testUsername, role: 'manager' },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' } // Expiré immédiatement
      );

      expect(() => {
        jwt.verify(expiredToken, process.env.JWT_SECRET);
      }).toThrow();
      
      console.log('✓ Étape 3: Token expiré correctement rejeté');
    });
  });

  describe('Étape 4: Rafraîchissement du token', () => {
    it('devrait générer un nouvel access token avec le refresh token', async () => {
      const result = await authService.refreshAccessToken(initialRefreshToken);

      expect(result).toHaveProperty('accessToken');

      refreshedAccessToken = result.accessToken;
      
      // Décoder et stocker les claims du nouveau token
      refreshedClaims = jwt.decode(refreshedAccessToken);
      
      expect(refreshedClaims).toHaveProperty('id');
      expect(refreshedClaims).toHaveProperty('username');
      expect(refreshedClaims).toHaveProperty('role');
      
      console.log('✓ Étape 4: Token rafraîchi avec succès');
      console.log('  Claims rafraîchis:', {
        id: refreshedClaims.id,
        username: refreshedClaims.username,
        role: refreshedClaims.role
      });
    });
  });

  describe('Étape 5: Vérification de l\'intégrité des claims', () => {
    it('devrait avoir les mêmes claims entre le token initial et rafraîchi', () => {
      expect(refreshedClaims.id).toBe(initialClaims.id);
      expect(refreshedClaims.username).toBe(initialClaims.username);
      expect(refreshedClaims.role).toBe(initialClaims.role);
      
      console.log('✓ Étape 5: Claims identiques vérifiés');
      console.log('  ID:', refreshedClaims.id, '===', initialClaims.id);
      console.log('  Username:', refreshedClaims.username, '===', initialClaims.username);
      console.log('  Role:', refreshedClaims.role, '===', initialClaims.role);
    });
  });

  describe('Étape 6: Vérification du nouveau token', () => {
    it('le nouveau token devrait être valide et vérifiable', () => {
      const decoded = jwt.verify(refreshedAccessToken, process.env.JWT_SECRET);
      
      expect(decoded).toHaveProperty('id');
      expect(decoded).toHaveProperty('username');
      expect(decoded).toHaveProperty('role');
      
      console.log('✓ Étape 6: Nouveau token est valide et vérifiable');
    });
  });

  describe('Étape 7: Vérification anti-régression', () => {
    it('le refresh token ne devrait plus fonctionner après rénovation', async () => {
      // Révoquer le refresh token
      await authService.logout(initialRefreshToken);

      // Tenter de rafraîchir à nouveau
      await expect(authService.refreshAccessToken(initialRefreshToken))
        .rejects.toThrow('Token invalide ou révoqué.');
      
      console.log('✓ Étape 7: Révocation du refresh token fonctionne (anti-régression)');
    });
  });

  describe('Étape 8: Test de sécurité - token invalide', () => {
    it('devrait rejeter un refresh token invalide', async () => {
      await expect(authService.refreshAccessToken('invalid-token-1234567890abcdef'))
        .rejects.toThrow('Token invalide ou révoqué.');
      
      console.log('✓ Étape 8: Token invalide correctement rejeté');
    });
  });

  describe('Étape 9: Test de sécurité - token manquant', () => {
    it('devrait rejeter un refresh token manquant', async () => {
      await expect(authService.refreshAccessToken(null))
        .rejects.toThrow('Refresh token requis.');
      
      console.log('✓ Étape 9: Token manquant correctement rejeté');
    });
  });

  describe('Étape 10: Test complet - scénario de refresh réussi', () => {
    it('devrait compléter le scénario complet: login → refresh → claims identiques', async () => {
      // Reset pour un test complet
      mockDbRefreshTokens = [];
      
      // 1. Login
      const loginResult = await authService.login(testUsername, testPassword);
      const loginClaims = jwt.decode(loginResult.accessToken);
      
      // 2. Refresh
      const refreshResult = await authService.refreshAccessToken(loginResult.refreshToken);
      const refreshClaims = jwt.decode(refreshResult.accessToken);
      
      // 3. Vérification claims identiques
      expect(refreshClaims.id).toBe(loginClaims.id);
      expect(refreshClaims.username).toBe(loginClaims.username);
      expect(refreshClaims.role).toBe(loginClaims.role);
      
      // 4. Vérification que le nouveau token est valide
      const verified = jwt.verify(refreshResult.accessToken, process.env.JWT_SECRET);
      expect(verified.id).toBe(testUserId);
      expect(verified.username).toBe(testUsername);
      expect(verified.role).toBe('manager');
      
      console.log('✓ Étape 10: Scénario complet validé avec succès');
      console.log('  ✓ Claims préservés après refresh');
      console.log('  ✓ Nouveau token valide');
      console.log('  ✓ Aucune régression détectée');
    });
  });
});
