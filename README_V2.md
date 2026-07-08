# 🏆 SYGIM - Architecture Professionnelle v2.0

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![License](https://img.shields.io/badge/license-UNLICENSED-red)

**Système de Gestion Immobilière — Architecture de Classe Mondiale**

[Architecture](#-architecture) • [Installation](#-installation) • [API](#-api) • [Développement](#-développement) • [Déploiement](#-déploiement)

</div>

---

## 🌟 Améliorations v2.0

| Aspect | Avant | Après |
|--------|-------|-------|
| **Architecture** | Monolithe | Couches (Controllers/Services/Repos) |
| **Gestion d'erreurs** | Ad-hoc | Centralisée avec `AppError` |
| **Logging** | Console simple | Structuré JSON (ELK compatible) |
| **Validation** | Manuelle | Validateur réutilisable |
| **Réponses API** | Incohérentes | Format standardisé `ApiResponse` |
| **Tests** | Aucuns | Infrastructure Jest + Mocha |
| **Sécurité** | Basique | Helmet, CORS, Validation, HTTPS |
| **Documentation** | Manquante | Complète (Architecture, API, Guide) |
| **Scalabilité** | Limitée | Microservices-ready |

---

## 📋 Prérequis

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **MySQL** >= 5.7
- **Git** (optionnel)

Vérifier:
```bash
node --version  # v18+
npm --version   # 9+
mysql --version # 5.7+
```

---

## 💾 Installation

### 1. Cloner le repository

```bash
cd backend
npm install
```

### 2. Configurer l'environnement

```bash
# Copier le template
cp .env.example .env

# Éditer .env avec vos paramètres
NODE_ENV=development
PORT=5000
CORS_ORIGINS=http://localhost:3000,http://localhost:5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=sygim_prod
```

### 3. Démarrer le serveur

```bash
# Mode développement
npm run dev

# Mode production
npm start

# Avec débogage
npm run dev:debug
```

Le serveur démarre sur `http://localhost:5000`

---

## 🏗️ Architecture

### Hiérarchie des couches

```
┌─────────────────────────────────────┐
│      HTTP Request/Response          │
├─────────────────────────────────────┤
│      Middleware Layer               │
│  (Logger, Validator, Auth)          │
├─────────────────────────────────────┤
│      Controller Layer               │
│  (Route handlers, Request parsing)  │
├─────────────────────────────────────┤
│      Service Layer                  │
│  (Business logic, Validation)       │
├─────────────────────────────────────┤
│      Repository Layer               │
│  (Database queries)                 │
├─────────────────────────────────────┤
│      Database Layer                 │
│  (MySQL, Transactions)              │
└─────────────────────────────────────┘
```

### Structure de fichiers

```
src/
├── app.js                  # Express app instance
├── index.js                # Server entry point
├── controllers/            # HTTP request handlers
├── services/               # Business logic
├── repositories/           # Database access
├── middleware/             # Express middleware
├── utils/
│   ├── errors/            # Error classes
│   ├── logger/            # Logging utilities
│   └── responses/         # Response formatters
├── routes/                # Route definitions
└── config/                # Configuration
```

---

## 🔌 API

### Format des réponses

Toutes les réponses suivent ce format standardisé:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation successful",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2026-06-06T10:30:00Z"
}
```

### Routes santé

```bash
# Health check
GET /health

# Readiness probe
GET /health/ready
```

### Codes HTTP

| Code | Signification |
|------|---------------|
| 200 | ✅ OK |
| 201 | ✅ Created |
| 204 | ✅ No Content |
| 400 | ❌ Bad Request |
| 401 | ❌ Unauthorized |
| 403 | ❌ Forbidden |
| 404 | ❌ Not Found |
| 409 | ❌ Conflict |
| 500 | ❌ Internal Server Error |

---

## 🛠️ Développement

### Scripts disponibles

```bash
npm run dev                # Mode watch
npm run dev:debug        # Avec déboggage
npm run test             # Tests + coverage
npm run test:watch       # Tests continus
npm run test:unit        # Tests unitaires
npm run test:integration # Tests d'intégration
npm run lint             # Vérifier le code
npm run format           # Formater le code
npm run check            # Lint + Tests
```

### Ajouter une nouvelle entité

1. **Créer un Repository**
```javascript
// src/repositories/ClientRepository.js
class ClientRepository extends BaseRepository {
  constructor() { super('clients'); }
}
```

2. **Créer un Service**
```javascript
// src/services/ClientService.js
class ClientService extends BaseService {
  // Ajouter logique métier
}
```

3. **Créer un Controller**
```javascript
// src/controllers/ClientController.js
class ClientController extends BaseController {
  // Ajouter handlers HTTP
}
```

4. **Ajouter les routes**
```javascript
// src/routes/clients.routes.js
router.get('/', controller.list);
router.post('/', controller.create);
```

5. **Enregistrer dans app.js**
```javascript
app.use('/api/clients', require('./routes/clients.routes'));
```

---

## 🧪 Tests

### Test unitaire

```bash
npm test -- --testPathPattern=services
```

### Test d'intégration

```bash
npm test -- --testPathPattern=integration
```

### Coverage

```bash
npm test -- --coverage
```

Rapports HTML en `coverage/lcov-report/index.html`

---

## 📊 Monitoring et Logs

### Logs structurés

Tous les logs sont au format JSON:
```json
{
  "timestamp": "2026-06-06T10:30:00Z",
  "level": "INFO",
  "message": "User created",
  "service": "sygim-api",
  "userId": 123
}
```

### Niveaux de log

- `DEBUG` - Informations détaillées (dev seulement)
- `INFO` - Informations générales
- `WARN` - Avertissements
- `ERROR` - Erreurs

### Intégration ELK

Les logs JSON sont prêts pour:
- Elasticsearch
- Logstash
- Kibana
- CloudWatch
- Datadog

---

## 🚀 Déploiement

### Production

```bash
# Vérifier les normes
npm run check

# Démarrer
npm start
```

### Docker

```bash
# Construire l'image
docker build -t sygim-api .

# Lancer le conteneur
docker run -p 5000:5000 \
  -e NODE_ENV=production \
  -e DB_HOST=db.example.com \
  sygim-api
```

### Orchestration (Kubernetes)

```bash
# Déployer
kubectl apply -f k8s/deployment.yaml
```

### PM2 (Clustering)

```bash
pm2 start src/index.js -i max --name "sygim-api"
```

---

## 🔐 Sécurité

✅ **HTTPS/SSL** - En production obligatoire
✅ **CORS** - Configuré par environnement
✅ **Helmet** - Protection des headers
✅ **Validation** - Input sanitization
✅ **JWT** - Authentification (à implémenter)
✅ **Rate Limiting** - À implémenter
✅ **CSRF Protection** - À implémenter
✅ **Secrets** - Via `.env` (jamais en git)

---

## 📚 Documentation complète

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Architecture détaillée
- [IMPLEMENTATION_GUIDE.md](../IMPLEMENTATION_GUIDE.md) - Guide d'implémentation
- [MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) - Migration v1 → v2

---

## 🐛 Troubleshooting

### Port déjà utilisé

```bash
# Trouver le processus
netstat -ano | findstr :5000

# Tuer le processus
taskkill /PID <PID> /F
```

### Erreur de connexion BD

```bash
# Vérifier les credentials
mysql -h localhost -u root -p

# Vérifier les logs
npm run dev 2>&1 | grep -i error
```

### Module not found

```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

---

## 🤝 Contribution

1. Fork le repository
2. Créer une branche (`git checkout -b feature/amazing`)
3. Commit les changements (`git commit -m 'Add amazing feature'`)
4. Push la branche (`git push origin feature/amazing`)
5. Ouvrir une Pull Request

Respecter les normes ESLint/Prettier

---

## 📝 License

UNLICENSED - Propriétaire

---

## 📞 Support

Pour les problèmes:
1. Consulter [Troubleshooting](#-troubleshooting)
2. Vérifier les logs: `npm run dev`
3. Ouvrir une issue GitHub

---

<div align="center">

**Construit avec ❤️ par l'équipe SYGIM**

v2.0.0 • Node.js Professional Architecture

</div>

