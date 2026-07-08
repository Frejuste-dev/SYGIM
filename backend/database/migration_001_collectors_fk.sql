-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Conversion clients.agent (STRING) → collector_id (FK)
-- ═══════════════════════════════════════════════════════════════
-- Date : 26 mars 2026
-- Objectif : Harmoniser la gestion des collecteurs (récolteurs)
-- ═══════════════════════════════════════════════════════════════

USE sygim_db;

-- ÉTAPE 1 : Ajouter la nouvelle colonne si elle n'existe pas
ALTER TABLE clients
ADD COLUMN collector_id INT DEFAULT NULL AFTER agent,
ADD CONSTRAINT fk_clients_collector FOREIGN KEY (collector_id) REFERENCES collectors(id) ON DELETE SET NULL;

-- ÉTAPE 2 : Migrer les données existantes
-- Mapper les noms de collecteurs (agent STRING) vers leurs IDs
UPDATE clients c
SET c.collector_id = (
    SELECT coll.id 
    FROM collectors coll 
    LEFT JOIN users u ON coll.user_id = u.id
    WHERE c.agent != '' 
    AND c.agent IS NOT NULL
    AND (
        CONCAT(coll.first_name, ' ', coll.last_name) = c.agent 
        OR u.collector_name = c.agent
        OR u.username = c.agent
    )
    LIMIT 1
)
WHERE c.agent IS NOT NULL AND c.agent != '';

-- ÉTAPE 3 : Indexer la nouvelle colonne pour les performances
ALTER TABLE clients
ADD INDEX idx_clients_collector (collector_id);

-- ÉTAPE 4 : Supprimer l'ancienne colonne après vérification manuelle
-- À exécuter après vérification :
-- ALTER TABLE clients DROP COLUMN agent;

-- ═══════════════════════════════════════════════════════════════
-- NOTES :
-- • La colonne 'agent' est conservée pendant la phase de transition
-- • Une fois vérifiée, supprimer la colonne agent
-- • Tous les nouveaux clients utiliseront collector_id
-- ═══════════════════════════════════════════════════════════════
