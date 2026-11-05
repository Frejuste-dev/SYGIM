const { authenticate } = require('../../src/middleware/auth.middleware');
const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

describe('Auth Middleware - Phase 1D Cookie & Fallback', () => {
  let req, res, next;

  beforeEach(() => {
    req = { cookies: {}, headers: {} };
    res = {};
    next = jest.fn();
    process.env.JWT_SECRET = 'test_secret';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('CAS A: Cookie accessToken valide => authentification réussie', () => {
    req.cookies.accessToken = 'valid_cookie_token';
    jwt.verify.mockReturnValue({ id: 1, role: 'admin' });

    authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid_cookie_token', 'test_secret');
    expect(req.user).toEqual({ id: 1, role: 'admin' });
    expect(next).toHaveBeenCalledWith(); // Called without errors
  });

  test('CAS B: Cookie accessToken invalide + Authorization Bearer valide => DOIT retourner 401', () => {
    req.cookies.accessToken = 'invalid_cookie_token';
    req.headers.authorization = 'Bearer valid_header_token';
    
    jwt.verify.mockImplementation((token) => {
      if (token === 'invalid_cookie_token') throw new Error('Invalid signature');
      return { id: 1 };
    });

    authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledTimes(1); // Should fail immediately, no fallback
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Token invalide ou expiré.',
      statusCode: 401
    }));
  });

  test('CAS C: Cookie accessToken absent + Authorization Bearer valide => authentification réussie', () => {
    req.headers.authorization = 'Bearer valid_header_token';
    jwt.verify.mockReturnValue({ id: 2, role: 'user' });

    authenticate(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('valid_header_token', 'test_secret');
    expect(req.user).toEqual({ id: 2, role: 'user' });
    expect(next).toHaveBeenCalledWith();
  });

  test('CAS D: Cookie absent + Authorization absent => 401', () => {
    authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Authentification requise. Token manquant.',
      statusCode: 401
    }));
  });
});
