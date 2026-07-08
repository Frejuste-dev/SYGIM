/**
 * Format de réponse API standardisé et professionnel
 * Cohérent avec les meilleures pratiques REST/JSON:API
 */

class ApiResponse {
  static success(data, message = 'Succès', statusCode = 200, meta = null) {
    return {
      success: true,
      statusCode,
      message,
      data,
      ...(meta && { meta }),
      timestamp: new Date().toISOString()
    };
  }

  static error(message, statusCode = 500, code = 'ERROR', errors = null) {
    return {
      success: false,
      statusCode,
      message,
      code,
      ...(errors && { errors }),
      timestamp: new Date().toISOString()
    };
  }

  static paginated(data, page, limit, total, message = 'Données paginées') {
    const totalPages = Math.ceil(total / limit);
    return {
      success: true,
      statusCode: 200,
      message,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      timestamp: new Date().toISOString()
    };
  }

  static created(data, message = 'Créé avec succès') {
    return this.success(data, message, 201);
  }

  static updated(data, message = 'Mise à jour réussie') {
    return this.success(data, message, 200);
  }

  static deleted(message = 'Suppression réussie') {
    return this.success(null, message, 204);
  }
}

module.exports = ApiResponse;
