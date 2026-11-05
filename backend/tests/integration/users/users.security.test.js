const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../config/db');
const { generateToken } = require('../../../src/middleware/auth.middleware');

describe('Security: User & Profile Tests (DEBT-S04)', () => {
  let adminToken, userToken, testAdminId, testUserId;

  beforeAll(async () => {
    // Nettoyage et préparation de la base pour les tests
    await pool.query("DELETE FROM users WHERE username IN ('test_sec_admin', 'test_sec_user', 'test_new_user', 'hacked_admin')");
    
    const [adminResult] = await pool.query(
      `INSERT INTO users (username, password_hash, role, active) 
       VALUES ('test_sec_admin', 'hash', 'admin', 1)`
    );
    testAdminId = adminResult.insertId;
    adminToken = generateToken({ id: testAdminId, username: 'test_sec_admin', role: 'admin' });

    const [userResult] = await pool.query(
      `INSERT INTO users (username, password_hash, role, active) 
       VALUES ('test_sec_user', 'hash', 'collector', 1)`
    );
    testUserId = userResult.insertId;
    userToken = generateToken({ id: testUserId, username: 'test_sec_user', role: 'collector' });
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE username IN ('test_sec_admin', 'test_sec_user', 'test_new_user', 'hacked_admin')");
  });

  describe('User Service - Création & Mise à jour via /api/users', () => {
    
    it('Test 1 & 6: Un administrateur peut créer un admin, un utilisateur non.', async () => {
      // User normal tente de créer un utilisateur (sera bloqué par middleware authorize)
      let res = await request(app)
        .post('/api/users')
        .set('Cookie', `accessToken=${userToken}`)
        .send({
          username: 'test_new_user',
          email: 'test@example.com',
          password: 'password123',
          role: 'admin'
        });
      expect(res.status).toBe(403);

      // Admin crée un utilisateur en tant qu'admin
      res = await request(app)
        .post('/api/users')
        .set('Cookie', `accessToken=${adminToken}`)
        .send({
          username: 'test_new_user',
          email: 'new@example.com',
          password: 'password123',
          role: 'admin'
        });
      expect(res.status).toBe(201);
      
      const [[dbUser]] = await pool.query("SELECT role FROM users WHERE username = 'test_new_user'");
      expect(dbUser.role).toBe('admin');
    });

    it('Test 3: Impossible d\'injecter password_hash directement via update', async () => {
      const res = await request(app)
        .put(`/api/users/${testUserId}`)
        .set('Cookie', `accessToken=${adminToken}`)
        .send({
          password_hash: 'hacked_hash'
        });
      
      expect(res.status).toBe(400); // Car aucun champ valide mis à jour

      const [[dbUser]] = await pool.query("SELECT password_hash FROM users WHERE id = ?", [testUserId]);
      expect(dbUser.password_hash).toBe('hash'); // Inchangé
    });
  });

  describe('Auth Service - Profile via /api/auth/profile', () => {

    it('Test 1 & 2: Impossible de modifier son propre rôle ou statut actif', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Cookie', `accessToken=${userToken}`)
        .send({
          role: 'admin',
          active: false
        });
      
      // La whitelist rejette les champs "role" et "active". Si rien d'autre n'est valide => 400
      expect(res.status).toBe(400);

      const [[dbUser]] = await pool.query("SELECT role, active FROM users WHERE id = ?", [testUserId]);
      expect(dbUser.role).toBe('collector');
      expect(dbUser.active).toBe(1);
    });

    it('Test 4: IDOR - Impossible de modifier un autre utilisateur via le profile', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Cookie', `accessToken=${userToken}`)
        .send({
          userId: testAdminId,
          email: 'hacked@example.com',
          username: 'hacked_admin'
        });
      
      // Modification légitime des champs, mais elle doit s'appliquer au user authentifié (testUserId)
      if (res.status !== 200) console.log('DEBUG:', res.body);
      expect(res.status).toBe(200);

      // L'admin ne doit pas avoir été modifié
      const [[dbAdmin]] = await pool.query("SELECT email, username FROM users WHERE id = ?", [testAdminId]);
      expect(dbAdmin.username).toBe('test_sec_admin');

      // C'est l'utilisateur normal qui a vu ses données changer
      const [[dbUser]] = await pool.query("SELECT email, username FROM users WHERE id = ?", [testUserId]);
      expect(dbUser.username).toBe('hacked_admin');
      expect(dbUser.email).toBe('hacked@example.com');
    });

    it('Test 5: Modification légitime du profil', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Cookie', `accessToken=${userToken}`)
        .send({
          email: 'legit@example.com'
        });
      
      if (res.status !== 200) {
        console.log('TEST 5 FAILED:', res.status, res.body);
      }
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('legit@example.com');
      
      // password_hash ne doit pas être retourné ! (DEBT-S03 traitée partiellement ici)
      expect(res.body.data).not.toHaveProperty('password_hash');
    });
  });
});
