/**
 * Logger professionnel pour logging structuré et monitoring
 * Implémenté avec Winston avec rotation quotidienne
 */

const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const { sanitize } = require('./logSanitizer');

const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Formatteur Winston de sanitisation centralisé (SEC-003-B)
const sanitizeFormat = winston.format((info) => {
  return sanitize(info);
});

const logFormat = winston.format.combine(
  sanitizeFormat(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      sanitizeFormat(),
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];

// N'instancier la rotation sur fichier qu'en production ou si explicitement demandé,
// afin d'éviter les verrous de fichiers EPERM de Windows en développement
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  const fileTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logDir, 'sygim-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxSize: '20m',
    maxFiles: '14d'
  });
  fileTransport.on('error', (err) => {
    // Éviter qu'une erreur de verrouillage fichier sous Windows ne crash le processus
    console.warn('File logger non-bloquant:', err.message);
  });
  transports.push(fileTransport);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'sygim-api',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports
});

class Logger {
  static info(message, data = {}) {
    logger.info(message, data);
  }

  static warn(message, data = {}) {
    logger.warn(message, data);
  }

  static error(message, error = null, data = {}) {
    const errorDetails = error ? {
      message: error.message || error,
      code: error.code,
      stack: error.stack
    } : {};

    logger.error(message, { error: errorDetails, ...data });
  }

  static debug(message, data = {}) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(message, data);
    }
  }

  static performance(operation, duration, data = {}) {
    if (duration > 1000) {
      logger.warn(`Performance: ${operation} took ${duration}ms`, data);
    } else {
      logger.debug(`${operation} completed in ${duration}ms`, data);
    }
  }
}

module.exports = Logger;
