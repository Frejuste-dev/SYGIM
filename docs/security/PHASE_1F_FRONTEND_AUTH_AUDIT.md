# PHASE 1F.0 — FRONTEND AUTH AUDIT (SYGIM)
**Rédigé le :** 17 Août 2026
**Statut de l'Audit :** TERMINÉ

## 1. Résumé Exécutif

L'audit détaillé du frontend React met en lumière une architecture d'authentification basée historiquement sur le `localStorage` et les en-têtes HTTP `Authorization: Bearer`. Le système actuel est **incompatible en l'état** avec le nouveau contrat d'authentification du backend utilisant les cookies `HttpOnly` mis en œuvre lors de la Phase 1D/1E. 

Bien que certains mécanismes soient bien implémentés (protection contre les _refresh storms_), l'application s'attend toujours à recevoir et manipuler les JWT manuellement en JavaScript.

- Fichiers analysés : +50
- Occurrences localStorage pertinentes : ~30
- Occurrences Authorization / fetch direct : 2
- Mécanisme de refresh : 1 (intégré dans le client HTTP centralisé)
- Fichiers critiques à modifier : 6
- Tests existants liés à l'auth : 5 (scripts manuels Node, aucun test automatisé frontend)

---

## 2. Architecture Actuelle

Le frontend suit le modèle traditionnel du Single Page Application (SPA) JWT-based :

```text
  Login
    │
    ├── Payload Backend: { data: { user, accessToken, refreshToken } }
    │
    ▼
  AuthContext (React Context)
    │
    ├── Sauvegarde: localStorage.setItem('sygim_jwt_token', accessToken)
    ├── Sauvegarde: localStorage.setItem('sygim_refresh_token', refreshToken)
    ├── Sauvegarde: localStorage.setItem('sygim_current_user', user)
    │
    ▼
  API Client (client.js)
    │
    ├── Récupère: localStorage.getItem('sygim_jwt_token')
    ├── Construit: headers['Authorization'] = `Bearer ${token}`
    │
    ▼
  Requêtes API
```

---

## 3. Cartographie du LocalStorage

Les accès au `localStorage` sont concentrés autour de clés définies dans `src/api/config.js` (`CONFIG.STORAGE.*`), et gérés par le `AuthContext.jsx`, `client.js` et `services.js`.

| Fichier | Opération | Clé | Utilisation |
|---|---|---|---|
| `client.js` | Lecture / Écriture | `sygim_jwt_token` | Utilisé pour injecter le token Bearer. |
| `client.js` | Lecture / Écriture | `sygim_refresh_token` | Utilisé dans `_refreshToken()`. |
| `AuthContext.jsx` | Lecture / Écriture | `sygim_jwt_token` | Récupération à l'init pour session. |
| `AuthContext.jsx` | Lecture / Écriture | `sygim_current_user` | Cache pour l'état `user` après reload. |
| `AuthContext.jsx` | Lecture / Écriture | `sygim_refresh_token` | Nettoyage ou sauvegarde post-login. |
| `services.js` | Lecture / Nettoyage | (les 3 clés) | Lors du logout (`API.Auth.logout`). |

**Constat :** Les JWT (Access et Refresh) sont intégralement manipulés par JavaScript et vulnérables au vol par XSS.

---

## 4. Cartographie du Header `Authorization`

La majorité des requêtes passe par `src/api/client.js`, où l'on trouve ce code d'injection :

```javascript
_getHeaders(additionalHeaders = {}) {
    const headers = { 'Content-Type': 'application/json', ...additionalHeaders };
    if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
}
```

Toutes les requêtes via `httpClient` injectent donc ce paramètre.

---

## 5. Cartographie des Appels API Directs (`fetch`)

En plus du client centralisé, des requêtes indépendantes injectant explicitement le header d'authentification ont été détectées :

- **`src/pages/Reports.jsx` (Ligne 133)**
  Effectue un `fetch` direct pour le téléchargement PDF :
  ```javascript
  const token = localStorage.getItem(CONFIG.STORAGE.JWT_TOKEN);
  const response = await fetch(`${CONFIG.API.BASE}/reports/export/pdf/overdue`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  ```
- **`src/pages/Transactions.jsx` (Ligne 100)**
  Effectue un `fetch` direct pour l'export CSV.
  ```javascript
  const token = localStorage.getItem(CONFIG.STORAGE.JWT_TOKEN);
  const res = await fetch(`/api/transactions/export/csv...`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  ```

---

## 6. Cartographie du Refresh Token

**Mécanisme implémenté dans `client.js` :**
- L'instance `httpClient` gère la récupération d'un nouveau jeton via la fonction asynchrone `_refreshToken()`.
- **Méthode envoyée :** `POST /auth/refresh`
- **Body :** `{ refreshToken: "..." }` où la valeur est lue depuis le localStorage.
- **Réception :** Le code extrait les nouveaux tokens depuis la payload JSON de la réponse.

**Incompatibilité :** Le nouveau backend ne lit plus le body et n'y écrit plus la réponse. Il opère exclusivement par un cookie `HttpOnly` envoyé automatiquement avec la directive `credentials: 'include'`.

---

## 7. Analyse du Risque de "Refresh Loop"

**Résultat de l'analyse : TRÈS BON.**
L'architecture actuelle gère correctement les appels concurrents via une promesse partagée (`_refreshPromise`) dans `client.js`. 

Si Requête A, Requête B et Requête C retournent toutes un 401 en même temps :
1. Requête A initialise `this._refreshPromise`.
2. Requêtes B et C patientent sur la résolution de `this._refreshPromise`.
3. Un seul appel API `POST /auth/refresh` est émis.
4. En cas de succès, A, B et C sont rejouées.
5. En cas d'échec (ex: 401 sur le refresh), la session est coupée sans boucle infinie.

---

## 8. Cartographie du Logout

La déconnexion est appelée par `logout()` depuis `AuthContext.jsx`, qui délègue à `API.Auth.logout(refreshToken)` (`services.js`).
- Le `refreshToken` extrait du `localStorage` est transmis dans le body de la requête `POST /auth/logout`.
- En réponse, le `localStorage` est vidé.

---

## 9. State Management

Le système d'état utilise exclusivement les Contextes Natifs React (`AuthContext.jsx`) et l'état interne (`useState`, `useEffect`).
Il n'y a ni Zustand, ni Redux, ni TanStack Query en utilisation pour la partie Auth.
Le rechargement de la page restaure la session via une vérification `API.Auth.getCurrentUser()`.

---

## 10. Compatibilité avec le Nouveau Backend

| Mécanisme | Statut | Justification |
|---|---|---|
| **Login** | **INCOMPATIBLE** | Le front attend les tokens dans la payload JSON, ils ne seront plus là. |
| **Authentification (Bearer)** | **PARTIELLEMENT COMPATIBLE** | L'API accepte encore le fallback `Authorization` si le localStorage a un ancien jeton. |
| **Refresh** | **INCOMPATIBLE** | Le refresh attendra le cookie HttpOnly et ne fournira pas de token JSON en retour. |
| **Logout** | **INCOMPATIBLE** | L'appel API échouera ou ne retirera pas le cookie si l'option `credentials` n'est pas spécifiée. |
| **Appels API normaux** | **INCOMPATIBLE** | Sans `credentials: 'include'`, le navigateur ne transmettra pas les cookies au Backend, provoquant des 401. |

---

## 11. Inventaire des Modificiations Futures (Phase 1F)

### 🔴 CRITIQUES
1. **`src/api/client.js`**
   - Retirer la logique liée au `localStorage` (`_getToken`, `_getRefreshToken`, `setToken`).
   - Supprimer le header `Authorization: Bearer`.
   - Ajouter `credentials: 'include'` par défaut sur toutes les requêtes (via `fetchOptions`).
   - Retirer le token de la payload pour `_refreshToken()`.
2. **`src/api/services.js`**
   - Nettoyer le code de `Auth.logout` pour ne plus envoyer le refresh token dans le body (l'envoyer sans payload).
3. **`src/contexts/AuthContext.jsx`**
   - Retirer la manipulation du `JWT_TOKEN` et `REFRESH_TOKEN` dans le `localStorage`.
   - Modifier la fonction `login()` pour récupérer uniquement les informations de l'utilisateur (`user`) sans attendre les tokens.
4. **`src/pages/Reports.jsx` & `src/pages/Transactions.jsx`**
   - Supprimer le header `Authorization: Bearer`.
   - Ajouter `credentials: 'include'` explicitement dans les objets options de `fetch()`.

### 🟠 IMPORTANTS
5. **`src/api/config.js`**
   - Supprimer `CONFIG.STORAGE.JWT_TOKEN` et `REFRESH_TOKEN`.

---

## 12. Risques liés à la Migration

| Risque | Fichier | Gravité | Impact | Remédiation future |
|---|---|---|---|---|
| **Vol de JWT** | `AuthContext`, `client.js` | Élevée | XSS peut extraire les tokens. | Utiliser les cookies HttpOnly (objet de la migration). |
| **Echec Exports PDF/CSV** | `Reports.jsx`, `Transactions.jsx` | Élevée | 401 (Non autorisé) | Ajouter `credentials: 'include'` aux requêtes fetch directes. |
| **Blocage du Refresh** | `client.js` | Majeure | La session expirera après 15 min | Adapter `_refreshToken` pour utiliser `credentials`. |

---

## 13. Architecture Cible Proposée

```text
  Login
    │
    ├── Backend répond avec un Set-Cookie (HttpOnly) pour Access/Refresh
    ├── Payload Backend: { user }
    │
    ▼
  AuthContext (React Context)
    │
    ├── Sauvegarde: localStorage.setItem('sygim_current_user', user)
    ├── (Aucune interaction JWT)
    │
    ▼
  API Client (client.js)
    │
    ├── Modifié : { credentials: 'include' } par défaut
    │
    ▼
  Requêtes API (Cookies envoyés automatiquement)
    │
    ├── 2xx → réponse
    ├── 401 → _refreshToken() (appel POST vide, avec credentials) 
               ├── 200 → Relance requêtes
               └── 401 → Nettoie state user + redirige vers Login
```

---

## 14. Tests Futurs Recommandés

1. **Test de connexion :** Validation que le localStorage ne contient plus de jetons.
2. **Test de transmission :** Vérification que les requêtes API emploient bien `credentials: 'include'` via la trace réseau.
3. **Test de Refresh Token :** Simulation de l'expiration du cookie Access Token (côté backend) pour vérifier le déclenchement transparent de la fonction `_refreshToken()` et le succès des requêtes suivantes.
4. **Test de Logout :** Vérification de l'extinction des cookies (via l'onglet application du navigateur) et redirection vers le login.

---

## 15. Verdict Final

**VERDICT : READY FOR FRONTEND IMPLEMENTATION**
