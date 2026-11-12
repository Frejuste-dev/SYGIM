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
const cookieParser = require('cookie-parser');

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
      defaultSrc: ['\'self\''],
      scriptSrc: ['\'self\''],
      styleSrc: ['\'self\'', '\'unsafe-inline\''],
      imgSrc: ['\'self\'', 'data:'],
      connectSrc: ['\'self\''],
      fontSrc: ['\'self\''],
      objectSrc: ['\'none\''],
      frameSrc: ['\'none\'']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' }
}));

// CORS configurable selon l'environnement
const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [process.env.FRONTEND_URL || 'http://localhost:5173'];
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600
}));

// Compression des réponses
app.use(compression({ level: 6 }));

// Parsing des requêtes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logging des requêtes
app.use(requestLogger);

// ═══════════════════════════════════════════════════════════════════════
// 3. DOCUMENTATION API (Swagger)
// ═══════════════════════════════════════════════════════════════════════

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'SYGIM API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true
  }
}));

// ═══════════════════════════════════════════════════════════════════════
// 4. ROUTES DE SANTÉ
// ═══════════════════════════════════════════════════════════════════════

app.use('/health', require('./routes/health.routes'));

// ═══════════════════════════════════════════════════════════════════════
// 4. ROUTES API
// ═══════════════════════════════════════════════════════════════════════

app.use(cookieParser());

app.use('/api/auth',         require('./modules/auth/auth.routes'));
app.use('/api/users',        require('./modules/users/user.routes'));
app.use('/api/collectors',   require('./modules/collectors/collector.routes'));
app.use('/api/reports',      require('./modules/reports/report.routes'));
app.use('/api/clients',      require('./modules/clients/client.routes'));
app.use('/api/properties',   require('./modules/properties/property.routes'));
app.use('/api/owners',       require('./modules/owners/owner.routes'));
app.use('/api/transactions', require('./modules/transactions/transaction.routes'));
app.use('/api/financial',    require('./modules/financial/financial.routes'));
app.use('/api/alerts',       require('./modules/alerts/alert.routes'));
app.use('/api/repairs',      require('./modules/repairs/repair.routes'));
app.use('/api/rgpd',         require('./modules/rgpd/rgpd.routes'));

// ═══════════════════════════════════════════════════════════════════════
// 5. SERVIR LES FICHIERS FRONTEND
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const reactDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
const legacyFrontendPath = path.join(__dirname, '..', '..', 'frontend');
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

module.exports = app;
