-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ Migration 017 : Historique d'Attribution des Biens aux Locataires        ║
-- ║ Cible : Suivi des baux, réattributions et libérations par le Manager     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS property_tenant_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  owner_id INT NULL,
  previous_client_id INT NULL,
  new_client_id INT NULL,
  action_type ENUM('INITIAL_ASSIGNMENT', 'REASSIGNMENT', 'DEPARTURE') NOT NULL DEFAULT 'INITIAL_ASSIGNMENT',
  rent_amount DECIMAL(15,2) NULL,
  performed_by INT NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pta_prop_created (property_id, created_at DESC),
  INDEX idx_pta_client (new_client_id),
  INDEX idx_pta_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialiser l'historique avec les baux actifs existants
INSERT INTO property_tenant_assignments (property_id, owner_id, new_client_id, action_type, rent_amount, performed_by, notes, created_at)
SELECT 
  c.property_id, 
  p.owner_id, 
  c.id, 
  'INITIAL_ASSIGNMENT', 
  COALESCE(c.amount_due, p.rent, 0), 
  p.assigned_by, 
  'Bail actif existant', 
  COALESCE(c.created_at, NOW())
FROM clients c
JOIN properties p ON c.property_id = p.id
WHERE c.status != 'inactive' AND c.property_id IS NOT NULL;
