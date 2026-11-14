-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ Migration 014 : Optimisations de Performance & Index de Sécurité         ║
-- ║ Cible : Élimination des Full Table Scans (Compatible MySQL 8.0 standard) ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- 1. Index sur les tranches de reversements propriétaires (Table sans index secondaires)
CREATE INDEX idx_osi_settlement ON owner_settlement_installments (settlement_id, installment_number);
CREATE INDEX idx_osi_created_by ON owner_settlement_installments (created_by);

-- 2. Index sur les travaux et réparations
CREATE INDEX idx_repairs_property_status ON tenant_repairs (property_id, status);
CREATE INDEX idx_repairs_collector ON tenant_repairs (collector_id);

-- 3. Optimisation des transactions (Historique locataire trié par date)
CREATE INDEX idx_transactions_client_date ON transactions (client_id, date DESC);

-- 4. Index composites sur les clients et propriétés (Vues filtrées par rôle)
CREATE INDEX idx_clients_collector_status ON clients (collector_id, status);
CREATE INDEX idx_clients_owner_status ON clients (owner_id, status);
CREATE INDEX idx_properties_owner_status ON properties (owner_id, status);

-- 5. Nettoyage de l'index doublon et index composite actif sur refresh_tokens
DROP INDEX idx_token ON refresh_tokens;
CREATE INDEX idx_tokens_active_lookup ON refresh_tokens (userId, revokedAt, expiresAt);
