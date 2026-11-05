const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const certDir = path.join(__dirname, '..', 'certs');
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

const keys = forge.pki.rsa.generateKeyPair(2048);
const cert = forge.pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = '01' + Date.now().toString(16);
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);

const attrs = [
  { name: 'commonName', value: 'localhost' },
  { name: 'organizationName', value: 'SYGIM' },
  { name: 'countryName', value: 'ML' }
];

cert.setSubject(attrs);
cert.setIssuer(attrs);

cert.setExtensions([
  { name: 'basicConstraints', cA: true },
  { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
  { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
  { name: 'subjectAltName', altNames: [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' }
  ]}
]);

cert.sign(keys.privateKey, forge.md.sha256.create());

const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

fs.writeFileSync(path.join(certDir, 'server.crt'), certPem, 'utf8');
fs.writeFileSync(path.join(certDir, 'server.key'), keyPem, 'utf8');

console.log('✅ Certificats SSL auto-signés générés dans certs/');
console.log(`   - server.crt`);
console.log(`   - server.key`);
console.log('\n⚠️  Usage développement uniquement. Pour la production, utilisez Let\'s Encrypt.');
