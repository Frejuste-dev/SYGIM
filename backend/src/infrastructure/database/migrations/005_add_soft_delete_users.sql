-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ module: Users - Soft Delete                                     ║
-- ║ auteur: SYGIM Team                                              ║
-- ║ date: 2026-06-16                                                ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE users ADD COLUMN deletedAt DATETIME NULL;

CREATE INDEX idx_users_deletedAt ON users(deletedAt);
