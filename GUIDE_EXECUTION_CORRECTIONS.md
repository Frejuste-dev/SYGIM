# 🚀 GUIDE D'EXÉCUTION - Corrections du 26 mai 2026

## ⏱️ Durée Estimée: 15-20 minutes

---

## 📋 PRÉ-REQUIS

- ✅ Node.js installé (npm)
- ✅ MySQL en cours d'exécution
- ✅ Base de données `sygim_db` créée
- ✅ Backend accessible sur `http://localhost:5000`

---

## 🔧 ÉTAPES D'EXÉCUTION

### ÉTAPE 1: Arrêter le serveur actuel (si en cours)

```bash
# Terminal où le serveur tourne
Ctrl+C

# Attendre quelques secondes...
```

### ÉTAPE 2: Appliquer la migration BD (UNIQUE constraints)

**Option A: Ligne de commande MySQL**

```bash
# Ouvrir MySQL
mysql -u root -p

# Entrer votre mot de passe

# Exécuter la migration
source backend/database/migration_002_unique_constraints.sql
```

**Option B: Via une application MySQL**

1. Ouvrir MySQL Workbench ou phpMyAdmin
2. Ouvrir la base `sygim_db`
3. Importer le fichier `backend/database/migration_002_unique_constraints.sql`
4. Exécuter

**Résultat attendu**:
```
✅ Query OK, 0 rows affected (0.00 sec)
✅ Contraintes UNIQUE ajoutées
```

---

### ÉTAPE 3: Vérifier les contraintes

```sql
-- Dans MySQL, vérifier:
SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME 
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'sygim_db' 
  AND CONSTRAINT_NAME LIKE 'unique_%'
ORDER BY TABLE_NAME;

-- Résultat attendu:
-- unique_users_email      | users
-- unique_users_phone      | users
-- unique_clients_phone    | clients
-- unique_collectors_phone | collectors
-- unique_owners_phone     | owners
```

---

### ÉTAPE 4: Redémarrer le serveur backend

```bash
# Dans le dossier du projet
cd backend

# Vérifier que npm et les dépendances sont installés
npm install

# Lancer le serveur
npm start

# Vous devriez voir:
# ✅ Serveur démarré sur le port 5000
# ✅ Connecté à MySQL sygim_db
# ✅ Routes chargées
```

---

### ÉTAPE 5: Ouvrir un 2ème terminal pour les tests

```bash
# Dans le même dossier racine (joa APP - envoieZIP)
# Ouvrir un NOUVEAU terminal (pas dans le dossier backend)

# Lancer les tests
node backend/test-corrections.js

# Attendre quelques secondes pour les résultats...
```

---

## ✅ RÉSULTATS ATTENDUS

### Après l'étape 2 (Migration BD)

```
✅ Contraintes UNIQUE appliquées
✅ Aucune erreur de syntaxe SQL
✅ Base de données mise à jour
```

### Après l'étape 4 (Backend démarré)

```
Listening on port 5000
✅ Routes d'authentification chargées
✅ Routes clients chargées
✅ Routes transactions chargées
```

### Après l'étape 5 (Tests)

```
🧪 SYGIM — Tests des Corrections

📌 Test 1: Connectivité du serveur
✅ Serveur répond

📌 Test 2: Route POST /api/auth/register
✅ Status 201 (Created)
✅ Retourne success: true
✅ Retourne un token JWT
✅ Retourne user avec ID
✅ Utilisateur a rôle "collector"

📌 Test 3: Validation du format email
✅ Rejette email invalide (400)
✅ Message d'erreur mentionné "email invalide"

📌 Test 4: Validation du mot de passe
✅ Rejette mot de passe < 6 chars (400)

📌 Test 5: Prévention des doublons - username
✅ Rejette username dupliqué (409)
✅ Message d'erreur mentionné "déjà existe"

📌 Test 6: Login avec nouvel utilisateur
✅ Status 200 (OK)
✅ Retourne success: true
✅ Retourne un token
✅ User a même ID qu'à l'inscription

📌 Test 7: Endpoint /api/auth/me
✅ Status 200 avec token valide
✅ Retourne user data

📌 Test 8: Authentification requise
✅ Status 401 sans token

📌 Test 9: Validation client
✅ Rejette phone invalide

📌 Test 10: Logout
✅ Logout retourne success

📊 RÉSUMÉ
   Tests passés: 20/20

✅ TOUS LES TESTS SONT PASSÉS!
```

---

## 🐛 DÉPANNAGE

### Problème: Tests ne trouvent pas le serveur

```
❌ Erreur: ECONNREFUSED

Solution:
→ Vérifier que npm start est en cours
→ Vérifier que le port 5000 est accessible
→ Attendre 2-3 secondes après npm start
→ Relancer les tests
```

### Problème: Erreur "Table 'sygim_db' doesn't exist"

```
Solution:
→ Créer la BD: mysql -u root -p < backend/database/sygim_schema.sql
→ Puis relancer les tests
```

### Problème: Erreur "Unique constraint failed"

```
✅ C'est normal! Cela veut dire que les contraintes fonctionnent
→ Relancer les tests (ils créent des usernames uniques avec Date.now())
```

### Problème: Status 403 au lieu de 400 sur certains tests

```
Solution:
→ L'utilisateur n'a pas la permission (rôle collector)
→ Les tests clients (POST) nécessitent admin/director
→ C'est une limitation normale de l'API
```

---

## 📊 VÉRIFICATION MANUELLE

### Test 1: Inscription publique

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john.collector",
    "password": "Test1234",
    "firstName": "John",
    "lastName": "Collector",
    "email": "john@example.com",
    "phone": "+223 70 00 00 00"
  }'

# Résultat attendu:
{
  "success": true,
  "token": "eyJ...",
  "user": {
    "id": 1,
    "username": "john.collector",
    "role": "collector"
  }
}
```

### Test 2: Duplicate rejection

```bash
# Réutiliser le même email/phone
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jane.collector",
    "password": "Test1234",
    "email": "john@example.com"  # ← Même email!
  }'

# Résultat attendu:
{
  "success": false,
  "error": "Cet email est déjà utilisé"
}
```

### Test 3: Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john.collector",
    "password": "Test1234"
  }'

# Résultat attendu:
{
  "success": true,
  "token": "eyJ...",
  "user": { ... }
}
```

---

## ✨ APRÈS LA CORRECTION

### Vérifications recommandées

- [ ] Tester l'inscription en frontend
- [ ] Tester le login avec plusieurs comptes
- [ ] Vérifier que les validations email/phone fonctionnent
- [ ] Créer un client avec validation de phone
- [ ] Tester que les doublons sont rejetés
- [ ] Vérifier les messages d'erreur

### Avant d'aller en production

- [ ] Exécuter `node backend/test-corrections.js` ✅ Tous passent
- [ ] Vérifier `.env` avec les bons secrets
- [ ] Vérifier les permissions des utilisateurs
- [ ] Tester avec des données réelles
- [ ] Faire un backup de la BD
- [ ] Exécuter `cleanup_production.bat`

---

## 📞 SUPPORT

### Si les tests échouent

1. **Vérifier les logs du serveur**
   ```bash
   # Regarder la sortie de npm start
   # Chercher les erreurs rouges ou avertissements
   ```

2. **Vérifier MySQL**
   ```bash
   # Vérifier la connexion
   mysql -u root -p sygim_db
   # Afficher les tables
   SHOW TABLES;
   # Vérifier les contraintes
   SHOW INDEX FROM users;
   ```

3. **Redémarrer complètement**
   ```bash
   # Arrêter le serveur: Ctrl+C
   # Attendre 5 secondes
   # Relancer: npm start
   # Relancer les tests
   ```

---

**Créé le**: 26 mai 2026  
**Version**: 1.0.0  
**État**: ✅ PRÊT À EXÉCUTER
