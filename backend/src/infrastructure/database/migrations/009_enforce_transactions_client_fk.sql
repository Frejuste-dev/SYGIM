-- Migration 009: Renforcement de la clé étrangère transactions.client_id
-- Objectif: Remplacer le comportement ON DELETE SET NULL par ON DELETE RESTRICT
-- pour garantir que l'historique financier d'un client supprimé est protégé.

-- 1. Supprimer l'ancienne contrainte FK (SET NULL)
ALTER TABLE transactions DROP FOREIGN KEY fk_transactions_client;

-- 2. Ajouter la nouvelle contrainte FK (RESTRICT)
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT;
