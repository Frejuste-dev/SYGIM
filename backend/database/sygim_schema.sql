

-- Création de la base de données
-- CREATE DATABASE IF NOT EXISTS sygim_db
--     CHARACTER SET utf8mb4
--     COLLATE utf8mb4_unicode_ci;

-- USE sygim_db;

-- ───────────────────────────────────────────────────────────────
-- TABLE 1 : UTILISATEURS (Authentification + Rôles)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(100)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    role            ENUM('admin','director','accounting','collector_manager','collector')
                                    NOT NULL DEFAULT 'collector',
    first_name      VARCHAR(100)    NOT NULL DEFAULT '',
    last_name       VARCHAR(100)    NOT NULL DEFAULT '',
    display_name    VARCHAR(200)    NOT NULL DEFAULT '',
    avatar          VARCHAR(10)     NOT NULL DEFAULT '',
    email           VARCHAR(255)    DEFAULT NULL,
    phone           VARCHAR(30)     DEFAULT NULL,
    collector_name  VARCHAR(100)    DEFAULT NULL,
    active          TINYINT(1)      NOT NULL DEFAULT 1,
    last_login      DATETIME        DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    username_normalized VARCHAR(255) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS (lower(`username`)) STORED,
    deletedAt       DATETIME        DEFAULT NULL,

    INDEX idx_users_role    (role),
    INDEX idx_users_active  (active)
) ENGINE=InnoDB;

-- TABLE 2 : PROPRIÉTAIRES
-- 
CREATE TABLE IF NOT EXISTS owners (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(100)    NOT NULL DEFAULT '',
    last_name       VARCHAR(100)    NOT NULL,
    display_name    VARCHAR(200)    DEFAULT NULL,
    phone           VARCHAR(30)     DEFAULT NULL,
    email           VARCHAR(255)    DEFAULT NULL,
    address         TEXT            DEFAULT NULL,
    id_number       VARCHAR(50)     DEFAULT NULL COMMENT 'Numéro pièce identité',
    bank_name       VARCHAR(100)    DEFAULT NULL,
    bank_account    VARCHAR(50)     DEFAULT NULL,
    notes           TEXT            DEFAULT NULL,
    active          TINYINT(1)      NOT NULL DEFAULT 1,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_owners_active (active)
) ENGINE=InnoDB;

-- TABLE 3 : RÉCOLTEURS / AGENTS TERRAIN

CREATE TABLE IF NOT EXISTS collectors (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(100)    NOT NULL DEFAULT '',
    last_name       VARCHAR(100)    NOT NULL,
    phone           VARCHAR(30)     DEFAULT NULL,
    email           VARCHAR(255)    DEFAULT NULL,
    zone            VARCHAR(200)    DEFAULT NULL COMMENT 'Zone géographique assignée',
    commission_rate DECIMAL(5,2)    DEFAULT 0.00 COMMENT 'Taux de commission en %',
    active          TINYINT(1)      NOT NULL DEFAULT 1,
    user_id         INT             DEFAULT NULL COMMENT 'Lien vers le compte utilisateur',
    manager_id      INT             DEFAULT NULL COMMENT 'Référence au gestionnaire (users.id)',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt       DATETIME        DEFAULT NULL,

    INDEX idx_collectors_active  (active),
    INDEX idx_collectors_user    (user_id),
    INDEX idx_collectors_manager (manager_id),
    CONSTRAINT fk_collectors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- TABLE 4 : PROPRIÉTÉS / BIENS IMMOBILIERS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(200)    NOT NULL,
    address         TEXT            NOT NULL,
    type            VARCHAR(50)     NOT NULL DEFAULT 'appartement'
                                    COMMENT 'appartement, maison, terrain, commercial, etc.',
    status          VARCHAR(30)     NOT NULL DEFAULT 'vacant'
                                    COMMENT 'vacant, loue, en_renovation, vendu',
    value           DECIMAL(15,2)   DEFAULT 0.00 COMMENT 'Valeur du bien en XOF',
    rent            DECIMAL(12,2)   DEFAULT 0.00 COMMENT 'Loyer mensuel en XOF',
    area            DECIMAL(10,2)   DEFAULT NULL COMMENT 'Surface en m²',
    rooms           INT             DEFAULT NULL COMMENT 'Nombre de pièces',
    description     TEXT            DEFAULT NULL,
    image_url       VARCHAR(500)    DEFAULT NULL,
    owner_id        INT             DEFAULT NULL,
    tenant_id       INT             DEFAULT NULL COMMENT 'Locataire actuel (si loué)',
    collector_id    INT             DEFAULT NULL COMMENT 'Récolteur assigné',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_properties_status    (status),
    INDEX idx_properties_type      (type),
    INDEX idx_properties_owner     (owner_id),
    INDEX idx_properties_tenant    (tenant_id),
    INDEX idx_properties_collector (collector_id),
    CONSTRAINT fk_properties_owner     FOREIGN KEY (owner_id)     REFERENCES owners(id) ON DELETE SET NULL,
    CONSTRAINT fk_properties_collector FOREIGN KEY (collector_id) REFERENCES collectors(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- TABLE 5 : CLIENTS / LOCATAIRES
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(100)    NOT NULL DEFAULT '',
    last_name       VARCHAR(100)    NOT NULL,
    phone           VARCHAR(30)     DEFAULT NULL,
    email           VARCHAR(255)    DEFAULT NULL,
    address         TEXT            DEFAULT NULL,
    property_id     INT             DEFAULT NULL,
    property_name   VARCHAR(200)    DEFAULT NULL COMMENT 'Cache du nom du bien pour affichage rapide',
    property_value  DECIMAL(15,2)   DEFAULT 0.00,
    amount_due      DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT 'Loyer mensuel dû',
    amount_paid     DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT 'Montant payé ce mois',
    payment_method  VARCHAR(50)     DEFAULT '',
    status          VARCHAR(30)     NOT NULL DEFAULT 'pending'
                                    COMMENT 'pending, partial, paid, late, inactive',
    agent           VARCHAR(100)    DEFAULT '' COMMENT 'Nom du récolteur assigné (rétro-compat)',
    collector_id    INT             DEFAULT NULL COMMENT 'FK vers le récolteur assigné',
    owner_id        INT             DEFAULT NULL,
    deposit         DECIMAL(12,2)   DEFAULT 0.00 COMMENT 'Caution versée',
    advance_payment DECIMAL(12,2)   DEFAULT 0.00 COMMENT 'Paiement anticipé',
    contract_start  DATE            DEFAULT NULL,
    contract_end    DATE            DEFAULT NULL,
    departure_reason VARCHAR(200)   DEFAULT NULL,
    departure_notes TEXT            DEFAULT NULL,
    join_date       VARCHAR(20)     DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_clients_status   (status),
    INDEX idx_clients_agent    (agent),
    INDEX idx_clients_property (property_id),
    INDEX idx_clients_owner    (owner_id),
    INDEX idx_clients_collector (collector_id),
    CONSTRAINT fk_clients_property  FOREIGN KEY (property_id)  REFERENCES properties(id)  ON DELETE SET NULL,
    CONSTRAINT fk_clients_owner     FOREIGN KEY (owner_id)     REFERENCES owners(id)      ON DELETE SET NULL,
    CONSTRAINT fk_clients_collector FOREIGN KEY (collector_id) REFERENCES collectors(id)  ON DELETE SET NULL
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- TABLE 6 : TRANSACTIONS / PAIEMENTS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    reference       VARCHAR(100)    DEFAULT NULL COMMENT 'Référence unique (REC-xxx, REPL-xxx, etc.)',
    date            DATE            NOT NULL,
    date_display    VARCHAR(20)     DEFAULT NULL COMMENT 'Date formatée fr-FR pour compatibilité',
    client_id       INT             DEFAULT NULL,
    client_name     VARCHAR(200)    DEFAULT NULL COMMENT 'Nom du client pour affichage rapide',
    description     TEXT            DEFAULT NULL,
    amount          DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
    method          VARCHAR(50)     DEFAULT NULL
                                    COMMENT 'cash, bank_transfer, mobile_money, check, card, custom, replacement',
    status          VARCHAR(30)     NOT NULL DEFAULT 'pending'
                                    COMMENT 'pending, processed, cancelled, refunded',
    payment_type    VARCHAR(50)     DEFAULT NULL COMMENT 'acompte, avance, echeance, custom, etc.',
    due_date        DATE            DEFAULT NULL,
    notes           TEXT            DEFAULT NULL,
    collector_id    INT             DEFAULT NULL COMMENT 'Récolteur qui a encaissé',
    signature_data  TEXT            DEFAULT NULL COMMENT 'Données de signature base64',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_transactions_date       (date),
    INDEX idx_transactions_client     (client_id),
    INDEX idx_transactions_status_date (status, date),
    INDEX idx_transactions_method     (method),
    INDEX idx_transactions_reference  (reference),
    INDEX idx_transactions_collector_status (collector_id, status),
    CONSTRAINT fk_transactions_client    FOREIGN KEY (client_id)    REFERENCES clients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_transactions_collector FOREIGN KEY (collector_id) REFERENCES collectors(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- TABLE 7 : JOURNAL D'ACTIVITÉ
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    type            VARCHAR(50)     NOT NULL COMMENT 'login, payment, create, update, delete, etc.',
    message         TEXT            NOT NULL,
    user_id         INT             DEFAULT NULL,
    user_name       VARCHAR(200)    DEFAULT NULL,
    ip_address      VARCHAR(45)     DEFAULT NULL,
    date            DATE            NOT NULL,
    time            TIME            NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_logs_type   (type),
    INDEX idx_logs_date   (date),
    INDEX idx_logs_user   (user_id),
    CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- TABLE 8 : PRÉFINANCEMENTS
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prefinancings (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    reference       VARCHAR(100)    NOT NULL UNIQUE COMMENT 'Numéro de préfinancement (PREF-xxx)',
    property_id     INT             DEFAULT NULL,
    owner_id        INT             DEFAULT NULL,
    amount          DECIMAL(15,2)   NOT NULL DEFAULT 0.00 COMMENT 'Montant préfinancé en XOF',
    interest_rate   DECIMAL(5,2)    DEFAULT 0.00 COMMENT 'Taux d\'intérêt en %',
    start_date      DATE            NOT NULL,
    end_date        DATE            DEFAULT NULL COMMENT 'Date de fin prévue',
    actual_end_date DATE            DEFAULT NULL COMMENT 'Date de fin réelle (remboursement)',
    amount_repaid   DECIMAL(15,2)   DEFAULT 0.00 COMMENT 'Montant remboursé',
    status          VARCHAR(30)     NOT NULL DEFAULT 'active'
                                    COMMENT 'active, completed, overdue, cancelled',
    notes           TEXT            DEFAULT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_prefinancings_status   (status),
    INDEX idx_prefinancings_owner    (owner_id),
    INDEX idx_prefinancings_property (property_id),
    INDEX idx_prefinancings_date     (start_date),
    CONSTRAINT fk_prefinancings_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    CONSTRAINT fk_prefinancings_owner    FOREIGN KEY (owner_id)    REFERENCES owners(id)     ON DELETE SET NULL
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────────────────────
-- TABLE 9 : PARAMÈTRES DE L'APPLICATION
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    setting_key     VARCHAR(100)    NOT NULL UNIQUE,
    setting_value   TEXT            DEFAULT NULL,
    description     VARCHAR(255)    DEFAULT NULL,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- TABLE : Acquittement des alertes
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alert_acknowledgements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    client_id       INT NOT NULL,
    acknowledged_by INT NOT NULL,
    acknowledged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_alert_client_user (client_id, acknowledged_by),
    CONSTRAINT fk_alert_ack_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_ack_user   FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- TABLE : Refresh Tokens
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS refresh_tokens (
    primaryKey      INT AUTO_INCREMENT PRIMARY KEY,
    userId          INT NOT NULL,
    token           VARCHAR(512) NOT NULL UNIQUE,
    expiresAt       DATETIME NOT NULL,
    revokedAt       DATETIME DEFAULT NULL,
    createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_userId (userId),
    CONSTRAINT fk_user_refresh_token FOREIGN KEY (userId) 
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ═══════════════════════════════════════════════════════════════
-- DONNÉES INITIALES
-- ═══════════════════════════════════════════════════════════════

-- Compte administrateur par défaut
-- Mot de passe : Admin2026! (hashé avec bcrypt)
INSERT INTO users (username, password_hash, role, first_name, last_name, display_name, avatar, active)
VALUES ('admin', '$2a$10$placeholder_will_be_set_by_seed', 'admin', 'Super', 'Admin', 'Administrateur', 'ADM', 1);

-- Paramètres par défaut
INSERT INTO settings (setting_key, setting_value, description) VALUES
    ('app_name', 'SYGIM', 'Nom de l\'application'),
    ('currency', 'XOF', 'Devise par défaut'),
    ('maintenance_mode', '0', 'Mode maintenance (0=off, 1=on)'),
    ('min_rent', '10000', 'Loyer minimum autorisé'),
    ('commission_default', '5.00', 'Taux de commission par défaut (%)'),
    ('auto_save_interval', '120', 'Intervalle de sauvegarde auto en secondes');
