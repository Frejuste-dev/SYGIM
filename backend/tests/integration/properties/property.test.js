/**
 * Tests d'intégration — Module Properties
 * Vérification des règles métier et de l'architecture V2
 */

const request = require('supertest');
const app = require('../../../src/app');
const { pool } = require('../../../config/db');

describe('Property Integration Tests (PROP)', () => {
  let authToken;
  let testPropertyId;
  let testTenantId;
  let testOwnerId;

  beforeAll(async () => {
    // 1. Login as admin to get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin2026!' }); // Dépend du seed
    
    authToken = res.body.token;

    // 2. Setup IDs for tests (Ideally from seed or specific setup)
    // Pour l'instant, on suppose que des données de test existent ou on les crée
  });

  /**
   * PROP-001: Création bien
   */
  test('PROP-001: Should create a new property', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${authToken}`)
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
      .set('Authorization', `Bearer ${authToken}`)
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
    // Note: Nécessite un tenant_id valide. On suppose '1' pour le test ou on le mocke.
    const res = await request(app)
      .post(`/api/properties/${testPropertyId}/assign`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ tenantId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('loue');
    expect(res.body.data.tenant_id).toBe(1);
  });

  /**
   * PROP-005: Libération locataire
   */
  test('PROP-005: Should release a tenant and make property vacant', async () => {
    const res = await request(app)
      .post(`/api/properties/${testPropertyId}/release`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('vacant');
    expect(res.body.data.tenant_id).toBeNull();
  });

  /**
   * PROP-006 & PROP-007: Recherche et Pagination
   */
  test('PROP-006/007: Should list properties with pagination', async () => {
    const res = await request(app)
      .get('/api/properties?page=1&limit=5')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
