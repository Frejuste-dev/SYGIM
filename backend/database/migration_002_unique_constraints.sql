-- ════════════════════════════════════════════════════════════════════════════
-- MIGRATION 002: Ajout de contraintes UNIQUE sur les emails et téléphones
-- Date: 2026-05-26
-- Description: Assure l'unicité des emails et téléphones pour éviter les doublons
-- ════════════════════════════════════════════════════════════════════════════

USE sygim_db;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USERS: Ajouter UNIQUE sur email (optionnel mais unique si fourni)
-- ─────────────────────────────────────────────────────────────────────────────

-- Nettoyer les doublons d'email avant d'ajouter la contrainte
DELETE FROM users WHERE id NOT IN (
    SELECT id FROM (
        SELECT MIN(id) as id FROM users 
        WHERE email IS NOT NULL AND email != ''
        GROUP BY email
    ) AS temp
) AND email IS NOT NULL AND email != '';

-- Ajouter la contrainte UNIQUE
ALTER TABLE users 
ADD CONSTRAINT unique_users_email 
UNIQUE KEY (email);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. USERS: Ajouter UNIQUE sur phone (optionnel)
-- ─────────────────────────────────────────────────────────────────────────────

-- Nettoyer les doublons de téléphone
DELETE FROM users WHERE id NOT IN (
    SELECT id FROM (
        SELECT MIN(id) as id FROM users 
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY phone
    ) AS temp
) AND phone IS NOT NULL AND phone != '';

-- Ajouter la contrainte UNIQUE
ALTER TABLE users 
ADD CONSTRAINT unique_users_phone 
UNIQUE KEY (phone);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CLIENTS: Ajouter UNIQUE sur phone
-- ─────────────────────────────────────────────────────────────────────────────

-- Nettoyer les doublons
DELETE FROM clients WHERE id NOT IN (
    SELECT id FROM (
        SELECT MIN(id) as id FROM clients 
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY phone
    ) AS temp
) AND phone IS NOT NULL AND phone != '';

-- Ajouter la contrainte UNIQUE
ALTER TABLE clients 
ADD CONSTRAINT unique_clients_phone 
UNIQUE KEY (phone);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. COLLECTORS: Ajouter UNIQUE sur phone
-- ─────────────────────────────────────────────────────────────────────────────

-- Nettoyer les doublons
DELETE FROM collectors WHERE id NOT IN (
    SELECT id FROM (
        SELECT MIN(id) as id FROM collectors 
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY phone
    ) AS temp
) AND phone IS NOT NULL AND phone != '';

-- Ajouter la contrainte
ALTER TABLE collectors 
ADD CONSTRAINT unique_collectors_phone 
UNIQUE KEY (phone);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. OWNERS: Ajouter UNIQUE sur phone (optionnel)
-- ─────────────────────────────────────────────────────────────────────────────

-- Nettoyer les doublons
DELETE FROM owners WHERE id NOT IN (
    SELECT id FROM (
        SELECT MIN(id) as id FROM owners 
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY phone
    ) AS temp
) AND phone IS NOT NULL AND phone != '';

-- Ajouter la contrainte UNIQUE
ALTER TABLE owners 
ADD CONSTRAINT unique_owners_phone 
UNIQUE KEY (phone);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. PREFINANCINGS: S'assurer que reference est bien UNIQUE (déjà défini)
-- ─────────────────────────────────────────────────────────────────────────────

-- Vérifier la contrainte
SHOW CREATE TABLE prefinancings\G

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ════════════════════════════════════════════════════════════════════════════

-- Afficher les contraintes UNIQUE ajoutées
SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME 
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE TABLE_SCHEMA = 'sygim_db' 
  AND CONSTRAINT_NAME LIKE 'unique_%'
ORDER BY TABLE_NAME;

-- ════════════════════════════════════════════════════════════════════════════
-- NOTES
-- ════════════════════════════════════════════════════════════════════════════
-- ✅ Cette migration ajoute les contraintes UNIQUE manquantes
-- ✅ Les emails/phones NULL ne sont pas affectés par UNIQUE en MySQL
-- ✅ Permet de créer plusieurs comptes sans email/phone (optionnels)
-- ✅ Mais si email/phone est fourni, il doit être unique
-- ✅ À exécuter AVANT la livraison production
-- ════════════════════════════════════════════════════════════════════════════
