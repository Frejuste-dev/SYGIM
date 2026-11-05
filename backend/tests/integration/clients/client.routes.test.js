const request = require('supertest');
const express = require('express');

jest.mock('../../../src/modules/clients/client.service', () => ({
  getClients: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  replaceTenant: jest.fn(),
  getById: jest.fn()
}));

jest.mock('../../../config/db', () => ({
  pool: {
    query: jest.fn().mockResolvedValue([[]]),
    getConnection: jest.fn()
  }
}));

jest.mock('../../../src/middleware/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, role: 'admin', username: 'testadmin' };
    next();
  },
  authorize: (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Accès interdit. Rôle insuffisant.' });
    }
    next();
  }
}));

const ClientService = require('../../../src/modules/clients/client.service');
const clientRoutes = require('../../../src/modules/clients/client.routes');

const app = express();
app.use(express.json());
app.use('/api/clients', clientRoutes);

describe('Client Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/clients', () => {
    it('should return 200 with clients list', async () => {
      ClientService.getClients.mockResolvedValue({
        data: [{ id: 1, last_name: 'Doe', first_name: 'John' }],
        pagination: { page: 1, limit: 20, total: 1 }
      });

      const response = await request(app)
        .get('/api/clients')
        .query({ status: 'pending' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/clients', () => {
    it('should return 201 on create', async () => {
      ClientService.create.mockResolvedValue({ id: 1, lastName: 'Doe', firstName: 'John' });

      const response = await request(app)
        .post('/api/clients')
        .send({ lastName: 'Doe', firstName: 'John', phone: '+225 07 00 00 00 00' });

      console.log('RESPONSE:', response.body, response.error);
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('should return 200 on update', async () => {
      ClientService.update.mockResolvedValue({ id: 1, lastName: 'Doe Updated' });

      const response = await request(app)
        .put('/api/clients/1')
        .send({ lastName: 'Doe Updated' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('should return 200 on delete', async () => {
      ClientService.delete.mockResolvedValue({ success: true, id: 1 });

      const response = await request(app).delete('/api/clients/1');

      expect(response.status).toBe(204);
    });
  });
});
