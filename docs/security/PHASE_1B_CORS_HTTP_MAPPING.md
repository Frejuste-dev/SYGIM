# PHASE 1B — CARTOGRAPHIE CORS ET CONFIGURATION HTTP (SYGIM)

## 1. CONFIGURATION CORS (Backend)
- **Fichier de configuration :** `backend/src/app.js` (Lignes 59-67)
- **Options exactes passées à `cors()` :**
  ```javascript
  app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 3600
  }));
  ```
- **L'option `credentials: true` est-elle activée ?** OUI. Cette option est déjà présente, ce qui est une condition sine qua non pour accepter les cookies HttpOnly.
- **Définition de l'`origin` :** Elle est définie dynamiquement à partir d'un tableau (array) d'origines autorisé, sans wildcard `*` (ce qui est également obligatoire pour l'usage des cookies). Le tableau est construit à partir d'une variable d'environnement ou d'un fallback.
  ```javascript
  const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',') 
    : [process.env.FRONTEND_URL || 'http://localhost:5173'];
  ```

## 2. VARIABLES D'ENVIRONNEMENT RÉSEAU
- **Côté Backend :** L'application utilise `CORS_ORIGINS` (liste séparée par des virgules) ou `FRONTEND_URL` pour déterminer l'origine de confiance (`app.js`).
- **Côté Frontend :** Contrairement aux pratiques standards (ex: `VITE_API_URL`), la configuration de l'API Base URL ne repose pas sur les variables d'environnement, mais sur une déduction logique dynamique dans le fichier de configuration `frontend/react-app/src/api/config.js` :
  ```javascript
  API: {
      BASE: typeof window !== 'undefined' 
        ? window.location.origin + '/api' 
        : 'http://localhost:5000/api',
      // ...
  }
  ```

## 3. CLIENT HTTP FRONTEND (Frontend)
- **Configuration de la Base URL :** Dans `frontend/react-app/src/api/client.js` (Classe `HttpClient`), la `baseUrl` est initialisée via la config passée en paramètre ou via le fallback de `CONFIG.API.BASE`.
  ```javascript
  this.baseUrl = config.baseUrl || CONFIG.API.BASE;
  ```
- **Envoi des cookies (`credentials`) :** INEXISTANT. La méthode `request` qui construit les `fetchOptions` n'inclut actuellement aucune directive pour envoyer les cookies (`credentials: 'include'` n'est pas présent).
  ```javascript
  // frontend/react-app/src/api/client.js : Lignes 144-149
  const fetchOptions = {
      method,
      headers: this._getHeaders(options.headers),
      signal: controller.signal,
      ...options.fetchOptions
  };
  ```

## 4. SÉCURITÉ DES HEADERS (Backend)
- **Librairie Helmet :** OUI. `helmet` (version `^8.2.0`) est installé dans le `package.json` et utilisé dans `app.js`.
- **Content-Security-Policy (CSP) :** OUI. Une politique explicite est configurée.
  ```javascript
  // backend/src/app.js : Lignes 38-49
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        scriptSrc: ['\'self\''],
        styleSrc: ['\'self\'', '\'unsafe-inline\''],
        imgSrc: ['\'self\'', 'data:'],
        connectSrc: ['\'self\''],
        fontSrc: ['\'self\''],
        objectSrc: ['\'none\''],
        frameSrc: ['\'none\'']
      }
    },
    // ...
  ```

## 5. GESTION DES COOKIES EXISTANTE (Backend)
- **Librairie `cookie-parser` :** NON TROUVÉE. Elle n'est pas listée dans les dépendances du `package.json`.
- **Utilisation existante des cookies :** INEXISTANTE. L'application est actuellement 100% "stateless local-storage" et ne manipule aucun cookie HTTP.

## 6. ROUTE REFRESH (Backend)
- **Contrôleur :** Géré par `auth.controller.js` (Lignes 28-37).
- **Extraction du `refreshToken` :** Le contrôleur l'extrait actuellement depuis le **corps de la requête JSON (body)**, et non depuis un cookie.
  ```javascript
  // backend/src/modules/auth/auth.controller.js : Lignes 28-32
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshAccessToken(refreshToken);
  // ...
  ```
