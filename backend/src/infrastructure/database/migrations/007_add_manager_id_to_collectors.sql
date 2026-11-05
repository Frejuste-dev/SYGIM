-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ module: Collectors - Manager Assignment                          ║
-- ║ auteur: SYGIM Team                                              ║
-- ║ date: 2026-07-09                                                ║
-- ╚══════════════════════════════════════════════════════════════════╝

ALTER TABLE collectors
  ADD COLUMN manager_id INT DEFAULT NULL,
  ADD INDEX idx_collectors_manager (manager_id);
