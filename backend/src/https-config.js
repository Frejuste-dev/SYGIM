const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const Logger = require('./utils/logger/Logger');

function configureServer(app, port = 5000, httpsPort = 5443) {
  const env = process.env.NODE_ENV || 'development';
  const useHttps = process.env.USE_HTTPS === 'true' || env === 'production';

  const httpServer = http.createServer(app);
  httpServer.listen(port, () => {
    Logger.info(`Serveur HTTP en écoute sur le port ${port}`);
  });

  if (useHttps) {
    const certPath = path.join(__dirname, '../certs/server.crt');
    const keyPath = path.join(__dirname, '../certs/server.key');

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      try {
        const options = {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath)
        };

        const httpsServer = https.createServer(options, app);
        httpsServer.listen(httpsPort, () => {
          Logger.info(`🔐 Serveur HTTPS en écoute sur le port ${httpsPort}`);
        });

        return { httpServer, httpsServer };
      } catch (error) {
        Logger.error('Erreur chargement certificat SSL', { error: error.message });
      }
    } else {
      Logger.warn('Certificats SSL non trouvés dans certs/');
      Logger.warn('Générez-les avec: node database/generate_ssl_nodejs.js');
    }
  }

  return { httpServer, httpsServer: null };
}

module.exports = { configureServer };
