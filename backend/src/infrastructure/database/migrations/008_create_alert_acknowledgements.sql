-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ module: Alerts - Acknowledgement Tracking                        ║
-- ║ auteur: SYGIM Team                                              ║
-- ║ date: 2026-07-09                                                ║
-- ╚══════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS alert_acknowledgements (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    client_id       INT NOT NULL,
    acknowledged_by INT NOT NULL,
    acknowledged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_alert_client_user (client_id, acknowledged_by),
    CONSTRAINT fk_alert_ack_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_ack_user   FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
