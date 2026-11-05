/**
 * module: Redis Client
 * auteur: SYGIM Team
 * date: 2026-06-16
 */

const Logger = require('../../utils/logger/Logger');

Logger.info('ℹ️ Redis est désactivé. L\'application fonctionnera sans cache.');

// Client Redis factice (Mock) pour éviter les plantages
const redisClient = {
  isReady: false,
  get: async () => null,
  set: async () => null,
  del: async () => null,
  keys: async () => [],
  ping: async () => true,
  on: () => {},
  connect: async () => {}
};

module.exports = redisClient;
