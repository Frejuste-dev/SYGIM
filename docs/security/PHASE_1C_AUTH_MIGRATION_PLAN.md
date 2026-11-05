# PHASE 1C — CONTRAT TECHNIQUE DU PATCH AUTH/JWT (SYGIM)

## OBJECTIF DE LA MIGRATION
Migrer progressivement le stockage et la transmission des tokens (Access Token et Refresh Token) du `localStorage` et des headers HTTP vers des cookies sécurisés `HttpOnly`, tout en maintenant une compatibilité descendante (Legacy fallback) pendant la période de transition.

---

## 1. BACKEND : DÉPENDANCES ET CONFIGURATION GLOBALE

### 1.1 Ajout de `cookie-parser`
- **Fichier ciblé :** `backend/package.json` et `backend/src/app.js`
- **Modification :** 
  - Ajouter `cookie-parser` aux dépendances.
  - Dans `app.js`, importer et utiliser `app.use(cookieParser())` juste avant l'initialisation des routes API, pour permettre la lecture de `req.cookies`.

---

## 2. BACKEND : CONTRÔLEURS D'AUTHENTIFICATION (`auth.controller.js`)

Pour assurer une migration douce, les contrôleurs continueront de renvoyer les tokens dans le corps JSON, tout en les injectant simultanément dans des cookies sécurisés.

### 2.1 Route `login`
- **Modification :** Après la génération des tokens par `authService.login`, ajouter les directives `res.cookie()` avant l'envoi de la réponse JSON.
- **Paramètres des cookies :**
  - `httpOnly: true` (Protection XSS, interdit la lecture via `document.cookie`).
  - `secure: process.env.NODE_ENV === 'production'` (HTTPS en production).
  - `sameSite: 'strict'` (Protection CSRF).
  - `maxAge` : 15 minutes pour l'AccessToken (900000 ms) et 7 jours pour le RefreshToken (604800000 ms).

### 2.2 Route `refresh`
- **Modification de l'extraction :** Lire le `refreshToken` **d'abord** depuis `req.cookies.refreshToken`, avec un **fallback** sur `req.body.refreshToken` (pour les clients non mis à jour).
- **Modification de l'émission :** Tout comme pour le login, injecter le nouveau `accessToken` (et potentiellement le `refreshToken`) via `res.cookie()` avant de renvoyer la réponse.

### 2.3 Route `logout`
- **Modification :** 
  - Extraire le `refreshToken` (cookie prioritaire, puis body).
  - Appeler la révocation (`authService.logout`).
  - Nettoyer les cookies via `res.clearCookie('accessToken')` et `res.clearCookie('refreshToken')`.

---

## 3. BACKEND : MIDDLEWARE D'AUTHENTIFICATION (`auth.middleware.js`)

Le middleware doit être rendu "Cookie-Aware" tout en restant compatible avec l'en-tête `Authorization`.

### 3.1 Extraction du Token
- **Logique cible (Fallback) :**
  1. Vérifier si `req.cookies && req.cookies.accessToken` existe. Si oui, utiliser ce token.
  2. Sinon, vérifier le header `Authorization: Bearer <token>`.
  3. Si aucun des deux n'est présent, rejeter avec une erreur 401.

---

## 4. FRONTEND : CONFIGURATION DU CLIENT HTTP (`client.js`)

Le client HTTP doit être configuré pour inclure automatiquement les cookies dans toutes les requêtes cross-origin ou same-origin.

### 4.1 Activation de l'envoi des Cookies
- **Fichier ciblé :** `frontend/react-app/src/api/client.js`
- **Modification :** Dans la méthode `request()`, ajouter `credentials: 'include'` à l'objet `fetchOptions`.
  ```javascript
  const fetchOptions = {
      method,
      headers: this._getHeaders(options.headers),
      signal: controller.signal,
      credentials: 'include', // NOUVEAU
      ...options.fetchOptions
  };
  ```

### 4.2 Route de Refresh Token
- **Modification :** Dans la méthode `_refreshToken()`, la requête `fetch` vers `/auth/refresh` doit également inclure `credentials: 'include'`.
- **Note de transition :** Le frontend continuera d'envoyer le `refreshToken` dans le body JSON tant que le nettoyage du `localStorage` n'aura pas été effectué dans une phase ultérieure.

---

## 5. TESTS DE VALIDATION REQUIS

Toute modification devra être couverte par des tests d'intégration.

### 5.1 Tests Backend (ex: `auth.functional.test.js`)
- **Test 1 (Login Cookie) :** Envoyer des identifiants valides à `/auth/login` et vérifier la présence des en-têtes `Set-Cookie` pour `accessToken` et `refreshToken` avec les flags `HttpOnly` et `SameSite`.
- **Test 2 (Middleware Fallback) :** Créer une route protégée de test. 
  - Requête A : Sans header Authorization, mais avec un cookie `accessToken` valide → Doit passer (200).
  - Requête B : Avec header Authorization, sans cookie → Doit passer (200).
- **Test 3 (Logout Cookie) :** Appeler `/auth/logout` et vérifier que les en-têtes de réponse contiennent la suppression des cookies (ex: `Expires=Thu, 01 Jan 1970...`).

---

## 6. SÉQUENCE D'EXÉCUTION (Prochaines étapes)

1. **Backend :** Installation de `cookie-parser` et modification de `app.js`.
2. **Backend :** Mise à jour du `auth.controller.js` pour émettre les cookies (`res.cookie`).
3. **Backend :** Mise à jour de `auth.middleware.js` pour accepter les cookies.
4. **Backend :** Écriture et exécution des tests unitaires/fonctionnels prouvant que la double acceptation (Cookie + Header) fonctionne.
5. **Frontend :** Mise à jour de `client.js` pour envoyer `credentials: 'include'`.
6. (Hors périmètre actuel) : Une fois validé en production, nettoyage final du code frontend pour cesser d'écrire dans le `localStorage`.
