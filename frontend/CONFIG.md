# SYGIM Frontend Configuration

Ce fichier documente la configuration du frontend.

## Variables d'environnement (si utilisation de build tool)

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=SYGIM
VITE_APP_VERSION=1.0.0
```

## Configuration lors du runtime

Voir `js/config.js` pour la configuration globale qui s'ajuste automatiquement selon:
- `window.location.origin` pour l'URL de base de l'API
- Modes de développement vs production détectés automatiquement

## Utilisation de l'API dans l'application

### Initialisation automatique

L'API est initialisée automatiquement au chargement de la page:
- Configuration chargée depuis `js/config.js`
- Client HTTP créé et disponible via `window.httpClient`
- Services API disponibles via `window.API`

### Exemples d'utilisation

```javascript
// Authentification
const result = await API.Auth.login({ username, password });
if (result.success) {
    window.httpClient.setToken(result.token);
    APIUtils.setCurrentUser(result.user);
}

// Récupérer les clients
const clients = await API.Clients.getAll();

// Créer une propriété
const property = await API.Properties.create({ name, address, value });

// Gérer les erreurs
try {
    await API.Users.delete(userId);
} catch (error) {
    const message = APIUtils.formatError(error);
    console.error(message);
}

// Vérifier les permissions
if (APIUtils.hasRole('admin')) {
    // Afficher panel admin
}
```

## Structure des fichiers

```
frontend/
  ├── index.html                 # Page principal
  ├── css/
  │   ├── styles.css
  │   ├── components/           # Composants CSS réutilisables
  │   └── utilities/            # Classes utilitaires
  ├── js/
  │   ├── config.js             # Configuration globale
  │   ├── script_main.js        # Logique métier principale
  │   ├── script_fixes.js       # Correctifs/patches
  │   ├── script_import_csv.js  # Import CSV
  │   ├── script_import_modal.js# Modal d'import
  │   ├── api/
  │   │   ├── client.js         # Client HTTP base
  │   │   ├── services.js       # Services métier
  │   │   └── init.js           # Initialisation
  │   ├── modules/              # Modules réutilisables
  │   ├── utils/                # Fonctions utilitaires
  │   └── legacy/               # Ancien code archivé
  └── assets/
      ├── icons/                # Icônes
      └── images/               # Images statiques
```
