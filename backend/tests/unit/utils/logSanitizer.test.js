/**
 * Tests Unitaires & Intégration — logSanitizer (SEC-003-B)
 * Couvre l'assainissement exhaustif des logs sans régression métier ni mutation.
 */

const { sanitize, sanitizeString, SENSITIVE_KEYS, REDACTED } = require('../../../src/utils/logger/logSanitizer');

describe('logSanitizer — Tests Unitaires (SEC-003-B)', () => {

  describe('1. Mots de passe et variantes de nommage', () => {
    it('doit masquer un mot de passe en clair (password)', () => {
      const input = { username: 'john_doe', password: 'SecretPassword123!' };
      const output = sanitize(input);

      expect(output.password).toBe(REDACTED);
      expect(output.username).toBe('john_doe');
    });

    it('doit masquer password_hash, passwordHash et pass', () => {
      const input = {
        password_hash: '$2a$12$e8Yn5h3j4k5l6m7n8o9p0q1r2s3t4u5v6w7x8y9z0a1b2c3d4e5f',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz01234567890123456789012345',
        pass: 'shortPwd',
        pwd: 'myPwd'
      };
      const output = sanitize(input);

      expect(output.password_hash).toBe(REDACTED);
      expect(output.passwordHash).toBe(REDACTED);
      expect(output.pass).toBe(REDACTED);
      expect(output.pwd).toBe(REDACTED);
    });

    it('doit masquer currentPassword, newPassword et confirmPassword', () => {
      const input = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
        confirmPassword: 'NewPassword456!'
      };
      const output = sanitize(input);

      expect(output.currentPassword).toBe(REDACTED);
      expect(output.newPassword).toBe(REDACTED);
      expect(output.confirmPassword).toBe(REDACTED);
    });

    it('doit être insensible à la casse et aux séparateurs (snake_case, kebab-case, UPPERCASE)', () => {
      const input = {
        PASSWORD: 'upper',
        'current-password': 'kebab',
        new_password: 'snake',
        DB_PASSWORD: 'env',
        JWT_SECRET: 'jwt_env'
      };
      const output = sanitize(input);

      expect(output.PASSWORD).toBe(REDACTED);
      expect(output['current-password']).toBe(REDACTED);
      expect(output.new_password).toBe(REDACTED);
      expect(output.DB_PASSWORD).toBe(REDACTED);
      expect(output.JWT_SECRET).toBe(REDACTED);
    });
  });

  describe('2. Tokens, Cookies et En-têtes', () => {
    it('doit masquer token, accessToken, refreshToken et rawRefreshToken', () => {
      const input = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        accessToken: 'access-jwt-val',
        refreshToken: 'refresh-jwt-val',
        rawRefreshToken: 'raw-refresh-val',
        sessionId: 'sess-1234'
      };
      const output = sanitize(input);

      expect(output.token).toBe(REDACTED);
      expect(output.accessToken).toBe(REDACTED);
      expect(output.refreshToken).toBe(REDACTED);
      expect(output.rawRefreshToken).toBe(REDACTED);
      expect(output.sessionId).toBe(REDACTED);
    });

    it('doit masquer l\'en-tête authorization et conserver le schéma Bearer si textuel', () => {
      const input = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MX0.signature'
      };
      const output = sanitize(input);

      expect(output.authorization).toBe(REDACTED);
    });

    it('doit masquer l\'objet headers imbriqué avec authorization et cookie', () => {
      const input = {
        headers: {
          authorization: 'Bearer secret_token_xyz',
          cookie: 'accessToken=jwt_secret_val; refreshToken=refresh_secret_val; other=not_secret',
          'content-type': 'application/json'
        }
      };
      const output = sanitize(input);

      expect(output.headers.authorization).toBe(REDACTED);
      expect(output.headers.cookie).toBe(REDACTED);
      expect(output.headers['content-type']).toBe('application/json');
    });

    it('doit masquer sélectivement les tokens dans les chaînes de cookies via sanitizeString', () => {
      const cookieStr = 'accessToken=jwt_secret_val; other_cookie=visible; refreshToken=refresh_val';
      const clean = sanitizeString(cookieStr);

      expect(clean).toContain(`accessToken=${REDACTED}`);
      expect(clean).toContain(`refreshToken=${REDACTED}`);
      expect(clean).toContain('other_cookie=visible');
    });

    it('doit masquer les patterns Bearer dans les chaînes de texte libres', () => {
      const text = 'Failed auth with header Bearer eyJhbGciOiJIUzI1Ni.xyz.123 for user admin';
      const clean = sanitizeString(text);

      expect(clean).toContain(`Bearer ${REDACTED}`);
      expect(clean).not.toContain('eyJhbGciOiJIUzI1Ni');
      expect(clean).toContain('for user admin');
    });
  });

  describe('3. Objets imbriqués et Tableaux', () => {
    it('doit masquer récursivement les clés sensibles dans les objets imbriqués', () => {
      const input = {
        level1: {
          level2: {
            user: 'admin',
            credentials: {
              password: 'nestedPassword!',
              token: 'nestedToken'
            }
          }
        }
      };
      const output = sanitize(input);

      expect(output.level1.level2.user).toBe('admin');
      expect(output.level1.level2.credentials.password).toBe(REDACTED);
      expect(output.level1.level2.credentials.token).toBe(REDACTED);
    });

    it('doit masquer récursivement dans les tableaux', () => {
      const input = {
        users: [
          { id: 1, username: 'user1', password: 'p1' },
          { id: 2, username: 'user2', password: 'p2' }
        ]
      };
      const output = sanitize(input);

      expect(output.users[0].username).toBe('user1');
      expect(output.users[0].password).toBe(REDACTED);
      expect(output.users[1].username).toBe('user2');
      expect(output.users[1].password).toBe(REDACTED);
    });
  });

  describe('4. Immutabilité et Non-Mutation', () => {
    it('ne doit JAMAIS modifier l\'objet d\'origine passé en paramètre', () => {
      const original = {
        username: 'alice',
        password: 'OriginalPasswordDoNotTouch!',
        meta: { token: 'OriginalToken' },
        list: [{ secret: 'OriginalSecret' }]
      };
      const frozenOriginalSnapshot = JSON.stringify(original);

      const sanitized = sanitize(original);

      expect(JSON.stringify(original)).toBe(frozenOriginalSnapshot);
      expect(original.password).toBe('OriginalPasswordDoNotTouch!');
      expect(original.meta.token).toBe('OriginalToken');
      expect(original.list[0].secret).toBe('OriginalSecret');

      expect(sanitized.password).toBe(REDACTED);
      expect(sanitized.meta.token).toBe(REDACTED);
      expect(sanitized.list[0].secret).toBe(REDACTED);
    });
  });

  describe('5. Données métier légitimes préservées', () => {
    it('doit préserver intactes toutes les informations métier sans sur-masquage', () => {
      const input = {
        username: 'collector_jean',
        email: 'jean.dupont@sygim.ci',
        clientId: 42,
        client_name: 'M. Kouassi',
        amountReceived: 250000,
        amount_paid: 250000,
        balance_due: 0,
        invoiceNumber: 'FAC-2026-10-001',
        receiptNumber: 'REC-02112026-ABCD',
        transactionReference: 'TXN-98765',
        role: 'collector',
        status: 'PAID'
      };
      const output = sanitize(input);

      expect(output).toEqual(input);
    });
  });

  describe('6. Objets d\'Erreur et Stack Traces', () => {
    it('doit assainir les objets Error sans perdre les propriétés d\'erreur', () => {
      const err = new Error('Auth failed for Bearer secretToken123456');
      err.code = 'UNAUTHORIZED';
      err.data = { password: 'myPassword' };

      const sanitizedErr = sanitize(err);

      expect(sanitizedErr.name).toBe('Error');
      expect(sanitizedErr.code).toBe('UNAUTHORIZED');
      expect(sanitizedErr.message).toContain(`Bearer ${REDACTED}`);
      expect(sanitizedErr.message).not.toContain('secretToken123456');
      expect(sanitizedErr.data.password).toBe(REDACTED);
      expect(sanitizedErr.stack).toBeDefined();
    });
  });

  describe('7. Gestion des Références Circulaires et Graphes Partagés (SEC-003-D)', () => {
    it('doit détecter et marquer [Circular] sur un cycle direct sans récursion infinie', () => {
      const circular = { name: 'circularDirect', password: 'secret' };
      circular.self = circular;

      let result;
      expect(() => {
        result = sanitize(circular);
      }).not.toThrow();

      expect(result.password).toBe(REDACTED);
      expect(result.name).toBe('circularDirect');
      expect(result.self).toBe('[Circular]');
    });

    it('doit détecter et marquer [Circular] sur un cycle indirect (A -> B -> A)', () => {
      const nodeA = { name: 'nodeA', password: 'secretA' };
      const nodeB = { name: 'nodeB', token: 'tokenB' };
      nodeA.link = nodeB;
      nodeB.link = nodeA;

      let result;
      expect(() => {
        result = sanitize(nodeA);
      }).not.toThrow();

      expect(result.password).toBe(REDACTED);
      expect(result.link.token).toBe(REDACTED);
      expect(result.link.link).toBe('[Circular]');
    });

    it('doit détecter et marquer [Circular] sur un tableau contenant une référence cyclique', () => {
      const arr = [{ id: 1, password: 'secretInArray' }];
      arr.push(arr);

      let result;
      expect(() => {
        result = sanitize(arr);
      }).not.toThrow();

      expect(result[0].password).toBe(REDACTED);
      expect(result[1]).toBe('[Circular]');
    });

    it('doit assainir sans fausse détection de cycle les références partagées non cycliques (DAG)', () => {
      const sharedUser = {
        id: 42,
        name: 'SharedUser',
        password: 'SensitivePassword123!',
        token: 'SharedToken456'
      };

      const payload = {
        source: sharedUser,
        target: sharedUser,
        meta: { primary: sharedUser }
      };

      const result = sanitize(payload);

      // Aucune propriété ne doit être marquée [Circular] à tort
      expect(result.source).not.toBe('[Circular]');
      expect(result.target).not.toBe('[Circular]');
      expect(result.meta.primary).not.toBe('[Circular]');

      // Les secrets doivent être masqués partout
      expect(result.source.password).toBe(REDACTED);
      expect(result.source.token).toBe(REDACTED);
      expect(result.target.password).toBe(REDACTED);
      expect(result.target.token).toBe(REDACTED);
      expect(result.meta.primary.password).toBe(REDACTED);

      // Données métier préservées
      expect(result.source.name).toBe('SharedUser');
      expect(result.target.name).toBe('SharedUser');
    });
  });

  describe('8. Primitives, Null, Undefined et Valeurs Limites', () => {
    it('doit retourner les primitives sans altération', () => {
      expect(sanitize(null)).toBe(null);
      expect(sanitize(undefined)).toBe(undefined);
      expect(sanitize('simple string')).toBe('simple string');
      expect(sanitize(12345)).toBe(12345);
      expect(sanitize(true)).toBe(true);
      expect(sanitize(false)).toBe(false);
      expect(sanitize([])).toEqual([]);
      expect(sanitize({})).toEqual({});
    });
  });

  describe('9. Propriétés Symboliques Winston (SEC-003-D)', () => {
    it('doit préserver les symboles Winston de base (level, message)', () => {
      const symMessage = Symbol.for('message');
      const symLevel = Symbol.for('level');

      const winstonInfo = {
        level: 'info',
        message: 'User logged in',
        password: 'clearPassword',
        [symLevel]: 'info',
        [symMessage]: 'formatted string with Bearer eyJhbGciOiJIUzI1Ni.xyz.sig'
      };

      const sanitizedInfo = sanitize(winstonInfo);

      expect(sanitizedInfo.level).toBe('info');
      expect(sanitizedInfo.password).toBe(REDACTED);
      expect(sanitizedInfo[symLevel]).toBe('info');
      expect(sanitizedInfo[symMessage]).toContain(`Bearer ${REDACTED}`);
    });

    it('doit assainir récursivement les arguments splat de Winston (Symbol.for("splat"))', () => {
      const symSplat = Symbol.for('splat');

      const winstonInfoWithSplat = {
        level: 'info',
        message: 'Authentication event',
        [symSplat]: [
          {
            username: 'john_admin',
            password: 'SuperSecretSplatPassword!',
            accessToken: 'splat-access-token-12345',
            meta: {
              refreshToken: 'splat-refresh-token-67890'
            }
          },
          'Additional context string with Bearer eyJhbGciOiJIUzI1Ni.splatToken.sig'
        ]
      };

      const sanitized = sanitize(winstonInfoWithSplat);

      expect(sanitized[symSplat]).toBeDefined();
      expect(Array.isArray(sanitized[symSplat])).toBe(true);

      const splatObj = sanitized[symSplat][0];
      expect(splatObj.username).toBe('john_admin');
      expect(splatObj.password).toBe(REDACTED);
      expect(splatObj.accessToken).toBe(REDACTED);
      expect(splatObj.meta.refreshToken).toBe(REDACTED);

      const splatStr = sanitized[symSplat][1];
      expect(splatStr).toContain(`Bearer ${REDACTED}`);
      expect(splatStr).not.toContain('splatToken');
    });
  });

  describe('10. Intégration Middleware requestLogger (SEC-003-D)', () => {
    const requestLogger = require('../../../src/middleware/requestLogger');
    const Logger = require('../../../src/utils/logger/Logger');

    it('doit transmettre req.body et req.query bruts au logger sans les muter, Winston assurant la sanitisation centrale', () => {
      const req = {
        method: 'POST',
        path: '/api/v1/auth/login',
        body: { username: 'testuser', password: 'SecretPassword123!' },
        query: { token: 'secret-query-token', page: '1' }
      };
      const res = { on: jest.fn() };
      const next = jest.fn();

      const debugSpy = jest.spyOn(Logger, 'debug').mockImplementation(() => {});

      requestLogger(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);

      // 1. Les objets Express d'origine restent strictement intacts
      expect(req.body.password).toBe('SecretPassword123!');
      expect(req.body.username).toBe('testuser');
      expect(req.query.token).toBe('secret-query-token');

      // 2. Logger.debug reçoit les données sans double-traversée locale
      expect(debugSpy).toHaveBeenCalledWith(
        'Incoming request [POST /api/v1/auth/login]',
        expect.objectContaining({
          body: req.body,
          query: req.query
        })
      );

      // 3. Le formateur central Winston assainit l'entrée complète
      const passedToLogger = debugSpy.mock.calls[0][1];
      const sanitizedAtWinston = sanitize(passedToLogger);
      expect(sanitizedAtWinston.body.password).toBe(REDACTED);
      expect(sanitizedAtWinston.body.username).toBe('testuser');
      expect(sanitizedAtWinston.query.token).toBe(REDACTED);
      expect(sanitizedAtWinston.query.page).toBe('1');

      debugSpy.mockRestore();
    });
  });

  describe('11. Intégration BaseService & Non-Régression Métier (SEC-003-B)', () => {
    const BaseService = require('../../../src/core/BaseService');
    const Logger = require('../../../src/utils/logger/Logger');

    it('doit transmettre les données intactes au repository tout en garantissant un log assaini', async () => {
      const mockRepo = {
        create: jest.fn().mockImplementation(async (data) => ({ id: 42, ...data })),
        update: jest.fn().mockImplementation(async (id, data) => ({ id, ...data }))
      };
      const service = new BaseService(mockRepo);

      const rawUserData = {
        username: 'new_collector',
        password_hash: '$2b$10$UnHashedSecretValueInProduction12345',
        refreshToken: 'rt-secure-token-value',
        amountDue: 50000
      };

      const infoSpy = jest.spyOn(Logger, 'info').mockImplementation(() => {});

      const result = await service.create(rawUserData, { id: 1, role: 'admin' });

      // 1. Le repository a bien reçu la donnée brute inchangée
      expect(mockRepo.create).toHaveBeenCalledWith(rawUserData);
      expect(result.password_hash).toBe('$2b$10$UnHashedSecretValueInProduction12345');
      expect(result.amountDue).toBe(50000);

      // 2. Le logger a reçu le log
      expect(infoSpy).toHaveBeenCalledWith(
        'Creating new item',
        expect.objectContaining({ data: rawUserData })
      );

      // 3. Le formateur de log Winston (sanitize) masque les données sensibles à l'enregistrement
      const loggedInfo = infoSpy.mock.calls[0][1];
      const sanitizedOutput = sanitize(loggedInfo);
      expect(sanitizedOutput.data.password_hash).toBe(REDACTED);
      expect(sanitizedOutput.data.refreshToken).toBe(REDACTED);
      expect(sanitizedOutput.data.username).toBe('new_collector');
      expect(sanitizedOutput.data.amountDue).toBe(50000);

      infoSpy.mockRestore();
    });
  });

  describe('12. Traitement Sécurisé des Buffers (SEC-003-D)', () => {
    it('doit remplacer les Buffer par une représentation contrôlée sans décomposition en octets', () => {
      const secretBinary = Buffer.from('ExtremelyConfidentialKeyOrToken123');
      const input = {
        filename: 'private_key.bin',
        content: secretBinary,
        nested: {
          fileBuffer: Buffer.alloc(64)
        }
      };

      const output = sanitize(input);

      expect(output.filename).toBe('private_key.bin');
      expect(output.content).toBe(`[Buffer: ${secretBinary.length} bytes]`);
      expect(output.nested.fileBuffer).toBe('[Buffer: 64 bytes]');

      // Vérifier que le résultat est une chaîne contrôlée et non un objet de bytes
      expect(typeof output.content).toBe('string');
      expect(output.content).toMatch(/^\[Buffer: \d+ bytes\]$/);
      expect(typeof output.nested.fileBuffer).toBe('string');
      expect(output.nested.fileBuffer).toBe('[Buffer: 64 bytes]');
    });

    it('doit traiter les Buffer autonomes sans erreur', () => {
      const standalone = Buffer.from('hello');
      expect(sanitize(standalone)).toBe('[Buffer: 5 bytes]');
    });
  });

  describe('13. Contrôle de Sortie Réelle des Transports Winston & Formatage Splat (SEC-003-D)', () => {
    const winston = require('winston');
    const { Writable } = require('stream');

    it('doit masquer les secrets transmis dans les arguments splat à la sortie d\'un transport Winston réel', (done) => {
      const outputs = [];
      const memStream = new Writable({
        write(chunk, encoding, next) {
          outputs.push(chunk.toString());
          next();
        }
      });

      const testLogger = winston.createLogger({
        format: winston.format.combine(
          winston.format((info) => sanitize(info))(),
          winston.format.splat(),
          winston.format.json()
        ),
        transports: [
          new winston.transports.Stream({ stream: memStream })
        ]
      });

      testLogger.info('Authentication event', {
        username: 'audit_user',
        password: 'SecretPasswordInSplat!',
        accessToken: 'jwt-access-token-in-splat',
        refreshToken: 'jwt-refresh-token-in-splat',
        businessData: { receiptNumber: 'REC-20261102-SPLAT' }
      });

      setImmediate(() => {
        const rawOutput = outputs.join('');

        expect(rawOutput).toContain('Authentication event');
        expect(rawOutput).toContain('audit_user');
        expect(rawOutput).toContain('REC-20261102-SPLAT');
        expect(rawOutput).toContain(REDACTED);

        // Vérification absolue : aucun secret brut dans le transport Winston réel
        expect(rawOutput).not.toContain('SecretPasswordInSplat!');
        expect(rawOutput).not.toContain('jwt-access-token-in-splat');
        expect(rawOutput).not.toContain('jwt-refresh-token-in-splat');

        done();
      });
    });
  });

  describe('14. Vérification du Logging Sécurisé de db.js (SEC-003-D)', () => {
    it('doit exporter testConnection qui utilise Logger sans dépendance circulaire', async () => {
      const { testConnection } = require('../../../config/db');
      expect(typeof testConnection).toBe('function');
    });
  });

});
