# SYGIM API Characterization Matrix

Cette matrice documente le comportement **actuel** de l'API SYGIM Legacy (Phase 2.0). 
L'objectif est d'avoir une baseline comportementale reproductible avant toute refactorisation (Phase 3).

## Légende
- ✅ **Sécurisé** : L'API implémente correctement les contrôles d'accès/IDOR (Retourne 403 Forbidden ou filtre silencieusement).
- ❌ **Vulnérabilité / Comportement Anormal** : L'API présente une faille IDOR (Retourne 200 OK avec des données non autorisées) ou une erreur de conception.
- ⚠️ **Partiellement Protégé** : Le comportement est ambigu ou dépend de certains cas.

## Matrice des Endpoints (IDOR & RBAC)

| Endpoint | Méthode | Rôle / Acteur | Description de l'Action | Statut Actuel | Code HTTP Observé | Remarques |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/transactions/:id` | GET | Collector (col1) | Lecture d'une transaction appartenant à un autre collecteur (col2) | ✅ Sécurisé | 403 Forbidden | Le backend SYGIM (Legacy) vérifie correctement la propriété via `checkOwnership`. |
| `/api/transactions` | POST | Collector (col1) | Création d'une transaction pour un client appartenant à un autre collecteur | ✅ Sécurisé | 403 Forbidden | Le `TransactionService` vérifie la propriété du client et rejette l'action si le client n'est pas assigné. |
| `/api/transactions/:id` | PUT | Collector (col1) | Modification d'une transaction appartenant à un autre collecteur | ✅ Sécurisé | 403 Forbidden | Protégé par `checkOwnership` et restreint par rôle. |
| `/api/transactions/:id` | DELETE | Collector (col1) | Suppression d'une transaction appartenant à un autre collecteur | ✅ Sécurisé | 403 Forbidden | Le rôle collector est totalement interdit de suppression (`Rôle insuffisant`). |
| `/api/clients/:id` | GET | Collector (col1) | Lecture d'un client assigné à un autre collecteur (col2) | ✅ Sécurisé | 403 Forbidden | Protégé par `checkOwnership` dans `ClientService`. |
| `/api/reports/dashboard` | GET | Collector (col1) | Lecture du dashboard | ✅ Sécurisé | 200 OK | Les collecteurs ont accès à leur propre dashboard (le contrôleur filtre les données par `collector_id` implicitement). |
| `/api/reports/dashboard` | GET | Manager (col_manager) | Lecture du dashboard | ✅ Sécurisé | 200 OK | Les managers ont accès au dashboard. |
| `/api/users` | GET | Collector (col1) | Lecture de la liste des utilisateurs | ✅ Sécurisé | 403 Forbidden | Protégé par `authorize('admin')`. Seuls les admins peuvent accéder à cette ressource. |
| `/api/properties/:id` | GET | Collector (col1) | Lecture d'une propriété assignée à un autre collecteur | ❌ VULNÉRABLE | 200 OK | `PropertyController.getById` ne fait jamais appel à `PropertyService.checkOwnership` ! IDOR confirmé. |
| `/api/users` | GET | Manager (col_manager) | Lecture de la liste complète des utilisateurs | ✅ Sécurisé | 403 Forbidden | Restreint aux administrateurs. |
| `/api/users` | GET | Admin (admin_sys) | Lecture de la liste complète des utilisateurs | ✅ Sécurisé | 200 OK | L'accès est accordé à l'administrateur. |

*Note: Cette matrice sera mise à jour au fur et à mesure que les tests de caractérisation sont ajoutés à `idor.test.js` et autres suites de tests de la Phase 2.0.*
