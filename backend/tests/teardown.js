const { pool } = require('../config/db');

afterAll(async () => {
  if (pool) {
    try {
      await pool.end();
    } catch (err) {
      // Ignore if already closed
    }
  }
});
