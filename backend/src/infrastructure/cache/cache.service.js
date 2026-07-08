/**
 * module: Cache Service
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const redisClient = require('./redis.client');
const Logger = require('../../utils/logger/Logger');

class CacheService {
  /**
   * Récupère une valeur du cache
   */
  async get(key) {
    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      Logger.error(`Cache.get error [${key}]`, error);
      return null;
    }
  }

  /**
   * Stocke une valeur dans le cache avec TTL
   */
  async set(key, value, ttlSeconds = 300) {
    try {
      const stringValue = JSON.stringify(value);
      await redisClient.set(key, stringValue, {
        EX: ttlSeconds
      });
      return true;
    } catch (error) {
      Logger.error(`Cache.set error [${key}]`, error);
      return false;
    }
  }

  /**
   * Supprime une clé du cache
   */
  async del(key) {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      Logger.error(`Cache.del error [${key}]`, error);
      return false;
    }
  }

  /**
   * Supprime des clés par pattern (ex: "dashboard:*")
   */
  async delByPattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      Logger.error(`Cache.delByPattern error [${pattern}]`, error);
      return false;
    }
  }
}

module.exports = new CacheService();
