# API CHARACTERIZATION MATRIX - SYGIM Legacy

*Baseline établie lors de la Phase 2.0*

Cette matrice détaille l'ensemble des routes (endpoints) de l'API SYGIM telles qu'elles sont définies actuellement dans le code. Les rôles et middlewares d'authentification indiqués correspondent aux contraintes implémentées (ou à leur absence potentiellement vulnérable).

## 1. Méta & Santé (`/`)

| Méthode | Endpoint       | Controller / Logique   | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|----------------|------------------------|--------------|-----------------|--------------------------|
| GET     | `/health`      | Callback inline        | Non          | Public          | Renvoie l'état du serveur et de la DB. HTTP 200/503. |

## 2. Authentification (`/api/auth`)

| Méthode | Endpoint                 | Controller             | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|--------------------------|------------------------|--------------|-----------------|--------------------------|
| POST    | `/login`                 | `authController.login` | Non          | Public          | Limité par `authLimiter`. |
| POST    | `/refresh`               | `authController.refresh`| Non         | Public          | Utilise le cookie HttpOnly `refreshToken`. |
| POST    | `/logout`                | `authController.logout`| Oui          | Tous authentifiés | |
| POST    | `/change-password`       | `authController.changePassword` | Oui | Tous authentifiés | Limité par `authLimiter`. |
| GET     | `/me`                    | `authController.getProfile`| Oui      | Tous authentifiés | |
| PUT     | `/profile`               | `authController.updateProfile`| Oui   | Tous authentifiés | |

## 3. Utilisateurs (`/api/users`)

*Attention : Ce module est protégé de manière globale par `authorize('admin')`.*

| Méthode | Endpoint       | Controller             | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|----------------|------------------------|--------------|-----------------|--------------------------|
| GET     | `/`            | `UserController.getAll`| Oui          | `admin`         | |
| GET     | `/:id`         | `UserController.getById`| Oui         | `admin`         | |
| POST    | `/`            | `UserController.create`| Oui          | `admin`         | |
| PUT     | `/:id`         | `UserController.update`| Oui          | `admin`         | |
| DELETE  | `/:id`         | `UserController.delete`| Oui          | `admin`         | Soft delete (deletedAt). |

## 4. Propriétaires (`/api/owners`)

| Méthode | Endpoint       | Controller              | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|----------------|-------------------------|--------------|-----------------|--------------------------|
| GET     | `/`            | `OwnerController.getAll`| Oui          | `admin`, `director`, `accounting`, `collector_manager`, `collector` | |
| GET     | `/stats`       | `OwnerController.getStats`| Oui       | (idem) | |
| GET     | `/:id`         | `OwnerController.getById`| Oui        | (idem) | Risque d'IDOR possible. |
| POST    | `/`            | `OwnerController.create`| Oui         | `admin`, `director`, `collector_manager`, `accounting` | `collector` exclu. |
| PUT     | `/:id`         | `OwnerController.update`| Oui         | `admin`, `director`, `collector_manager`, `accounting` | |
| DELETE  | `/:id`         | `OwnerController.delete`| Oui         | `admin`, `director`, `collector_manager` | `accounting` exclu. |

## 5. Propriétés (`/api/properties`)

| Méthode | Endpoint       | Controller                 | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|----------------|----------------------------|--------------|-----------------|--------------------------|
| GET     | `/`            | `PropertyController.getAll`| Oui          | `admin`, `director`, `accounting`, `collector_manager`, `collector` | |
| GET     | `/stats`       | `PropertyController.getStats`| Oui       | `admin`, `director`, `accounting`, `collector_manager` | `collector` exclus. |
| GET     | `/:id`         | `PropertyController.getById`| Oui        | (Tous sauf admin_syst) | Risque IDOR (A voir si le collector ne voit que ses propriétés). |
| POST    | `/`            | `PropertyController.create`| Oui         | `admin`, `director`, `collector_manager`, `accounting` | |
| PUT     | `/:id`         | `PropertyController.update`| Oui         | (idem) | |
| DELETE  | `/:id`         | `PropertyController.delete`| Oui         | `admin`, `director`, `collector_manager` | |

## 6. Clients / Locataires (`/api/clients`)

| Méthode | Endpoint             | Controller                   | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|----------------------|------------------------------|--------------|-----------------|--------------------------|
| GET     | `/`                  | `ClientController.getAll`    | Oui          | `admin`, `director`, `accounting`, `collector_manager`, `collector` | |
| GET     | `/stats`             | `ClientController.getStats`  | Oui          | (idem) | |
| GET     | `/:id`               | `ClientController.getById`   | Oui          | (idem) | Risque IDOR. |
| POST    | `/`                  | `ClientController.create`    | Oui          | `admin`, `director`, `collector_manager`, `accounting` | |
| PUT     | `/:id`               | `ClientController.update`    | Oui          | (idem) | |
| DELETE  | `/:id`               | `ClientController.delete`    | Oui          | `admin`, `director`, `collector_manager` | |
| POST    | `/:id/replace`       | `ClientController.replaceTenant`| Oui       | `admin`, `director`, `collector_manager` | Remplace un locataire (Action métier forte). |

## 7. Transactions (`/api/transactions`)

| Méthode | Endpoint             | Controller                     | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|----------------------|--------------------------------|--------------|-----------------|--------------------------|
| GET     | `/`                  | `TransactionController.getAll` | Oui          | (Presque tous) | |
| GET     | `/stats`             | `TransactionController.getStats`| Oui       | (idem) | |
| GET     | `/export/csv`        | `TransactionController.exportCSV`| Oui      | (idem) | |
| GET     | `/:id`               | `TransactionController.getById`| Oui        | (idem) | Risque IDOR. |
| POST    | `/`                  | `TransactionController.create` | Oui          | (idem) | Création de paiement. `transactionValidator` injecté. |
| PUT     | `/:id`               | `TransactionController.update` | Oui          | `admin`, `director`, `accounting`, `collector_manager` | `collector` n'a pas le droit de modifier un paiement. |
| DELETE  | `/:id`               | `TransactionController.delete` | Oui          | (idem) | `collector` n'a pas le droit de supprimer. |

## 8. Collecteurs (`/api/collectors`)

| Méthode | Endpoint                 | Controller                        | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|--------------------------|-----------------------------------|--------------|-----------------|--------------------------|
| GET     | `/`                      | `collectorController.getAll`      | Oui          | `admin`, `director`, `accounting`, `collector_manager`, `collector` | |
| GET     | `/:id`                   | `collectorController.getById`     | Oui          | (idem) | |
| GET     | `/:id/stats`             | `collectorController.getStats`    | Oui          | `admin`, `director`, `collector_manager` | (Différent de getAll). |
| GET     | `/owner/:ownerId`        | `collectorController.getByOwner`  | Oui          | (Presque tous) | |
| POST    | `/`                      | `collectorController.create`      | Oui          | `admin`, `director`, `collector_manager` | `accounting` exclus. |
| PUT     | `/:id`                   | `collectorController.update`      | Oui          | (idem) | |
| DELETE  | `/:id`                   | `collectorController.delete`      | Oui          | (idem) | Soft delete probable. |
| POST    | `/:id/assign-properties` | `collectorController.assignProperties`| Oui      | (idem) | Action métier forte. |

## 9. Rapports / Reports (`/api/reports`)

| Méthode | Endpoint                 | Controller                     | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|--------------------------|--------------------------------|--------------|-----------------|--------------------------|
| GET     | `/kpis`                  | `reportController.getKpis`     | Oui          | (Tous les rôles possibles) | Inclus aussi `gestionnaire`, `super_admin` et `collecteur` ! |
| GET     | `/dashboard`             | `reportController.getDashboard`| Oui          | (idem) | |
| GET     | `/collectors`            | `reportController.getCollector`| Oui          | (idem) | |
| GET     | `/properties`            | `reportController.getProperty` | Oui          | (idem) | |
| GET     | `/export/csv/:type`      | `reportController.exportCsv`   | Oui          | (idem) | |
| GET     | `/export/pdf/:type`      | `reportController.exportPdf`   | Oui          | (idem) | |

## 10. Alertes (`/api/alerts`)

| Méthode | Endpoint                 | Controller                          | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|--------------------------|-------------------------------------|--------------|-----------------|--------------------------|
| GET     | `/overdue-payments`      | `AlertController.getOverduePayments`| Oui          | (Presque tous)  | Valide avec `overduePaymentsValidator`. |
| GET     | `/dashboard`             | `AlertController.getDashboard`      | Oui          | `admin`, `director`, `accounting` | |
| GET     | `/summary`               | `AlertController.getSummary`        | Oui          | `admin`, `director`, `accounting`, `collector_manager` | |
| PUT     | `/:clientId/acknowledge` | `AlertController.acknowledge`       | Oui          | `admin`, `director`, `collector_manager`, `accounting` | `collector` exclu de l'acquittement global ? |

## 11. RGPD (`/api/rgpd`)

| Méthode | Endpoint                 | Controller                          | Auth Requise | Rôles Autorisés | Remarques / Observations |
|---------|--------------------------|-------------------------------------|--------------|-----------------|--------------------------|
| GET     | `/me/export`             | `RgpdController.exportData`         | Oui          | Tous authentifiés | Ne possède pas de vérification de rôle (ce qui est logique). |
| DELETE  | `/me/data`               | `RgpdController.deleteData`         | Oui          | (Presque tous) | Curiosité : Utilise `authorize`, restreignant peut-être d'autres rôles ? |
| POST    | `/admin/purge-logs`      | `RgpdController.purgeLogs`          | Oui          | `admin` uniquement | Valide avec `purgeLogsValidator`. |

---
*Analyse initiale de la matrice* : 
- **Roles inégaux** : Le middleware du module `/api/reports` autorise des noms de rôles traduits (`super_admin`, `gestionnaire`, `collecteur`, `manager`) qui n'existent **pas** dans l'ENUM stricte de la base de données (`admin`, `director`, `accounting`, `collector_manager`, `collector`).
- **IDOR potentiel massif** : Toutes les routes GET, PUT, DELETE par `/:id` sont accessibles par la quasi-totalité des rôles de back-office. Il faudra vérifier si les Controllers filtrent effectivement par l'utilisateur (ex: un collecteur A peut-il voir le client d'un collecteur B ?).
