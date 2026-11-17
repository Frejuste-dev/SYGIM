/**
 * Middleware de gestion d'erreurs centralisée
 * Toutes les erreurs sont traitées ici de manière cohérente
 */

const Logger = require('../utils/logger/Logger');
const ApiResponse = require('../utils/responses/ApiResponse');
const AppError = require('../utils/errors/AppError');

function errorHandler(err, req, res, next) {
  const requestId = req.id || 'unknown';

  // Détecter si l'erreur provient du moteur MySQL (codes ER_*, syntaxe SQL, intégrité)
  const isSqlError = Boolean(
    (err.code && typeof err.code === 'string' && (err.code.startsWith('ER_') || err.code === 'PROTOCOL_CONNECTION_LOST')) ||
    err.sqlMessage ||
    err.sqlState ||
    (err.errno && typeof err.errno === 'number')
  );

  // Convertir erreurs non-AppError en AppError
  let error = err;
  if (!(err instanceof AppError)) {
    error = new AppError(
      err.message || 'Erreur serveur interne',
      err.statusCode || 500,
      err.code || 'INTERNAL_ERROR'
    );
  }

  // Logger l'erreur détaillée sur le serveur (avec stack et détails SQL pour le débogage)
  Logger.error(`[${requestId}] ${err.message || error.message}`, err, {
    requestId,
    path: req.path,
    method: req.method,
    statusCode: error.statusCode,
    isSqlError,
    sqlState: err.sqlState,
    sqlCode: err.code
  });

  // Sécurisation de la réponse HTTP : masquer toute fuite d'information SQL au client
  let clientMessage = error.message;
  let clientCode = error.code;

  if (isSqlError) {
    clientMessage = 'Une erreur est survenue lors de l\'opération en base de données';
    clientCode = 'DATABASE_ERROR';
  } else if (process.env.NODE_ENV === 'production' && !error.isOperational) {
    clientMessage = 'Une erreur serveur interne s\'est produite';
    clientCode = 'INTERNAL_ERROR';
  }

  const response = ApiResponse.error(
    clientMessage,
    error.statusCode,
    clientCode
  );

  res.status(error.statusCode || 500).json(response);
}

module.exports = errorHandler;
