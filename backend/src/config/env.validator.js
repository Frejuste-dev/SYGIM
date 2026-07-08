/**
 * module: Environment Validator
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const Logger = require('../utils/logger/Logger');

/**
 * Valide les variables d'environnement critiques au démarrage
 * @throws {Error} Si une variable obligatoire est manquante ou invalide
 */
const validateEnv = () => {
  const required = [
    'PORT',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    const errorMsg = `[FATAL] Variables d'environnement manquantes : ${missing.join(', ')}`;
    console.error('\x1b[31m%s\x1b[0m', errorMsg);
    process.exit(1);
  }

  // Validation spécifique pour les secrets
  if (process.env.JWT_SECRET.length < 64) {
    console.error('\x1b[31m%s\x1b[0m', '[FATAL] JWT_SECRET doit faire au moins 64 caractères.');
    process.exit(1);
  }

  if (process.env.JWT_REFRESH_SECRET.length < 64) {
    console.error('\x1b[31m%s\x1b[0m', '[FATAL] JWT_REFRESH_SECRET doit faire au moins 64 caractères.');
    process.exit(1);
  }

  Logger.info('✅ Environnement validé avec succès.');
};

module.exports = { validateEnv };
