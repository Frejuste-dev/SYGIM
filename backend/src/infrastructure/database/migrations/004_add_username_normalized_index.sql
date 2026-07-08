-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ module: Auth - Performance Optimization                         ║
-- ║ auteur: SYGIM Team                                              ║
-- ║ date: 2026-06-16                                                ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE users 
ADD COLUMN username_normalized VARCHAR(255) 
GENERATED ALWAYS AS (LOWER(username)) STORED;

CREATE INDEX idx_username_normalized ON users(username_normalized);
