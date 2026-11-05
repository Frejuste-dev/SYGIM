# PHASE 1A — CARTOGRAPHIE DU FLUX D'AUTHENTIFICATION (SYGIM)

## 1. GÉNÉRATION DU JWT (Backend)
- **Fichier / Fonction :** `backend/src/modules/auth/auth.service.js`, fonction privée `_generateAccessToken(user)`.
- **Payload :** Le payload exact contient la clé primaire de l'utilisateur, son nom d'utilisateur et son rôle.
  ```javascript
  { id: user.primaryKey, username: user.username, role: user.role }
  ```
- **Durée d'expiration :** Configurée par la variable d'environnement `JWT_EXPIRES_IN` avec une valeur par défaut de `15m` (15 minutes).
  ```javascript
  // backend/src/modules/auth/auth.service.js : Lignes 182-186
  _generateAccessToken(user) {
    return jwt.sign(
      { id: user.primaryKey, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
  }
  ```

## 2. TRANSMISSION AU CLIENT (Backend)
- **Transmission :** Le JWT est renvoyé directement dans le corps (body) de la réponse JSON retournée par le contrôleur de login, accompagné du Refresh Token et des informations de base de l'utilisateur.
  ```javascript
  // backend/src/modules/auth/auth.service.js : Lignes 52-60
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.primaryKey,
      username: user.username,
      role: user.role
    }
  };
  ```

## 3. STOCKAGE FRONTEND (Client)
- **Fichier :** Principalement géré dans `frontend/react-app/src/contexts/AuthContext.jsx` et `frontend/react-app/src/api/client.js`.
- **Emplacement de stockage :** Le JWT est stocké en clair dans le `localStorage` du navigateur.
- **Ligne exacte :**
  ```javascript
  // frontend/react-app/src/contexts/AuthContext.jsx : Ligne 149
  localStorage.setItem(CONFIG.STORAGE.JWT_TOKEN, token);
  ```

## 4. INJECTION DANS LES REQUÊTES (Client)
- **Fichier configurant le client HTTP :** `frontend/react-app/src/api/client.js` (classe `HttpClient` custom basée sur Fetch API).
- **Injection :** Lors de la construction des en-têtes (headers) pour chaque requête HTTP, le token est extrait depuis la variable d'instance du client HTTP et formaté avec le préfixe `Bearer`.
  ```javascript
  // frontend/react-app/src/api/client.js : Lignes 63-65
  if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
  }
  ```

## 5. EXTRACTION ET VÉRIFICATION (Backend)
- **Middleware responsable :** `authenticate` dans `backend/src/middleware/auth.middleware.js`.
- **Extraction :** Le token est extrait depuis le header HTTP `Authorization`.
  ```javascript
  // backend/src/middleware/auth.middleware.js : Lignes 14-20
  const authHeader = req.headers.authorization;
  // [...]
  const token = authHeader.split(' ')[1];
  ```
- **Gestion des erreurs :** La vérification est faite dans un bloc `try/catch` avec `jwt.verify`. Si le token est expiré, malformé ou que la signature est invalide, l'erreur est attrapée et transmise au gestionnaire d'erreur global d'Express.
  ```javascript
  // backend/src/middleware/auth.middleware.js : Lignes 22-28
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new AppError('Token invalide ou expiré.', 401));
  }
  ```

## 6. PROTECTION DES ROUTES (Backend)
- **Application du middleware :** Le middleware `authenticate` n'est pas appliqué globalement sur toute l'application. Il est injecté **par groupe de routes** ou **manuellement sur certaines routes** dans les fichiers de configuration du routeur (`*.routes.js`).
  ```javascript
  // Exemple dans backend/src/modules/users/user.routes.js : Ligne 6
  router.use(authenticate);
  
  // Exemple dans backend/src/modules/auth/auth.routes.js : Ligne 34 (application manuelle)
  router.post('/logout', authenticate, authController.logout);
  ```

## 7. LOGOUT (Fullstack)
- **Frontend :** La fonction `logout` de `AuthContext.jsx` déclenche un appel API (facultatif si erreur), puis efface l'utilisateur du state React, nettoie la mémoire du client HTTP, et supprime les tokens (JWT, Refresh) ainsi que les données utilisateur du `localStorage`.
  ```javascript
  // frontend/react-app/src/contexts/AuthContext.jsx : Lignes 178-181
  httpClient.setToken(null);
  localStorage.removeItem(CONFIG.STORAGE.JWT_TOKEN);
  localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
  localStorage.removeItem('sygim_refresh_token');
  ```
- **Backend :** L'API dispose bien d'une route protégée `/logout` qui appelle `authService.logout(rawRefreshToken)`. Cette méthode supprime (révoque) le Refresh Token dans la base de données. Cependant, **l'Access Token (JWT) n'est pas révoqué côté serveur** (pas de mécanisme de liste noire "blacklist"). L'API étant stateless, le JWT restera techniquement valide jusqu'à la fin de ses 15 minutes de durée de vie naturelle s'il est intercepté.

## 8. REFRESH TOKEN (Fullstack)
- **Mécanisme implémenté :** OUI.
- **Backend (Génération & Stockage) :** Un token de rafraîchissement cryptographique (`crypto.randomBytes(40)`) est généré. Sa version hachée (`sha256`) est stockée dans la base de données (`authRepository.createRefreshToken`) avec une durée de validité de 7 jours. Il est retourné en clair dans la réponse JSON du login (avec l'Access Token).
- **Frontend (Stockage) :** Stocké de la même manière que le JWT, en clair dans le `localStorage`.
  ```javascript
  // frontend/react-app/src/contexts/AuthContext.jsx : Ligne 152
  localStorage.setItem('sygim_refresh_token', data.refreshToken);
  ```
- **Transmission pour Rafraîchissement :** Lorsque le frontend reçoit une erreur `401 Unauthorized` de l'API (et que la requête initiale ne concernait pas l'authentification), le client HTTP (`client.js`) intercepte l'erreur, récupère le Refresh Token du `localStorage`, et l'envoie dans le **corps** (JSON Body) d'une requête POST vers `/auth/refresh`. En cas de succès, la requête d'origine est rejouée de manière transparente avec le nouveau JWT.
  ```javascript
  // frontend/react-app/src/api/client.js : Lignes 91-94
  const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
  });
  ```
