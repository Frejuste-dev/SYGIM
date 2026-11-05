const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

class CryptoService {
  constructor() {
    this.key = this._getKey();
  }

  _getKey() {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
      return null;
    }
    return crypto.scryptSync(secret, 'sygim_salt', 32);
  }

  encrypt(plaintext) {
    if (!this.key || plaintext === null || plaintext === undefined) {
      return plaintext;
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(plaintext.toString(), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  }

  decrypt(ciphertext) {
    if (!this.key || ciphertext === null || ciphertext === undefined) {
      return ciphertext;
    }

    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      return ciphertext;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

module.exports = new CryptoService();
