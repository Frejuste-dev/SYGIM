const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../src/config/database');
const { generateToken } = require('../../../src/middleware/auth.middleware');

describe('Security - IDOR Tests', () => {
  let adminToken, manager1Token, manager2Token, collector1Token, collector2Token, collector3Token;
  let manager1Id, manager2Id, collector1Id, collector2Id, collector3Id;
  let client1Id, client2Id, client3Id;
  let property1Id, owner1Id;

  beforeAll(async () => {
    // 0. Nettoyage
    await pool.query("DELETE FROM users WHERE username LIKE '%_idor'");
    await pool.query("DELETE FROM clients WHERE first_name LIKE '%_idor'");
    await pool.query("DELETE FROM owners WHERE first_name LIKE '%_idor'");
    await pool.query("DELETE FROM properties WHERE name LIKE '%_idor'");    // 1. Création des users
    const [adminRes] = await pool.query("INSERT INTO users (username, password_hash, role) VALUES ('admin_idor', 'hash', 'admin')");
    const [mgr1Res] = await pool.query("INSERT INTO users (username, password_hash, role) VALUES ('mgr1_idor', 'hash', 'collector_manager')");
    const [mgr2Res] = await pool.query("INSERT INTO users (username, password_hash, role) VALUES ('mgr2_idor', 'hash', 'collector_manager')");
    const [col1Res] = await pool.query("INSERT INTO users (username, password_hash, role) VALUES ('col1_idor', 'hash', 'collector')");
    const [col2Res] = await pool.query("INSERT INTO users (username, password_hash, role) VALUES ('col2_idor', 'hash', 'collector')");
    const [col3Res] = await pool.query("INSERT INTO users (username, password_hash, role) VALUES ('col3_idor', 'hash', 'collector')");
    
    // Tokens
    adminToken = generateToken({ id: adminRes.insertId, role: 'admin' });
    manager1Token = generateToken({ id: mgr1Res.insertId, role: 'collector_manager' });
    manager2Token = generateToken({ id: mgr2Res.insertId, role: 'collector_manager' });
    collector1Token = generateToken({ id: col1Res.insertId, role: 'collector' });
    collector2Token = generateToken({ id: col2Res.insertId, role: 'collector' });
    collector3Token = generateToken({ id: col3Res.insertId, role: 'collector' });

    // 2. Création des collecteurs
    // Mgr1 gère Col1 et Col2
    const [col1Db] = await pool.query("INSERT INTO collectors (user_id, manager_id, first_name, last_name) VALUES (?, ?, 'Col', '1')", [col1Res.insertId, mgr1Res.insertId]);
    collector1Id = col1Db.insertId;
    const [col2Db] = await pool.query("INSERT INTO collectors (user_id, manager_id, first_name, last_name) VALUES (?, ?, 'Col', '2')", [col2Res.insertId, mgr1Res.insertId]);
    collector2Id = col2Db.insertId;

    // Mgr2 gère Col3
    const [col3Db] = await pool.query("INSERT INTO collectors (user_id, manager_id, first_name, last_name) VALUES (?, ?, 'Col', '3')", [col3Res.insertId, mgr2Res.insertId]);
    collector3Id = col3Db.insertId;

    // 3. Création d'un Owner
    const [ownerRes] = await pool.query("INSERT INTO owners (first_name, last_name) VALUES ('Owner', '1')");
    owner1Id = ownerRes.insertId;

    // 4. Création d'une propriété (assignée à col1)
    const [propRes] = await pool.query("INSERT INTO properties (name, type, status, address, owner_id, collector_id) VALUES ('Prop 1', 'appartement', 'vacant', '123 Test St', ?, ?)", [owner1Id, collector1Id]);
    property1Id = propRes.insertId;

    // 5. Création des clients (locataires)
    const [client1Db] = await pool.query("INSERT INTO clients (first_name, last_name, phone, collector_id) VALUES ('Client', '1', '01010101', ?)", [collector1Id]);
    client1Id = client1Db.insertId;
    const [client2Db] = await pool.query("INSERT INTO clients (first_name, last_name, phone, collector_id) VALUES ('Client', '2', '02020202', ?)", [collector2Id]);
    client2Id = client2Db.insertId;
    const [client3Db] = await pool.query("INSERT INTO clients (first_name, last_name, phone, collector_id) VALUES ('Client', '3', '03030303', ?)", [collector3Id]);
    client3Id = client3Db.insertId;
  });

  describe('Clients IDOR', () => {
    it('Manager 1 can create client for their team (Col 1)', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Cookie', `accessToken=${manager1Token}`)
        .send({ lastName: 'Test_idor', phone: `07${Math.floor(Math.random()*10000000)}`, collectorId: collector1Id });
      expect(res.status).toBe(201);
    });

    it('Manager 1 cannot assign client to Col 3 (other team) - 403', async () => {
      const res = await request(app)
        .post('/api/clients')
        .set('Cookie', `accessToken=${manager1Token}`)
        .send({ lastName: 'Test2_idor', phone: `08${Math.floor(Math.random()*10000000)}`, collectorId: collector3Id });
      expect(res.status).toBe(403);
    });
  });

  describe('Transactions IDOR', () => {
    it('Collector 1 can create transaction for Client 1', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Cookie', `accessToken=${collector1Token}`)
        .send({ clientId: client1Id, amount: 1000, method: 'cash' });
      expect(res.status).toBe(201);
    });

    it('Collector 1 cannot force collectorId in payload', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Cookie', `accessToken=${collector1Token}`)
        .send({ clientId: client1Id, amount: 1000, method: 'cash', collectorId: collector3Id });
      expect(res.status).toBe(201);
      
      // Transaction is created but forced to collector 1
      const [txs] = await pool.query('SELECT collector_id FROM transactions WHERE id = ?', [res.body.data.id]);
      expect(txs[0].collector_id).toBe(collector1Id);
    });

    it('Manager 1 cannot create transaction for Client 3 (other team) - 403', async () => {
      const res = await request(app)
        .post('/api/transactions')
        .set('Cookie', `accessToken=${manager1Token}`)
        .send({ clientId: client3Id, amount: 1000, method: 'cash' });
      expect(res.status).toBe(403);
    });
  });

  describe('Collectors IDOR', () => {
    it('Collector 1 can view own profile', async () => {
      const res = await request(app)
        .get(`/api/collectors/${collector1Id}`)
        .set('Cookie', `accessToken=${collector1Token}`);
      expect(res.status).toBe(200);
    });

    it('Collector 1 cannot view Col 2 profile - 403', async () => {
      const res = await request(app)
        .get(`/api/collectors/${collector2Id}`)
        .set('Cookie', `accessToken=${collector1Token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Owners IDOR', () => {
    it('Collector 1 can view Owner 1 (linked via property) - 200', async () => {
      const res = await request(app)
        .get(`/api/owners/${owner1Id}`)
        .set('Cookie', `accessToken=${collector1Token}`);
      expect(res.status).toBe(200);
    });

    it('Collector 3 cannot view Owner 1 (not linked) - 403', async () => {
      const res = await request(app)
        .get(`/api/owners/${owner1Id}`)
        .set('Cookie', `accessToken=${collector3Token}`);
      expect(res.status).toBe(403);
    });

    it('Manager 1 can view Owner 1 (linked via team) - 200', async () => {
      const res = await request(app)
        .get(`/api/owners/${owner1Id}`)
        .set('Cookie', `accessToken=${manager1Token}`);
      expect(res.status).toBe(200);
    });

    it('Manager 2 cannot view Owner 1 (not linked) - 403', async () => {
      const res = await request(app)
        .get(`/api/owners/${owner1Id}`)
        .set('Cookie', `accessToken=${manager2Token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Alerts IDOR', () => {
    it('Manager 2 cannot acknowledge alert for Client 1 (other team) - 403', async () => {
      const res = await request(app)
        .put(`/api/alerts/${client1Id}/acknowledge`)
        .set('Cookie', `accessToken=${manager2Token}`);
      expect(res.status).toBe(403);
    });
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE username LIKE '%_idor'");
    await pool.query("DELETE FROM clients WHERE first_name LIKE '%_idor'");
    await pool.query("DELETE FROM owners WHERE first_name LIKE '%_idor'");
    await pool.query("DELETE FROM properties WHERE name LIKE '%_idor'");
  });
});
