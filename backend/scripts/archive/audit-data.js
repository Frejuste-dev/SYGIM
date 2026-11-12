/**
 * Script d'audit - Vérifier les données anormales
 * Usage: node audit-data.js
 */

require('dotenv').config();
const { pool } = require('../../src/config/database');

async function auditData() {
  console.log('\n🔍 AUDIT DES DONNÉES ANORMALES\n');
  
  try {
    // 1. Vérifier les transactions
    console.log('📊 TRANSACTIONS:');
    const [transactions] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(amount) as total_amount,
        COUNT(DISTINCT client_id) as unique_clients,
        COUNT(DISTINCT date) as unique_dates
      FROM transactions
    `);
    console.log('  Total transactions:', transactions[0].total);
    console.log('  Montant total:', transactions[0].total_amount);
    console.log('  Clients uniques:', transactions[0].unique_clients);
    console.log('  Dates uniques:', transactions[0].unique_dates);
    
    // 2. Vérifier les doublons
    console.log('\n⚠️  DOUBLONS POSSIBLES:');
    const [duplicates] = await pool.query(`
      SELECT reference, COUNT(*) as count 
      FROM transactions 
      WHERE reference IS NOT NULL 
      GROUP BY reference 
      HAVING count > 1
    `);
    if (duplicates.length > 0) {
      console.log('  ❌ Références dupliquées trouvées:');
      duplicates.forEach(d => console.log(`    ${d.reference}: ${d.count} fois`));
    } else {
      console.log('  ✅ Aucune référence dupliquée');
    }
    
    // 3. Montants négatifs ou zéro
    console.log('\n💰 MONTANTS ANORMAUX:');
    const [abnormal] = await pool.query(`
      SELECT COUNT(*) as total FROM transactions WHERE amount <= 0
    `);
    console.log(`  Transactions avec montant ≤ 0: ${abnormal[0].total}`);
    
    // 4. Transactions sans client
    const [noClient] = await pool.query(`
      SELECT COUNT(*) as total FROM transactions WHERE client_id IS NULL
    `);
    console.log(`  Transactions sans client: ${noClient[0].total}`);
    
    // 5. Vérifier les clients
    console.log('\n👥 CLIENTS:');
    const [clients] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(amount_due) as total_due,
        SUM(amount_paid) as total_paid
      FROM clients
    `);
    console.log('  Total clients:', clients[0].total);
    console.log('  Montant dû total:', clients[0].total_due);
    console.log('  Montant payé total:', clients[0].total_paid);
    
    // 6. Vérifier les propriétés
    console.log('\n🏠 PROPRIÉTÉS:');
    const [properties] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'loue' THEN 1 END) as rented,
        COUNT(CASE WHEN status = 'vacant' THEN 1 END) as vacant
      FROM properties
    `);
    console.log('  Total propriétés:', properties[0].total);
    console.log('  Louées:', properties[0].rented);
    console.log('  Vacantes:', properties[0].vacant);
    
    // 7. Incohérences clients-propriétés
    console.log('\n🔗 INCOHÉRENCES (clients sans propriété):');
    const [orphans] = await pool.query(`
      SELECT COUNT(*) as total FROM clients WHERE property_id IS NOT NULL 
      AND property_id NOT IN (SELECT id FROM properties)
    `);
    console.log(`  Clients pointant vers propriétés inexistantes: ${orphans[0].total}`);
    
    console.log('\n✅ Audit terminé!\n');
    
  } catch (err) {
    console.error('❌ Erreur audit:', err);
  } finally {
    await pool.end();
  }
}

auditData();
