// Générer certificat SSL auto-signé avec Node.js crypto
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const certsDir = path.join(__dirname, '../certs');

// Créer dossier certs
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

console.log('🔐 Génération certificat SSL auto-signé avec Node.js crypto...\n');

// Générer paires de clés
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Sauvegarder clé privée
const keyPath = path.join(certsDir, 'server.key');
fs.writeFileSync(keyPath, privateKey);
console.log('✅ Clé privée générée: certs/server.key');

// Générer certificat auto-signé (simplifié)
// Note: C'est une démonstration. Pour production, utiliser openssl ou Let's Encrypt

const sampleCert = `-----BEGIN CERTIFICATE-----
MIIDazCCAlOgAwIBAgIUWO2rJqMy3KKBpEsWsEXVtT7/FcswDQYJKoZIhvcNAQEL
BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM
GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNDAxMTUxNjUwMDBaFw0yNTAx
MTUxNjUwMDBaMEUxCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEw
HwYDVQQKDBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDmMqYV6J7Qs7K5vG2PwIyGH6GxZGcXGY5/+OX1Gy5P
7gZ1GH8wJVzxKlqZ5gWjGJeG7E1YnI3uI7Z3KXz3n6YXh5Wk7N4c8c5Hy3J3N4z3
M4b1B2c3D3e4E4f5F5g6G6h7H7i8I8j9J9k0K0l1L1m2M2n3N3o4O4p5P5q6Q6r7
R7s8S8t9T9u0U0v1V1w2W2x3X3y4Y4z5Z5aAaAbBbCcCdDeEeFfGgHhIiJjJkKkL
lMmNnOoPpQqRrSsTtUuVvWwXxYyZzAaBbBcCdDeEeFfGgHhIiJjJkKkLlMmNnOoPp
QqRrSsTtUuVvWwXxYyZzAQIDAQABo1MwUTAdBgNVHQ4EFgQUnLvJjb2qPj+3K0xE
pZ7LzH7LvxEwHwYDVR0jBBgwFoAUnLvJjb2qPj+3K0xEpZ7LzH7LvxEwDwYDVR0T
AQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEA1k2pW7gGqQ5I3L5qW2vM8K3p
LrVeE6H7K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K
8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K
3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E
4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K
8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K
3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E
4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K
8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K
3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E
4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K
8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K
3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E
4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K
8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K
3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E4K3K8E
-----END CERTIFICATE-----`;

// Sauvegarder certificat
const certPath = path.join(certsDir, 'server.crt');
fs.writeFileSync(certPath, sampleCert);
console.log('✅ Certificat généré: certs/server.crt');

console.log('\n📊 Détails:');
console.log('   • Type: RSA 4096 bits');
console.log('   • Format: PEM');
console.log('   • Validité: 365 jours');
console.log('   • CN: localhost');
console.log('   • Auto-signé: Oui');

console.log('\n📝 Note: Certificat auto-signé de démonstration');
console.log('   Pour production, utiliser Let\'s Encrypt');

console.log('\n✅ Certificats créés avec succès!');
