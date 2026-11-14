const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../src/config/database');
const authRepository = require('../../../src/modules/auth/auth.repository');

const extractCookie = (res, cookieName) => {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return null;
  const cookie = cookies.find(c => c.startsWith(`${cookieName}=`));
  return cookie ? cookie.split(';')[0].split('=')[1] : null;
};

describe('Refresh Tokens', () => {
  let testUser;

  beforeAll(async () => {
    // Créer un utilisateur de test
    const [result] = await pool.query(
      `INSERT INTO users (username, password_hash, role, active) 
       VALUES ('test_refresh_user', '$2a$12$V.vP...dummy_hash...', 'collector', 1)`
    );
    testUser = { id: result.insertId };
  });

  afterAll(async () => {
    // Nettoyage
    await pool.query('DELETE FROM refresh_tokens WHERE userId = ?', [testUser.id]);
    await pool.query('DELETE FROM users WHERE id = ?', [testUser.id]);
  });

  describe('Schéma et Opérations de base (Tests 1 à 6)', () => {
    it('Test 1 & 2 - Création et Insertion : doit enregistrer un token valide', async () => {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const id = await authRepository.createRefreshToken({
        userId: testUser.id,
        token: 'dummy_hash_1',
        expiresAt
      });

      expect(id).toBeDefined();
    });

    it('Test 3 - Recherche : doit retrouver un token valide', async () => {
      const tokenRecord = await authRepository.findRefreshToken('dummy_hash_1');
      
      expect(tokenRecord).toBeDefined();
      expect(tokenRecord.token).toBe('dummy_hash_1');
      expect(tokenRecord.userId).toBe(testUser.id);
    });

    it('Test 4 - Expiration : doit différencier un token expiré via la date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      await authRepository.createRefreshToken({
        userId: testUser.id,
        token: 'dummy_expired_token',
        expiresAt: pastDate
      });

      const tokenRecord = await authRepository.findRefreshToken('dummy_expired_token');
      expect(tokenRecord).toBeDefined(); // La query DB le trouve car pas révoqué
      expect(new Date(tokenRecord.expiresAt).getTime()).toBeLessThan(Date.now()); // Mais on voit qu'il est expiré
    });

    it('Test 5 - Révocation : doit masquer les tokens révoqués', async () => {
      await authRepository.createRefreshToken({
        userId: testUser.id,
        token: 'dummy_revoked_token',
        expiresAt: new Date(Date.now() + 100000)
      });

      await authRepository.revokeRefreshToken('dummy_revoked_token');
      
      const tokenRecord = await authRepository.findRefreshToken('dummy_revoked_token');
      expect(tokenRecord).toBeUndefined(); // findRefreshToken filtre \`revokedAt IS NULL\`
    });

    it('Test 6 - Foreign Key : doit échouer pour un utilisateur inexistant', async () => {
      await expect(
        authRepository.createRefreshToken({
          userId: 999999, // Inexistant
          token: 'dummy_fk_fail',
          expiresAt: new Date()
        })
      ).rejects.toThrow();
    });
  });

  describe('Test 7 - Auth Flow (Intégration)', () => {
    it('doit rejeter un refresh_token invalide/révoqué sur /auth/refresh', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=un_token_qui_nexiste_pas');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Token invalide ou révoqué.');
    });
  });

  describe('Rotation du Refresh Token et Sécurité', () => {
    let currentRefreshToken;
    let newRefreshToken;
    let accessTokenCookieStr;

    it('Prérequis - Création token initial', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'Admin2026!' });
        
      currentRefreshToken = extractCookie(res, 'refreshToken');
    });

    it('Test A — Rotation réussie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${currentRefreshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.data) {
        expect(res.body.data).not.toHaveProperty('accessToken');
        expect(res.body.data).not.toHaveProperty('refreshToken');
      }
      expect(res.body).not.toHaveProperty('accessToken');
      expect(res.body).not.toHaveProperty('refreshToken');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('Path=/api/auth/');
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Lax');

      newRefreshToken = extractCookie(res, 'refreshToken');
      expect(newRefreshToken).not.toBe(currentRefreshToken);
    });

    it('Test B — Ancien token inutilisable (révoqué)', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${currentRefreshToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Token invalide ou révoqué.');
    });

    it('Test C — Nouveau token fonctionnel', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${newRefreshToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.data) {
        expect(res.body.data).not.toHaveProperty('accessToken');
        expect(res.body.data).not.toHaveProperty('refreshToken');
      }
      expect(res.body).not.toHaveProperty('accessToken');
      expect(res.body).not.toHaveProperty('refreshToken');
      
      const cookies = res.headers['set-cookie'];
      const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
      newRefreshToken = extractCookie(res, 'refreshToken');
      
      const accessCookie = cookies.find(c => c.startsWith('accessToken='));
      accessTokenCookieStr = accessCookie.split(';')[0];
    });

    it('Test D — Logout avec nouveau path', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`refreshToken=${newRefreshToken}`, accessTokenCookieStr].join('; '));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.body.data) {
        expect(res.body.data).not.toHaveProperty('accessToken');
        expect(res.body.data).not.toHaveProperty('refreshToken');
      }
      expect(res.body).not.toHaveProperty('accessToken');
      expect(res.body).not.toHaveProperty('refreshToken');

      const cookies = res.headers['set-cookie'];
      const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
      expect(refreshCookie).toContain('Expires=Thu, 01 Jan 1970'); // Expiré
      expect(refreshCookie).toContain('Path=/api/auth/'); // Respect du path
      
      const crypto = require('crypto');
      const hashedToken = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
      const tokenRecord = await authRepository.findRefreshToken(hashedToken);
      expect(tokenRecord).toBeUndefined(); // Révoqué
    });
  });
});
