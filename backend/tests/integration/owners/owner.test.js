/**
 * Tests d'intégration — Module Owners
 * Vérification de la logique patrimoniale et sécurité Enterprise
 */

const request = require('supertest');
const app = require('../../../src/app');

describe('Owner Integration Tests (OWNER)', () => {
  let authToken;
  let testOwnerId;

  beforeAll(async () => {
    // Login to get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin2026!' });
    
    authToken = res.body.token;
  });

  /**
   * OWNER-001: Création propriétaire
   */
  test('OWNER-001: Should create a new owner', async () => {
    const res = await request(app)
      .post('/api/owners')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        firstName: 'Jean',
        lastName: 'Dupont',
        phone: '0102030405',
        email: 'jean.dupont@test.com'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    testOwnerId = res.body.data.id;
  });

  /**
   * OWNER-005: Portfolio Summary
   */
  test('OWNER-005: Should retrieve portfolio summary', async () => {
    const res = await request(app)
      .get(`/api/owners/${testOwnerId}/portfolio`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('propertyCount');
    expect(res.body.data).toHaveProperty('monthlyRevenue');
  });

  /**
   * OWNER-002: Dashboard
   */
  test('OWNER-002: Should retrieve owner dashboard', async () => {
    const res = await request(app)
      .get(`/api/owners/${testOwnerId}/dashboard`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('portfolio');
    expect(res.body.data).toHaveProperty('alerts');
  });

  /**
   * OWNER-004: Suppression protégée
   * On teste la suppression d'un propriétaire sans biens (devrait marcher)
   */
  test('OWNER-004: Should soft delete an owner with no properties', async () => {
    const res = await request(app)
      .delete(`/api/owners/${testOwnerId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('désactivé');
  });
});
