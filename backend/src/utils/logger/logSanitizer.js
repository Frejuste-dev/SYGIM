/**
 * Module   : logSanitizer
 * Rôle     : Assainissement récursif et centralisé des journaux pour éliminer
 *            l'exposition de secrets, mots de passe, tokens et credentials (SEC-003-B).
 *
 * Caractéristiques :
 * - Fonction pure, 100% sans mutation des objets sources.
 * - Insensible à la casse, aux séparateurs (_ et -) et aux conventions de nommage.
 * - Gestion sûre des références circulaires (WeakSet).
 * - Préservation intégrale des propriétés symboliques Winston.
 * - Préservation intégrale des informations métier non sensibles.
 */

const REDACTED = '***REDACTED***';

/**
 * Normalise un nom de propriété pour faciliter la comparaison :
 * ex: "Password_Hash" -> "passwordhash", "new-password" -> "newpassword"
 */
function normalizeKey(key) {
  if (typeof key !== 'string') return '';
  return key.toLowerCase().replace(/[-_\s]/g, '');
}

/**
 * Ensemble des clés normalisées strictement interdites dans les journaux
 */
const SENSITIVE_NORMALIZED_KEYS = new Set([
  // Mots de passe
  'password',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'passwordhash',
  'pass',
  'pwd',

  // Tokens & Sessions
  'token',
  'accesstoken',
  'refreshtoken',
  'rawrefreshtoken',
  'bearertoken',
  'jwttoken',
  'usertoken',
  'authtoken',
  'csrftoken',
  'xsrftoken',
  'sessionid',

  // En-têtes & Cookies sensibles
  'authorization',
  'cookie',
  'setcookie',

  // Secrets & Clés API
  'apikey',
  'clientsecret',
  'secret',
  'privatekey',
  'jwtsecret',
  'jwtrefreshsecret',
  'dbpassword'
]);

/**
 * Patterns de sous-chaînes sensibles pour capture étendue (si la clé contient ces mots)
 */
const SENSITIVE_SUBSTRINGS = ['password', 'secret', 'privatekey'];

/**
 * Clés métier autorisées explicitement même si elles contiennent un motif suspect
 */
const ALLOWED_BUSINESS_KEYS = new Set([
  'username',
  'clientname',
  'email',
  'clientid',
  'propertyid',
  'collectorid',
  'amountreceived',
  'amountpaid',
  'balancedue',
  'invoicenumber',
  'receiptnumber',
  'transactionreference',
  'role',
  'status'
]);

/**
 * Vérifie si une clé donnée correspond à une donnée sensible
 */
function isSensitiveKey(rawKey) {
  if (typeof rawKey !== 'string') return false;

  const normalized = normalizeKey(rawKey);

  // Vérifier d'abord si c'est explicitement une clé métier autorisée
  if (ALLOWED_BUSINESS_KEYS.has(normalized)) {
    return false;
  }

  // Vérifier la liste exacte normalisée
  if (SENSITIVE_NORMALIZED_KEYS.has(normalized)) {
    return true;
  }

  // Vérifier si elle se termine ou contient des sous-chaînes sensibles évidentes
  for (const sub of SENSITIVE_SUBSTRINGS) {
    if (normalized.includes(sub)) {
      return true;
    }
  }

  return false;
}

/**
 * Assainit une chaîne de caractères libre (masque Bearer, cookies spécifiques, tokens JWT, hashes)
 */
function sanitizeString(str) {
  if (typeof str !== 'string' || str.length === 0) return str;

  let sanitized = str;

  // 1. Masquer les tokens Bearer : "Bearer eyJhbG..." -> "Bearer ***REDACTED***"
  sanitized = sanitized.replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, `$1${REDACTED}`);

  // 2. Masquer les cookies sensibles dans les en-têtes cookie textuels
  sanitized = sanitized.replace(
    /((?:access_?token|refresh_?token|token|session_?id|connect\.sid)\s*=\s*)([^;]+)/gi,
    `$1${REDACTED}`
  );

  // 3. Masquer un hash bcrypt complet isolé
  sanitized = sanitized.replace(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/g, REDACTED);

  // 4. Masquer un JWT complet isolé
  sanitized = sanitized.replace(/^eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g, REDACTED);

  return sanitized;
}

/**
 * Fonction récursive pure de sanitisation
 * @param {*} target - Donnée à assainir
 * @param {Set} ancestors - Ensemble des ancêtres actifs dans la pile DFS (détection des vrais cycles)
 * @param {WeakMap} memo - Cache des références partagées (graphe DAG / diamant non circulaire)
 * @returns {*} Nouvelle structure assainie (sans mutation)
 */
function sanitize(target, ancestors = new Set(), memo = new WeakMap()) {
  // 1. Valeurs nulles ou primitives non-string
  if (target === null || target === undefined) {
    return target;
  }

  const type = typeof target;

  if (type === 'string') {
    return sanitizeString(target);
  }

  if (type === 'number' || type === 'boolean' || type === 'symbol' || type === 'function') {
    return target;
  }

  // 2. Traitement sécurisé des Buffer (évite exposition binaire et dump géant d'octets)
  if (Buffer.isBuffer(target)) {
    return `[Buffer: ${target.length} bytes]`;
  }

  // 3. Détection des véritables cycles récursifs
  if (ancestors.has(target)) {
    return '[Circular]';
  }

  // 4. Gestion des références partagées non cycliques (DAG) via mémoïsation
  if (memo.has(target)) {
    return memo.get(target);
  }

  // 5. Objets spéciaux : Date, RegExp
  if (target instanceof Date) {
    return new Date(target.getTime());
  }

  if (target instanceof RegExp) {
    return new RegExp(target);
  }

  // Marquer l'objet comme ancêtre actif sur la branche courante
  ancestors.add(target);

  // 6. Traitement des tableaux
  if (Array.isArray(target)) {
    const arrayCopy = [];
    memo.set(target, arrayCopy);

    for (let i = 0; i < target.length; i++) {
      arrayCopy.push(sanitize(target[i], ancestors, memo));
    }

    ancestors.delete(target);
    return arrayCopy;
  }

  // 7. Traitement des instances d'Error
  if (target instanceof Error) {
    const errorCopy = {
      name: target.name,
      message: sanitizeString(target.message),
      code: target.code,
      statusCode: target.statusCode,
      stack: target.stack ? sanitizeString(target.stack) : undefined
    };
    memo.set(target, errorCopy);

    // Copier et assainir d'éventuelles propriétés personnalisées attachées à l'erreur (ex: error.data)
    for (const key of Object.keys(target)) {
      if (!['name', 'message', 'code', 'statusCode', 'stack'].includes(key)) {
        if (isSensitiveKey(key)) {
          errorCopy[key] = REDACTED;
        } else {
          errorCopy[key] = sanitize(target[key], ancestors, memo);
        }
      }
    }

    ancestors.delete(target);
    return errorCopy;
  }

  // 8. Objets ordinaires
  const result = {};
  memo.set(target, result);

  // Traiter les propriétés régulières
  for (const [key, value] of Object.entries(target)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = sanitize(value, ancestors, memo);
    }
  }

  // Traitement sécurisé des propriétés Symbol (Winston Symbols)
  const symbols = Object.getOwnPropertySymbols(target);
  for (const sym of symbols) {
    // Si Winston a stocké des arguments supplémentaires dans Symbol.for('splat')
    if (sym === Symbol.for('splat') && Array.isArray(target[sym])) {
      result[sym] = target[sym].map((item) => sanitize(item, ancestors, memo));
    } else if (sym === Symbol.for('message') && typeof target[sym] === 'string') {
      result[sym] = sanitizeString(target[sym]);
    } else {
      result[sym] = target[sym];
    }
  }

  ancestors.delete(target);
  return result;
}

module.exports = {
  sanitize,
  sanitizeString,
  isSensitiveKey,
  REDACTED
};

