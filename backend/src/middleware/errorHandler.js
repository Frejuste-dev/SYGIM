/**
 * Middleware de gestion d'erreurs centralisée
 * Toutes les erreurs sont traitées ici de manière cohérente
 */

const Logger = require('../utils/logger/Logger');
const ApiResponse = require('../utils/responses/ApiResponse');
const AppError = require('../utils/errors/AppError');

function errorHandler(err, req, res, next) {
  const requestId = req.id || 'unknown';

  // Convertir erreurs non-AppError en AppError
  let error = err;
  if (!(err instanceof AppError)) {
    error = new AppError(
      err.message || 'Erreur serveur interne',
      err.statusCode || 500,
      err.code || 'INTERNAL_ERROR'
    );
  }

  // Logger l'erreur
  Logger.error(`[${requestId}] ${error.message}`, error, {
    requestId,
    path: req.path,
    method: req.method,
    statusCode: error.statusCode
  });

  // Répondre avec format cohérent
  const response = ApiResponse.error(
    error.message,
    error.statusCode,
    error.code
  );

  // En production, ne pas exposer les détails d'implémentation
  if (process.env.NODE_ENV === 'production' && !error.isOperational) {
    response.message = 'Une erreur serveur interne s\'est produite';
  }

  res.status(error.statusCode || 500).json(response);
}

module.exports = errorHandler;
