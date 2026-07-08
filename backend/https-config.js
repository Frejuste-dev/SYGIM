/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  SYGIM Server Configuration - HTTP & HTTPS Support      ║
 * ║  Version: 1.0 Production                               ║
 * ╚══════════════════════════════════════════════════════════╝
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Configure serveur avec support HTTP et HTTPS
 * @param {Express App} app - Application Express
 * @param {number} port - Port HTTP
 * @param {number} httpsPort - Port HTTPS (optionnel)
 */
function configureServer(app, port = 5000, httpsPort = 5443) {
  const env = process.env.NODE_ENV || 'development';
  const useHttps = process.env.USE_HTTPS === 'true' || env === 'production';
  
  // ────────────────────────────────────────────────────────
  // HTTP Server
  // ────────────────────────────────────────────────────────
  const httpServer = http.createServer(app);
  
  httpServer.listen(port, () => {
    console.log(`\n✅ Server HTTP: http://localhost:${port}`);
  });

  // ────────────────────────────────────────────────────────
  // HTTPS Server (optionnel)
  // ────────────────────────────────────────────────────────
  if (useHttps) {
    const certPath = path.join(__dirname, 'certs/server.crt');
    const keyPath = path.join(__dirname, 'certs/server.key');
    
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      try {
        const options = {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath)
        };
        
        const httpsServer = https.createServer(options, app);
        httpsServer.listen(httpsPort, () => {
          console.log(`✅ Server HTTPS: https://localhost:${httpsPort}`);
          console.log(`🔐 Certificat: ./certs/server.crt (auto-signé)\n`);
        });
        
        return { httpServer, httpsServer };
      } catch (error) {
        console.error('⚠️ Erreur chargement certificat:', error.message);
        console.log('   Continuant avec HTTP uniquement\n');
      }
    } else {
      console.log('⚠️ Certificat SSL non trouvé');
      console.log('   Générez avec: node database/generate_ssl.js\n');
    }
  }
  
  return { httpServer };
}

module.exports = { configureServer };
