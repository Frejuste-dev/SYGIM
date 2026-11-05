const request = require('supertest');
const express = require('express');

// Mock service avant d'importer le routeur
jest.mock('../../../src/modules/auth/auth.service', () => {
  return {
    login: jest.fn(),
    refreshAccessToken: jest.fn(),
    logout: jest.fn()
  };
});

const authService = require('../../../src/modules/auth/auth.service');
const authRoutes = require('../../../src/modules/auth/auth.routes');
const AppError = require('../../../src/utils/errors/AppError');

const extractCookie = (res, cookieName) => {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return null;
  const cookie = cookies.find(c => c.startsWith(`${cookieName}=`));
  return cookie ? cookie.split(';')[0].split('=')[1] : null;
};

// Configuration express pour les tests
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Error handler middleware (simplifié pour les tests)
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: err.message });
  }
  res.status(500).json({ success: false, error: 'Erreur serveur' });
});

describe('Auth Routes Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 200 and tokens on successful login', async () => {
      authService.login.mockResolvedValue({
        accessToken: 'mock-access',
        refreshToken: 'mock-refresh',
        user: { id: 1, username: 'testuser', role: 'admin' }
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      if (response.body.data) {
        expect(response.body.data).not.toHaveProperty('accessToken');
        expect(response.body.data).not.toHaveProperty('refreshToken');
      }
      expect(response.body).not.toHaveProperty('accessToken');
      expect(response.body).not.toHaveProperty('refreshToken');
      
      expect(extractCookie(response, 'accessToken')).toBe('mock-access');
      expect(extractCookie(response, 'refreshToken')).toBe('mock-refresh');
    });

    it('should return 401 on invalid credentials', async () => {
      authService.login.mockRejectedValue(new AppError('Identifiants invalides.', 401));

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'wrong', password: 'WrongPass123!' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Identifiants invalides.');
    });
  });
});
