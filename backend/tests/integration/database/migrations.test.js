const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { pool } = require('../../../config/db');

const TEST_MIGRATIONS_DIR = path.join(__dirname, 'test_migrations');

function runMigrate(args = '') {
  return execSync(`node src/infrastructure/database/migrate.js ${args}`, {
    env: { ...process.env, MIGRATIONS_DIR: TEST_MIGRATIONS_DIR, DB_NAME: 'sygim_test_migrations' },
    encoding: 'utf8'
  });
}

function runMigrateThrows(args = '') {
  try {
    runMigrate(args);
    return { status: 0, stdout: '' };
  } catch (error) {
    return { status: error.status, stdout: error.stdout, stderr: error.stderr };
  }
}

describe('DEBT-D05: Migrations System', () => {
  beforeAll(async () => {
    await pool.query('DROP DATABASE IF EXISTS sygim_test_migrations');
    await pool.query('CREATE DATABASE sygim_test_migrations');
  });

  afterAll(async () => {
    await pool.query('DROP DATABASE IF EXISTS sygim_test_migrations');
  });

  beforeEach(() => {
    if (fs.existsSync(TEST_MIGRATIONS_DIR)) {
      fs.rmSync(TEST_MIGRATIONS_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_MIGRATIONS_DIR, { recursive: true });
  });

  afterEach(async () => {
    await pool.query('DROP TABLE IF EXISTS sygim_test_migrations.schema_migrations;');
    await pool.query('DROP TABLE IF EXISTS sygim_test_migrations.dummy_test;');
  });

  test('Test 1 & 2 & 4: Table creation, execution in order, and tracking', async () => {
    fs.writeFileSync(path.join(TEST_MIGRATIONS_DIR, '001_first.sql'), 'CREATE TABLE dummy_test (id INT);');
    fs.writeFileSync(path.join(TEST_MIGRATIONS_DIR, '002_second.sql'), 'ALTER TABLE dummy_test ADD COLUMN name VARCHAR(50);');
    
    const out = runMigrate();
    expect(out).toContain('001_first.sql');
    expect(out).toContain('002_second.sql');
    expect(out.indexOf('001')).toBeLessThan(out.indexOf('002'));

    const [rows] = await pool.query('SELECT * FROM sygim_test_migrations.schema_migrations ORDER BY version ASC');
    expect(rows.length).toBe(2);
    expect(rows[0].version).toBe('001');
    expect(rows[1].version).toBe('002');
  });

  test('Test 3 & 7: Idempotence', async () => {
    fs.writeFileSync(path.join(TEST_MIGRATIONS_DIR, '001_first.sql'), 'CREATE TABLE dummy_test (id INT);');
    runMigrate(); // first run
    
    const out = runMigrate(); // second run
    expect(out).toContain('Database is already up to date');
    
    const [rows] = await pool.query('SELECT * FROM sygim_test_migrations.schema_migrations');
    expect(rows.length).toBe(1);
  });

  test('Test 5: Stop on SQL error and do not record', async () => {
    fs.writeFileSync(path.join(TEST_MIGRATIONS_DIR, '001_first.sql'), 'CREATE TABLE dummy_test (id INT);');
    fs.writeFileSync(path.join(TEST_MIGRATIONS_DIR, '002_bad.sql'), 'INVALID SQL STATEMENT;');
    
    const res = runMigrateThrows();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('Error applying migration 002_bad.sql');

    const [rows] = await pool.query('SELECT * FROM sygim_test_migrations.schema_migrations');
    expect(rows.length).toBe(1); // 001 was recorded
    expect(rows[0].version).toBe('001');
  });

  test('Test 6: Checksum verification', async () => {
    const file = path.join(TEST_MIGRATIONS_DIR, '001_first.sql');
    fs.writeFileSync(file, 'CREATE TABLE dummy_test (id INT);');
    runMigrate();
    
    // Modify file
    fs.writeFileSync(file, 'CREATE TABLE dummy_test (id INT, extra INT);');
    
    const res = runMigrateThrows();
    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('MIGRATION_CHECKSUM_MISMATCH');
  });

  test('Test 8: Dry run', async () => {
    fs.writeFileSync(path.join(TEST_MIGRATIONS_DIR, '001_first.sql'), 'CREATE TABLE dummy_test (id INT);');
    const out = runMigrate('--dry-run');
    expect(out).toContain('Pending migrations:');
    expect(out).toContain('001_first.sql');

    // DB should not have the table
    let error;
    try {
      await pool.query('SELECT * FROM sygim_test_migrations.dummy_test');
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe('ER_NO_SUCH_TABLE');
  });

  test('Test 9: Baseline', async () => {
    fs.writeFileSync(path.join(TEST_MIGRATIONS_DIR, '001_first.sql'), 'CREATE TABLE dummy_test (id INT);');
    const out = runMigrate('baseline');
    expect(out).toContain('Baseline mode started');
    expect(out).toContain('Baselining 001_first.sql');
    
    // DB should NOT have the table because it was baseline only
    let error;
    try {
      await pool.query('SELECT * FROM sygim_test_migrations.dummy_test');
    } catch (err) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe('ER_NO_SUCH_TABLE');

    // But it should be in schema_migrations
    const [rows] = await pool.query('SELECT * FROM sygim_test_migrations.schema_migrations');
    expect(rows.length).toBe(1);
    expect(rows[0].version).toBe('001');
  });
});
