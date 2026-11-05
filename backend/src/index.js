require('dotenv').config();
const { validateEnv } = require('./config/env.validator');
validateEnv();

const app = require('./app');
const { configureServer } = require('./https-config');
const Logger = require('./utils/logger/Logger');

const PORT = parseInt(process.env.PORT || '5000');
const HTTPS_PORT = parseInt(process.env.HTTPS_PORT || '5443');

const { httpServer, httpsServer } = configureServer(app, PORT, HTTPS_PORT);

Logger.info('🚀 Serveur SYGIM démarré avec succès', {
  httpPort: PORT,
  httpsPort: httpsServer ? HTTPS_PORT : 'désactivé',
  environment: process.env.NODE_ENV || 'development',
  nodeVersion: process.version
});

function shutdown(signal) {
  Logger.warn(`Signal ${signal} reçu, arrêt gracieux en cours...`);
  httpServer.close(() => {
    if (httpsServer) {
      httpsServer.close();
    }
    Logger.info('Serveur arrêté proprement');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  Logger.error('Rejection non gérée', reason);
  httpServer.close(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
  Logger.error('Exception non capturée', error);
  httpServer.close(() => process.exit(1));
});
