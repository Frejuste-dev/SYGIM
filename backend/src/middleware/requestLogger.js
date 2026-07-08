/**
 * Middleware de logging des requêtes
 * Suivi détaillé de toutes les requêtes avec timing
 */

const Logger = require('../utils/logger/Logger');

function requestLogger(req, res, next) {
  // Générer un ID unique pour la requête
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const start = Date.now();
  
  // Intercepter la fin de la réponse
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      userAgent: req.get('user-agent'),
      ip: req.ip
    };

    if (res.statusCode >= 500) {
      Logger.error(`Request completed with error [${req.method} ${req.path}]`, null, logData);
    } else if (res.statusCode >= 400) {
      Logger.warn(`Request completed with warning [${req.method} ${req.path}]`, logData);
    } else {
      Logger.info(`Request completed [${req.method} ${req.path}]`, logData);
    }
  });

  Logger.debug(`Incoming request [${req.method} ${req.path}]`, {
    requestId: req.id,
    body: req.body,
    query: req.query
  });

  next();
}

module.exports = requestLogger;
