# SYGIM — RAPPORT D'AUDIT TECHNIQUE ET FONCTIONNEL DÉFINITIF
**Version 1.0 | Date : Août 2026 | Statut : FINAL**

## 01. Executive Summary

Ce rapport est la synthèse de 4 audits approfondis (Produit/UX, Architecture, Sécurité/CI, Domaine Financier).

| Domaine | Score | Formule de calcul / Source |
|---------|-------|----------------------------|
| Produit & UX | 5.6 / 10 | Moyenne des heuristiques (Clarté, Cohérence, Architecture, Accessibilité) - (Source: AUDIT_01) |
| Architecture & Tech | 5.6 / 10 | Moyenne des dimensions tech (Arch 7, DB 5, Sec 6, Perf 7, Scalability 6, Maintenabilité 5, Tests 5, Obs 4) - (Source: AUDIT_02) |
| Domaine Financier | 2.0 / 10 | Évaluation experte de l'intégrité comptable - (Source: AUDIT_04) |
| **NOTE GLOBALE** | **4.4 / 10** | **Moyenne arithmétique : (5.6 + 5.6 + 2.0) / 3** |

**Verdict Clair : Fonctionne en démo vs Auditable/Sécurisé**
Actuellement, SYGIM **"fonctionne en démo"**. L'application permet d'ajouter un locataire, de cliquer sur "Payer" et d'imprimer un joli reçu. Cependant, elle n'est **absolument pas auditable ni sécurisée d'un point de vue comptable**. L'absence de notion de quittance (Invoice) et d'historique des dettes, couplée à un stockage plat et sans verrous transactionnels, empêche toute utilisation à grande échelle ou certification financière.

## 02. Périmètre et méthodologie
Le présent document synthétise 4 phases d'audit basées sur l'analyse stricte du code source, sans supposition :
- **Phase 1 (AUDIT_01)** : Audit Produit, UX/UI, Personas et Workflows.
- **Phase 2 (AUDIT_02)** : Audit de l'Architecture Technique, Choix Technologiques, Modèle de Données et Scalabilité.
- **Phase 3 (AUDIT_03)** : Audit de Sécurité (RBAC, JWT, Vulnérabilités), Tests et CI/CD.
- **Phase 4 (AUDIT_04)** : Audit expert du Domaine Financier et de l'intégrité comptable.

## 03. Architecture actuelle
SYGIM repose sur un **Monolithe Modulaire** :
- **Frontend** : React 19, Vite 8, TailwindCSS 4, TanStack Query 5.
- **Backend** : Node.js (Express), stateless.
- **Base de données** : MySQL via requêtes brutes (`mysql2`), sans ORM.
- **Faiblesses** : Le backend souffre d'un manque de typage (absence de TypeScript), et l'utilisation de SQL brut parsemé dans les *Repositories* complexifie la maintenabilité et augmente le risque d'erreur humaine. 

## 04. Audit fonctionnel et métier
L'interface (UI) a été améliorée (ex: les reçus de paiement), mais l'UX globale est trop "orientée CRUD" :
- L'arborescence est "plate" (`/admin/*`) et manque de hiérarchie.
- Il y a des redondances entre les dashboards (`/manager`, `/dashboard`).
- Gaps majeurs (AUDIT_01) : Absence de processus de clôture comptable, pas de système de relance des impayés, pas de génération d'appels de loyer (quittancement).

## 05. Audit du modèle de données
Le schéma de base de données (`sygim_schema.sql`) maintient une intégrité référentielle de base (`ON DELETE SET NULL / RESTRICT`), mais souffre d'une gestion plate :
- Absence d'historisation des états et de "Soft Deletion" unifiée.
- Les entités ne sont pas temporelles (pas de tables pour gérer le cycle de vie au fil des mois).

## 06. Audit backend / API & 07. Audit frontend / UI / UX
- **Backend** : Architecture en couches (Controllers, Services, Repositories). Les validations (`express-validator`) sont présentes, mais l'absence d'ORM limite l'évolutivité.
- **Frontend** : L'adoption de TanStack Query a fiabilisé le cache. Cependant, certains filtrages lourds sont exécutés côté client au lieu de l'API.

## 08. Audit sécurité & 09. Audit performance & 10. Audit tests / CI/CD
- **Sécurité (AUDIT_03)** : Le JWT est stocké en clair dans le `localStorage`, vulnérable au XSS. Les contrôles IDOR sont manuels dans les services et non centralisés.
- **Performance (AUDIT_02)** : Bonne sur de petits volumes, mais la scalabilité analytique (tableaux de bord) souffrira sans matérialisation ni cache, car les KPIs utilisent des requêtes `SUM()` à la volée.
- **Tests & CI (AUDIT_03)** : Le filet de sécurité est **inexistant**. La suite de tests Jest échoue, la couverture est insuffisante (~36%), et la migration SQL de la base de test est corrompue (`002_bad.sql`).

## 11. Audit financier et comptable (Le cœur du problème)
(Issu de l'AUDIT_04)
Le système gère l'argent comme un calepin (un simple compteur global). 
Il **ne permet pas** le quittancement. 
- Il n'y a pas de "Dette" historisée. On se contente d'ajouter le montant d'une transaction à un compteur `amount_paid` sur la table `clients`.
- Il n'y a **pas de lettrage** : On ne sait pas si un locataire paie son retard de Mai ou son avance de Juillet.
- Les annulations de transactions ne déduisent même pas le montant du solde du client (le code l'omet).

## 12. Registre consolidé des risques

| ID | Domaine | Risque | Gravité | Prob. | Impact | Priorité | Source | Fichier / Preuve | Confiance |
|----|---------|--------|---------|-------|--------|----------|--------|------------------|-----------|
| FIN-001 | Données | Modèle financier plat sans quittances | P0 | Haute | Rejet comptable | P0 | AUDIT_04 | `sygim_schema.sql` (table `clients`) | PROUVÉ |
| FIN-002 | Finance | Absence de contre-passation (annulation) | P0 | Haute | Soldes faux | P0 | AUDIT_04 | `transaction.repository.js` (L188) | PROUVÉ |
| FIN-003 | Finance | Race condition (Double clic = Double encaissement) | P1 | Moy. | Corruption financière | P1 | AUDIT_04 | Pas de verrou dans le repo, pas de ref UNIQUE DB | PROUVÉ |
| SEC-001 | Sécurité| JWT dans LocalStorage (Vulnérabilité XSS) | P1 | Haute | Vol de session | P1 | AUDIT_03 | `AuthContext.jsx` (L21) | PROUVÉ |
| SEC-002 | Sécurité| Contrôles IDOR manuels dans les services | P1 | Moy. | Fuite de données | P1 | AUDIT_03 | `transaction.service.js` | PROUVÉ |
| TST-001 | CI/CD | Migrations SQL de test corrompues | P2 | Haute | Tests impossibles | P1 | AUDIT_03 | Résultat Jest (002_bad.sql) | PROUVÉ |

## 13. Dette technique consolidée
- **A. Sécurité** : Stockage du JWT, Contrôles d'accès manuels.
- **B. Architecture** : Absence d'ORM (SQL brut en JS), absence de typage (TypeScript manquant).
- **C. Données** : Modèle plat pour la finance, absence de tables de facturation.
- **D. Qualité** : Tests unitaires cassés, couverture faible, migrations désynchronisées.

## 14. Diagnostic de maturité & 15. Décision de déploiement
- **Maturité** : **Prototype Fonctionnel**.
- **Décision de déploiement (Go / No-Go)** : **NO-GO STRICT** pour la production à grande échelle (risque légal et comptable majeur).

## 16. Architecture cible (Le Modèle de Domaine)
*(Rappel : Ces concepts ne sont pas dans le système existant, ils constituent la cible architecturale.)*
Pour gérer des encaissements réels, le modèle devra intégrer :
1. **BillingPeriod** (Périodes comptables : Juin, Juillet...).
2. **Invoice** (La dette : Appel de loyer, rattaché à une période).
3. **Transaction** (L'encaissement brut, reçu de la banque ou du collecteur).
4. **PaymentAllocation** (Le lettrage : jointure reliant une Transaction à une ou plusieurs Invoices).
5. **CreditMovement** (Avances, avoirs, portefeuille client).

**Invariants fondamentaux à implémenter :**
- **Idempotence** : La référence d'une transaction DOIT être unique en base.
- **Immutabilité** : Toute modification s'opère par une transaction inverse (contre-passation), on n'efface jamais l'historique.
- **Allocation stricte** : `amount_paid` doit être un champ *calculé* (somme des lettrages), pas un champ *stocké et écrasé*.

## 17. Master Roadmap de remédiation

- **Phase 0 — Freeze & sécurisation immédiate** : Arrêt des développements de fonctionnalités. Aucune nouvelle route.
- **Phase 1 — Security Remediation** : Bascule du JWT en cookie `HttpOnly`. Mise en place d'un middleware IDOR strict. Indexation UNIQUE de `transactions.reference`.
- **Phase 2 — Characterization Tests** : Réparation des migrations (`002_bad.sql`) et restauration du harnais de tests Jest.
- **Phase 3 — Financial Domain** : Création des tables `Invoices`, `BillingPeriods`, `PaymentAllocations`. Réécriture du coeur de `TransactionService`.
- **Phase 4 — Migration Cut-Off** : Scripts de migration des données de l'ancien modèle (calepin) vers le nouveau modèle (quittances).
- **Phase 5 — Application Layer** : Adaptation des Controllers et des Services pour utiliser le nouveau modèle. (Eventuelle intégration de Prisma ORM).
- **Phase 6 — Frontend** : Adaptation des hooks (`useTransactions`), des dashboards et de la vue "Dettes" (remplacement de l'affichage du solde global par un tableau des factures).
- **Phase 7 — Performance & Observability** : Matérialisation des KPIs, Audit Logging systématique.
- **Phase 8 — CI/CD & Production Readiness** : Automatisation des tests sur pipeline, stress tests.

## 18. Stratégie de migration
Le **Cut-Off** est l'étape la plus délicate (Phase 4). L'ancien système calcule des soldes de façon silencieuse et aveugle.
1. **Reconciliation** : Exporter les soldes `amount_due` et `amount_paid` actuels.
2. **Opening Invoice/Credit** : Plutôt que de ventiler les paiements passés sur des mois artificiels, on générera une unique "Facture d'ouverture" (Opening Invoice) ou un "Crédit d'ouverture" représentant le solde exact du locataire au jour de la bascule (Freeze Legacy). 
3. **Dry Run** : Exécuter l'algorithme sur une copie de base pour valider l'égalité des soldes. Il faudra particulièrement prêter attention aux "locataires multi-baux" (À VÉRIFIER : est-ce que le système lie 1 client à 1 ou plusieurs biens de façon exclusive ?).

## 19. Critères de sortie (Production Readiness)
- **Sécurité** : 100% des endpoints critiques protégés par middleware RBAC/IDOR + JWT en HttpOnly.
- **Finance** : Création/Annulation de paiement 100% ACID (Tests de concurrence validés sans Race Conditions).
- **Données** : Zéro modification de la colonne `amount_paid` (qui aura disparu au profit d'un sum() sur le lettrage).
- **Tests** : 80% de couverture de test sur les domaines critiques (Finance/Auth). CI au vert.
- **Infrastructure** : Environnement de Staging isolé et représentatif de la production.

## 20. Points à arbitrer & Conclusion exécutive

**Contradictions ou "Points à arbitrer" :**
- *Prorata & Avances vs Modèle Existant* : L'AUDIT_01 a identifié que le "Taux de recouvrement" affichait des valeurs aberrantes (119%). L'AUDIT_04 a prouvé que c'est parce que les avances s'accumulent sans affectation. Le métier doit arbitrer : lors du Cut-Off, les soldes positifs doivent-ils être transformés en "Avoirs" (Crédits) ou en paiements anticipés alloués aux mois futurs ?
- *Dettes techniques asynchrones* : L'utilisation de Prisma ORM est fortement recommandée (AUDIT_02), mais son implémentation de front avec la refonte du modèle financier (AUDIT_04) risque de bloquer la livraison. La direction technique doit arbitrer s'il faut migrer sous Prisma d'abord, ou construire le nouveau modèle SQL en utilisant `mysql2` puis migrer l'ORM plus tard.

**Conclusion exécutive :**
SYGIM possède une excellente enveloppe technique et visuelle, portée par une architecture frontend moderne. Néanmoins, son cœur métier (la comptabilité locative) a été conçu comme un MVP transactionnel plat. Le pivot vers une architecture de "Domain-Driven Design" financier (Factures / Lettrage) est l'unique chemin pour transformer cet outil de démo en un véritable ERP de gestion immobilière apte à affronter les audits comptables de ses futurs clients.
