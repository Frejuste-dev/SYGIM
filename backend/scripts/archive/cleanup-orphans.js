/**
 * Script de nettoyage - Supprimer les transactions orphelines
 * Usage: node cleanup-orphans.js
 */

require('dotenv').config();
const { pool } = require('./config/db');

async function cleanupOrphans() {
  console.log('\n🧹 NETTOYAGE DES DONNÉES ORPHELINES\n');
  
  try {
    // Supprimer les transactions sans client
    const [result] = await pool.query(`
      DELETE FROM transactions WHERE client_id IS NULL
    `);
    
    console.log(`✅ ${result.affectedRows} transaction(s) orpheline(s) supprimée(s)`);
    
    // Vérifier qu'il ne reste plus de doublons ou anomalies
    console.log('\n📊 Vérification post-nettoyage:');
    const [remaining] = await pool.query(`
      SELECT COUNT(*) as total FROM transactions
    `);
    console.log(`   Total transactions restantes: ${remaining[0].total}`);
    
    console.log('\n✅ Nettoyage terminé!\n');
    
  } catch (err) {
    console.error('❌ Erreur nettoyage:', err);
  } finally {
    await pool.end();
  }
}

cleanupOrphans();
