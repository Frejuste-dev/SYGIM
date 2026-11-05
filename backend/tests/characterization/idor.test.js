// Set the DB explicitly for characterization BEFORE any require
process.env.DB_NAME = 'sygim_characterization';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../config/db');

describe('Characterization Tests - Phase 2.0 (IDOR & RBAC)', () => {
  let collector1Agent;
  let collector2Agent;
  let managerAgent;
  let adminAgent;

  beforeAll(async () => {
    // Authenticate all test users
    collector1Agent = request.agent(app);
    collector2Agent = request.agent(app);
    managerAgent = request.agent(app);
    adminAgent = request.agent(app);

    const resCol1 = await collector1Agent.post('/api/auth/login').send({ username: 'col1', password: 'password123' });
    console.log('Login Col1 Body:', resCol1.body, resCol1.status);
    await collector2Agent.post('/api/auth/login').send({ username: 'col2', password: 'password123' });
    await managerAgent.post('/api/auth/login').send({ username: 'manager', password: 'password123' });
    await adminAgent.post('/api/auth/login').send({ username: 'admin', password: 'password123' });
  });

  afterAll(async () => {
    await db.pool.end(); // close DB connection so test exits cleanly
  });

  describe('Transactions IDOR Characterization', () => {
    it("LEGACY BEHAVIOR / KNOWN VULNERABILITY: Can Collector 1 read Collector 2's transaction?", async () => {
      // Transaction 1 belongs to Client 2, which belongs to Collector 2 (Seed)
      const res = await collector1Agent.get('/api/transactions/1');
      console.log('Collector 1 fetching Transaction 1:', res.status, res.body);
      
      // OBSERVED BEHAVIOR: The system correctly blocks this IDOR with 403
      expect(res.status).toBe(403); // ✅ PROTECTED IN LEGACY
    });

    it("LEGACY BEHAVIOR: Can Collector 1 update Collector 2's transaction?", async () => {
      const res = await collector1Agent.put('/api/transactions/1').send({ amount: 1000 });
      console.log('Collector 1 updating Transaction 1:', res.status, res.body);
      
      // We expect the system to block this with 403, just like GET.
      expect(res.status).toBe(403);
    });

    it("LEGACY BEHAVIOR: Can Collector 1 delete Collector 2's transaction?", async () => {
      const res = await collector1Agent.delete('/api/transactions/1');
      console.log('Collector 1 deleting Transaction 1:', res.status, res.body);
      
      // We expect the system to block this with 403, just like GET.
      expect(res.status).toBe(403);
    });

    it("LEGACY BEHAVIOR: Can Collector 1 create a transaction for Collector 2's client?", async () => {
      const res = await collector1Agent.post('/api/transactions').send({
        clientId: 2, // Belongs to Collector 2
        amount: 500,
        method: 'cash',
        type: 'loyer'
      });
      console.log('Collector 1 creating tx for Client 2:', res.status, res.body);
      
      // The system should block this with 403.
      expect(res.status).toBe(403);
    });
  });

  describe('Clients IDOR Characterization', () => {
    it('LEGACY BEHAVIOR: Can Collector 1 fetch a client belonging to someone else?', async () => {
      // Client 2 belongs to Collector 2
      const res = await collector1Agent.get('/api/clients/2'); 
      console.log('Collector 1 fetching Client 2:', res.status, res.body);
      
      // OBSERVED BEHAVIOR: The system correctly blocks this IDOR with 403
      expect(res.status).toBe(403); // ✅ PROTECTED IN LEGACY
    });
  });

  describe('Properties IDOR Characterization', () => {
    it("LEGACY BEHAVIOR / KNOWN VULNERABILITY: Can Collector 1 fetch a property belonging to someone else?", async () => {
      const res = await collector1Agent.get('/api/properties/2');
      console.log('Collector 1 fetching Property 2:', res.status, res.body);
      
      // VULNERABILITY: PropertyController.getById overrides BaseController.getOne
      // and forgets to call checkOwnership! So this returns 200 OK.
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(2);
      expect(res.body.data.collector_id).toBe(2);
    });
  });
});
