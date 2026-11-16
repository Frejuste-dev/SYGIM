-- 018_owner_situation_fields.sql
-- SYGIM Migration: Ajout des champs d'étage et type d'unité pour le document officiel de Situation Propriétaire (Cabinet Me DOUHO MAXIME)

ALTER TABLE properties
  ADD COLUMN floor_level VARCHAR(60) NULL AFTER type,
  ADD COLUMN unit_type VARCHAR(80) NULL AFTER floor_level;

CREATE INDEX idx_properties_owner_floor ON properties(owner_id, floor_level);
