/**
 * Classe d'erreur centralisée pour toute l'application
 * Permet une gestion cohérente et professionnelle des erreurs
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Erreurs connues et gérées

    Error.captureStackTrace(this, this.constructor);
  }

  // Erreurs de validation
  static validation(message, field = null) {
    return new AppError(message, 400, 'VALIDATION_ERROR', { field });
  }

  // Erreurs d'authentification
  static unauthorized(message = 'Authentification requise') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  // Erreurs d'autorisation
  static forbidden(message = 'Accès refusé') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  // Ressource non trouvée
  static notFound(resource = 'Ressource') {
    return new AppError(`${resource} non trouvée`, 404, 'NOT_FOUND');
  }

  // Conflit
  static conflict(message = 'Conflit détecté') {
    return new AppError(message, 409, 'CONFLICT');
  }

  // Erreur serveur
  static internal(message = 'Erreur serveur interne') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}

module.exports = AppError;
