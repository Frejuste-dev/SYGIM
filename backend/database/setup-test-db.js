const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Force reading .env.dev for database credentials
require('dotenv').config({ path: path.join(__dirname, '..', '.env.dev') });

async function setupTestDb() {
  console.log('🛠️ Configuration de la base de données de test...');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    console.log('🔄 Recréation de la base sygim_test...');
    await connection.query('DROP DATABASE IF EXISTS sygim_test');
    await connection.query('CREATE DATABASE sygim_test');
    await connection.query('USE sygim_test');

    const schemaPath = path.join(__dirname, 'sygim_schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    
    // VERY IMPORTANT: Remove "USE sygim_db;" from the schema so it doesn't switch away from sygim_test
    schema = schema.replace(/USE\s+sygim_db\s*;/gi, '');
    
    console.log('🔄 Application du schéma...');
    await connection.query(schema);

    console.log('🔄 Enregistrement des migrations (Baseline)...');
    execSync('npm run db:migrate:baseline', {
      env: { ...process.env, DB_NAME: 'sygim_test' },
      stdio: 'inherit'
    });
    
    console.log('✅ Base de données sygim_test prête.');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration de la base:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
  
  // Lancer les seeds
  try {
    console.log('🔄 Insertion des données de test...');
    const envForSeed = { 
      ...process.env, 
      DB_NAME: 'sygim_test' 
    };

    execSync('node database/seed.js', { env: envForSeed, stdio: 'inherit' });
    execSync('node database/seed-test-data.js', { env: envForSeed, stdio: 'inherit' });
    
    console.log('✅ Base de test peuplée avec succès.');
  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
    process.exit(1);
  }
}

setupTestDb();
