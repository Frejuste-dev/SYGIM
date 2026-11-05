const AppError = require('../../../../src/utils/errors/AppError');
const errorHandler = require('../../../../src/middleware/errorHandler');
const ApiResponse = require('../../../../src/utils/responses/ApiResponse');
const Logger = require('../../../../src/utils/logger/Logger');

// Mocker le Logger pour éviter les logs pendant les tests
jest.mock('../../../../src/utils/logger/Logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn()
}));

describe('AppError', () => {
  describe('badRequest()', () => {
    it('doit créer une erreur avec le message fourni et le status 400 par défaut', () => {
      const error = AppError.badRequest('Données invalides');
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Données invalides');
      expect(error.code).toBe('BAD_REQUEST');
    });

    it("doit permettre de surcharger le code d'erreur", () => {
      const error = AppError.badRequest('Téléphone invalide', 'INVALID_PHONE');
      
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Téléphone invalide');
      expect(error.code).toBe('INVALID_PHONE');
    });
  });

  describe('Intégration errorHandler', () => {
    it('doit renvoyer une réponse HTTP 400 formatée correctement', () => {
      const error = AppError.badRequest('Validation échouée', 'BAD_REQUEST');
      
      const req = { id: 'test-req-id', path: '/test', method: 'POST' };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: 'Validation échouée',
        code: 'BAD_REQUEST',
        statusCode: 400
      }));
      expect(Logger.error).toHaveBeenCalled();
    });
  });
});
