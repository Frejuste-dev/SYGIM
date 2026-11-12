const { pool } = require('../src/config/database');

afterAll(async () => {
  if (pool) {
    try {
      await pool.end();
    } catch (err) {
      // Ignore if already closed
    }
  }
});
