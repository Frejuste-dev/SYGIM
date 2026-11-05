-- Migration 010: Optimisation des index de la table transactions
-- Objectif: Remplacer les index simples sous-optimaux par des index composés adaptés aux requêtes

-- 1. Ajout des index composés optimisés
CREATE INDEX idx_transactions_collector_status ON transactions(collector_id, status);
CREATE INDEX idx_transactions_status_date ON transactions(status, date);

-- 2. Suppression des index simples devenus redondants
ALTER TABLE transactions DROP INDEX idx_transactions_collector;
ALTER TABLE transactions DROP INDEX idx_transactions_status;
