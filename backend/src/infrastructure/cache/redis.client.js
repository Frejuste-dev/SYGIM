/**
 * module: Redis Client
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const { createClient } = require('redis');
const Logger = require('../../utils/logger/Logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redisClient = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 2) {
        Logger.warn('⚠️ Connexion Redis échouée. L\'application continuera sans cache.');
        return false; // Arrête les tentatives de reconnexion
      }
      return 2000; // Réessayer après 2 secondes
    }
  }
});

redisClient.on('error', (err) => {
  Logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  Logger.info('✅ Redis connecté avec succès');
});

// Connexion asynchrone au démarrage
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    Logger.error('Impossible de se connecter à Redis', err);
  }
})();

module.exports = redisClient;
