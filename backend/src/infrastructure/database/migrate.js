const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env.dev') }); // fallback, typically loaded by app

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(__dirname, 'migrations');

// Helper to compute SHA-256 checksum
function computeChecksum(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isBaseline = args.includes('baseline');

  if (isDryRun && isBaseline) {
    console.error('Cannot combine --dry-run and baseline.');
    process.exit(1);
  }

  let connection;
  try {
    // We create a specific connection because we MUST have multipleStatements: true for migrations
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sygim_db',
      multipleStatements: true
    });

    // 1. Acquire Lock
    const [lockResult] = await connection.query('SELECT GET_LOCK(\'sygim_migrations\', 10) AS lock_acquired');
    if (!lockResult[0].lock_acquired) {
      console.error('Failed to acquire migration lock. Another migration process is running.');
      process.exit(1);
    }

    // 2. Ensure schema_migrations table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        checksum CHAR(64) NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 3. Load migration files
    let files = [];
    if (fs.existsSync(MIGRATIONS_DIR)) {
      files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort(); // 4. Sort by version (alphabetical)
    }

    // 5. Fetch already applied migrations
    const [appliedRows] = await connection.query('SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC');
    const appliedMap = new Map();
    for (const row of appliedRows) {
      appliedMap.set(row.version, row);
    }

    // 6. Verify checksums and identify pending
    const pendingMigrations = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      // Normalize line endings to avoid checksum mismatch between OS
      const normalizedContent = content.replace(/\r\n/g, '\n');
      const checksum = computeChecksum(normalizedContent);
      const version = file.split('_')[0];

      if (appliedMap.has(version)) {
        const applied = appliedMap.get(version);
        if (applied.checksum && applied.checksum !== checksum) {
          console.error(`MIGRATION_CHECKSUM_MISMATCH: Migration ${file} has been modified after it was applied.`);
          process.exit(1);
        }
      } else {
        pendingMigrations.push({ file, version, checksum, content: normalizedContent });
      }
    }

    // 7. Check pending
    if (pendingMigrations.length === 0) {
      console.log('Database is already up to date.');
      return;
    }

    // 8. Dry-run
    if (isDryRun) {
      console.log('Pending migrations:');
      for (const m of pendingMigrations) {
        console.log(`- ${m.file}`);
      }
      return;
    }

    // Baseline Mode
    if (isBaseline) {
      console.log('Baseline mode started. Recording migrations as applied without executing them.');
      for (const m of pendingMigrations) {
        console.log(`Baselining ${m.file}...`);
        await connection.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)',
          [m.version, m.file, m.checksum]
        );
      }
      console.log('Baseline completed.');
      return;
    }

    // 9. Execute migrations
    console.log('Database migration started.\n');
    console.log('Applied:');
    for (const m of pendingMigrations) {
      console.log(m.file);

      try {
        // Strip out any USE statement to prevent accidental DB switching during tests
        const safeSql = m.content.replace(/USE\s+[\w_]+\s*;/gi, '');

        // Exécuter le SQL (qui peut contenir du DDL, et donc auto-commit dans MySQL)
        await connection.query(safeSql);

        // Enregistrer la migration comme appliquée
        await connection.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)',
          [m.version, m.file, m.checksum]
        );
      } catch (err) {
        console.error(`\nError applying migration ${m.file}:`, err.message);
        process.exit(1);
      }
    }

    console.log('\nDatabase is up to date.');

  } catch (err) {
    console.error('Migration system error:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      // 10. Release Lock
      await connection.query('SELECT RELEASE_LOCK(\'sygim_migrations\')');
      await connection.end();
    }
  }
}

run();
