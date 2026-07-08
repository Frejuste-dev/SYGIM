/**
 * module: Health Routes
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../../config/db');
const redisClient = require('../infrastructure/cache/redis.client');

/**
 * @route   GET /health
 * @desc    Vérifie l'état de santé des services critiques
 * @access  Public
 */
router.get('/', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'ok',
      redis: 'ok'
    }
  };

  try {
    // Vérification Base de données
    const dbConn = await pool.getConnection();
    dbConn.release();
  } catch (err) {
    health.status = 'degraded';
    health.services.database = 'error';
  }

  try {
    // Vérification Redis
    if (!redisClient.isReady) {
      health.status = 'degraded';
      health.services.redis = 'error';
    } else {
      await redisClient.ping();
    }
  } catch (err) {
    health.status = 'degraded';
    health.services.redis = 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
