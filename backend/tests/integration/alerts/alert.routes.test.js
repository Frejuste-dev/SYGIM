const request = require('supertest');
const express = require('express');

jest.mock('../../../src/modules/alerts/alert.service', () => ({
  getOverduePayments: jest.fn(),
  getDashboard: jest.fn(),
  getSummary: jest.fn(),
  acknowledge: jest.fn()
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

const AlertService = require('../../../src/modules/alerts/alert.service');
const alertRoutes = require('../../../src/modules/alerts/alert.routes');

const app = express();
app.use(express.json());
app.use('/api/alerts', alertRoutes);

describe('Alert Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/alerts/overdue-payments', () => {
    it('should return 200 with alerts and stats', async () => {
      AlertService.getOverduePayments.mockResolvedValue({
        alerts: [{ id: 1, amount_owed: 500, severity: 'normale' }],
        stats: { totalAlerts: 1, totalAmount: 500 }
      });

      const response = await request(app)
        .get('/api/alerts/overdue-payments')
        .query({ severity: 'normale' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.stats.totalAlerts).toBe(1);
    });
  });

  describe('GET /api/alerts/dashboard', () => {
    it('should return 200 for authorized roles', async () => {
      AlertService.getDashboard.mockResolvedValue({
        totalOwed: { total_owed: 5000 },
        topOverdueClients: [],
        byCollector: [],
        todayCollections: {}
      });

      const response = await request(app).get('/api/alerts/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/alerts/summary', () => {
    it('should return 200 with summary data', async () => {
      AlertService.getSummary.mockResolvedValue([
        { severity: 'critique', count: 2, total_amount: 8000 }
      ]);

      const response = await request(app).get('/api/alerts/summary');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('PUT /api/alerts/:clientId/acknowledge', () => {
    it('should return 200 on acknowledge', async () => {
      AlertService.acknowledge.mockResolvedValue({ success: true, clientId: 42 });

      const response = await request(app)
        .put('/api/alerts/42/acknowledge');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Alerte marquée comme reconnue');
    });
  });
});
