/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM - Script de Nettoyage BD Production              ║
 * ║     Supprime TOUTES les données de test/développement            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * USAGE: node database/clean_production.js
 * ⚠️  ATTENTION: Supprime TOUTES les données! À utiliser avant livraison.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:     process.env.DB_HOST || 'localhost',
    user:     process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sygim_db'
});

async function clean() {
    const conn = await pool.getConnection();

    try {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════╗');
        console.log('║     SYGIM - Nettoyage BD Production                 ║');
        console.log('║     ⚠️  Supprime TOUTES les données!                ║');
        console.log('╚══════════════════════════════════════════════════════╝');
        console.log('');

        // Désactiver les FK temporairement
        await conn.query('SET FOREIGN_KEY_CHECKS=0');

        // Supprimer TOUTES les données (mais garder la structure)
        const tables = [
            'activity_logs',
            'transactions',
            'clients',
            'properties',
            'collectors',
            'owners',
            'users'
        ];

        for (const table of tables) {
            try {
                await conn.query(`TRUNCATE TABLE ${table}`);
                console.log(`✅ ${table}: VIDÉE`);
            } catch (e) {
                console.log(`⚠️  ${table}: ${e.message}`);
            }
        }

        // Réactiver les FK
        await conn.query('SET FOREIGN_KEY_CHECKS=1');

        console.log('');
        console.log('✅ BD nettoyée avec succès!');
        console.log('');
        console.log('🔐 Créez les comptes utilisateurs production:');
        console.log('   - Via l\'API: POST /api/auth/register');
        console.log('   - Ou: POST /api/users (rôle admin)');
        console.log('');

        conn.release();
        process.exit(0);

    } catch (err) {
        console.error('❌ Erreur:', err.message);
        conn.release();
        process.exit(1);
    }
}

clean();
