/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Configuration Base de Données MySQL           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const mysql = require('mysql2/promise');
const { randomUUID } = require('crypto');
require('dotenv').config();
const Logger = require('../utils/logger/Logger');

const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               process.env.DB_PORT     || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'sygim_db',
    waitForConnections: true,
    connectionLimit:    parseInt(process.env.DB_CONNECTION_LIMIT || '25'),
    queueLimit:         0,
    charset:            'utf8mb4',
    timezone:           '+00:00',
    namedPlaceholders:  true,
});

async function safeAlter(sql) {
    try {
        await pool.query(sql);
    } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060) {
            Logger.debug('Schema alter info: ' + err.message);
        }
    }
}

async function ensureSchemaUpgrades() {
    try {
        // 1. Colonnes de préférences de paiement sur la table owners
        await safeAlter("ALTER TABLE owners ADD COLUMN preferred_payment_method VARCHAR(50) DEFAULT 'bank_transfer'");
        await safeAlter("ALTER TABLE owners ADD COLUMN payout_schedule VARCHAR(50) DEFAULT 'monthly_full'");
        await safeAlter("ALTER TABLE owners ADD COLUMN preferred_payout_day VARCHAR(30) DEFAULT '5'");
        await safeAlter("ALTER TABLE owners ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 10.00");

        // 2. S'assurer que la table owner_settlements existe et possède les colonnes de préfinancement & échelonnement
        await pool.query(`
            CREATE TABLE IF NOT EXISTS owner_settlements (
                id INT AUTO_INCREMENT PRIMARY KEY,
                uuid VARCHAR(36) NOT NULL UNIQUE,
                owner_id INT NOT NULL,
                property_id INT NULL,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                expected_rent DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                total_collected DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
                agency_commission DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                maintenance_deductions DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                net_owner_payout DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                payment_method VARCHAR(50) DEFAULT 'bank_transfer',
                payout_mode VARCHAR(50) DEFAULT 'full',
                is_prefinanced TINYINT(1) NOT NULL DEFAULT 0,
                scheduled_date DATE NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'PAID',
                payout_date DATETIME NULL,
                payout_reference VARCHAR(100) NULL,
                notes TEXT NULL,
                created_by INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await safeAlter("ALTER TABLE owner_settlements MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PAID'");
        await safeAlter("ALTER TABLE owner_settlements ADD COLUMN property_id INT NULL");
        await safeAlter("ALTER TABLE owner_settlements ADD COLUMN expected_rent DECIMAL(12, 2) NOT NULL DEFAULT 0.00");
        await safeAlter("ALTER TABLE owner_settlements ADD COLUMN amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0.00");
        await safeAlter("ALTER TABLE owner_settlements ADD COLUMN payment_method VARCHAR(50) DEFAULT 'bank_transfer'");
        await safeAlter("ALTER TABLE owner_settlements ADD COLUMN payout_mode VARCHAR(50) DEFAULT 'full'");
        await safeAlter("ALTER TABLE owner_settlements ADD COLUMN is_prefinanced TINYINT(1) NOT NULL DEFAULT 0");
        await safeAlter("ALTER TABLE owner_settlements ADD COLUMN scheduled_date DATE NULL");
        await safeAlter("ALTER TABLE owner_settlements ADD COLUMN notes TEXT NULL");
        await safeAlter("ALTER TABLE owner_settlements ADD COLUMN created_by INT NULL");

        // 3. Colonnes de départ sur clients
        await safeAlter("ALTER TABLE clients ADD COLUMN departure_date DATE NULL");
        await safeAlter("ALTER TABLE clients ADD COLUMN departure_reason VARCHAR(255) NULL");
        await safeAlter("ALTER TABLE clients ADD COLUMN departure_notes TEXT NULL");

        // 4. Table des réparations & travaux pris en charge par le locataire
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tenant_repairs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_id INT NOT NULL,
                property_id INT NULL,
                collector_id INT NULL,
                description VARCHAR(255) NOT NULL,
                total_cost DECIMAL(12, 2) NOT NULL,
                deduction_mode VARCHAR(30) NOT NULL DEFAULT 'monthly',
                monthly_deduction DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                reimbursed_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                remaining_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                repair_date DATE NOT NULL,
                receipt_ref VARCHAR(100) NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'IN_PROGRESS',
                notes TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_client_repairs (client_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Exemples de réparations si la table est vide
        const [[{ repairCnt }]] = await pool.query("SELECT COUNT(*) AS repairCnt FROM tenant_repairs");
        if (repairCnt === 0) {
            const [clients] = await pool.query("SELECT id, property_id, collector_id, amount_due FROM clients WHERE status IN ('active', 'pending') LIMIT 2");
            if (clients.length > 0) {
                const c1 = clients[0];
                const totalCost1 = 60000;
                const monthlyDed1 = 20000;
                await pool.query(
                    `INSERT INTO tenant_repairs 
                     (client_id, property_id, collector_id, description, total_cost, deduction_mode, monthly_deduction, reimbursed_amount, remaining_amount, repair_date, receipt_ref, status, notes)
                     VALUES (?, ?, ?, 'Réfection plomberie et tuyauterie salle de bain', ?, 'monthly', ?, 0, ?, CURDATE(), 'FAC-PLOMB-01', 'IN_PROGRESS', 'Réparation validée par le collecteur - déduction de 20 000 FCFA/mois sur 3 mois')`,
                    [c1.id, c1.property_id || null, c1.collector_id || null, totalCost1, monthlyDed1, totalCost1]
                );
            }
        }

        // Table d'historique détaillé des tranches / versements partiels propriétaires
        await pool.query(`
            CREATE TABLE IF NOT EXISTS owner_settlement_installments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                settlement_id INT NOT NULL,
                installment_number INT NOT NULL DEFAULT 1,
                amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
                payment_method VARCHAR(50) DEFAULT 'bank_transfer',
                payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reference VARCHAR(100) NULL,
                notes TEXT NULL,
                created_by INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Initialiser les tranches pour les règlements existants qui n'en ont pas encore
        const [[{ instCnt }]] = await pool.query("SELECT COUNT(*) AS instCnt FROM owner_settlement_installments");
        if (instCnt === 0) {
            const [existingSettlements] = await pool.query("SELECT id, amount_paid, payment_method, payout_date, created_at, payout_reference, notes FROM owner_settlements WHERE amount_paid > 0");
            for (const s of existingSettlements) {
                await pool.query(
                    `INSERT INTO owner_settlement_installments (settlement_id, installment_number, amount, payment_method, payment_date, reference, notes)
                     VALUES (?, 1, ?, ?, COALESCE(?, ?), ?, ?)`,
                    [s.id, s.amount_paid, s.payment_method || 'bank_transfer', s.payout_date, s.created_at, s.payout_reference || `TR-1-${s.id}`, s.notes || '1er versement']
                );
            }
        }

        // 3. Initialiser quelques règlements propriétaires exemples si la table est vide
        const [[{ cnt }]] = await pool.query("SELECT COUNT(*) AS cnt FROM owner_settlements");
        if (cnt === 0) {
            const [owners] = await pool.query("SELECT id, first_name, last_name FROM owners ORDER BY id ASC LIMIT 3");
            if (owners.length > 0) {
                const now = new Date();
                const pStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                const pEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

                // Exemple 1 : Reversement intégral normal
                await pool.query(
                    `INSERT INTO owner_settlements 
                     (uuid, owner_id, period_start, period_end, expected_rent, total_collected, commission_rate, agency_commission, net_owner_payout, amount_paid, payment_method, payout_mode, is_prefinanced, scheduled_date, status, payout_date, payout_reference, notes)
                     VALUES (?, ?, ?, ?, 450000, 450000, 10, 45000, 405000, 405000, 'bank_transfer', 'full', 0, ?, 'PAID', NOW(), 'REV-2026-001', 'Reversement mensuel intégral par virement bancaire')`,
                    [randomUUID(), owners[0].id, pStart, pEnd, pStart]
                );

                // Exemple 2 : Préfinancement (locataire en retard, le comptable avance au propriétaire)
                if (owners[1]) {
                    await pool.query(
                        `INSERT INTO owner_settlements 
                         (uuid, owner_id, period_start, period_end, expected_rent, total_collected, commission_rate, agency_commission, net_owner_payout, amount_paid, payment_method, payout_mode, is_prefinanced, scheduled_date, status, payout_date, payout_reference, notes)
                         VALUES (?, ?, ?, ?, 300000, 0, 10, 30000, 270000, 270000, 'mobile_money', 'prefinancing', 1, ?, 'PREFINANCED', NOW(), 'PREF-2026-002', 'Préfinancement agence (locataire en retard de paiement)')`,
                        [randomUUID(), owners[1].id, pStart, pEnd, pStart]
                    );
                }

                // Exemple 3 : Paiement échelonné (1ère tranche versée)
                if (owners[2]) {
                    await pool.query(
                        `INSERT INTO owner_settlements 
                         (uuid, owner_id, period_start, period_end, expected_rent, total_collected, commission_rate, agency_commission, net_owner_payout, amount_paid, payment_method, payout_mode, is_prefinanced, scheduled_date, status, payout_date, payout_reference, notes)
                         VALUES (?, ?, ?, ?, 500000, 500000, 10, 50000, 450000, 250000, 'cheque', 'installment', 0, ?, 'PARTIAL', NOW(), 'ECH-2026-003', 'Paiement échelonné - 1er acompte versé (reste 200 000 FCFA)')`,
                        [randomUUID(), owners[2].id, pStart, pEnd, pStart]
                    );
                }
            }
        }

        Logger.info('✅ Schéma financier (Propriétaires, Reversements & Préfinancements) vérifié.');
    } catch (err) {
        Logger.error('Erreur lors de la vérification du schéma financier', err);
    }
}

// Exécuter la mise à niveau du schéma au chargement uniquement si expressément activé via variable d'environnement (SEC-12)
if (process.env.RUN_AUTO_DDL === 'true') {
    ensureSchemaUpgrades();
}

// Test de connexion au démarrage
async function testConnection() {
    try {
        const conn = await pool.getConnection();
        Logger.info('MySQL connecté avec succès', { database: process.env.DB_NAME || 'sygim_db' });
        conn.release();
        return true;
    } catch (err) {
        Logger.error('Erreur connexion MySQL', err, {
            code: err.code,
            errno: err.errno,
            sqlState: err.sqlState
        });
        return false;
    }
}

module.exports = { pool, testConnection, ensureSchemaUpgrades };

