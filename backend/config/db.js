/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Configuration Base de Données MySQL           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const mysql = require('mysql2/promise');
require('dotenv').config();
const Logger = require('../src/utils/logger/Logger');

const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               process.env.DB_PORT     || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'sygim_db',
    waitForConnections: true,
    connectionLimit:    parseInt(process.env.DB_CONNECTION_LIMIT || '25'),
    queueLimit:         0,
    charset:            'utf8mb4',
    timezone:           '+00:00',
    // Retourner les résultats sous forme d'objets JS
    namedPlaceholders:  true,
});

// Test de connexion au démarrage
async function testConnection() {
    try {
        const conn = await pool.getConnection();
        Logger.info('MySQL connecté avec succès', { database: process.env.DB_NAME || 'sygim_db' });
        conn.release();
        return true;
    } catch (err) {
        Logger.error('Erreur connexion MySQL', err, {
            code: err.code,
            errno: err.errno,
            sqlState: err.sqlState
        });
        return false;
    }
}

module.exports = { pool, testConnection };
