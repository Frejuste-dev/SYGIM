// Set the DB explicitly for characterization BEFORE any require
process.env.DB_NAME = 'sygim_characterization';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../config/db');

describe('Characterization Tests - Phase 2.0 (RBAC)', () => {
  let collectorAgent;
  let managerAgent;
  let adminAgent;

  beforeAll(async () => {
    collectorAgent = request.agent(app);
    managerAgent = request.agent(app);
    adminAgent = request.agent(app);

    // Login users with different roles
    await collectorAgent.post('/api/auth/login').send({ username: 'col1', password: 'password123' });
    await managerAgent.post('/api/auth/login').send({ username: 'col_manager_1', password: 'password123' });
    await adminAgent.post('/api/auth/login').send({ username: 'admin_sys', password: 'password123' });
  });

  afterAll(async () => {
    // Close the connection pool explicitly via the exported db object
    if (db && db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
  });

  describe('Global Reports Access', () => {
    it('LEGACY BEHAVIOR: Can a Collector access dashboard reports?', async () => {
      const res = await collectorAgent.get('/api/reports/dashboard');
      console.log('Collector fetching dashboard reports:', res.status, res.body);
      
      // OBSERVED BEHAVIOR: Collectors can view dashboard reports (200)
      expect(res.status).toBe(200);
    });

    it('LEGACY BEHAVIOR: Can a Manager access dashboard reports?', async () => {
      const res = await managerAgent.get('/api/reports/dashboard');
      console.log('Manager fetching dashboard reports:', res.status, res.body);
      
      // OBSERVED BEHAVIOR: Managers can view dashboard reports (200)
      expect(res.status).toBe(200);
    });
  });

  describe('User Management Access', () => {
    it('LEGACY BEHAVIOR: Can a Manager access the user list?', async () => {
      const res = await managerAgent.get('/api/users');
      console.log('Manager fetching user list:', res.status, res.body);
      
      // OBSERVED BEHAVIOR: Blocked in Legacy (403). Only Admin can view users.
      expect(res.status).toBe(403);
    });

    it('LEGACY BEHAVIOR: Can an Admin access the user list?', async () => {
      const res = await adminAgent.get('/api/users');
      console.log('Admin fetching user list:', res.status, res.body);
      
      // OBSERVED BEHAVIOR: Admin can view user list (200)
      expect(res.status).toBe(200);
    });
  });
});
