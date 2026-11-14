-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ Migration 015 : Module Manager, Attributions, Audit & Notifications      ║
-- ║ Cible : Support complet du rôle Manager & Traçabilité immuable (MySQL 8) ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- 1. Évolution de la table `properties`
ALTER TABLE properties
  MODIFY COLUMN owner_id INT NULL,
  ADD COLUMN reference_code VARCHAR(50) NULL AFTER id,
  ADD COLUMN zone VARCHAR(120) NULL AFTER address,
  ADD COLUMN assigned_at DATETIME NULL AFTER owner_id,
  ADD COLUMN assigned_by INT NULL AFTER assigned_at;

-- Remplissage des codes de référence et dates d'attribution pour les biens existants
UPDATE properties 
SET reference_code = CONCAT('BIEN-', LPAD(id, 3, '0')) 
WHERE reference_code IS NULL;

ALTER TABLE properties
  ADD UNIQUE INDEX uq_properties_reference_code (reference_code);

UPDATE properties 
SET assigned_at = created_at 
WHERE owner_id IS NOT NULL AND assigned_at IS NULL;

-- 2. Table d'historique des attributions & réattributions de biens
CREATE TABLE IF NOT EXISTS property_owner_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  previous_owner_id INT NULL,
  new_owner_id INT NOT NULL,
  action_type ENUM('INITIAL_ASSIGNMENT', 'REASSIGNMENT', 'MODIFICATION') NOT NULL DEFAULT 'INITIAL_ASSIGNMENT',
  performed_by INT NOT NULL,
  notes VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_poa_property_created (property_id, created_at DESC),
  INDEX idx_poa_new_owner (new_owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table de journalisation immuable des activités Manager
CREATE TABLE IF NOT EXISTS manager_activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  operation_type VARCHAR(60) NOT NULL,
  operation_label VARCHAR(120) NOT NULL,
  property_id INT NULL,
  property_ref VARCHAR(60) NULL,
  owner_id INT NULL,
  owner_name VARCHAR(150) NULL,
  target_summary VARCHAR(255) NOT NULL,
  description TEXT NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  status ENUM('SUCCESS', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mal_user_created (user_id, created_at DESC),
  INDEX idx_mal_operation_type (operation_type),
  INDEX idx_mal_property_ref (property_ref),
  INDEX idx_mal_owner_name (owner_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table des notifications utilisateur
CREATE TABLE IF NOT EXISTS user_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('SUCCESS', 'INFO', 'WARNING', 'ERROR') NOT NULL DEFAULT 'SUCCESS',
  category VARCHAR(50) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  reference_link VARCHAR(255) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_un_user_read_created (user_id, is_read, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
