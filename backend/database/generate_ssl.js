// Script pour générer certificat SSL auto-signé
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certsDir = path.join(__dirname, '../backend/certs');

// Créer dossier certs
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
  console.log('📁 Dossier certs créé');
}

try {
  // Vérifier si OpenSSL est disponible
  try {
    execSync('openssl version', { stdio: 'pipe' });
    
    console.log('🔐 Génération certificat SSL auto-signé...\n');
    
    // Générer clé privée et certificat
    const cmd = `openssl req -x509 -newkey rsa:4096 -keyout "${path.join(certsDir, 'server.key')}" -out "${path.join(certsDir, 'server.crt')}" -days 365 -nodes -subj "/C=ML/ST=Mali/L=Bamako/O=SYGIM/CN=localhost"`;
    
    execSync(cmd, { stdio: 'pipe' });
    
    if (fs.existsSync(path.join(certsDir, 'server.crt')) && 
        fs.existsSync(path.join(certsDir, 'server.key'))) {
      console.log('✅ Certificat SSL généré avec succès!\n');
      console.log('📋 Détails:');
      console.log('   - Fichier: backend/certs/server.crt');
      console.log('   - Clé: backend/certs/server.key');
      console.log('   - Type: RSA 4096 bits');
      console.log('   - Validité: 365 jours');
      console.log('   - Common Name: localhost\n');
      
      console.log('✅ Vous pouvez maintenant activer HTTPS dans server.js');
    }
  } catch (e) {
    console.log('⚠️ OpenSSL non disponible en PATH');
    console.log('📌 Options:');
    console.log('   1. Installer OpenSSL: https://slproweb.com/products/Win32OpenSSL.html');
    console.log('   2. Ou utiliser Let\'s Encrypt en production');
  }
} catch (error) {
  console.error('❌ Erreur:', error.message);
}
