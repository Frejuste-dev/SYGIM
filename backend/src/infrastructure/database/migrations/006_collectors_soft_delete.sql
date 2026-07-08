-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ module: Collectors - Soft Delete                                ║
-- ║ auteur: SYGIM Team                                              ║
-- ║ date: 2026-06-16                                                ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE collectors
  ADD COLUMN deletedAt DATETIME NULL DEFAULT NULL,
  ADD INDEX idx_collectors_deleted (deletedAt);
