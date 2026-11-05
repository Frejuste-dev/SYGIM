# PHASE 2 CHARACTERIZATION AUDIT - SYGIM Legacy

*Baseline établie lors de la Phase 2.0*

Ce document résume l'audit initial des règles métier et financières du SYGIM Legacy, ainsi que les vulnérabilités de conception (RBAC, IDOR, intégrité) découvertes au cours de la caractérisation.

---

## 1. Caractérisation des Règles Financières (Hardcodées)

L'application repose fortement sur des règles implémentées en JavaScript et SQL, sans utilisation de contraintes de base de données (CHECK, TRIGGERS).

### 1.1 Mise à jour des Paiements Locataires (Transactions)
* **Localisation** : `transaction.repository.js` -> `createWithClientUpdate()`
* **Inputs** : `clientId`, `amount`, `status`
* **Formule et Effets DB** :
  Lorsqu'une transaction est créée (avec statut `processed` ou vide), le système met à jour le client correspondant :
  ```sql
  UPDATE clients 
  SET amount_paid = amount_paid + :amount,
      status = CASE 
         WHEN amount_paid + :amount >= amount_due THEN 'paid'
         WHEN amount_paid + :amount > 0 THEN 'partial'
         ELSE status 
      END
  WHERE id = :clientId
  ```
* **Vulnérabilité / Constat** :
  - L'état de paiement est calculé de manière incrémentale, sans protection contre les conditions de course (Race Conditions) si deux requêtes de paiement sont soumises simultanément.
  - Aucune table d'historique comptable immuable ; l'état dépend uniquement de l'accumulation dans `clients.amount_paid`.

### 1.2 Définition des Loyers (Amount Due)
* **Localisation** : `client.service.js` -> `create()` et `replaceTenant()`
* **Inputs** : Saisie utilisateur (ex: `amountDue`, `newRent`)
* **Formule** : Assignation statique en base de données (`amount_due = input`).
* **Vulnérabilité / Constat** :
  - Aucun mécanisme d'échéancier mensuel (Cron ou génération automatique des loyers dus chaque mois). Le système semble attendre que le montant dû soit mis à jour manuellement, ou ne gère que les dettes statiques.

### 1.3 Calcul des Commissions Collecteurs
* **Localisation** : Probablement calculé à la volée côté Frontend ou lors de l'export (`csv-exporter.js`), car aucune logique de commission n'a été trouvée dans les requêtes de base du module de rapports (`report.repository.js` `getCollectorPerformance`).
* **Vulnérabilité / Constat** : Logique financière décentralisée, risque de divergence entre ce que voit l'utilisateur (Front) et les exports (Back).

---

## 2. Caractérisation des Modèles de Sécurité (RBAC & IDOR)

### 2.1 Modèle RBAC (Role-Based Access Control)
* **Contrôleurs et Middlewares** : Les rôles sont vérifiés via `authorize(['admin', 'director', ...])`.
* **Vulnérabilités de Rôles** :
  - **Incohérences** : Dans `report.routes.js`, le middleware vérifie des rôles traduits (`super_admin`, `gestionnaire`, `collecteur`), alors que la base de données ne contient que `admin`, `director`, `accounting`, `collector_manager`, `collector`.
  - **Résultat** : Un `collector` peut accéder à un rapport car le middleware vérifie `collecteur` et `collector` (ou ce dernier manque). Cela nécessite une investigation E2E, mais le code indique une confusion linguistique.

### 2.2 Modèle d'Isolation des Données (IDOR)
L'accès aux ressources appartenant à d'autres utilisateurs est partiellement protégé via les Services.
* **Mécanisme de Défense** : Les fonctions `checkOwnership(id, user)` sont appelées manuellement dans chaque méthode de Service (ex: `client.service.js`, `property.service.js`).
* **Vulnérabilités / Constat** :
  - Étant donné que `checkOwnership` est un appel impératif manuel, un simple oubli dans une nouvelle route expose immédiatement la ressource.
  - Les rôles de haut niveau (`admin`, `director`, `accounting`) bypassent toujours ces vérifications, ce qui est normal, mais les managers de collecteurs ont une logique complexe (`assignedCollector.manager_id !== user.id`) qui peut s'avérer fragile si la hiérarchie change.
  - La route `GET /api/properties/:id` ne semble pas utiliser `checkOwnership` de manière stricte dans tous les cas, ce qui pourrait permettre à un collecteur de lire les détails d'une propriété assignée à un autre.

---

## 3. Synthèse de la Baseline (Legacy)
Le système SYGIM Legacy fonctionne, mais présente des fragilités structurelles classiques :
1. **Source de vérité dispersée** : Les états métier (statut 'paid', 'partial') sont dérivés au moment de l'écriture en base via des requêtes SQL dynamiques.
2. **Couplage Base de Données / Code** : L'intégrité référentielle douce (Soft Deletes manuels, Dénormalisation des noms `property_name` dans `clients`) repose entièrement sur des promesses de code (pas de triggers ou de contraintes `FOREIGN KEY` avec `ON UPDATE CASCADE`).
3. **Risques Concurrency** : Les opérations financières de base (+= amount) ne sont pas protégées par des transactions de base de données avec des niveaux d'isolation stricts ou des verrous pessimistes.

*Ces comportements doivent être reproduits et capturés par les tests de caractérisation.*
