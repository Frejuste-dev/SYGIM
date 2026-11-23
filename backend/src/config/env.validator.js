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
  // Normaliser les variables MySQL Railway si DB_* ne sont pas définies
  if (!process.env.DB_HOST && process.env.MYSQLHOST) process.env.DB_HOST = process.env.MYSQLHOST;
  if (!process.env.DB_PORT && process.env.MYSQLPORT) process.env.DB_PORT = process.env.MYSQLPORT;
  if (!process.env.DB_NAME && process.env.MYSQLDATABASE) process.env.DB_NAME = process.env.MYSQLDATABASE;
  if (!process.env.DB_USER && process.env.MYSQLUSER) process.env.DB_USER = process.env.MYSQLUSER;
  if (process.env.DB_PASSWORD === undefined && process.env.MYSQLPASSWORD !== undefined) {
    process.env.DB_PASSWORD = process.env.MYSQLPASSWORD;
  }
  process.env.PORT = process.env.PORT || '5000';

  const required = [
    'PORT',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);

  // DB_PASSWORD peut être vide en développement local (ex: XAMPP / WAMP root sans mot de passe)
  if (process.env.DB_PASSWORD === undefined) {
    missing.push('DB_PASSWORD');
  }

  if (missing.length > 0) {
    const errorMsg = `[FATAL] Variables d'environnement manquantes : ${missing.join(', ')}`;
    console.error('\x1b[31m%s\x1b[0m', errorMsg);
    process.exit(1);
  }

  // Validation spécifique pour les secrets (min 32 en dev, 64 recommandé)
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('\x1b[31m%s\x1b[0m', '[FATAL] JWT_SECRET doit faire au moins 32 caractères.');
    process.exit(1);
  }

  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    console.error('\x1b[31m%s\x1b[0m', '[FATAL] JWT_REFRESH_SECRET doit faire au moins 32 caractères.');
    process.exit(1);
  }

  Logger.info('✅ Environnement validé avec succès.');
};

module.exports = { validateEnv };
