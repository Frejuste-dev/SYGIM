# Audit professionnel complet — SYGIM

**Date de l’audit :** 1 août 2026  
**Périmètre :** dépôt `SYGIM` — backend Node.js/Express/MySQL, frontend React/Vite, frontend historique HTML/CSS/JavaScript, base de données, tests, Docker et CI.  
**Méthode :** revue statique fondée exclusivement sur les fichiers présents dans le dépôt. Aucune correction applicative n’a été réalisée pendant l’audit.

---

## 1. Avis exécutif

### Verdict

> **SYGIM nécessite une refonte partielle structurée avant toute mise en production.**

Le projet contient un socle fonctionnel crédible : modèle immobilier identifiable, API Express structurée, authentification JWT avec refresh tokens hachés, RBAC, transactions SQL sur certains flux critiques, Docker, CI backend, Swagger, journalisation structurée et début de conformité RGPD.

Cependant, il n’est **pas prêt pour une production professionnelle** en l’état. Les facteurs bloquants sont :

1. **Secrets et mots de passe présents dans le dépôt** (`backend/.env`, `backend/.env.production`, `docker-compose.yml`, scripts de base de données).
2. **Deux frontends concurrents**, dont un frontend historique très volumineux, utilisant `localStorage` comme source de données de secours et de nombreuses affectations `innerHTML`.
3. **Risque XSS à fort impact**, aggravé par le stockage des access et refresh tokens dans `localStorage`.
4. **Contrats de données et schéma fragmentés** : migrations camelCase, schéma principal snake_case, colonnes référencées par le code mais absentes du schéma de base, requêtes de rapports visant des colonnes non définies dans `transactions`.
5. **Opérations métier non atomiques**, notamment le remplacement de locataire.
6. **Contrôles d’accès incomplets au niveau objet** : des rôles peuvent appeler des routes, mais la portée métier de la ressource n’est pas systématiquement vérifiée.
7. **Validation API partielle et dispersée**, sans DTO/schéma homogène sur les routes principales.
8. **Couverture de tests insuffisante** et suites d’intégration explicitement exclues de la CI.
9. **CI/CD, sauvegarde, restauration, observabilité et déploiement de production incomplets.**
10. **Fonctionnalités d’interface simulées ou indiquées “À implémenter”**, incompatibles avec une promesse de produit finalisé.

### Synthèse des scores

| Domaine | Score /10 | Appréciation |
|---|---:|---|
| Compréhension métier | 6.5 | Domaine identifiable, règles encore dispersées |
| Architecture globale | 4.5 | Bonnes intentions, architecture hybride et migration inachevée |
| Qualité backend | 5.0 | Couche service/repository utile, incohérences et logique métier fragile |
| Qualité frontend React | 5.5 | Base moderne, peu testée et trop chargée côté client |
| Frontend historique | 2.5 | Dette majeure, risques XSS et données locales concurrentes |
| API et contrats | 4.5 | Routes structurées, documentation et réponses non totalement alignées |
| Base de données | 4.0 | FK et index présents, modèle et migrations fragmentés |
| Sécurité | 2.5 | Contrôles utiles mais plusieurs risques critiques |
| Performance | 4.5 | Compression et pagination partielles, chargements massifs et cache factice |
| Tests / QA | 3.5 | Tests existants mais couverture basse et CI incomplète |
| DevOps / exploitation | 3.5 | Docker et CI de base, pas de chaîne de production robuste |
| Observabilité / SRE | 4.0 | Logs et health check, pas de métriques/traces/alertes exploitables |
| UI | 5.0 | Composants React cohérents par endroits, coexistence visuelle non gouvernée |
| UX | 4.0 | Parcours riches mais retours simulés, erreurs masquées et `alert()` fréquent |
| Accessibilité | 3.5 | Quelques labels/ARIA, aucune preuve WCAG systématique |
| Maintenabilité | 3.5 | Duplication, fichiers monolithiques, conventions concurrentes |
| Scalabilité | 3.5 | Architecture monolithique viable à court terme, accès et chargements non adaptés à la croissance |
| Documentation / gouvernance | 4.5 | Documentation abondante mais sur-prometteuse et parfois obsolète |
| **Score global pondéré** | **4.1/10** | **Refonte partielle requise** |

---

## 2. Compréhension du projet et du métier

### 2.1 Finalité

SYGIM est un **Système de Gestion Immobilière** destiné à administrer :

- les propriétaires ;
- les biens immobiliers ;
- les locataires/clients ;
- les collecteurs et leurs affectations ;
- les encaissements et transactions ;
- les retards et alertes ;
- les préfinancements ;
- les rapports ;
- les utilisateurs, rôles et paramètres.

### 2.2 Acteurs observés

| Acteur | Responsabilités déduites du code |
|---|---|
| `admin` | Administration des utilisateurs, accès global, purge RGPD |
| `director` | Pilotage, rapports, accès large aux opérations |
| `accounting` | Gestion/consultation financière, clients, biens et transactions |
| `collector_manager` | Supervision des collecteurs, affectations, clients et opérations |
| `collector` | Consultation de son périmètre et saisie d’encaissements |
| Propriétaire | Entité métier bénéficiaire des revenus, sans portail autonome identifié |
| Locataire/client | Entité métier redevable des paiements, sans portail autonome identifié |

### 2.3 Flux métier principal

```text
Utilisateur authentifié
        |
        v
Consulte les biens / clients / alertes
        |
        +--> affecte un collecteur à un bien
        |
        +--> associe un locataire à un bien
        |
        +--> enregistre un paiement
                    |
                    v
             INSERT transaction
                    |
                    v
        UPDATE client.amount_paid/status
                    |
                    v
         statistiques / alertes / rapports
```

### 2.4 Règles métier observées

- Une transaction doit être liée à un client dans `TransactionService.createTransaction`.
- La création d’un paiement traité incrémente `clients.amount_paid` dans une transaction SQL.
- Un client peut être associé à un bien, un propriétaire et un collecteur.
- Un bien peut être déclaré vacant, loué ou en rénovation/maintenance selon des vocabulaires non homogènes.
- Un collecteur connecté voit ses clients/transactions filtrés par `collectors.user_id` dans certains repositories.
- La suppression d’un client libère les biens ayant ce `tenant_id`.
- Le remplacement de locataire désactive l’ancien, crée/réaffecte le nouveau et modifie le bien, mais sans transaction SQL globale.

### 2.5 Ambiguïtés métier

1. **Client vs locataire** : les termes sont utilisés comme synonymes, sans agrégat métier clairement défini.
2. **Propriété/bien/lot** : la hiérarchie et les sous-unités sont évoquées dans l’interface, mais pas formalisées de façon cohérente dans le backend.
3. **Paiement vs transaction** : la table `transactions` porte plusieurs concepts, y compris un “remplacement” à montant zéro.
4. **Encaissement, reversement propriétaire et commission** : l’interface les simule partiellement, mais les écritures comptables et règles de rapprochement ne sont pas formalisées.
5. **Statuts** : valeurs différentes entre schéma, Swagger, code React et code historique (`loue`, `maintenance`, `en_renovation`, etc.).
6. **Signatures et documents** : l’interface capture des données, mais aucune chaîne probatoire, politique de conservation ou stockage documentaire sécurisé n’est démontré.

---

## 3. Cartographie de l’architecture

### 3.1 Architecture réellement présente

```text
                    +-----------------------+
                    | Navigateur utilisateur|
                    +-----------+-----------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
+---------------------------+        +-----------------------------+
| Frontend React/Vite       |        | Frontend historique         |
| contexts/pages/components |        | index.html + gros scripts JS|
+-------------+-------------+        +--------------+--------------+
              |                                     |
              +------------------+------------------+
                                 |
                                 v
                    +-------------------------+
                    | Express /api            |
                    | middleware + routes     |
                    +------------+------------+
                                 |
            +--------------------+--------------------+
            |                    |                    |
            v                    v                    v
  Controllers/Services   Modules par feature    Services directs
  Repositories globaux   auth/collectors/reports RGPD/alertes
            |                    |                    |
            +--------------------+--------------------+
                                 |
                                 v
                      +---------------------+
                      | MySQL / InnoDB      |
                      | schéma + migrations |
                      +---------------------+
```

### 3.2 Problème architectural central

Le dépôt combine trois styles :

1. architecture horizontale globale (`controllers`, `services`, `repositories`, `routes`) ;
2. modules verticaux (`modules/auth`, `modules/collectors`, `modules/reports`) ;
3. accès SQL direct depuis les contrôleurs/services.

Cette coexistence indique une **migration architecturale inachevée**. Elle augmente le coût de compréhension et rend les politiques transversales difficiles à appliquer uniformément.

### 3.3 Évaluation des principes

| Principe | Évaluation |
|---|---|
| SOLID | Partiel : séparation en couches, mais dépendances globales et responsabilités mélangées |
| DRY | Faible : deux middlewares RBAC, deux frontends, multiples clients API et mappings |
| KISS | Dégradé par la coexistence d’architectures et les mécanismes de fallback |
| YAGNI | Plusieurs capacités annoncées ou simulées sans implémentation opérationnelle |
| Clean Architecture | Non atteinte : domaine couplé à Express, MySQL et structures de tables |
| Hexagonale / Onion | Non démontrée : absence de ports/adapters explicites |
| DDD | Vocabulaire métier présent, mais pas d’agrégats, value objects ou invariants centralisés |
| CQRS | Absent |
| Event-driven | Absent |

### 3.4 Architecture cible recommandée

Un **monolithe modulaire** est préférable à des microservices prématurés :

```text
src/
  platform/
    http/ auth/ logging/ database/ observability/
  modules/
    identity/
    properties/
    tenancies/
    collections/
    owners/
    reporting/
    compliance/
  shared/
    domain/ validation/ errors/
```

Chaque module doit posséder : API, application, domaine, infrastructure, tests. Les dépendances doivent aller de l’extérieur vers le domaine.

---

## 4. Audit du backend

### 4.1 Points positifs vérifiés

- Middleware `helmet`, CORS, compression et limitation de débit dans `backend/src/app.js`.
- Authentification JWT et autorisation par rôles dans `auth.middleware.js`.
- Refresh tokens générés aléatoirement et hachés avant stockage dans `auth.service.js`.
- Rotation/révocation de refresh tokens prévue.
- Requêtes généralement paramétrées pour les valeurs.
- Gestion centralisée des erreurs via `errorHandler.js` et `ApiResponse`.
- Transactions SQL sur la création de client et l’enregistrement d’un paiement.
- Journalisation Winston avec rotation quotidienne.
- Arrêt gracieux et gestion des erreurs process dans `src/index.js`.

### 4.2 Défauts majeurs

#### A. Remplacement de locataire non atomique — Critique métier

`ClientService.replaceTenant` effectue successivement plusieurs `SELECT`, `UPDATE` et `INSERT` via le pool, sans `beginTransaction`.

Conséquence : une panne entre l’inactivation de l’ancien locataire et la création/affectation du nouveau peut laisser un bien dans un état incohérent.

#### B. Contrôle objet incomplet / IDOR — Élevé

Les routes autorisent des rôles, mais les méthodes `findById` héritées du repository générique ne filtrent pas toujours par collecteur, manager ou périmètre.

Exemple : un collecteur est autorisé à appeler `GET /api/clients/:id` et `GET /api/transactions/:id`; la portée de la ressource doit être vérifiée systématiquement.

#### C. Fuite de portée en cas de compte collecteur non lié — Élevé

Dans `ClientRepository.findAllWithCollector` et `TransactionRepository.findAll`, si aucun collecteur correspondant à `user_id` n’est trouvé, aucun filtre de collecteur n’est ajouté. Le résultat peut alors devenir global.

Le comportement sûr est **deny by default** : retourner zéro donnée ou 403.

#### D. Validation dispersée et incomplète — Élevé

- Les routes principales `clients`, `properties`, `owners`, `transactions` n’appliquent pas de schéma uniforme.
- `ClientController.create` importe des validateurs et la base au milieu de la méthode.
- `Validator.required` rejette `0` et `false`, ce qui est incorrect pour certains champs.
- Les paramètres `page`, `limit`, dates et identifiants sont convertis sans bornes strictes.
- Les mises à jour ne répètent pas systématiquement les contrôles d’unicité et d’intégrité de la création.

#### E. Accès SQL dynamique — Moyen à élevé

`BaseRepository` construit dynamiquement noms de tables, colonnes de filtres et colonnes d’écriture. Les valeurs sont paramétrées, mais les identifiants ne sont pas validés par allowlist dans la classe de base.

Aujourd’hui les appels semblent majoritairement internes, mais le composant est dangereux par conception.

#### F. Statistiques non scoppées — Élevé

`TransactionController.getStats` appelle `getStats(period)` sans passer l’utilisateur. Un collecteur autorisé sur la route peut donc recevoir des agrégats globaux.

#### G. Requête de rapport incompatible avec le schéma — Critique fonctionnel

`report.repository.js` filtre/joint `transactions.property_id`, alors que `sygim_schema.sql` ne définit pas cette colonne dans `transactions`. Les rapports par propriétaire et les exports détaillés peuvent échouer sur le schéma déclaré.

#### H. API de reporting incohérente — Élevé

- Swagger documente `GET/POST /api/reports`, mais le routeur réel expose `/dashboard`, `/collectors`, `/properties`, `/export/...`.
- Swagger documente `/api/auth/register`, mais aucune route register n’est présente dans `auth.routes.js`.
- Swagger documente des routes propriété `/assign` et `/release` absentes du routeur réel.
- `apis: []` implique une spécification maintenue manuellement, avec dérive déjà visible.

#### I. Export CSV fragile — Moyen

L’export transactions remplace uniquement les points-virgules. Il ne protège pas contre l’injection de formules de tableur (`=`, `+`, `-`, `@`) ni ne fait un échappement CSV complet des guillemets et retours ligne.

#### J. Erreurs génériques — Moyen

Plusieurs services lancent `new Error`, converti en erreur 500 par le middleware. Des “non trouvé” deviennent ainsi des erreurs serveur au lieu de 404.

#### K. HTTP actif en production — Élevé

`https-config.js` démarre toujours le serveur HTTP, même quand HTTPS est activé, sans redirection obligatoire. Dans Docker/Nginx, la terminaison TLS n’est pas démontrée.

#### L. Cache annoncé mais désactivé — Moyen

`redis.client.js` est un client factice. Les rapports appellent un service de cache, mais aucune donnée n’est réellement mise en cache. De plus, `KEYS` serait inadapté en production si Redis était activé tel quel.

#### M. Journalisation potentiellement sensible — Élevé

`requestLogger` journalise `req.body` en debug. Cela peut inclure mot de passe, token, données personnelles ou signature. Les fichiers de logs sont présents dans le dépôt.

### 4.3 Qualité et maintenabilité

- `ClientController` viole l’inversion de dépendance en important DB/validateurs dans une action HTTP.
- `ClientService` contient mapping, persistence, transactions et orchestration métier.
- Le commentaire “logic needs...” dans `replaceTenant` confirme une implémentation transitoire.
- Deux mécanismes de rôle (`authorize`, `checkRole`) créent un risque de divergence.
- Plusieurs repositories retournent des formes différentes : tableau brut, `{data,pagination}`, objet avec `primaryKey`, objet avec `id`.
- `SELECT *` accroît le couplage, le volume et le risque de divulgation accidentelle.
- Les références `REC-${Date.now()}` ne constituent pas une stratégie robuste d’identifiant métier concurrent.

---

## 5. Audit de la base de données

### 5.1 Points positifs

- MySQL/InnoDB.
- Clés étrangères sur de nombreuses relations.
- Index sur plusieurs colonnes de recherche/liaison.
- Transactions explicites dans certains flux.
- Migration dédiée aux refresh tokens et aux suppressions logiques.

### 5.2 Fragmentation du schéma

Trois sources de vérité coexistent :

1. `database/sygim_schema.sql` ;
2. `database/migration_001...` et `migration_002...` ;
3. `src/infrastructure/database/migrations/003...008`.

Le schéma principal ne contient pas nécessairement les colonnes ajoutées par les migrations (`username_normalized`, `deletedAt`, `manager_id`, refresh tokens). Aucun outil de migration versionné avec table d’historique, ordre garanti et rollback automatisé n’est démontré.

### 5.3 Conventions incohérentes

- Tables principales en snake_case (`user_id`, `created_at`).
- Migrations récentes en camelCase (`userId`, `expiresAt`, `revokedAt`, `deletedAt`).
- Le code alterne entre ces conventions.

Cette incohérence complique requêtes, maintenance et outils d’analyse.

### 5.4 Normalisation et intégrité

Colonnes dénormalisées :

- `clients.property_name`, `clients.property_value`, `clients.agent` ;
- `transactions.client_name`, `transactions.date_display`.

Ces duplications peuvent être utiles pour l’historisation, mais aucune règle explicite ne distingue snapshot historique et cache dérivé. Elles risquent donc de diverger.

Autres problèmes :

- `join_date` en `VARCHAR(20)` au lieu de `DATE`/`DATETIME`.
- Statuts et types en `VARCHAR` sans contraintes CHECK visibles.
- Montants sans contraintes de non-négativité visibles.
- Relation circulaire métier `clients.property_id` et `properties.tenant_id`, source d’incohérence.
- Suppression physique des clients malgré l’existence de transactions et exigences d’audit.
- Absence de stratégie claire pour comptabilité immuable, annulation et remboursement.

### 5.5 Index et requêtes

- Les recherches `%terme%` sur plusieurs colonnes ne profiteront pas d’index B-tree.
- Les expressions `MONTH(date)`/`YEAR(date)` limitent l’utilisation d’index temporels ; privilégier des bornes de dates.
- Les pages utilisent `LIMIT/OFFSET`, acceptable à faible volume mais coûteux à grande profondeur.
- Plusieurs statistiques lancent des requêtes séquentielles qui pourraient être regroupées.
- Aucune preuve d’`EXPLAIN`, benchmark, index composite piloté par les requêtes ou détection N+1 automatisée.

### 5.6 Sauvegarde et reprise

Aucun mécanisme complet et testé de :

- sauvegarde automatisée ;
- chiffrement des backups ;
- politique de rétention ;
- restauration testée ;
- RPO/RTO ;
- réplication ;
- plan de reprise après sinistre.

---

## 6. Audit API

### 6.1 Forces

- Routes REST lisibles.
- Verbes HTTP généralement adaptés.
- Codes 201 utilisés à la création.
- Réponse standardisée via `ApiResponse` sur plusieurs contrôleurs.
- Paramètres de recherche, statut, dates et pagination sur certaines listes.
- Swagger UI exposée.

### 6.2 Faiblesses

1. Pas de versionnement (`/api/v1`).
2. Pagination non uniforme et souvent sans total/links.
3. Limites non plafonnées ; frontend demande 1000, export 10000.
4. Pas de politique de tri uniforme.
5. DTO d’entrée/sortie absents ou informels.
6. Mélange camelCase/snake_case dans les contrats.
7. Documentation Swagger en dérive.
8. Aucun ETag, idempotency key ou contrôle de concurrence optimiste.
9. Les suppressions utilisent souvent `200` plutôt que `204`, sans cohérence globale.
10. Les erreurs de validation ne conservent pas toujours les détails par champ.
11. Les exports sont construits en mémoire, risquant une forte consommation pour les gros volumes.
12. Aucun contrat OpenAPI validé en CI.

---

## 7. Audit de sécurité

### 7.1 Risques critiques

#### SEC-01 — Secrets versionnés

Des mots de passe DB et secrets JWT sont présents dans :

- `backend/.env` ;
- `backend/.env.production` ;
- `docker-compose.yml` ;
- `backend/database/fix_admin_role.js` ;
- commentaires/valeurs de seed.

**Action immédiate :** considérer ces secrets compromis, les révoquer/faire tourner, nettoyer l’historique Git avec procédure contrôlée, puis utiliser un gestionnaire de secrets.

#### SEC-02 — Chaîne XSS + vol de tokens

Le frontend historique contient de très nombreuses affectations `innerHTML` avec interpolation de données métier/importées. Les access et refresh tokens sont stockés en `localStorage` dans les deux frontends.

Une seule injection script réussie peut exfiltrer une session complète et durable.

#### SEC-03 — Autorisation objet incomplète

Les contrôles RBAC de route ne suffisent pas. L’accès à une ressource doit vérifier organisation, manager, collecteur, propriétaire et affectation.

#### SEC-04 — Incohérence de données sur opération métier

Le remplacement de locataire non transactionnel est un risque de fraude, perte ou divergence financière.

### 7.2 OWASP Top 10

| Catégorie | État |
|---|---|
| A01 Broken Access Control | **Risque élevé** : RBAC présent, scope objet incomplet |
| A02 Cryptographic Failures | **Risque élevé** : secrets exposés, TLS non garanti, signatures non gouvernées |
| A03 Injection | SQL values souvent paramétrées ; XSS historique élevé ; identifiants SQL dynamiques à durcir |
| A04 Insecure Design | Invariants métier dispersés, double source de vérité frontend |
| A05 Security Misconfiguration | Secrets Docker, HTTP actif, Swagger potentiellement public, CORS à vérifier par env |
| A06 Vulnerable Components | Non vérifié à l’exécution ; audit de dépendances impossible dans cette session |
| A07 Identification/Auth Failures | JWT/refresh corrects dans l’idée ; tokens navigateur, absence MFA et politique de compte robuste |
| A08 Software/Data Integrity | CI partielle, images non signées, pas de SBOM/provenance |
| A09 Logging/Monitoring | Logs structurés mais données sensibles possibles, pas d’alerting centralisé |
| A10 SSRF | Aucun flux serveur sortant majeur identifié ; risque non démontré |

### 7.3 Contrôles complémentaires manquants ou non démontrés

- MFA pour comptes privilégiés.
- Politique centralisée de mot de passe et contrôle des mots de passe compromis.
- Cookies `HttpOnly`, `Secure`, `SameSite` pour refresh token.
- Rotation des clés JWT avec `kid` et stratégie de révocation access token.
- CSP stricte compatible avec l’application.
- Protection anti-CSRF si migration vers cookies.
- En-têtes de proxy/trust proxy explicitement configurés pour rate limiting correct.
- Stockage distribué du rate limiter ; l’état mémoire n’est pas adapté à plusieurs instances.
- Analyse SAST, DAST, secrets, dépendances et images dans la CI.
- Contrôle d’upload : taille, MIME réel, antivirus, stockage hors web root.
- Chiffrement des champs sensibles au repos malgré l’existence d’un `CryptoService`.
- Politique d’audit immuable et inviolable pour les opérations financières.

### 7.4 RGPD

Le projet possède des endpoints d’export et d’anonymisation, ce qui est positif. Toutefois :

- l’export semble orienté vers le compte utilisateur interne, pas vers une personne concernée propriétaire/locataire ;
- aucune gestion des finalités, consentements, bases légales et droits par catégorie n’est démontrée ;
- les logs techniques et fichiers locaux peuvent conserver des données après anonymisation DB ;
- aucun registre de traitements, DPA, politique de conservation par donnée ou preuve d’effacement backup n’est présent ;
- l’anonymisation `deleted_<id>` reste déterministe et la conservation des références doit être justifiée.

---

## 8. Audit du frontend React

### 8.1 Forces

- React/Vite moderne.
- Routage protégé par rôles.
- Contextes séparés pour session et données métier.
- Client HTTP centralisé avec timeout, retry et refresh token concurrent contrôlé.
- Composants réutilisables (`DataTable`, `Modal`, `FilterBar`, etc.).
- Certaines adaptations camelCase/snake_case réduisent les ruptures immédiates.

### 8.2 Risques et dette

#### Authentification

- La session est restaurée depuis `localStorage` sans appel immédiat à `/auth/me` ; une identité périmée ou manipulée pilote donc l’UI jusqu’au premier rejet backend.
- Logout ne supprime pas explicitement le refresh token dans `AuthContext`.
- Le refresh token est écrit avec une chaîne littérale alors que le client lit `CONFIG.STORAGE.REFRESH_TOKEN` : risque de divergence de clé.
- Les rôles frontend ne sont qu’un contrôle ergonomique, pas une sécurité.

#### Données et performance

`DataContext` charge en parallèle jusqu’à 1000 propriétés, propriétaires, clients, collecteurs et transactions à chaque connexion/refresh.

Conséquences :

- temps initial élevé ;
- surconsommation réseau/mémoire ;
- données obsolètes ;
- recalculs locaux ;
- impossibilité de scaler proprement.

Chaque erreur individuelle est transformée en `{data: []}`. `Promise.all` réussit donc et l’écran peut annoncer une synchronisation réussie alors que des domaines sont en panne.

#### Cohérence

- `extractData` accepte plusieurs formes de réponse, symptôme d’un contrat instable.
- Des tableaux entiers sont mutables via setters exposés globalement.
- Pas de cache serveur/client structuré, invalidation ou optimistic concurrency.
- Pas de gestion claire des conflits entre utilisateurs.

#### Tests

Aucun script de test frontend n’est présent dans `frontend/react-app/package.json`. Aucun test unitaire, d’accessibilité ou E2E n’a été identifié dans le périmètre inspecté.

---

## 9. Frontend historique

Le frontend historique constitue la dette la plus importante du projet.

### 9.1 Caractéristiques

- `frontend/index.html` volumineux et scripts globaux.
- `script_main.js` dépasse plusieurs milliers de lignes.
- `script_fixes.js` est une superposition de correctifs.
- Multiples clients/adapters API et mécanismes de synchronisation.
- Données métier dupliquées dans `localStorage` (`CLIENTS_DB`, `PROPERTIES_DB`, `TRANSACTIONS_DB`, sauvegardes diverses).
- Nombreuses fonctionnalités simulées via `alert()` avec “À implémenter”.

### 9.2 Risques

- XSS via `innerHTML` et données interpolées.
- Divergence serveur/navigateur et écrasement potentiel de données.
- Perte de traçabilité : action locale présentée comme réussie sans persistance réelle.
- UX trompeuse : messages de succès pour fonctionnalités non implémentées.
- Fonctions globales et monkey patches difficiles à tester.
- Encodage corrompu visible dans plusieurs messages.
- Accessibilité faible : handlers inline, modales artisanales, navigation clavier incertaine.
- Coût de maintenance très élevé et risque de corriger un frontend non réellement servi.

### 9.3 Décision recommandée

Geler le frontend historique, interdire toute nouvelle fonctionnalité et migrer écran par écran vers React. Le fallback backend vers le legacy doit être supprimé après validation fonctionnelle du React build.

---

## 10. UI, UX et accessibilité

### 10.1 UI

Les composants React montrent une tentative de design cohérent, mais :

- beaucoup de styles inline ;
- variables CSS et couleurs hardcodées coexistent ;
- dépendance à Font Awesome sans composant icône accessible systématique ;
- pas de design system documenté, tokens versionnés ou bibliothèque de composants testée ;
- le legacy et React peuvent produire deux expériences visuelles différentes.

### 10.2 UX

Risques prioritaires :

1. erreurs réseau converties en listes vides ;
2. messages de succès pour actions simulées ;
3. `alert()`/`confirm()` bloquants très fréquents dans le legacy ;
4. chargement massif avant interaction ;
5. absence de gestion uniforme des états vide, erreur, hors-ligne et partiellement chargé ;
6. actions financières sensibles sans récapitulatif métier robuste, double confirmation ou idempotence ;
7. vocabulaire instable entre client, locataire, collecteur/récolteur.

### 10.3 Accessibilité

Quelques labels, rôles et attributs ARIA existent, mais aucune preuve de conformité WCAG 2.2 AA.

Points à vérifier/corriger :

- focus trap et restitution du focus dans les modales ;
- `aria-live` pour erreurs et confirmations ;
- nom accessible des boutons icône ;
- navigation clavier des tableaux, menus et panneaux ;
- contraste et indication non colorimétrique des statuts ;
- labels réellement associés à tous les champs ;
- canvas de signature avec alternative accessible ;
- tableaux avec caption, scopes et représentation mobile ;
- respect `prefers-reduced-motion`.

---

## 11. Performance et scalabilité

### Points positifs

- Compression HTTP.
- Pool MySQL.
- Pagination disponible sur plusieurs endpoints.
- Chargement parallèle côté React.
- Cache abstrait prévu.
- Nginx configure gzip et cache statique.

### Risques

- Frontend demande 5 ensembles de 1000 lignes.
- Exports montent jusqu’à 10000 lignes en mémoire.
- PDF construit entièrement en mémoire et dessine une “table” non paginée.
- `SELECT *` fréquent.
- Recherche `%...%` non indexable efficacement.
- Stats composées de requêtes séquentielles.
- Cache Redis désactivé.
- Pas de cache invalidation métier.
- Cache Nginx `immutable` appliqué potentiellement à des fichiers non hashés.
- Pas de budgets de bundle, analyse Vite ou lazy loading démontré.
- Pas de métriques latence p50/p95/p99, débit, saturation pool ou requêtes lentes.

### Capacité future

Le monolithe peut supporter une charge raisonnable après correction, mais pas avec le chargement global actuel. La priorité est la pagination serveur, la projection de champs, les index composites et l’observabilité avant toute distribution en microservices.

---

## 12. DevOps, CI/CD et SRE

### 12.1 Docker

- Images Node 20 Alpine et Nginx Alpine appropriées comme base.
- Backend utilise `npm install --omit=dev` au lieu de `npm ci --omit=dev`.
- Aucun utilisateur non-root explicitement défini dans le backend.
- Pas de multi-stage build backend.
- Docker Compose monte le code source et convient davantage au développement.
- Credentials codés en dur.
- Le Dockerfile frontend copie tout `frontend` sans construire React ; le résultat servi dépend de l’état local des artifacts.

### 12.2 CI

La CI :

- installe le backend ;
- lance lint et Jest ;
- exclut explicitement deux groupes d’intégration ;
- construit seulement l’image backend.

Absences :

- build/lint/test frontend ;
- base éphémère et migrations ;
- seuil de couverture bloquant ;
- audit dépendances ;
- scan secrets/SAST/containers ;
- SBOM ;
- tests E2E et smoke ;
- publication/signature d’image ;
- environnements, approbation, déploiement et rollback.

Le script lint backend utilise `--fix`, ce qui modifie les fichiers au lieu de servir de contrôle pur.

### 12.3 Exploitation

Présent : health check DB, logs structurés, arrêt gracieux.

Non démontré :

- endpoint readiness complet ;
- métriques Prometheus réellement exposées malgré `prom-client` ;
- tracing distribué ;
- agrégation de logs ;
- alertes ;
- dashboards ;
- SLO/SLI ;
- runbooks ;
- tests de restauration ;
- autoscaling ;
- orchestration Kubernetes ;
- infrastructure-as-code ;
- stratégie blue/green ou canary.

---

## 13. Tests et assurance qualité

### 13.1 État vérifié

Le dépôt contient des tests Jest/Supertest unitaires et d’intégration, ainsi qu’un script k6.

L’artifact `backend/coverage/clover.xml` indique approximativement :

- statements : **36,4 %** ;
- branches/conditionals : **27,7 %** ;
- methods : **33,3 %**.

### 13.2 Limites

- Suites d’intégration owners/properties exclues de la CI.
- Tests liés à une base et à des credentials seedés.
- Pas de frontend tests visible.
- Pas de tests de contrat OpenAPI.
- Pas de test systématique des autorisations par rôle et par objet.
- Pas de tests de migration/rollback.
- Pas de tests transactionnels sur remplacement de locataire, concurrence de paiement ou idempotence.
- k6 utilise des credentials fallback.
- Aucun résultat de mutation testing, DAST ou analyse de sécurité automatisée.

### 13.3 Pyramide cible

```text
             E2E critiques
          (login, paiement, clôture)
        /--------------------------\
       Tests API/intégration MySQL
      /----------------------------\
     Tests application/domaine + contrats
    /--------------------------------------\
   Tests unitaires purs, validateurs, calculs
```

Objectifs initiaux : 70 % lignes / 60 % branches sur backend et frontend, puis seuils renforcés sur modules financiers et sécurité.

---

## 14. Dette technique priorisée

| ID | Dette | Sévérité | Impact | Coût indicatif | Priorité |
|---|---|---|---|---|---|
| D01 | Secrets versionnés | Critique | Compromission infrastructure/données | Faible à moyen | P0 |
| D02 | Tokens dans localStorage + XSS legacy | Critique | Prise de session | Élevé | P0 |
| D03 | Schéma/migrations incompatibles | Critique | Pannes et corruption | Élevé | P0 |
| D04 | Remplacement locataire non atomique | Critique | Incohérence métier/financière | Moyen | P0 |
| D05 | Contrôle objet incomplet | Élevé | Fuite/modification de données | Élevé | P0 |
| D06 | Double frontend | Élevé | Coût, bugs, expérience divergente | Élevé | P1 |
| D07 | Validation/DTO non uniformes | Élevé | Données invalides, erreurs 500 | Moyen | P1 |
| D08 | Rapports visant `transactions.property_id` absent | Élevé | Rapports cassés | Moyen | P0 |
| D09 | Chargements 5 × 1000 lignes | Élevé | Lenteur et non-scalabilité | Moyen | P1 |
| D10 | CI backend partielle, frontend absent | Élevé | Régressions non détectées | Moyen | P1 |
| D11 | Couverture ~36/28/33 % | Élevé | Faible confiance au changement | Élevé | P1 |
| D12 | Swagger divergent | Moyen | Mauvaise intégration et support | Moyen | P1 |
| D13 | Redis factice / cache annoncé | Moyen | Performance imprévisible | Faible | P2 |
| D14 | Logs sensibles et logs versionnés | Élevé | Violation confidentialité | Moyen | P0 |
| D15 | Statuts et noms incohérents | Moyen | Bugs métier et UX | Moyen | P1 |
| D16 | `SELECT *` et exports mémoire | Moyen | Performance/divulgation | Moyen | P2 |
| D17 | Absence backup/restore testé | Critique | Perte de données | Élevé | P0 |
| D18 | Pas de SLO/alerting/tracing | Élevé | Incidents non détectés | Moyen | P1 |
| D19 | Fonctionnalités simulées | Élevé | Tromperie utilisateur/risque opérationnel | Moyen | P0 |
| D20 | Documentation sur-prometteuse | Moyen | Mauvaises décisions de gouvernance | Faible | P1 |

---

## 15. Recommandations détaillées

### R1 — Révoquer les secrets et sécuriser la configuration

- **Description :** rotation immédiate de tous les secrets visibles ; suppression des valeurs du code et historique ; secrets injectés par coffre.
- **Justification :** un secret versionné doit être considéré compromis.
- **Bénéfice :** réduction du risque de compromission directe.
- **Priorité :** P0.
- **Effort :** moyen.
- **Impact métier :** protège données clients et continuité.
- **Impact technique :** impose une configuration par environnement.
- **Non-remédiation :** accès non autorisé DB/API et incident majeur.

### R2 — Retirer le frontend historique par Strangler Fig

- **Description :** geler le legacy, cartographier ses écrans, migrer vers React par domaines, retirer les fallbacks locaux.
- **Justification :** c’est la principale source de XSS, duplication et incohérence.
- **Bénéfice :** un seul produit, testable et gouverné.
- **Priorité :** P0/P1.
- **Effort :** élevé.
- **Impact métier :** expérience fiable, moins de faux succès.
- **Impact technique :** forte réduction de dette.
- **Non-remédiation :** incidents de sécurité et coût croissant.

### R3 — Utiliser un refresh token en cookie HttpOnly

- **Description :** access token court en mémoire, refresh token en cookie Secure/HttpOnly/SameSite ; CSP stricte ; rotation.
- **Justification :** réduit l’exfiltration via XSS.
- **Bénéfice :** meilleure sécurité de session.
- **Priorité :** P0.
- **Effort :** moyen.
- **Non-remédiation :** toute XSS peut voler la session persistante.

### R4 — Construire un modèle d’autorisation centralisé

- **Description :** matrice rôle × action × portée, policies réutilisables, vérification au niveau repository/application.
- **Justification :** RBAC de route ne protège pas les objets.
- **Bénéfice :** prévention IDOR et séparation des portefeuilles.
- **Priorité :** P0.
- **Effort :** élevé.
- **Non-remédiation :** fuite inter-collecteurs/managers.

### R5 — Consolider le schéma et les migrations

- **Description :** baseline unique, conventions snake_case, outil de migration, migrations forward-only réversibles par stratégie, validation CI sur DB vierge et copie anonymisée.
- **Justification :** le code actuel vise plusieurs schémas possibles.
- **Bénéfice :** déploiements déterministes.
- **Priorité :** P0.
- **Effort :** élevé.
- **Non-remédiation :** pannes selon l’environnement.

### R6 — Rendre les flux financiers atomiques et idempotents

- **Description :** unités de travail pour paiement/remplacement/reversement ; verrouillage ou version ; clé d’idempotence ; journal comptable append-only.
- **Justification :** éviter doublons et états partiels.
- **Bénéfice :** intégrité financière et auditabilité.
- **Priorité :** P0.
- **Effort :** élevé.
- **Non-remédiation :** pertes, litiges, rapprochements impossibles.

### R7 — Uniformiser DTO, validation et contrats

- **Description :** schémas Zod/Joi/express-validator par endpoint, DTO d’entrée/sortie, limites, enums et normalisation.
- **Justification :** contrôles actuels dispersés.
- **Bénéfice :** erreurs 400 explicites et modèle stable.
- **Priorité :** P1.
- **Effort :** moyen.

### R8 — Générer OpenAPI depuis les routes/schémas ou l’inverse

- **Description :** source unique, validation de conformité en CI, exemples sans credentials réels.
- **Justification :** Swagger documente des routes inexistantes.
- **Bénéfice :** intégrations fiables.
- **Priorité :** P1.
- **Effort :** moyen.

### R9 — Repenser la stratégie de chargement frontend

- **Description :** pagination serveur, queries par écran, cache de requêtes, invalidation ciblée et virtualisation.
- **Justification :** 5000 lignes potentielles à la connexion.
- **Bénéfice :** rapidité et scalabilité.
- **Priorité :** P1.
- **Effort :** moyen.

### R10 — Établir une chaîne CI/CD complète

- **Description :** lint non-mutant, tests backend/frontend, DB migrations, E2E, coverage gates, SAST/SCA/secrets/container, SBOM, image signée, déploiement et rollback.
- **Justification :** CI actuelle ne valide qu’une partie du backend.
- **Bénéfice :** réduction des régressions et preuve de qualité.
- **Priorité :** P1.
- **Effort :** moyen à élevé.

### R11 — Mettre en place sauvegarde et reprise

- **Description :** backups automatiques chiffrés, rétention, restauration trimestrielle, RPO/RTO et runbook.
- **Priorité :** P0.
- **Effort :** moyen.
- **Non-remédiation :** perte définitive de données.

### R12 — Observabilité opérationnelle

- **Description :** métriques RED/USE, pool DB, requêtes lentes, logs centralisés/redactés, tracing OpenTelemetry, alertes et SLO.
- **Priorité :** P1.
- **Effort :** moyen.

### R13 — Programme QA basé sur le risque

- **Description :** tests d’autorisation, concurrence, idempotence, migrations, contrats, accessibilité et parcours financiers E2E.
- **Priorité :** P1.
- **Effort :** élevé.

### R14 — Design system et accessibilité WCAG 2.2 AA

- **Description :** tokens, composants formulaires/modales/tableaux, audits axe/Lighthouse et tests clavier.
- **Priorité :** P2.
- **Effort :** moyen.

---

## 16. Feuille de route priorisée

### 0–2 semaines — Stabilisation immédiate

1. Rotation de tous les secrets et suppression des secrets du dépôt.
2. Interdiction de déploiement public du legacy et restriction de Swagger.
3. Redaction des logs ; retrait des logs du versionnement.
4. Vérification/patch des contrôles de portée collecteur, notamment “collecteur non lié”.
5. Désactivation des fonctionnalités simulées ou étiquetage explicite “indisponible”.
6. Correction du reporting incompatible avec le schéma.
7. Sauvegarde DB automatisée minimale et test de restauration.
8. Inventaire de production : schéma réellement déployé, secrets, utilisateurs, données et services.

### 2–8 semaines — Socle fiable

1. Baseline de migration unique et pipeline DB éphémère.
2. DTO/validation sur tous les endpoints mutateurs.
3. Transactions sur remplacement et opérations financières.
4. Policies d’autorisation objet.
5. Cookies sécurisés pour refresh token et durcissement CSP.
6. Pagination/tri/filtres uniformes ; suppression des chargements `limit:1000`.
7. CI frontend + E2E critiques + scans sécurité.
8. Seuils de couverture et correction des suites exclues.

### 2–6 mois — Refonte modulaire

1. Modules métier : identity, tenancy, properties, collections, owners, reporting.
2. Migration Strangler Fig du legacy vers React.
3. Contrat OpenAPI comme source unique.
4. Ledger financier immuable et mécanismes d’annulation compensatoire.
5. Design system accessible.
6. Observabilité complète et SLO.
7. Processus de release, migration, rollback et runbooks.

### 6–12 mois — Industrialisation

1. Portail propriétaire/locataire uniquement si validé métier.
2. Recherche indexée/full-text si le volume le justifie.
3. Cache Redis réel uniquement après mesure, avec invalidation explicite.
4. Haute disponibilité DB, réplication et PRA testé.
5. IaC et environnements reproductibles.
6. Tests de charge, sécurité externe et audit RGPD formel.

### Long terme

N’envisager microservices, CQRS ou événements qu’après :

- stabilisation du monolithe modulaire ;
- identification de frontières métier réelles ;
- métriques prouvant un besoin de séparation ;
- maturité CI/CD et observabilité.

---

## 17. Stratégie de migration recommandée

### Approche : Strangler Fig + monolithe modulaire

1. **Sécuriser sans refactor massif** : secrets, scope, logs, backups, endpoints cassés.
2. **Créer une façade de contrats** : OpenAPI v1, DTO et politiques d’autorisation.
3. **Extraire les modules dans le même processus** : commencer par Identity et Collections.
4. **Encapsuler l’ancien SQL** derrière des repositories dédiés ; supprimer progressivement `BaseRepository` générique.
5. **Migrer les écrans legacy** vers React, un domaine à la fois.
6. **Supprimer les fallbacks localStorage** ; le serveur devient l’unique source de vérité.
7. **Basculer les routes** module par module avec tests de contrat et feature flags.
8. **Retirer le legacy** et le fallback statique du backend.
9. **Optimiser après mesure**, pas avant.

Cette stratégie évite une réécriture “big bang”, protège la continuité métier et permet de livrer des améliorations contrôlées.

---

## 18. Critères de passage en production

SYGIM ne devrait être déclaré “production-ready” que lorsque :

- [ ] tous les secrets historiques sont révoqués ;
- [ ] aucun secret n’est présent dans Git ;
- [ ] le schéma est reproductible depuis zéro par migrations ;
- [ ] les flux paiement/remplacement sont atomiques et testés ;
- [ ] les tests d’autorisation par objet passent pour chaque rôle ;
- [ ] le legacy exposé et les sources XSS sont retirés ou neutralisés ;
- [ ] refresh token sécurisé hors `localStorage` ;
- [ ] build/test frontend et backend obligatoires en CI ;
- [ ] suites d’intégration non exclues ;
- [ ] tests E2E des parcours financiers ;
- [ ] sauvegarde/restauration prouvée ;
- [ ] logs sans secrets/PII et centralisés ;
- [ ] métriques, alertes, health/readiness et runbooks en place ;
- [ ] OpenAPI alignée avec l’implémentation ;
- [ ] aucune fonctionnalité simulée présentée comme réelle ;
- [ ] audit de sécurité des dépendances et test d’intrusion réalisés.

---

## 19. Limites de l’audit

Les constats sont fondés sur le dépôt inspecté. Les commandes d’exécution des tests, du build, de l’audit npm et de Git n’ont pas abouti à cause d’une indisponibilité de l’environnement d’exécution. Par conséquent :

- les résultats de couverture cités proviennent de l’artifact existant `backend/coverage/clover.xml` ;
- le build React n’a pas été reconfirmé pendant cette session ;
- les vulnérabilités de dépendances n’ont pas été recalculées ;
- l’état exact de la base réellement déployée n’a pas été comparé à une instance live ;
- aucune charge réelle, analyse dynamique, pentest ou audit visuel navigateur n’a été exécuté.

Ces limites ne réduisent pas la gravité des preuves statiques, mais elles imposent une phase de validation dynamique avant tout plan de correction définitif.

---

## 20. Conclusion finale

SYGIM possède suffisamment de matière pour être sauvé et industrialisé ; une réécriture totale n’est pas justifiée à ce stade. Le meilleur choix est une **refonte partielle incrémentale**, centrée sur la sécurité, l’intégrité financière, la base de données, les contrats API et le retrait du frontend historique.

La priorité n’est pas d’ajouter des fonctionnalités, des microservices ou de l’IA. La priorité est d’obtenir une source de vérité unique, des opérations atomiques, des autorisations fiables, une session sécurisée, des migrations reproductibles et une chaîne de livraison vérifiable.

**Décision : non prêt pour la production — refonte partielle obligatoire avant mise en service.**
