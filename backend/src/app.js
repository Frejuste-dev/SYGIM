/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║    SYGIM — API REST de Classe Mondiale                            ║
 * ║    Architecture en couches professionnelle & scalable              ║
 * ║    Système de Gestion Immobilière — v2.0                          ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

// Import des middlewares et utilitaires
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { apiLimiter } = require('./middleware/rateLimiter');
const Logger = require('./utils/logger/Logger');
const ApiResponse = require('./utils/responses/ApiResponse');

// ═══════════════════════════════════════════════════════════════════════
// 1. INITIALISATION
// ═══════════════════════════════════════════════════════════════════════

const app = express();
const PORT = process.env.PORT || 5000;

// ═══════════════════════════════════════════════════════════════════════
// 2. MIDDLEWARE GLOBAL - SÉCURITÉ ET PERFORMANCE
// ═══════════════════════════════════════════════════════════════════════

// Limite le débit des requêtes
app.use('/api/', apiLimiter);

// Sécurité HTTP renforcée
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
}));

// CORS configurable selon l'environnement
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || 'http://localhost:5000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600
}));

// Compression des réponses
app.use(compression({ level: 6 }));

// Parsing des requêtes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging des requêtes
app.use(requestLogger);

// ═══════════════════════════════════════════════════════════════════════
// 3. ROUTES DE SANTÉ
// ═══════════════════════════════════════════════════════════════════════

app.use('/health', require('./routes/health.routes'));

// ═══════════════════════════════════════════════════════════════════════
// 4. ROUTES API
// ═══════════════════════════════════════════════════════════════════════

app.use('/api/auth',         require('./modules/auth/auth.routes'));
app.use('/api/users',        require('./routes/user.routes'));
app.use('/api/collectors',   require('./modules/collectors/collector.routes'));
app.use('/api/reports',      require('./modules/reports/report.routes'));
app.use('/api/clients',      require('./routes/client.routes'));
app.use('/api/properties',   require('./routes/property.routes'));
app.use('/api/owners',       require('./routes/owner.routes'));
app.use('/api/transactions', require('./routes/transaction.routes'));
app.use('/api/alerts',       require('../routes/alerts.routes'));

// ═══════════════════════════════════════════════════════════════════════
// 5. SERVIR LES FICHIERS FRONTEND
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const reactDistPath = path.join(__dirname, '..', 'frontend', 'react-app', 'dist');
const legacyFrontendPath = path.join(__dirname, '..', 'frontend');
const frontendPath = fs.existsSync(reactDistPath) ? reactDistPath : legacyFrontendPath;

app.use(express.static(frontendPath, {
  maxAge: '1d',
  etag: false
}));

// SPA - Rerouter le HTML5 history vers index.html
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ═══════════════════════════════════════════════════════════════════════
// 6. ROUTES 404
// ═══════════════════════════════════════════════════════════════════════

app.use('*', (req, res, next) => {
  const err = new Error(`Route non trouvée: ${req.originalUrl}`);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  next(err);
});

// ═══════════════════════════════════════════════════════════════════════
// 7. GESTIONNAIRE D'ERREURS CENTRALISÉ
// ═══════════════════════════════════════════════════════════════════════

app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════════
// 8. DÉMARRAGE DU SERVEUR
// ═══════════════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
  Logger.info(`🚀 Serveur SYGIM démarré avec succès`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. GESTION GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════

process.on('SIGTERM', () => {
  Logger.warn('Signal SIGTERM reçu, arrêt gracieux en cours...');
  server.close(() => {
    Logger.info('Serveur arrêté proprement');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  Logger.warn('Signal SIGINT reçu, arrêt gracieux en cours...');
  server.close(() => {
    Logger.info('Serveur arrêté proprement');
    process.exit(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 10. GESTION DES ERREURS NON CAPTURÉES
// ═══════════════════════════════════════════════════════════════════════

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Rejection non gérée', reason, { promise });
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (error) => {
  Logger.error('Exception non capturée', error);
  server.close(() => process.exit(1));
});

module.exports = app;
