-- Migration: Ajout des colonnes de validation comptable sur les transactions
-- Permet au comptable de valider formellement la réception physique des fonds collectés sur le terrain

ALTER TABLE `transactions`
  ADD COLUMN IF NOT EXISTS `validated_by` INT NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `validated_at` DATETIME NULL AFTER `validated_by`;

-- Indexation pour accélérer les requêtes de filtrage des transactions en attente de validation
CREATE INDEX IF NOT EXISTS `idx_transactions_status_collector` ON `transactions` (`status`, `collector_id`);

