-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ module: Auth - Refresh Tokens                                   ║
-- ║ auteur: SYGIM Team                                              ║
-- ║ date: 2026-06-16                                                ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS refresh_tokens (
    primaryKey INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    token VARCHAR(512) NOT NULL UNIQUE,
    expiresAt DATETIME NOT NULL,
    revokedAt DATETIME NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_userId (userId),
    CONSTRAINT fk_user_refresh_token FOREIGN KEY (userId) 
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
