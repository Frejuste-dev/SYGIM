/**
 * Point d'entrée de l'application
 * Charge le serveur avec les configurations appropriées
 */

require('dotenv').config();
const { validateEnv } = require('./config/env.validator');

// Validation de l'environnement au démarrage
validateEnv();

// Charge l'application et démarre le serveur
require('./app');
