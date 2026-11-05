# 📋 GUIDE COMPLET DE TEST & PRÉSENTATION CLIENT — SYGIM

Ce document est le **cahier de recette pas à pas** de l'application **SYGIM** (*Système de Gestion Immobilière*).  
Suivez chaque test dans l'ordre pour vérifier l'ensemble des fonctionnalités avant la présentation au client.

---

## 🔑 Identifiants de connexion

| Rôle | Identifiant | Mot de passe | Rôle & Usage dans la démo |
| :--- | :--- | :--- | :--- |
| **Administrateur** | `admin` | `Admin2026!` | Accès complet, paramétrage, création du patrimoine |
| **Collecteur 1** | `leonce` | `Leonce2026!` | Tournée mobile Léonce YAO (encaissement & signature) |
| **Collecteur 2** | `korede` | `Korede2026!` | Tournée mobile Kouassi KOREDE |
| **Manager Terrain** | `manager` | `Mgr2026!` | Supervision d'équipe, performance & alertes impayés |
| **Comptable** | `comptable` | `Cpt2026!` | Transactions, rapprochement bancaire & exports |

---

## 🚀 ÉTAPE 0 : Démarrage des serveurs

1. Ouvrez un terminal dans le dossier du projet ou double-cliquez sur `start-sygim.bat`.
2. Vérifiez que l'API est active sur **`http://localhost:5000`** et le Web sur **`http://localhost:5173`**.
3. Ouvrez votre navigateur sur : **`http://localhost:5173`**.

---

## 🏢 MODULE 1 : Administration & Gestion du Patrimoine
> **Compte à utiliser :** `admin` / `Admin2026!`

### Test 1.1 — Connexion & Tableau de Bord
* **Action :** Saisissez `admin` / `Admin2026!` et validez.
* **Résultat attendu :** 
  * Redirection immédiate vers le Dashboard.
  * Menu latéral complet à gauche (*Tableau de bord, Biens, Propriétaires, Locataires, Transactions, etc.*).
  * Affichage des KPIs financiers en haut (*Total loyers attendus, Total collecté, Taux de recouvrement, Impayés*).

### Test 1.2 — Gestion des Propriétaires (`/admin/owners`)
* **Action :**
  1. Cliquez sur **Propriétaires** dans le menu de gauche.
  2. Cliquez sur le bouton **+ Nouveau propriétaire**.
  3. Renseignez :
     * Nom : `KOUAME`
     * Prénom : `Jean-Luc`
     * Téléphone : `+225 07 11 22 33 44`
     * Email : `jeanluc.kouame@gmail.com`
  4. Cliquez sur **Créer**.
* **Résultat attendu :** Le nouveau propriétaire s'affiche immédiatement dans la liste sans rechargement de page.

### Test 1.3 — Gestion des Biens Immobiliers (`/admin/properties`)
* **Action :**
  1. Cliquez sur **Biens** dans le menu de gauche.
  2. Cliquez sur **+ Nouveau bien**.
  3. Renseignez :
     * Titre : `Villa Cocody 7ème Tranche`
     * Type : `Villa` (ou Appartement)
     * Ville : `Abidjan`
     * Commune / Quartier : `Cocody`
     * Loyer mensuel : `350 000`
     * **Propriétaire** : Déroulez la liste et sélectionnez `Jean-Luc KOUAME`.
  4. Cliquez sur **Créer**.
* **Résultat attendu :** Le bien est enregistré et lié au propriétaire, visible avec son statut `Disponible`.

---

## 👥 MODULE 2 : Gestion Locative & Relevé Financier
> **Compte à utiliser :** `admin` / `Admin2026!`

### Test 2.1 — Ajout d'un Locataire & Affectation (`/admin/clients`)
* **Action :**
  1. Cliquez sur **Locataires** dans le menu de gauche.
  2. Cliquez sur **+ Nouveau locataire**.
  3. Renseignez :
     * Prénom : `Mamadou`
     * Nom : `DIABATE`
     * Téléphone : `+225 05 55 44 33 22`
     * Email : `mamadou.diabate@gmail.com`
     * Propriété : Sélectionnez `Villa Cocody 7ème Tranche`.
     * Loyer mensuel : `350 000`
     * **Collecteur assigné** : Sélectionnez **`KOUASSI LEONCE`** *(crucial pour le test suivant)*.
  4. Cliquez sur **Créer**.
* **Résultat attendu :** Le locataire apparaît avec son loyer dû (350 000 FCFA), son solde restant et son agent assigné `LEONCE`.

### Test 2.2 — Relevé de Compte Financier Locataire
* **Action :**
  1. Sur la ligne de `Mamadou DIABATE` (ou d'un locataire existant avec historique), cliquez sur **Relevé** (ou menu d'action <i class="fas fa-ellipsis-v"></i> > **Relevé financier**).
* **Résultat attendu :**
  * La modale s'ouvre instantanément sans aucune erreur.
  * Synthèse financière claire : Loyer contractuel, Montant total versé, Reste à payer.
  * Historique des transactions et reçus.
  * Cliquez sur **Télécharger PDF / Imprimer** pour tester l'export propre du relevé.

### Test 2.3 — Recherche temps réel
* **Action :** Tapez `Mamadou` ou `05 55` dans le champ de recherche de la liste locataires.
* **Résultat attendu :** Filtrage instantané au clavier sans latence.

---

## 📱 MODULE 3 : Espace Terrain & Collecte Mobile
> **Compte à utiliser :** `leonce` / `Leonce2026!`

> 💡 **Mode Démo Mobile :** 
> * Ouvrez `http://localhost:5173` et appuyez sur **`F12`** puis sur l'icône smartphone (mode iPhone / Galaxy).
> * *Ou ouvrez directement l'URL Wi-Fi (ex: `http://192.168.x.x:5173`) sur un vrai smartphone.*

### Test 3.1 — Ergonomie Mobile Spécifique
* **Action :** Déconnectez-vous d'admin et connectez-vous avec `leonce` / `Leonce2026!`.
* **Résultat attendu :**
  * Redirection automatique sur **`/admin/collector`**.
  * **Barre d'onglets inférieure fixe** (*Tournée, Paiements, Profil, Quitter*).
  * **Grille 2×2 compacte des KPIs** (*Locataires assignés, Total collecté, Retards, Taux*).
  * **Cartes locataires tactiles** adaptées à l'écran vertical (fini le tableau illisible sur smartphone).

### Test 3.2 — Appel direct & Tournée terrain
* **Action :** 
  1. Vérifiez que l'onglet **« Ma tournée »** est actif : seuls les locataires assignés à Léonce apparaissent (dont `Mamadou DIABATE`).
  2. Cliquez sur l'onglet **« Tous »** : tous les locataires de l'agence apparaissent.
  3. Revenez sur **« Ma tournée »**.
  4. Repérez le bouton vert avec l'icône téléphone (<i class="fas fa-phone-alt"></i>) sur la carte de `Mamadou DIABATE`.
* **Résultat attendu :** Sur smartphone, ce bouton lance directement l'appel téléphonique vers le locataire.

### Test 3.3 — Encaissement Terrain & Tiroir Bottom-Sheet
* **Action :**
  1. Sur la carte de `Mamadou DIABATE`, cliquez sur le grand bouton **Encaisser**.
  2. Observez le tiroir qui coulisse depuis le bas de l'écran.
  3. Cliquez sur le raccourci **« Tout solder »** : le montant exact du solde restant se préremplit tout seul.
  4. Sélectionnez le mode : **Mobile Money (Wave/OM)** ou **Espèces**.
  5. Saisissez une référence facultative (ex : `Wave #88321`).
  6. Cliquez sur **Valider et signer**.
* **Résultat attendu :** Passage fluide à l'écran de signature locataire.

### Test 3.4 — Signature Électronique au doigt
* **Action :**
  1. Avec le doigt sur smartphone (ou à la souris sur PC), **dessinez une signature** dans le cadre dédié.
  2. Observez le voyant qui passe au vert : **« Signature enregistrée »**.
  3. Cliquez sur **Finaliser le paiement**.
* **Résultat attendu :**
  * Message de succès immédiat.
  * La carte du locataire passe instantanément en **« Soldé / Loyer à jour »** avec coche verte.
  * Le KPI **Total collecté** en haut s'incrémente automatiquement du montant payé.

---

## 📊 MODULE 4 : Supervision & Performance Manager
> **Compte à utiliser :** `manager` / `Mgr2026!`

### Test 4.1 — Tableau de Bord Supervision (`/admin/manager`)
* **Action :** Déconnectez-vous et connectez-vous avec `manager` / `Mgr2026!`.
* **Résultat attendu :**
  * Vue comparative des performances de l'équipe terrain.
  * Taux de recouvrement comparé entre `Léonce YAO` et `Kouassi KOREDE`.
  * Liste des alertes et relances pour impayés.

### Test 4.2 — Réattribution d'un locataire
* **Action :**
  1. Dans la section d'affectation de tournée, sélectionnez un locataire.
  2. Modifiez son collecteur assigné pour le transférer à un autre agent.
* **Résultat attendu :** La tournée du collecteur destinataire est mise à jour en temps réel.

---

## 💰 MODULE 5 : Comptabilité, Trésorerie & Exports
> **Compte à utiliser :** `comptable` / `Cpt2026!` (ou `admin`)

### Test 5.1 — Historique des Transactions (`/admin/transactions`)
* **Action :**
  1. Allez dans **Transactions** dans le menu de gauche.
  2. Repérez la transaction effectuée par Léonce à l'étape 3.
* **Résultat attendu :**
  * La transaction apparaît avec la date, le montant, le mode de paiement et l'agent collecteur associé.
  * Cliquez sur la transaction pour voir le reçu avec la signature électronique capturée.

### Test 5.2 — Export Comptable (Excel / CSV)
* **Action :**
  1. En haut à droite de la liste des transactions, cliquez sur **Exporter (Excel / CSV)**.
* **Résultat attendu :** Le fichier s'exporte instantanément sur votre ordinateur avec l'ensemble des colonnes comptables formatées.

---

## 🔒 MODULE 6 : Sécurité, Déconnexion & Rôles
* **Action :** 
  1. Déconnectez-vous via le bouton rouge **Quitter** (ou menu déconnexion).
  2. Tentez d'accéder manuellement à `http://localhost:5173/admin/dashboard` dans l'URL.
* **Résultat attendu :** Redirection immédiate vers `/login` sans fuite de données en cache (protection des routes privées).
