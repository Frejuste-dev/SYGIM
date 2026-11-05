# DATABASE CHARACTERIZATION - SYGIM Legacy

*Baseline établie lors de la Phase 2.0*

## 1. Tables et Structure

La base de données relationnelle est composée de 11 tables principales :

### 1.1 `users`
- **PK** : `id` (INT)
- **Unique** : `username`
- **ENUM** : `role` ('admin', 'director', 'accounting', 'collector_manager', 'collector')
- **Contraintes & Index** : `idx_users_role`, `idx_users_active`
- **Logique induite** : Gère l'authentification. `deletedAt` permet le soft delete. `username_normalized` est généré pour la recherche insensible à la casse.

### 1.2 `owners` (Propriétaires)
- **PK** : `id` (INT)
- **Contraintes & Index** : `idx_owners_active`
- **Logique induite** : Représente les propriétaires de biens. Aucune contrainte `UNIQUE` forte sur le nom ou le contact (potentiel risque de doublons).

### 1.3 `collectors` (Récolteurs)
- **PK** : `id` (INT)
- **FK** : `user_id` -> `users(id)` (ON DELETE SET NULL)
- **Logique induite** : Gère les agents terrain avec un taux de commission `commission_rate`. `manager_id` référence implicitement un autre utilisateur (sans FK stricte sur manager_id vers users, ce qui est une dette technique). `deletedAt` pour soft delete.

### 1.4 `properties` (Biens immobiliers)
- **PK** : `id` (INT)
- **FK** : `owner_id` -> `owners(id)` (ON DELETE SET NULL), `collector_id` -> `collectors(id)` (ON DELETE SET NULL)
- **Contraintes** : `type` (appartement, maison, etc.), `status` (vacant, loue, etc.) ne sont **pas** des ENUM stricts en BDD (type VARCHAR).
- **Logique induite** : Le `tenant_id` est défini comme un `INT` mais n'a pas de contrainte FK stricte dans la création de la table (dette technique).

### 1.5 `clients` (Locataires / Tenants)
- **PK** : `id` (INT)
- **FK** : `property_id` -> `properties(id)` (ON DELETE SET NULL), `owner_id` -> `owners(id)` (ON DELETE SET NULL), `collector_id` -> `collectors(id)` (ON DELETE SET NULL)
- **Logique induite** : Contient un champ de dénormalisation de données (`property_name`, `property_value`). `amount_due` et `amount_paid` (DECIMAL) gèrent l'état financier mensuel. `status` est un VARCHAR et non un ENUM strict (pending, partial, paid, late, inactive).

### 1.6 `transactions` (Paiements)
- **PK** : `id` (INT)
- **FK** : `client_id` -> `clients(id)` (ON DELETE RESTRICT), `collector_id` -> `collectors(id)` (ON DELETE SET NULL)
- **Index composites** : `idx_transactions_status_date` (status, date), `idx_transactions_collector_status` (collector_id, status).
- **Logique induite** : Enregistre tous les paiements. `amount` DECIMAL(12,2). `method` et `status` (pending, processed, cancelled, refunded) sont des VARCHAR. Protection ON DELETE RESTRICT sur `client_id` (on ne peut pas supprimer un locataire qui a des transactions).

### 1.7 `activity_logs`
- **PK** : `id` (INT)
- **FK** : `user_id` -> `users(id)` (ON DELETE SET NULL)
- **Logique induite** : Table de journalisation (login, create, update, delete).

### 1.8 `prefinancings`
- **PK** : `id` (INT)
- **Unique** : `reference` (PREF-xxx)
- **FK** : `property_id` -> `properties(id)`, `owner_id` -> `owners(id)` (ON DELETE SET NULL)
- **Logique induite** : Gère les avances de fonds avec un `interest_rate`.

### 1.9 `settings`
- **PK** : `id` (INT)
- **Unique** : `setting_key`
- **Logique induite** : Stocke la configuration globale (ex: `commission_default`, `min_rent`).

### 1.10 `alert_acknowledgements`
- **PK** : `id` (INT)
- **Unique composite** : `uq_alert_client_user` (client_id, acknowledged_by)
- **FK** : `client_id` -> `clients(id)` (ON DELETE CASCADE), `acknowledged_by` -> `users(id)` (ON DELETE CASCADE)
- **Logique induite** : Acquittement des retards de paiement, cascade sur suppression.

### 1.11 `refresh_tokens`
- **PK** : `primaryKey` (INT)
- **Unique** : `token`
- **FK** : `userId` -> `users(id)` (ON DELETE CASCADE)
- **Logique induite** : Stockage sécurisé des sessions pour rotation.

## 2. Contraintes et Règles (Soft vs Hard)

### 2.1 Soft Deletes
Les tables `users` et `collectors` possèdent une colonne `deletedAt`. Les autres ressources (`properties`, `clients`, `transactions`) n'en ont pas, signifiant qu'une suppression sera physique (HARD delete) pour la majorité du domaine.

### 2.2 Dénormalisation et Risques
- **Dénormalisation** : `clients.property_name`, `clients.property_value`, `transactions.client_name` sont utilisés "pour affichage rapide". Ce sont des règles maintenues **uniquement dans le code** applicatif (pas de triggers BDD).
- **Triggers Absents** : Les calculs financiers (`clients.amount_paid` par rapport à `transactions.amount`, commission du collecteur) ne sont pas gérés par la base de données.

### 2.3 Rétention
- **DELETE CASCADE** : Réservé aux jetons (`refresh_tokens`) et aux alertes (`alert_acknowledgements`).
- **DELETE SET NULL** : Utilisé majoritairement (ex: si un propriétaire est supprimé, la propriété devient orpheline : `owner_id = NULL`).
- **DELETE RESTRICT** : Présent uniquement sur `transactions.client_id`, bloquant la suppression d'un locataire (client) s'il a déjà payé.

### 2.4 Domaines de Valeurs (ENUM limités)
Seule la table `users` utilise un type `ENUM` strict au niveau base de données pour `role`.
Les autres champs de type statut (`properties.status`, `clients.status`, `transactions.status`) sont des `VARCHAR`. La restriction de ces valeurs est une règle gérée **uniquement par le code (code-level rule)**.

## 3. Verdict de la Baseline (Database)

- **Architecture** : Classique, fortement relationnelle.
- **Risque d'intégrité** : Élevé sur les statuts (VARCHAR) et sur les champs dénormalisés (maintenus côté code sans transactions SQL strictes garanties par le moteur).
- **IDOR potentiel** : Tous les `id` sont des `INT AUTO_INCREMENT` prédictibles, facilitant l'exploration IDOR.
