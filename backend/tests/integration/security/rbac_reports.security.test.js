const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../src/config/database');
const { generateToken } = require('../../../src/middleware/auth.middleware');

describe('Security - RBAC & Reports Anti-IDOR Tests', () => {
  let adminToken, collectorToken, accountingToken, owner1Token, owner2Token;
  let owner1Id, owner2Id, propertyId;

  beforeAll(async () => {
    // Nettoyage préalable
    await pool.query("DELETE FROM users WHERE username LIKE '%_rbac_test'");
    await pool.query("DELETE FROM owners WHERE first_name LIKE '%_rbac_test'");
    await pool.query("DELETE FROM properties WHERE name LIKE '%_rbac_test'");

    // Création des utilisateurs
    const [adminRes] = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ('admin_rbac_test', 'hash', 'admin')"
    );
    const [colRes] = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ('col_rbac_test', 'hash', 'collector')"
    );
    const [accRes] = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ('acc_rbac_test', 'hash', 'accounting')"
    );
    const [own1User] = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ('own1_rbac_test', 'hash', 'owner')"
    );
    const [own2User] = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ('own2_rbac_test', 'hash', 'owner')"
    );

    // Tokens
    adminToken = generateToken({ id: adminRes.insertId, role: 'admin' });
    collectorToken = generateToken({ id: colRes.insertId, role: 'collector' });
    accountingToken = generateToken({ id: accRes.insertId, role: 'accounting' });
    owner1Token = generateToken({ id: own1User.insertId, role: 'owner' });
    owner2Token = generateToken({ id: own2User.insertId, role: 'owner' });

    // Création des 2 propriétaires liés aux users
    const [o1] = await pool.query(
      "INSERT INTO owners (user_id, first_name, last_name, phone) VALUES (?, 'Owner1_rbac_test', 'Test', '010101')",
      [own1User.insertId]
    );
    owner1Id = o1.insertId;

    const [o2] = await pool.query(
      "INSERT INTO owners (user_id, first_name, last_name, phone) VALUES (?, 'Owner2_rbac_test', 'Test', '020202')",
      [own2User.insertId]
    );
    owner2Id = o2.insertId;

    // Création d'une propriété pour tests d'attribution
    const [prop] = await pool.query(
      "INSERT INTO properties (name, type, status, address, owner_id) VALUES ('Prop_rbac_test', 'appartement', 'vacant', 'Test Address', ?)",
      [owner1Id]
    );
    propertyId = prop.insertId;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE username LIKE '%_rbac_test'");
    await pool.query("DELETE FROM owners WHERE first_name LIKE '%_rbac_test'");
    await pool.query("DELETE FROM properties WHERE name LIKE '%_rbac_test'");
  });

  describe('SEC-02: Collector RBAC Protection on Financial & Tax Reports', () => {
    it('Collector CANNOT access mandate-bfr (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/reports/mandate-bfr')
        .set('Authorization', `Bearer ${collectorToken}`);
      expect(res.status).toBe(403);
    });

    it('Collector CANNOT access aged-receivables (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/reports/aged-receivables')
        .set('Authorization', `Bearer ${collectorToken}`);
      expect(res.status).toBe(403);
    });

    it('Collector CANNOT access deposits report (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/reports/deposits')
        .set('Authorization', `Bearer ${collectorToken}`);
      expect(res.status).toBe(403);
    });

    it('Collector CANNOT access owner tax declaration (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/reports/tax-declaration/${owner1Id}`)
        .set('Authorization', `Bearer ${collectorToken}`);
      expect(res.status).toBe(403);
    });

    it('Collector CANNOT access owner ledger (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/reports/owner-ledger/${owner1Id}`)
        .set('Authorization', `Bearer ${collectorToken}`);
      expect(res.status).toBe(403);
    });

    it('Collector CANNOT access owner situation (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/reports/owner-situation/${owner1Id}`)
        .set('Authorization', `Bearer ${collectorToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('SEC-03: Broken Access Control on Lease Assignment', () => {
    it('Collector CANNOT assign a tenant to a property (403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/properties/${propertyId}/assign`)
        .set('Authorization', `Bearer ${collectorToken}`)
        .send({
          newTenant: { lastName: 'Doe', phone: '07070707' },
          rent: 150000
        });
      expect(res.status).toBe(403);
    });
  });

  describe('SEC-05: Anti-IDOR for Owner Self-Service', () => {
    it('Owner 1 CAN view their own tax declaration (200 OK)', async () => {
      const res = await request(app)
        .get(`/api/reports/tax-declaration/${owner1Id}`)
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Owner 1 CANNOT view Owner 2 tax declaration (403 Forbidden - IDOR prevented)', async () => {
      const res = await request(app)
        .get(`/api/reports/tax-declaration/${owner2Id}`)
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(res.status).toBe(403);
    });

    it('Owner 1 CANNOT view Owner 2 situation report (403 Forbidden - IDOR prevented)', async () => {
      const res = await request(app)
        .get(`/api/reports/owner-situation/${owner2Id}`)
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(res.status).toBe(403);
    });

    it('Owner 1 CANNOT view Owner 2 ledger (403 Forbidden - IDOR prevented)', async () => {
      const res = await request(app)
        .get(`/api/reports/owner-ledger/${owner2Id}`)
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('SEC-04: Strict Parameter & Schema Validation', () => {
    it('Rejects invalid non-numeric ownerId with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/reports/tax-declaration/abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Rejects negative ownerId with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/reports/tax-declaration/-5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Rejects invalid fiscal year with 400 Bad Request', async () => {
      const res = await request(app)
        .get(`/api/reports/tax-declaration/${owner1Id}?year=1899`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('Rejects negative rent during tenant assignment with 400 Bad Request', async () => {
      const res = await request(app)
        .post(`/api/properties/${propertyId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rent: -50000,
          newTenant: { lastName: 'BadRent', phone: '09090909' }
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
