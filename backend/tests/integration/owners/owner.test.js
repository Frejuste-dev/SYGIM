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
    
    const cookies = res.headers['set-cookie'];
    const tokenCookie = cookies.find(c => c.startsWith('accessToken='));
    authToken = tokenCookie.split(';')[0].split('=')[1];
  });

  /**
   * OWNER-001: Création propriétaire
   */
  test('OWNER-001: Should create a new owner', async () => {
    const res = await request(app)
      .post('/api/owners')
      .set('Cookie', `accessToken=${authToken}`)
      .send({
        first_name: 'Jean',
        last_name: 'Dupont',
        phone: '0102030405',
        email: 'jean.dupont@test.com'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    testOwnerId = res.body.data.id;
  });



  /**
   * OWNER-004: Suppression protégée
   * On teste la suppression d'un propriétaire sans biens (devrait marcher)
   */
  test('OWNER-004: Should soft delete an owner with no properties', async () => {
    const res = await request(app)
      .delete(`/api/owners/${testOwnerId}`)
      .set('Cookie', `accessToken=${authToken}`);

    expect(res.status).toBe(204);
  });
});
