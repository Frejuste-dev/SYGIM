# Gestion des Migrations de Base de Données

Ce document décrit le fonctionnement du système de migration SQL mis en place pour SYGIM.

## Principe

Le backend utilise un système de migration maison (sans dépendance type Sequelize/Knex) afin d'exécuter des fichiers SQL (DDL, DML) et de conserver la trace des exécutions dans la table `schema_migrations`.

### Règles Fondamentales
1. **Unicité** : Chaque fichier de migration est numéroté (ex: `011_ajout_colonne.sql`) et ne sera exécuté qu'une seule fois.
2. **Ordre** : L'exécution se fait par ordre alphabétique des noms de fichier.
3. **Immutabilité** : Une migration déjà appliquée ne doit JAMAIS être modifiée. Son intégrité est garantie par un hash SHA-256 (checksum). Si un fichier est modifié a posteriori, le script échouera avec une erreur `MIGRATION_CHECKSUM_MISMATCH`.
4. **Locking** : Le système utilise un verrou MySQL (`GET_LOCK`) afin d'empêcher deux instances de jouer les migrations simultanément.
5. **Fail-Fast** : À la moindre erreur SQL, le script s'arrête immédiatement et ne marque pas la migration comme appliquée. 
   *(Note : les opérations DDL committent implicitement dans MySQL, donc la prudence reste de mise. Toujours backuper la production avant).*

## Commandes

```bash
# Appliquer toutes les migrations en attente
npm run db:migrate

# Mode simulation (liste les fichiers qui seraient appliqués, sans toucher à la BD)
npm run db:migrate --dry-run
```

## Le Mode Baseline

Lors de la création d'une **nouvelle base de données** à partir du fichier complet `sygim_schema.sql`, la base possède déjà toutes les tables et colonnes à jour. Si l'on exécute les anciennes migrations, elles échoueront (ex: `CREATE TABLE` sur une table existante).

Pour gérer cela, le mode "Baseline" enregistre toutes les migrations existantes comme "déjà appliquées", **sans les exécuter**.

```bash
npm run db:migrate:baseline
```

Ce mode est exécuté automatiquement par le script `database/setup-test-db.js` pour initialiser la base de test propre.
**Ne l'utilisez jamais sur un environnement existant qui nécessite réellement d'être migré.**

## Ajouter une nouvelle migration

1. Créez un fichier dans `src/infrastructure/database/migrations/`.
2. Nommez-le avec un préfixe numérique incrémentiel (ex: `011_ma_super_migration.sql`).
3. Rédigez le code SQL.
4. Testez-le localement avec `npm run db:migrate`.
5. Si tout est correct, mettez également à jour le fichier `database/sygim_schema.sql` (qui représente la "photo" finale de la base). 
