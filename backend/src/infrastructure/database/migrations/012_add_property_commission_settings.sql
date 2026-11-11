-- Migration 012: Ajout des paramètres de commission par bien immobilier
-- Permet de définir soit un pourcentage (%) soit un montant fixe (FCFA) pour chaque bien

ALTER TABLE properties
  ADD COLUMN commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage' AFTER rent,
  ADD COLUMN commission_rate DECIMAL(5,2) NOT NULL DEFAULT 10.00 AFTER commission_type,
  ADD COLUMN commission_fixed_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER commission_rate;
