/**
 * Tests d'intégration — Module Properties
 * Vérification des règles métier et de l'architecture V2
 */

const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../src/config/database');

describe('Property Integration Tests (PROP)', () => {
  let authToken;
  let testPropertyId;
  let testTenantId;
  let testOwnerId;

  beforeAll(async () => {
    // 1. Login as admin to get token
    console.log("DB IN USE:", process.env.DB_NAME);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin2026!' }); // Dépend du seed
    
    const cookies = res.headers['set-cookie'];
    if (!cookies) {
        console.error('LOGIN FAILED (NO COOKIES):', res.status, res.body);
    } else {
        const tokenCookie = cookies.find(c => c.startsWith('accessToken='));
        if (tokenCookie) authToken = tokenCookie.split(';')[0].split('=')[1];
    }

    // 2. Setup IDs for tests (Ideally from seed or specific setup)
    // Pour l'instant, on suppose que des données de test existent ou on les crée
  });

  /**
   * PROP-001: Création bien
   */
  test('PROP-001: Should create a new property', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Cookie', `accessToken=${authToken}`)
      .send({
        name: 'Villa Test',
        address: '123 Rue de la Paix',
        type: 'maison',
        status: 'vacant',
        rent: 500000
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Villa Test');
    testPropertyId = res.body.data.id;
  });

  /**
   * PROP-008: Validation statut incohérent
   */
  test('PROP-008: Should fail if occupied property has no tenant', async () => {
    const res = await request(app)
      .put(`/api/properties/${testPropertyId}`)
      .set('Cookie', `accessToken=${authToken}`)
      .send({
        status: 'loue'
        // tenant_id manquant
      });

    expect(res.status).toBe(400); // Validation error
    expect(res.body.message).toContain('doit avoir un locataire assigné');
  });

  /**
   * PROP-004: Affectation locataire
   */
  test('PROP-004: Should assign a tenant to a property', async () => {
    const res = await request(app)
      .put(`/api/properties/${testPropertyId}`)
      .set('Cookie', `accessToken=${authToken}`)
      .send({ tenant_id: 1, status: 'loue' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PROP-005: Should release a tenant and make property vacant', async () => {
    const res = await request(app)
      .put(`/api/properties/${testPropertyId}`)
      .set('Cookie', `accessToken=${authToken}`)
      .send({ tenant_id: null, status: 'vacant' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  /**
   * PROP-006 & PROP-007: Recherche et Pagination
   */
  test('PROP-006/007: Should list properties with pagination', async () => {
    const res = await request(app)
      .get('/api/properties?page=1&limit=5')
      .set('Cookie', `accessToken=${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
