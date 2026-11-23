// Fix admin role assignment for production users
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function fixAdminRole() {
  try {
    if (!process.env.DB_PASSWORD) {
      throw new Error("Variable d'environnement DB_PASSWORD requise.");
    }

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'sygim_db'
    });

    console.log('✅ Connecté à la base de données');

    // Update admin users' roles
    const [result] = await connection.execute(
      "UPDATE users SET role='admin' WHERE username IN ('admin_prod', 'admin_final')"
    );

    console.log(`✅ ${result.affectedRows} utilisateurs mis à jour avec le rôle 'admin'`);

    // Verify the update
    const [rows] = await connection.execute(
      'SELECT id, username, role FROM users'
    );

    console.log('\n📋 État actuel des utilisateurs:');
    console.table(rows);

    await connection.end();
    console.log('\n✅ Rôles admin corrigés avec succès');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

fixAdminRole();
